/**
 * Tenant-facing entitlement + quota display for the hybrid billing model.
 * Hard block is wallet balance = 0 (engine reserve). Quota bars are informational.
 */
import { query } from '../../db.js'
import { fromCreditUnits } from './scale.js'

const TENANT_QUOTA_SQL = `
SELECT c.feature,
       COALESCE(SUM(c.credits_amount), 0)::bigint AS used
  FROM public.credit_consumptions c
 WHERE c.tenant_id = $1
   AND c.consumed_at >= $2::timestamptz
   AND c.consumed_at < $3::timestamptz
   AND ($4::text IS NULL OR c.feature = $4)
 GROUP BY c.feature
`

export function tenantQuotaSql() {
  return TENANT_QUOTA_SQL
}

export async function checkEntitlement(tenantId, featureCode) {
  const featureRows = await query(
    `SELECT * FROM public.metered_features WHERE code = $1`,
    [featureCode],
  )
  const feature = featureRows[0]
  if (!feature) {
    return {
      enabled: false,
      registered: false,
      quota_used_this_cycle: 0,
      quota_display: 0,
      typical_monthly: 0,
      usage_ratio: 0,
    }
  }

  const subRows = await query(
    `SELECT s.id, s.billing_cycle_start, s.billing_cycle_end, s.properties_committed,
            s.package_version_id, s.status
       FROM public.tenant_subscriptions s
      WHERE s.tenant_id = $1
        AND s.status IN ('PENDING_START', 'ACTIVE', 'PAUSED', 'CANCELED_AT_PERIOD_END')
      LIMIT 1`,
    [tenantId],
  )
  const subscription = subRows[0] || null

  let flagEnabled = true
  let creditsPerProperty = 0
  if (subscription) {
    const flagRows = await query(
      `SELECT enabled FROM public.package_feature_flags
        WHERE package_version_id = $1 AND feature_code = $2`,
      [subscription.package_version_id, featureCode],
    )
    if (flagRows[0]) flagEnabled = Boolean(flagRows[0].enabled)
    const quotaRows = await query(
      `SELECT credits_per_property
         FROM public.package_feature_quotas
        WHERE package_version_id = $1 AND feature_id = $2`,
      [subscription.package_version_id, feature.id],
    )
    creditsPerProperty = Number(quotaRows[0]?.credits_per_property || 0)
  }

  const cycleStart = subscription?.billing_cycle_start || new Date(0).toISOString()
  const cycleEnd = subscription?.billing_cycle_end || new Date(Date.now() + 86400000).toISOString()
  const usedRows = await query(TENANT_QUOTA_SQL, [tenantId, cycleStart, cycleEnd, featureCode])
  const used = Number(usedRows[0]?.used || 0)
  const typicalMonthly = creditsPerProperty * Number(subscription?.properties_committed || 0)
  const quotaDisplay = typicalMonthly > 0 ? typicalMonthly : Number(feature.credits_per_unit || 0)
  const usageRatio = quotaDisplay > 0 ? used / quotaDisplay : 0

  return {
    enabled: Boolean(feature.active) && flagEnabled,
    registered: true,
    feature_code: featureCode,
    display_name: feature.display_name,
    quota_used_this_cycle: used,
    quota_display: quotaDisplay,
    typical_monthly: typicalMonthly,
    usage_ratio: usageRatio,
    soft_warning: usageRatio >= 1 && typicalMonthly > 0,
    billing_cycle_start: cycleStart,
    billing_cycle_end: cycleEnd,
    used_credits: fromCreditUnits(used),
    typical_credits: fromCreditUnits(typicalMonthly),
  }
}

export async function listFeatureQuotas(tenantId) {
  const features = await query(
    `SELECT code FROM public.metered_features WHERE active = true ORDER BY code`,
  )
  const items = []
  for (const row of features) {
    items.push(await checkEntitlement(tenantId, row.code))
  }
  return items
}
