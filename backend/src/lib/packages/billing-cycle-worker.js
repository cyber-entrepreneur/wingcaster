/**
 * Billing-cycle worker. Grants subscription-cycle credits via the compiler
 * + credit engine. Does not modify engine internals.
 *
 * Advisory lock FIN_PACKAGE_BILLING_CYCLE = 1024 (spec value; 1023 is
 * FIN_CREDITS_FIN_MIRROR).
 */
import { FIN_PACKAGE_BILLING_CYCLE } from '../../fin/foundation/advisory-locks.js'
import { grant } from '../credits/engine.js'
import { addCadence, compileSubscriptionCycleGrant, toIso } from './compiler.js'
import { writeOutbox } from './helpers.js'
import { activatePending, endSubscription } from './lifecycle.js'

const BATCH = 100

function asData(value) {
  if (!value) return {}
  if (typeof value === 'string') {
    try { return JSON.parse(value) } catch { return {} }
  }
  return value
}

async function loadCadence(client, packageVersionId) {
  const { rows } = await client.query(
    `SELECT p.billing_cadence, p.currency, p.id AS package_id
       FROM public.product_package_versions v
       JOIN public.product_packages p ON p.id = v.package_id
      WHERE v.id = $1`,
    [packageVersionId],
  )
  return rows[0]
}

async function processSubscription(client, { subscriptionId, now, environment }) {
  const locked = await client.query(
    `SELECT * FROM public.tenant_subscriptions WHERE id = $1 FOR UPDATE SKIP LOCKED`,
    [subscriptionId],
  )
  const subscription = locked.rows[0]
  if (!subscription) return { skipped: true }

  let current = subscription
  const nowDate = new Date(now)

  if (current.status === 'PENDING_START' && new Date(current.billing_cycle_start) <= nowDate) {
    current = await activatePending(client, { subscriptionId: current.id, now })
  }

  const cycleEnded = new Date(current.billing_cycle_end) <= nowDate
  const shouldEnd = current.status === 'CANCELED_AT_PERIOD_END'
    || (current.status === 'ACTIVE' && current.auto_renew === false && cycleEnded)
  const grantDue = (current.status === 'ACTIVE' || current.status === 'CANCELED_AT_PERIOD_END')
    && current.next_grant_at
    && new Date(current.next_grant_at) <= nowDate

  if (grantDue) {
    const compiled = await compileSubscriptionCycleGrant(client, {
      subscriptionId: current.id,
      cycleStart: current.billing_cycle_start,
    })
    let granted = null
    if (compiled.total_credits > 0) {
      granted = await grant({
        tenantId: current.tenant_id,
        source: 'subscription_cycle',
        amount: compiled.total_credits,
        currency: compiled.currency || 'USD',
        packageId: (await loadCadence(client, current.package_version_id)).package_id,
        billingPeriodStart: compiled.grant_ref.cycle_start,
        billingPeriodEnd: compiled.grant_ref.cycle_end,
        grantRef: compiled.grant_ref,
        grantedByActorType: 'SYSTEM',
        data: { breakdown: compiled.breakdown },
      })
    }

    const pkg = await loadCadence(client, current.package_version_id)
    const data = {
      ...asData(current.data),
      last_granted_cycle_start: compiled.grant_ref.cycle_start,
      last_granted_credits: compiled.total_credits,
      last_granted_at: now,
    }

    const renew = current.auto_renew !== false && current.status !== 'CANCELED_AT_PERIOD_END'
    let nextStart = current.billing_cycle_start
    let nextEnd = current.billing_cycle_end
    let nextGrantAt = null
    if (renew) {
      nextStart = toIso(current.billing_cycle_end)
      nextEnd = await addCadence(client, nextStart, pkg.billing_cadence)
      nextGrantAt = nextStart
    }

    const updated = await client.query(
      `UPDATE public.tenant_subscriptions
          SET billing_cycle_start = $2,
              billing_cycle_end = $3,
              next_grant_at = $4,
              data = $5::jsonb,
              version = version + 1,
              updated_at = $6::timestamptz
        WHERE id = $1
        RETURNING *`,
      [current.id, nextStart, nextEnd, nextGrantAt, JSON.stringify(data), now],
    )
    current = updated.rows[0]

    await writeOutbox(client, {
      topic: 'subscription.cycle_granted',
      dedupeKey: `subscription.cycle_granted:${current.id}:${compiled.grant_ref.cycle_start}`,
      payload: {
        subscription_id: current.id,
        tenant_id: current.tenant_id,
        amount: compiled.total_credits,
        grant_id: granted?.grant?.id || null,
        replay: Boolean(granted?.replay),
        grant_ref: compiled.grant_ref,
      },
      now,
    })

    if (shouldEnd && new Date(current.billing_cycle_end) <= nowDate && !renew) {
      current = await endSubscription(client, { subscriptionId: current.id, reason: 'period_end', now })
    }

    return {
      skipped: false,
      granted: compiled.total_credits > 0,
      amount: compiled.total_credits,
      replay: Boolean(granted?.replay),
      subscription: current,
      environment,
    }
  }

  if (shouldEnd && cycleEnded) {
    current = await endSubscription(client, {
      subscriptionId: current.id,
      reason: current.status === 'CANCELED_AT_PERIOD_END' ? 'canceled_period_end' : 'auto_renew_false',
      now,
    })
    return { skipped: false, granted: false, ended: true, subscription: current }
  }

  return { skipped: true, subscription: current }
}

export async function runBillingCycleWorkerTick({
  pool,
  now = new Date().toISOString(),
  limit = BATCH,
  environment = 'LIVE',
} = {}) {
  const lockClient = await pool.connect()
  try {
    const locked = await lockClient.query(
      'SELECT pg_try_advisory_lock($1, $2) AS ok',
      [FIN_PACKAGE_BILLING_CYCLE, 0],
    )
    if (!locked.rows[0].ok) {
      return { skipped: true, processed: 0, granted: 0, reason: 'PACKAGE_BILLING_CYCLE_LOCK_HELD' }
    }
    try {
      const due = await lockClient.query(
        `SELECT id FROM public.tenant_subscriptions
          WHERE (
              (status = 'PENDING_START' AND billing_cycle_start <= $1::timestamptz)
           OR (status = 'ACTIVE' AND next_grant_at IS NOT NULL AND next_grant_at <= $1::timestamptz)
           OR (status IN ('ACTIVE', 'CANCELED_AT_PERIOD_END')
               AND billing_cycle_end <= $1::timestamptz
               AND (auto_renew = false OR status = 'CANCELED_AT_PERIOD_END'))
          )
          ORDER BY next_grant_at NULLS FIRST, created_at ASC
          LIMIT $2`,
        [now, limit],
      )
      let processed = 0
      let granted = 0
      const results = []
      for (const row of due.rows) {
        await lockClient.query('BEGIN')
        try {
          const result = await processSubscription(lockClient, {
            subscriptionId: row.id,
            now,
            environment,
          })
          await lockClient.query('COMMIT')
          if (!result.skipped) processed += 1
          if (result.granted) granted += 1
          results.push(result)
        } catch (error) {
          await lockClient.query('ROLLBACK').catch(() => {})
          throw error
        }
      }
      return { skipped: false, processed, granted, results }
    } finally {
      await lockClient.query(
        'SELECT pg_advisory_unlock($1, $2)',
        [FIN_PACKAGE_BILLING_CYCLE, 0],
      )
    }
  } finally {
    lockClient.release()
  }
}

