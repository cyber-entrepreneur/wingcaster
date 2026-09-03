/**
 * Package preview helpers.
 *
 * - previewChangePlan (PR D): pro-ration preview for tenant plan changes.
 *   Consumes compiler APIs; does not mutate lifecycle or grant credits.
 *   UpgradeDialog uses this before calling lifecycle.changePlan.
 *
 * - previewFromRows / previewCycleGrant (PR C): cost/margin preview for an
 *   arbitrary properties_committed N on a given package version. Uses
 *   compileGrantFromSnapshot; does not call the credit engine.
 */
import { randomUUID } from 'node:crypto'
import { addCadence, compileGrantFromSnapshot, compileSubscriptionCycleGrant, toIso } from './compiler.js'
import { PACKAGE_ERROR, PackageError } from './errors.js'

const MINOR_TO_MICRO = 10_000

export async function previewChangePlan(client, {
  subscriptionId,
  newPackageVersionId,
  now = new Date().toISOString(),
} = {}) {
  const { rows: subRows } = await client.query(
    `SELECT * FROM public.tenant_subscriptions WHERE id = $1`,
    [subscriptionId],
  )
  const current = subRows[0]
  if (!current) {
    throw new PackageError(PACKAGE_ERROR.SUBSCRIPTION_NOT_FOUND, `Subscription ${subscriptionId} not found`)
  }
  const { rows: versionRows } = await client.query(
    `SELECT v.*, p.billing_cadence, p.currency, p.code AS package_code, p.display_name
       FROM public.product_package_versions v
       JOIN public.product_packages p ON p.id = v.package_id
      WHERE v.id = $1`,
    [newPackageVersionId],
  )
  const newVersion = versionRows[0]
  if (!newVersion) {
    throw new PackageError(PACKAGE_ERROR.PACKAGE_VERSION_NOT_FOUND, `Package version ${newPackageVersionId} not found`)
  }
  if (newVersion.state !== 'PUBLISHED') {
    throw new PackageError(
      PACKAGE_ERROR.VERSION_NOT_PUBLISHED,
      `Package version ${newPackageVersionId} is ${newVersion.state}`,
    )
  }

  const remainingMs = new Date(current.billing_cycle_end) - new Date(now)
  const totalMs = new Date(current.billing_cycle_end) - new Date(current.billing_cycle_start)
  const fraction = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0
  const oldCompiled = await compileSubscriptionCycleGrant(client, {
    subscriptionId: current.id,
    cycleStart: current.billing_cycle_start,
  })
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
      id: randomUUID(),
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
  return {
    subscription_id: current.id,
    current_package_version_id: current.package_version_id,
    new_package_version_id: newPackageVersionId,
    new_package_code: newVersion.package_code,
    new_package_display_name: newVersion.display_name,
    fraction,
    old_remaining: oldRemaining,
    new_remaining: newRemaining,
    net,
    currency: newVersion.currency,
    new_monthly_price_minor: Number(newVersion.monthly_price_minor),
  }
}

export function previewFromRows({ version, quotas, propertiesN, cycleStart, cycleEnd }) {
  const n = Number(propertiesN)
  if (!Number.isFinite(n) || n < 0) {
    throw new PackageError(PACKAGE_ERROR.INVALID_INPUT, 'properties must be >= 0')
  }
  const compiled = compileGrantFromSnapshot({
    subscription: {
      id: version.id,
      package_version_id: version.id,
      properties_committed: n,
    },
    quotas: quotas.map((q) => ({
      feature_id: q.feature_id,
      feature_code: q.feature_code,
      credits_per_property: Number(q.credits_per_property),
    })),
    cycleStart,
    cycleEnd,
  })
  let costMicro = 0
  const costBreakdown = []
  for (const quota of quotas) {
    const credits = Number(quota.credits_per_property) * n
    const perUnit = Number(quota.credits_per_unit || 0)
    const unitCost = quota.cost_per_unit_micro_usd == null ? null : Number(quota.cost_per_unit_micro_usd)
    let featureCost = 0
    if (unitCost != null && perUnit > 0) {
      featureCost = (unitCost * Number(quota.credits_per_property) * n) / perUnit
      costMicro += featureCost
    }
    costBreakdown.push({
      feature_id: quota.feature_id,
      feature_code: quota.feature_code,
      credits,
      cost_micro_usd: unitCost == null ? null : featureCost,
    })
  }
  const revenueMinor = Number(version.monthly_price_minor || 0) * n
  const revenueMicro = revenueMinor * MINOR_TO_MICRO
  const marginMicro = revenueMicro - costMicro
  const marginPercent = revenueMicro > 0 ? (marginMicro / revenueMicro) * 100 : (costMicro > 0 ? -100 : 0)
  const warnings = []
  if (costMicro > revenueMicro) warnings.push('COST_EXCEEDS_REVENUE')
  if (marginPercent < 20) warnings.push('MARGIN_BELOW_20')
  return {
    properties: n,
    total_credits: compiled.total_credits,
    breakdown: compiled.breakdown,
    cost_micro_usd: costMicro,
    cost_breakdown: costBreakdown,
    monthly_revenue_minor: revenueMinor,
    monthly_revenue_micro_usd: revenueMicro,
    margin_micro_usd: marginMicro,
    margin_percent: marginPercent,
    warnings,
    grant_ref: compiled.grant_ref,
  }
}

export async function previewCycleGrant(client, versionId, propertiesN) {
  const { rows } = await client.query(
    `SELECT v.*, p.billing_cadence, p.currency
       FROM public.product_package_versions v
       JOIN public.product_packages p ON p.id = v.package_id
      WHERE v.id = $1`,
    [versionId],
  )
  if (!rows[0]) {
    throw new PackageError(PACKAGE_ERROR.PACKAGE_VERSION_NOT_FOUND, `Version ${versionId} not found`)
  }
  const version = rows[0]
  const quotas = await client.query(
    `SELECT q.feature_id, q.credits_per_property, f.code AS feature_code,
            f.credits_per_unit, f.cost_per_unit_micro_usd
       FROM public.package_feature_quotas q
       JOIN public.metered_features f ON f.id = q.feature_id
      WHERE q.package_version_id = $1
      ORDER BY f.code`,
    [versionId],
  )
  const cycleStart = toIso(version.effective_from || new Date().toISOString())
  const cycleEnd = await addCadence(client, cycleStart, version.billing_cadence)
  return previewFromRows({
    version,
    quotas: quotas.rows,
    propertiesN,
    cycleStart,
    cycleEnd,
  })
}
