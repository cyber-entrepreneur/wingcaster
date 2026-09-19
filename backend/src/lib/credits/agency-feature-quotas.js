/**
 * AGN-CRD-006 — Agency-wide feature quota aggregation.
 */

import { query } from '../../db.js'
import { findUserById } from '../../identity.js'
import { listAgencyMemberships } from '../../tenant-authorization.js'
import { fromCreditUnits } from './scale.js'
import { syntheticTenantId } from './wallets.js'

const CATEGORY_GROUPS = Object.freeze([
  { key: 'social', label: 'Social', prefixes: ['publishing.social'] },
  { key: 'portal', label: 'Portal', prefixes: ['publishing.realestate'] },
  { key: 'ai', label: 'AI', prefixes: ['ai.'] },
  { key: 'comms', label: 'Comms', prefixes: ['communication.', 'whatsapp-listings'] },
  { key: 'other', label: 'Other', prefixes: [] },
])

function categoryGroupForFeature(feature) {
  const category = String(feature.category || '')
  const code = String(feature.code || '')
  for (const group of CATEGORY_GROUPS) {
    if (group.prefixes.some((prefix) => category.startsWith(prefix) || code === prefix || code.startsWith(prefix))) {
      return group.key
    }
  }
  return 'other'
}

async function resolveAgencyTenantIds(agencyId) {
  const agencyTenantId = syntheticTenantId('agency', agencyId)
  const memberships = await listAgencyMemberships(agencyId, { statuses: ['active'] })
  const agentUserIds = memberships
    .filter((m) => m.role !== 'guest')
    .map((m) => m.user_id)
    .filter(Boolean)

  const agentWalletRows = agentUserIds.length
    ? await query(
      `SELECT tenant_id, scope_id AS user_id
         FROM public.credit_wallets
        WHERE scope = 'agent' AND scope_id = ANY($1::uuid[])`,
      [agentUserIds],
    )
    : []

  const tenantIds = [agencyTenantId, ...agentWalletRows.map((row) => row.tenant_id)]
  const agentTenantByUserId = new Map(agentWalletRows.map((row) => [row.user_id, row.tenant_id]))
  const tenantAgentByTenantId = new Map(agentWalletRows.map((row) => [row.tenant_id, row.user_id]))

  return {
    agencyTenantId,
    tenantIds: [...new Set(tenantIds)],
    agentUserIds,
    agentTenantByUserId,
    tenantAgentByTenantId,
  }
}

async function loadAgencySubscription(agencyTenantId) {
  const rows = await query(
    `SELECT s.id, s.billing_cycle_start, s.billing_cycle_end, s.properties_committed,
            s.package_version_id, s.status
       FROM public.tenant_subscriptions s
      WHERE s.tenant_id = $1
        AND s.status IN ('PENDING_START', 'ACTIVE', 'PAUSED', 'CANCELED_AT_PERIOD_END')
      LIMIT 1`,
    [agencyTenantId],
  )
  return rows[0] || null
}

async function sumUsageForFeature(tenantIds, cycleStart, cycleEnd, featureCode) {
  if (!tenantIds.length) return 0
  const rows = await query(
    `SELECT COALESCE(SUM(c.credits_amount), 0)::bigint AS used
       FROM public.credit_consumptions c
      WHERE c.tenant_id = ANY($1::uuid[])
        AND c.consumed_at >= $2::timestamptz
        AND c.consumed_at < $3::timestamptz
        AND c.feature = $4`,
    [tenantIds, cycleStart, cycleEnd, featureCode],
  )
  return Number(rows[0]?.used || 0)
}

async function agentBreakdownForFeature(tenantIds, tenantAgentByTenantId, cycleStart, cycleEnd, featureCode) {
  if (!tenantIds.length) return []
  const rows = await query(
    `SELECT c.tenant_id, COALESCE(SUM(c.credits_amount), 0)::bigint AS used
       FROM public.credit_consumptions c
      WHERE c.tenant_id = ANY($1::uuid[])
        AND c.consumed_at >= $2::timestamptz
        AND c.consumed_at < $3::timestamptz
        AND c.feature = $4
      GROUP BY c.tenant_id
      HAVING COALESCE(SUM(c.credits_amount), 0) > 0
      ORDER BY used DESC`,
    [tenantIds, cycleStart, cycleEnd, featureCode],
  )

  const breakdown = []
  for (const row of rows) {
    const agentUserId = tenantAgentByTenantId.get(row.tenant_id)
    const user = agentUserId ? await findUserById(agentUserId) : null
    breakdown.push({
      agent_user_id: agentUserId || null,
      agent_name: user?.name || user?.email || (agentUserId ? agentUserId : 'Agency pool'),
      used_credits: fromCreditUnits(row.used),
      source: agentUserId ? 'agent' : 'agency',
    })
  }
  return breakdown
}

async function buildFeatureQuotaRow(feature, context) {
  const {
    tenantIds,
    tenantAgentByTenantId,
    subscription,
  } = context

  let flagEnabled = true
  let creditsPerProperty = 0
  if (subscription) {
    const flagRows = await query(
      `SELECT enabled FROM public.package_feature_flags
        WHERE package_version_id = $1 AND feature_code = $2`,
      [subscription.package_version_id, feature.code],
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
  const used = await sumUsageForFeature(tenantIds, cycleStart, cycleEnd, feature.code)
  const typicalMonthly = creditsPerProperty * Number(subscription?.properties_committed || 0)
  const quotaDisplay = typicalMonthly > 0 ? typicalMonthly : Number(feature.credits_per_unit || 0)
  const usageRatio = quotaDisplay > 0 ? used / quotaDisplay : 0
  const enabled = Boolean(feature.active) && flagEnabled
  const agentBreakdown = await agentBreakdownForFeature(
    tenantIds,
    tenantAgentByTenantId,
    cycleStart,
    cycleEnd,
    feature.code,
  )

  return {
    enabled,
    registered: true,
    feature_code: feature.code,
    display_name: feature.display_name,
    category: feature.category,
    category_group: categoryGroupForFeature(feature),
    quota_used_this_cycle: used,
    quota_display: quotaDisplay,
    typical_monthly: typicalMonthly,
    usage_ratio: usageRatio,
    soft_warning: usageRatio >= 1 && typicalMonthly > 0,
    at_cap: usageRatio >= 1 && typicalMonthly > 0,
    near_cap: usageRatio >= 0.8 && usageRatio < 1 && typicalMonthly > 0,
    billing_cycle_start: cycleStart,
    billing_cycle_end: cycleEnd,
    used_credits: fromCreditUnits(used),
    typical_credits: fromCreditUnits(typicalMonthly),
    agent_breakdown: agentBreakdown,
  }
}

export async function buildAgencyFeatureQuotas(agencyId) {
  const tenantContext = await resolveAgencyTenantIds(agencyId)
  const subscription = await loadAgencySubscription(tenantContext.agencyTenantId)
  const features = await query(
    `SELECT id, code, display_name, category, credits_per_unit, active
       FROM public.metered_features
      WHERE active = true
      ORDER BY category, code`,
  )

  const quotas = []
  for (const feature of features) {
    const row = await buildFeatureQuotaRow(feature, {
      tenantIds: tenantContext.tenantIds,
      tenantAgentByTenantId: tenantContext.tenantAgentByTenantId,
      subscription,
    })
    if (row.enabled || row.used_credits > 0) {
      quotas.push(row)
    }
  }

  const groups = CATEGORY_GROUPS
    .map((group) => ({
      key: group.key,
      label: group.label,
      quotas: quotas.filter((quota) => quota.category_group === group.key),
    }))
    .filter((group) => group.quotas.length > 0)

  return {
    agency_id: agencyId,
    billing_cycle_start: subscription?.billing_cycle_start || null,
    billing_cycle_end: subscription?.billing_cycle_end || null,
    groups,
    quotas,
  }
}

export { CATEGORY_GROUPS }
