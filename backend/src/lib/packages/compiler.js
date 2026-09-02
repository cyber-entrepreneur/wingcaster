/**
 * Package compiler — PURE over a snapshot, and a DB loader that feeds it.
 * Does NOT call the credit engine. The billing-cycle worker grants after this.
 */
import { PACKAGE_ERROR, PackageError } from './errors.js'

export function toIso(value) {
  if (value instanceof Date) return value.toISOString()
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) {
    throw new PackageError(PACKAGE_ERROR.INVALID_TRANSITION, `Invalid timestamp: ${value}`)
  }
  return d.toISOString()
}

export async function addCadence(client, startAt, cadence) {
  const { rows } = await client.query(
    `SELECT public.package_add_cadence($1::timestamptz, $2::text) AS next_at`,
    [startAt, cadence],
  )
  const nextAt = rows[0]?.next_at
  if (!nextAt) {
    throw new PackageError(PACKAGE_ERROR.UNKNOWN_CADENCE, `Unknown billing cadence: ${cadence}`)
  }
  return toIso(nextAt)
}

/**
 * Known inputs → known totals. Safe to unit-test without Postgres.
 */
export function compileGrantFromSnapshot({
  subscription,
  quotas = [],
  cycleStart,
  cycleEnd,
}) {
  const properties = Number(subscription.properties_committed || 0)
  const breakdown = quotas
    .filter((q) => q && q.feature_id)
    .map((q) => {
      const perProperty = Number(q.credits_per_property || 0)
      return {
        feature_id: q.feature_id,
        feature_code: q.feature_code,
        credits_per_property: perProperty,
        properties,
        total_credits: perProperty * properties,
      }
    })
  const totalCredits = breakdown.reduce((sum, row) => sum + row.total_credits, 0)
  const cycleStartIso = toIso(cycleStart)
  return {
    total_credits: totalCredits,
    grant_ref: {
      subscription_id: subscription.id,
      package_version_id: subscription.package_version_id,
      cycle_start: cycleStartIso,
      cycle_end: toIso(cycleEnd),
      properties_committed: properties,
      idempotency_key: `subscription_cycle:${subscription.id}:${cycleStartIso}`,
    },
    breakdown,
  }
}

/**
 * Load subscription + package version + quotas + features in one query,
 * then compile. Pure over the loaded rows — no credit-engine side effects.
 */
export async function compileSubscriptionCycleGrant(client, { subscriptionId, cycleStart }) {
  const { rows } = await client.query(
    `SELECT
        s.id,
        s.tenant_id,
        s.package_version_id,
        s.properties_committed,
        s.billing_cycle_start,
        s.billing_cycle_end,
        s.status,
        p.billing_cadence,
        p.currency,
        q.feature_id,
        q.credits_per_property,
        f.code AS feature_code
       FROM public.tenant_subscriptions s
       JOIN public.product_package_versions v ON v.id = s.package_version_id
       JOIN public.product_packages p ON p.id = v.package_id
       LEFT JOIN public.package_feature_quotas q ON q.package_version_id = v.id
       LEFT JOIN public.metered_features f ON f.id = q.feature_id
      WHERE s.id = $1`,
    [subscriptionId],
  )
  if (!rows[0]) {
    throw new PackageError(
      PACKAGE_ERROR.SUBSCRIPTION_NOT_FOUND,
      `Subscription ${subscriptionId} not found`,
    )
  }
  const head = rows[0]
  const start = cycleStart || head.billing_cycle_start
  const cycleEnd = await addCadence(client, start, head.billing_cadence)
  const quotas = rows
    .filter((row) => row.feature_id)
    .map((row) => ({
      feature_id: row.feature_id,
      feature_code: row.feature_code,
      credits_per_property: Number(row.credits_per_property),
    }))
  const compiled = compileGrantFromSnapshot({
    subscription: {
      id: head.id,
      package_version_id: head.package_version_id,
      properties_committed: Number(head.properties_committed),
    },
    quotas,
    cycleStart: start,
    cycleEnd,
  })
  return {
    ...compiled,
    tenant_id: head.tenant_id,
    billing_cadence: head.billing_cadence,
    currency: head.currency,
    status: head.status,
  }
}
