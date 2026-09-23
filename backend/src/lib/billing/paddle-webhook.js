/**
 * Paddle webhook dispatcher — the single ingress that turns signed Paddle events
 * into WingCaster state. Paddle is the source of truth for money; this maps its
 * events onto our entitlement records:
 *
 *   subscription.created/updated/activated  -> public.tenant_subscriptions (via lifecycle)
 *   subscription.canceled                   -> end the subscription
 *   customer.created/updated                -> refresh the tenant<->customer email mirror
 *   transaction.completed (kind=topup)      -> grant credits into public.credit_wallets
 *
 * Credit CYCLE grants stay with the billing-cycle worker — Paddle drives status
 * and plan only, so a renewal never double-grants here.
 *
 * Idempotency: subscription upserts converge (keyed by paddle_subscription_id);
 * top-up grants are idempotent on the Paddle transaction id. We therefore do not
 * rely on event ordering.
 */
import { verifyPaddleSignature, decodePaddleEvent } from '../../fin/funding/psp/paddle.js'
import { query, transaction } from '../../db.js'
import { paddleEnvironment } from './paddle-api.js'
import {
  startSubscription,
  changePlan,
  pauseSubscription,
  resumeSubscription,
  cancelAtPeriodEnd,
  endSubscription,
  ACTIVE_STATUSES,
} from '../packages/lifecycle.js'
import { completeTopUpFromWebhook } from '../credits/tenant-routes.js'

const SUBSCRIPTION_EVENTS = new Set([
  'subscription.created',
  'subscription.updated',
  'subscription.activated',
  'subscription.canceled',
])
const CUSTOMER_EVENTS = new Set(['customer.created', 'customer.updated'])

function eventNow(event) {
  const occurred = event?.raw?.occurred_at
  return occurred ? new Date(occurred).toISOString() : new Date().toISOString()
}

function readCustomData(data) {
  const cd = data?.custom_data || {}
  return {
    creditTenantId: cd.credit_tenant_id || cd.creditTenantId || null,
    scope: cd.scope || null,
    scopeId: cd.scope_id || cd.scopeId || null,
    packageVersionId: cd.package_version_id || cd.packageVersionId || null,
    units: cd.units != null ? Number(cd.units) : null,
    kind: cd.kind || null,
  }
}

async function packageVersionForPrice(priceId, environment) {
  if (!priceId) return null
  const rows = await query(
    `SELECT ref_id FROM public.paddle_price_map
      WHERE kind = 'subscription' AND paddle_price_id = $1 AND environment = $2 AND active = true
      LIMIT 1`,
    [priceId, environment],
  )
  return rows[0]?.ref_id || null
}

async function propertiesForVersion(client, packageVersionId) {
  const { rows } = await client.query(
    `SELECT properties_covered FROM public.product_package_versions WHERE id = $1`,
    [packageVersionId],
  )
  return Number(rows[0]?.properties_covered) || 0
}

async function upsertBillingCustomer(client, { tenantId, scope, scopeId, paddleCustomerId, email, environment }) {
  if (!tenantId || !paddleCustomerId) return
  await client.query(
    `INSERT INTO public.tenant_billing_customers
       (tenant_id, scope, scope_id, paddle_customer_id, email, environment, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (tenant_id) DO UPDATE
       SET paddle_customer_id = EXCLUDED.paddle_customer_id,
           scope = COALESCE(EXCLUDED.scope, public.tenant_billing_customers.scope),
           scope_id = COALESCE(EXCLUDED.scope_id, public.tenant_billing_customers.scope_id),
           email = COALESCE(EXCLUDED.email, public.tenant_billing_customers.email),
           environment = EXCLUDED.environment,
           updated_at = NOW()`,
    [tenantId, scope, scopeId, paddleCustomerId, email || null, environment],
  )
}

async function findOpenSubscriptionByTenant(client, tenantId) {
  const { rows } = await client.query(
    `SELECT * FROM public.tenant_subscriptions
      WHERE tenant_id = $1 AND status = ANY($2)
      ORDER BY created_at DESC
      LIMIT 1
      FOR UPDATE`,
    [tenantId, [...ACTIVE_STATUSES]],
  )
  return rows[0] || null
}

async function findSubscriptionByPaddleId(client, paddleSubscriptionId) {
  const { rows } = await client.query(
    `SELECT * FROM public.tenant_subscriptions
      WHERE paddle_subscription_id = $1
      LIMIT 1
      FOR UPDATE`,
    [paddleSubscriptionId],
  )
  return rows[0] || null
}

async function stampPaddleRefs(client, subscriptionId, { paddleSubscriptionId, paddleCustomerId, patch }) {
  await client.query(
    `UPDATE public.tenant_subscriptions
        SET paddle_subscription_id = COALESCE($2, paddle_subscription_id),
            paddle_customer_id = COALESCE($3, paddle_customer_id),
            data = data || $4::jsonb,
            updated_at = NOW()
      WHERE id = $1`,
    [subscriptionId, paddleSubscriptionId || null, paddleCustomerId || null, JSON.stringify(patch || {})],
  )
}

/**
 * Map a Paddle subscription status + scheduled change to the internal status we
 * want the row to be in. Returns null when no status transition is implied.
 */
function desiredInternalStatus(paddleStatus, scheduledChange) {
  if (paddleStatus === 'canceled') return 'ENDED'
  if (paddleStatus === 'paused') return 'PAUSED'
  if (scheduledChange?.action === 'cancel') return 'CANCELED_AT_PERIOD_END'
  if (scheduledChange?.action === 'pause') return null // wait for the actual `paused` event
  // active | trialing | past_due (grace) all keep the tenant enabled
  return 'ACTIVE'
}

async function reconcileStatus(client, subscription, desired, now) {
  const currentStatus = subscription.status
  if (!desired || currentStatus === desired) return
  try {
    if (desired === 'ENDED' && currentStatus !== 'ENDED') {
      await endSubscription(client, { subscriptionId: subscription.id, reason: 'paddle_canceled', now })
    } else if (desired === 'PAUSED' && currentStatus === 'ACTIVE') {
      await pauseSubscription(client, { subscriptionId: subscription.id, reason: 'paddle_paused', now })
    } else if (desired === 'CANCELED_AT_PERIOD_END' && currentStatus === 'ACTIVE') {
      await cancelAtPeriodEnd(client, { subscriptionId: subscription.id, reason: 'paddle_scheduled_cancel', now })
    } else if (desired === 'ACTIVE' && currentStatus === 'PAUSED') {
      await resumeSubscription(client, { subscriptionId: subscription.id, now })
    } else if (desired === 'ACTIVE' && currentStatus === 'CANCELED_AT_PERIOD_END') {
      // Paddle removed the scheduled cancel — clear it so the cycle worker does
      // not end the subscription at period end.
      await client.query(
        `UPDATE public.tenant_subscriptions
            SET status = 'ACTIVE', auto_renew = true, canceled_at = NULL,
                canceled_by_actor_id = NULL, version = version + 1, updated_at = NOW()
          WHERE id = $1 AND status = 'CANCELED_AT_PERIOD_END'`,
        [subscription.id],
      )
    }
  } catch (error) {
    // Convergent state: an invalid transition (e.g. a duplicate delivery that
    // already moved us) is not fatal — the row already reflects reality.
    if (error?.code === 'INVALID_TRANSITION') return
    throw error
  }
}

async function handleSubscriptionEvent(event) {
  const data = event.data || {}
  const paddleSubscriptionId = data.id
  if (!paddleSubscriptionId) return { ignored: true, reason: 'no_subscription_id' }
  const paddleCustomerId = data.customer_id || null
  const paddleStatus = data.status || null
  const scheduledChange = data.scheduled_change || null
  const priceId = Array.isArray(data.items) ? data.items[0]?.price?.id || null : null
  const environment = paddleEnvironment()
  const custom = readCustomData(data)
  const now = eventNow(event)

  const dataPatch = {
    paddle_status: paddleStatus,
    paddle_scheduled_change: scheduledChange || null,
  }

  await transaction(async (client) => {
    let subscription = await findSubscriptionByPaddleId(client, paddleSubscriptionId)

    // Target plan version: prefer explicit custom_data, else map the price id.
    const targetVersionId = custom.packageVersionId || (await packageVersionForPrice(priceId, environment))

    if (!subscription) {
      // Not seen before — create it against the tenant from custom_data (set at
      // checkout). Without a tenant we can't map it; record nothing.
      const tenantId = custom.creditTenantId
      if (!tenantId || !targetVersionId) return

      await upsertBillingCustomer(client, {
        tenantId,
        scope: custom.scope,
        scopeId: custom.scopeId,
        paddleCustomerId,
        email: data.customer?.email || null,
        environment,
      })

      const open = await findOpenSubscriptionByTenant(client, tenantId)
      let sub
      if (open && open.package_version_id === targetVersionId) {
        sub = open
      } else if (open) {
        const res = await changePlan(client, {
          subscriptionId: open.id,
          newPackageVersionId: targetVersionId,
          prorate: false,
          now,
        })
        sub = res.subscription
      } else {
        const propertiesCommitted = await propertiesForVersion(client, targetVersionId)
        sub = await startSubscription(client, {
          tenantId,
          packageVersionId: targetVersionId,
          propertiesCommitted,
          billingCycleStart: now,
          now,
        })
      }
      // Set committed quantity to the plan's covered count and stamp refs.
      const properties = await propertiesForVersion(client, targetVersionId)
      await client.query(
        `UPDATE public.tenant_subscriptions SET properties_committed = $2 WHERE id = $1`,
        [sub.id, properties],
      )
      await stampPaddleRefs(client, sub.id, {
        paddleSubscriptionId,
        paddleCustomerId,
        patch: dataPatch,
      })
      await reconcileStatus(client, { ...sub, status: sub.status }, desiredInternalStatus(paddleStatus, scheduledChange), now)
      return
    }

    // Known subscription — apply plan change then status reconcile.
    if (targetVersionId && targetVersionId !== subscription.package_version_id && ACTIVE_STATUSES.has(subscription.status)) {
      const res = await changePlan(client, {
        subscriptionId: subscription.id,
        newPackageVersionId: targetVersionId,
        prorate: false,
        now,
      })
      const properties = await propertiesForVersion(client, targetVersionId)
      await client.query(
        `UPDATE public.tenant_subscriptions SET properties_committed = $2 WHERE id = $1`,
        [res.subscription.id, properties],
      )
      await stampPaddleRefs(client, res.subscription.id, {
        paddleSubscriptionId,
        paddleCustomerId,
        patch: dataPatch,
      })
      subscription = await findSubscriptionByPaddleId(client, paddleSubscriptionId)
    }

    await reconcileStatus(client, subscription, desiredInternalStatus(paddleStatus, scheduledChange), now)
    await stampPaddleRefs(client, subscription.id, { paddleCustomerId, patch: dataPatch })
    if (custom.creditTenantId && paddleCustomerId) {
      await upsertBillingCustomer(client, {
        tenantId: custom.creditTenantId,
        scope: custom.scope,
        scopeId: custom.scopeId,
        paddleCustomerId,
        email: data.customer?.email || null,
        environment,
      })
    }
  })

  return { ok: true }
}

async function handleCustomerEvent(event) {
  const data = event.data || {}
  const paddleCustomerId = data.id
  const email = data.email || null
  if (!paddleCustomerId) return { ignored: true }
  // Only refresh an existing mirror row; the tenant<->customer link itself is
  // established from subscription/transaction custom_data (which carries the
  // tenant), never from a bare customer event.
  await query(
    `UPDATE public.tenant_billing_customers
        SET email = COALESCE($2, email), updated_at = NOW()
      WHERE paddle_customer_id = $1 AND environment = $3`,
    [paddleCustomerId, email, paddleEnvironment()],
  )
  return { ok: true }
}

async function handleTransactionEvent(event) {
  const data = event.data || {}
  const custom = readCustomData(data)
  if (custom.kind !== 'topup') {
    // Non-top-up transactions (e.g. a subscription's own invoice) are handled by
    // the subscription events; nothing to do here.
    return { ignored: true, reason: 'not_topup' }
  }
  const tenantId = custom.creditTenantId
  const units = custom.units
  const transactionId = data.id
  if (!tenantId || !units || !transactionId) {
    return { ignored: true, reason: 'incomplete_topup' }
  }
  await completeTopUpFromWebhook({
    tenantId,
    units,
    webhookEventId: `txn:${transactionId}`,
    source: 'topup.paddle',
  })
  // Keep the customer mirror fresh from the transaction's custom_data.
  const paddleCustomerId = data.customer_id || null
  if (paddleCustomerId) {
    await transaction((client) => upsertBillingCustomer(client, {
      tenantId,
      scope: custom.scope,
      scopeId: custom.scopeId,
      paddleCustomerId,
      email: data.customer?.email || null,
      environment: paddleEnvironment(),
    }))
  }
  return { ok: true }
}

/**
 * Verify + dispatch a Paddle webhook. Returns { httpStatus, body }. Always
 * returns 200 for a verified event we choose to ignore, so Paddle stops
 * retrying it.
 */
export async function handlePaddleWebhookEvent(rawBody, headers, { secret, now } = {}) {
  const header = headers?.['paddle-signature'] || headers?.['Paddle-Signature']
  const verified = verifyPaddleSignature({
    rawBody,
    header,
    secret: secret || process.env.PADDLE_WEBHOOK_SECRET,
    now,
  })
  if (!verified.ok) {
    return { httpStatus: verified.httpStatus, body: { error: verified.error } }
  }

  let event
  try {
    event = decodePaddleEvent(rawBody)
  } catch {
    return { httpStatus: 400, body: { error: 'unparseable' } }
  }
  if (!event.id) {
    return { httpStatus: 400, body: { error: 'missing_event_id' } }
  }

  try {
    if (SUBSCRIPTION_EVENTS.has(event.type)) {
      const result = await handleSubscriptionEvent(event)
      return { httpStatus: 200, body: { received: true, ...result } }
    }
    if (CUSTOMER_EVENTS.has(event.type)) {
      const result = await handleCustomerEvent(event)
      return { httpStatus: 200, body: { received: true, ...result } }
    }
    if (event.type === 'transaction.completed') {
      const result = await handleTransactionEvent(event)
      return { httpStatus: 200, body: { received: true, ...result } }
    }
    return { httpStatus: 200, body: { received: true, ignored: true } }
  } catch (error) {
    // Let Paddle retry on unexpected failures (5xx).
    return { httpStatus: 500, body: { error: 'processing_failed', detail: error?.message || null } }
  }
}
