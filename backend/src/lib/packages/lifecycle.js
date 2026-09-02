/**
 * Subscription state machine.
 *
 * PENDING_START --(activate at billing_cycle_start)--> ACTIVE
 * ACTIVE --(pause)--> PAUSED --(resume)--> ACTIVE
 * ACTIVE --(cancel end-of-period)--> CANCELED_AT_PERIOD_END --(cycle ends)--> ENDED
 * ACTIVE --(cancel immediate)--> ENDED
 * PAUSED --(cancel)--> ENDED
 */
import { randomUUID } from 'node:crypto'
import { grant } from '../credits/engine.js'
import { addCadence, compileGrantFromSnapshot, compileSubscriptionCycleGrant, toIso } from './compiler.js'
import { PACKAGE_ERROR, PackageError } from './errors.js'
import { snapshotSubscription, writeTransitionArtifacts } from './helpers.js'

const ACTIVE_STATUSES = new Set(['PENDING_START', 'ACTIVE', 'PAUSED', 'CANCELED_AT_PERIOD_END'])

async function loadSubscription(client, subscriptionId, { forUpdate = false } = {}) {
  const sql = `SELECT * FROM public.tenant_subscriptions WHERE id = $1${forUpdate ? ' FOR UPDATE' : ''}`
  const { rows } = await client.query(sql, [subscriptionId])
  if (!rows[0]) {
    throw new PackageError(PACKAGE_ERROR.SUBSCRIPTION_NOT_FOUND, `Subscription ${subscriptionId} not found`)
  }
  return rows[0]
}

async function loadPublishedVersion(client, packageVersionId) {
  const { rows } = await client.query(
    `SELECT v.*, p.billing_cadence, p.currency, p.code AS package_code
       FROM public.product_package_versions v
       JOIN public.product_packages p ON p.id = v.package_id
      WHERE v.id = $1`,
    [packageVersionId],
  )
  const version = rows[0]
  if (!version) {
    throw new PackageError(
      PACKAGE_ERROR.PACKAGE_VERSION_NOT_FOUND,
      `Package version ${packageVersionId} not found`,
    )
  }
  if (version.state !== 'PUBLISHED') {
    throw new PackageError(
      PACKAGE_ERROR.VERSION_NOT_PUBLISHED,
      `Package version ${packageVersionId} is ${version.state}`,
    )
  }
  return version
}

function assertTransition(from, allowed, action) {
  if (!allowed.includes(from)) {
    throw new PackageError(
      PACKAGE_ERROR.INVALID_TRANSITION,
      `Cannot ${action} from ${from}`,
      { from, allowed },
    )
  }
}

async function persistStatus(client, {
  subscription, patch, action, topic, actorId, reason, now, extra,
}) {
  const before = snapshotSubscription(subscription)
  const fields = {
    status: patch.status ?? subscription.status,
    billing_cycle_start: patch.billing_cycle_start ?? subscription.billing_cycle_start,
    billing_cycle_end: patch.billing_cycle_end ?? subscription.billing_cycle_end,
    next_grant_at: Object.prototype.hasOwnProperty.call(patch, 'next_grant_at')
      ? patch.next_grant_at
      : subscription.next_grant_at,
    package_version_id: patch.package_version_id ?? subscription.package_version_id,
    properties_committed: patch.properties_committed ?? subscription.properties_committed,
    auto_renew: patch.auto_renew ?? subscription.auto_renew,
    paused_at: Object.prototype.hasOwnProperty.call(patch, 'paused_at') ? patch.paused_at : subscription.paused_at,
    paused_by_actor_id: Object.prototype.hasOwnProperty.call(patch, 'paused_by_actor_id')
      ? patch.paused_by_actor_id
      : subscription.paused_by_actor_id,
    canceled_at: Object.prototype.hasOwnProperty.call(patch, 'canceled_at') ? patch.canceled_at : subscription.canceled_at,
    canceled_by_actor_id: Object.prototype.hasOwnProperty.call(patch, 'canceled_by_actor_id')
      ? patch.canceled_by_actor_id
      : subscription.canceled_by_actor_id,
    ended_at: Object.prototype.hasOwnProperty.call(patch, 'ended_at') ? patch.ended_at : subscription.ended_at,
    data: patch.data ?? subscription.data,
  }
  const { rows } = await client.query(
    `UPDATE public.tenant_subscriptions
        SET status = $2,
            billing_cycle_start = $3,
            billing_cycle_end = $4,
            next_grant_at = $5,
            package_version_id = $6,
            properties_committed = $7,
            auto_renew = $8,
            paused_at = $9,
            paused_by_actor_id = $10,
            canceled_at = $11,
            canceled_by_actor_id = $12,
            ended_at = $13,
            data = $14::jsonb,
            version = version + 1,
            updated_at = $15::timestamptz
      WHERE id = $1
      RETURNING *`,
    [
      subscription.id,
      fields.status,
      fields.billing_cycle_start,
      fields.billing_cycle_end,
      fields.next_grant_at,
      fields.package_version_id,
      fields.properties_committed,
      fields.auto_renew,
      fields.paused_at,
      fields.paused_by_actor_id,
      fields.canceled_at,
      fields.canceled_by_actor_id,
      fields.ended_at,
      JSON.stringify(fields.data || {}),
      now,
    ],
  )
  const updated = rows[0]
  await writeTransitionArtifacts(client, {
    action,
    topic,
    subscription: updated,
    beforeState: before,
    afterState: snapshotSubscription(updated),
    actorId,
    reason,
    extra,
    now,
  })
  return updated
}

export async function startSubscription(client, {
  id = randomUUID(),
  tenantId,
  packageVersionId,
  propertiesCommitted,
  billingCycleStart,
  autoRenew = true,
  actorId = null,
  now = new Date().toISOString(),
} = {}) {
  if (!tenantId) throw new PackageError(PACKAGE_ERROR.INVALID_TRANSITION, 'tenantId is required')
  const existingWallet = await client.query(
    `SELECT 1 FROM public.credit_wallets WHERE tenant_id = $1`,
    [tenantId],
  )
  if (!existingWallet.rows[0]) {
    await client.query(
      `INSERT INTO public.credit_wallets (
         tenant_id, currency, credits_remaining, credits_reserved, updated_at
       ) VALUES ($1, 'USD', 0, 0, NOW())
       ON CONFLICT (tenant_id) DO NOTHING`,
      [tenantId],
    )
  }
  const version = await loadPublishedVersion(client, packageVersionId)
  const start = toIso(billingCycleStart || now)
  const end = await addCadence(client, start, version.billing_cadence)
  const status = new Date(start) <= new Date(now) ? 'ACTIVE' : 'PENDING_START'
  const data = {
    first_cycle_start: start,
    package_code: version.package_code,
  }
  let inserted
  try {
    const result = await client.query(
      `INSERT INTO public.tenant_subscriptions (
         id, tenant_id, package_version_id, status,
         billing_cycle_start, billing_cycle_end, next_grant_at,
         properties_committed, auto_renew, data, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$11)
       RETURNING *`,
      [
        id, tenantId, packageVersionId, status,
        start, end, start,
        propertiesCommitted, autoRenew, JSON.stringify(data), now,
      ],
    )
    inserted = result.rows[0]
  } catch (error) {
    if (error.code === '23505') {
      throw new PackageError(
        PACKAGE_ERROR.ACTIVE_SUBSCRIPTION_EXISTS,
        'Tenant already has a non-ended subscription',
        { tenantId },
      )
    }
    throw error
  }
  await writeTransitionArtifacts(client, {
    action: 'subscription.start',
    topic: 'subscription.started',
    subscription: inserted,
    beforeState: null,
    afterState: snapshotSubscription(inserted),
    actorId,
    reason: 'start',
    now,
  })
  return inserted
}

export async function pauseSubscription(client, { subscriptionId, actorId = null, reason = null, now = new Date().toISOString() }) {
  const subscription = await loadSubscription(client, subscriptionId, { forUpdate: true })
  assertTransition(subscription.status, ['ACTIVE'], 'pause')
  return persistStatus(client, {
    subscription,
    patch: {
      status: 'PAUSED',
      paused_at: now,
      paused_by_actor_id: actorId,
    },
    action: 'subscription.pause',
    topic: 'subscription.paused',
    actorId,
    reason: reason || 'pause',
    now,
  })
}

export async function resumeSubscription(client, { subscriptionId, actorId = null, now = new Date().toISOString() }) {
  const subscription = await loadSubscription(client, subscriptionId, { forUpdate: true })
  assertTransition(subscription.status, ['PAUSED'], 'resume')
  return persistStatus(client, {
    subscription,
    patch: {
      status: 'ACTIVE',
      paused_at: null,
      paused_by_actor_id: null,
    },
    action: 'subscription.resume',
    topic: 'subscription.resumed',
    actorId,
    reason: 'resume',
    now,
  })
}

export async function cancelAtPeriodEnd(client, { subscriptionId, actorId = null, reason = null, now = new Date().toISOString() }) {
  const subscription = await loadSubscription(client, subscriptionId, { forUpdate: true })
  assertTransition(subscription.status, ['ACTIVE'], 'cancelAtPeriodEnd')
  return persistStatus(client, {
    subscription,
    patch: {
      status: 'CANCELED_AT_PERIOD_END',
      auto_renew: false,
      canceled_at: now,
      canceled_by_actor_id: actorId,
    },
    action: 'subscription.cancel_at_period_end',
    topic: 'subscription.canceled_at_period_end',
    actorId,
    reason: reason || 'cancel_at_period_end',
    now,
  })
}

export async function cancelImmediate(client, { subscriptionId, actorId = null, reason = null, now = new Date().toISOString() }) {
  const subscription = await loadSubscription(client, subscriptionId, { forUpdate: true })
  assertTransition(subscription.status, ['ACTIVE', 'PAUSED', 'CANCELED_AT_PERIOD_END', 'PENDING_START'], 'cancelImmediate')
  return persistStatus(client, {
    subscription,
    patch: {
      status: 'ENDED',
      auto_renew: false,
      canceled_at: subscription.canceled_at || now,
      canceled_by_actor_id: actorId || subscription.canceled_by_actor_id,
      ended_at: now,
      next_grant_at: null,
    },
    action: 'subscription.cancel_immediate',
    topic: 'subscription.ended',
    actorId,
    reason: reason || 'cancel_immediate',
    now,
  })
}

export async function endSubscription(client, { subscriptionId, actorId = null, reason = null, now = new Date().toISOString() }) {
  const subscription = await loadSubscription(client, subscriptionId, { forUpdate: true })
  if (subscription.status === 'ENDED') return subscription
  return persistStatus(client, {
    subscription,
    patch: {
      status: 'ENDED',
      ended_at: now,
      next_grant_at: null,
    },
    action: 'subscription.end',
    topic: 'subscription.ended',
    actorId,
    reason: reason || 'end',
    now,
  })
}

export async function activatePending(client, { subscriptionId, now = new Date().toISOString() }) {
  const subscription = await loadSubscription(client, subscriptionId, { forUpdate: true })
  if (subscription.status !== 'PENDING_START') return subscription
  if (new Date(subscription.billing_cycle_start) > new Date(now)) return subscription
  return persistStatus(client, {
    subscription,
    patch: { status: 'ACTIVE' },
    action: 'subscription.activate',
    topic: 'subscription.activated',
    reason: 'billing_cycle_start',
    now,
  })
}

/**
 * Ends the current subscription and starts a new one for the same tenant.
 * When `prorate` is true, grants max(0, remaining-new - remaining-old) via
 * the compiler. Clawback of unused old credits is intentionally skipped
 * (credit engine consume requires a feature/request_id; refunds are PR C/D).
 */
export async function changePlan(client, {
  subscriptionId,
  newPackageVersionId,
  prorate = false,
  actorId = null,
  now = new Date().toISOString(),
} = {}) {
  const current = await loadSubscription(client, subscriptionId, { forUpdate: true })
  assertTransition(current.status, ['ACTIVE', 'PAUSED', 'CANCELED_AT_PERIOD_END'], 'changePlan')
  const newVersion = await loadPublishedVersion(client, newPackageVersionId)

  let prorateGrant = null
  if (prorate && current.status === 'ACTIVE') {
    const remainingMs = new Date(current.billing_cycle_end) - new Date(now)
    const totalMs = new Date(current.billing_cycle_end) - new Date(current.billing_cycle_start)
    const fraction = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0
    const oldCompiled = await compileSubscriptionCycleGrant(client, {
      subscriptionId: current.id,
      cycleStart: current.billing_cycle_start,
    })
    const nextId = randomUUID()
    const cycleEnd = await addCadence(client, now, newVersion.billing_cadence)
    const quotaRows = await client.query(
      `SELECT q.feature_id, q.credits_per_property, f.code AS feature_code
         FROM public.package_feature_quotas q
         JOIN public.metered_features f ON f.id = q.feature_id
        WHERE q.package_version_id = $1`,
      [newPackageVersionId],
    )
    const newCompiled = compileGrantFromSnapshot({
      subscription: {
        id: nextId,
        package_version_id: newPackageVersionId,
        properties_committed: Number(current.properties_committed),
      },
      quotas: quotaRows.rows.map((row) => ({
        feature_id: row.feature_id,
        feature_code: row.feature_code,
        credits_per_property: Number(row.credits_per_property),
      })),
      cycleStart: now,
      cycleEnd,
    })
    const oldRemaining = Math.floor(oldCompiled.total_credits * fraction)
    const newRemaining = Math.floor(newCompiled.total_credits * fraction)
    const net = newRemaining - oldRemaining
    // Grant BEFORE inserting the new subscription. An INSERT that FKs to
    // credit_wallets takes a share lock held until COMMIT; grant() FOR UPDATE
    // on the wallet from a second connection would deadlock.
    if (net > 0) {
      const cycleStartIso = toIso(now)
      prorateGrant = await grant({
        tenantId: current.tenant_id,
        source: 'subscription_cycle',
        amount: net,
        currency: newVersion.currency || 'USD',
        packageId: newVersion.package_id,
        billingPeriodStart: cycleStartIso,
        billingPeriodEnd: toIso(cycleEnd),
        grantRef: {
          ...newCompiled.grant_ref,
          prorate: true,
          fraction,
          old_remaining: oldRemaining,
          new_remaining: newRemaining,
          idempotency_key: `subscription_prorate:${nextId}:${cycleStartIso}`,
        },
        grantedByActorType: actorId ? 'USER' : 'SYSTEM',
        grantedByActorId: actorId,
        data: { breakdown: newCompiled.breakdown, reason: 'change_plan_prorate' },
      })
    }
    const ended = await persistStatus(client, {
      subscription: current,
      patch: {
        status: 'ENDED',
        ended_at: now,
        next_grant_at: null,
        data: { ...(current.data || {}), superseded_by_plan: newPackageVersionId },
      },
      action: 'subscription.change_plan.end',
      topic: 'subscription.ended',
      actorId,
      reason: 'change_plan',
      now,
    })
    const next = await startSubscription(client, {
      id: nextId,
      tenantId: current.tenant_id,
      packageVersionId: newPackageVersionId,
      propertiesCommitted: current.properties_committed,
      billingCycleStart: now,
      autoRenew: current.auto_renew,
      actorId,
      now,
    })
    return { previous: ended, subscription: next, prorateGrant, fraction, net }
  }

  const ended = await persistStatus(client, {
    subscription: current,
    patch: {
      status: 'ENDED',
      ended_at: now,
      next_grant_at: null,
      data: { ...(current.data || {}), superseded_by_plan: newPackageVersionId },
    },
    action: 'subscription.change_plan.end',
    topic: 'subscription.ended',
    actorId,
    reason: 'change_plan',
    now,
  })
  const next = await startSubscription(client, {
    tenantId: current.tenant_id,
    packageVersionId: newPackageVersionId,
    propertiesCommitted: current.properties_committed,
    billingCycleStart: now,
    autoRenew: current.auto_renew,
    actorId,
    now,
  })
  return { previous: ended, subscription: next, prorateGrant: null }
}

export { ACTIVE_STATUSES, loadSubscription }
