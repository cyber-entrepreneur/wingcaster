/**
 * Cost/margin preview for an arbitrary properties_committed N.
 * Uses compileGrantFromSnapshot; does not call the credit engine.
 */
import { compileGrantFromSnapshot, toIso } from './compiler.js'
import { PACKAGE_ERROR, PackageError } from './errors.js'
import { addCadence } from './compiler.js'

const MINOR_TO_MICRO = 10_000

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
