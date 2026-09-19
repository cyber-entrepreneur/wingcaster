/**
 * AGN-CRD-001 — Agency wallet overview aggregation.
 */

import { query } from '../../db.js'
import { findUserById } from '../../identity.js'
import { agencyTenantId, listAgencyMemberships } from '../../tenant-authorization.js'
import { createCreditService } from './compat.js'
import { fromCreditUnits } from './scale.js'

const credits = createCreditService()
const DEFAULT_ALERT_THRESHOLD = 100

function roundCredits(value) {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

function startOfMonthIso() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
}

function daysAgoIso(days) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString()
}

export async function loadAgencyWalletSettings(agencyId) {
  const rows = await query(
    `SELECT agency_id, low_balance_alert_threshold, updated_by, updated_at
       FROM public.agency_credit_wallet_settings
      WHERE agency_id = $1`,
    [agencyId],
  )
  const row = rows[0]
  if (!row) {
    return {
      agency_id: agencyId,
      low_balance_alert_threshold: DEFAULT_ALERT_THRESHOLD,
      updated_by: null,
      updated_at: null,
      is_default: true,
    }
  }
  return {
    agency_id: row.agency_id,
    low_balance_alert_threshold: Number(row.low_balance_alert_threshold),
    updated_by: row.updated_by,
    updated_at: row.updated_at,
    is_default: false,
  }
}

export async function saveAgencyWalletSettings(agencyId, { low_balance_alert_threshold }, actorUserId) {
  const threshold = Number(low_balance_alert_threshold)
  if (!Number.isFinite(threshold) || threshold < 0) {
    return { ok: false, error: 'low_balance_alert_threshold must be a non-negative number' }
  }

  await query(
    `INSERT INTO public.agency_credit_wallet_settings (
       agency_id, low_balance_alert_threshold, updated_by, created_at, updated_at
     ) VALUES ($1, $2, $3, NOW(), NOW())
     ON CONFLICT (agency_id) DO UPDATE SET
       low_balance_alert_threshold = EXCLUDED.low_balance_alert_threshold,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()`,
    [agencyId, roundCredits(threshold), actorUserId],
  )

  return { ok: true, settings: await loadAgencyWalletSettings(agencyId) }
}

async function listAgencyAgentWallets(agencyId) {
  const memberships = await listAgencyMemberships(agencyId, { statuses: ['active'] })
  const agentUserIds = memberships
    .filter((m) => m.role !== 'guest')
    .map((m) => m.user_id)
    .filter(Boolean)

  if (!agentUserIds.length) return []

  const walletRows = await query(
    `SELECT scope_id AS user_id, credits_remaining, credits_reserved
       FROM public.credit_wallets
      WHERE scope = 'agent' AND scope_id = ANY($1::uuid[])`,
    [agentUserIds],
  )
  const walletByUser = new Map(walletRows.map((row) => [row.user_id, row]))

  const allocations = []
  for (const userId of agentUserIds) {
    const wallet = walletByUser.get(userId)
    const user = await findUserById(userId)
    const balance = fromCreditUnits(wallet?.credits_remaining || 0)
    const reserved = fromCreditUnits(wallet?.credits_reserved || 0)
    if (balance <= 0 && reserved <= 0) continue
    allocations.push({
      agent_user_id: userId,
      agent_name: user?.name || user?.email || userId,
      credits_remaining: roundCredits(balance),
      credits_reserved: roundCredits(reserved),
    })
  }

  allocations.sort((a, b) => b.credits_remaining - a.credits_remaining)
  return allocations
}

async function sumConsumptionsForTenants(tenantIds, sinceIso) {
  if (!tenantIds.length) return 0
  const rows = await query(
    `SELECT COALESCE(SUM(credits_amount), 0)::bigint AS total
       FROM public.credit_consumptions
      WHERE tenant_id = ANY($1::uuid[])
        AND consumed_at >= $2`,
    [tenantIds, sinceIso],
  )
  return fromCreditUnits(rows[0]?.total || 0)
}

export async function buildAgencyWalletOverview(agencyId) {
  const [agencyBalance, settings, agentAllocations] = await Promise.all([
    credits.balance('agency', agencyId),
    loadAgencyWalletSettings(agencyId),
    listAgencyAgentWallets(agencyId),
  ])

  const agencyPool = roundCredits(agencyBalance.credits_remaining || 0)
  const agencyReserved = roundCredits(agencyBalance.credits_reserved || 0)
  const allocatedTotal = roundCredits(
    agentAllocations.reduce((sum, row) => sum + row.credits_remaining, 0),
  )

  const tenantIds = [agencyBalance.tenant_id]
  if (agentAllocations.length) {
    const agentTenantRows = await query(
      `SELECT tenant_id FROM public.credit_wallets
        WHERE scope = 'agent' AND scope_id = ANY($1::uuid[])`,
      [agentAllocations.map((a) => a.agent_user_id)],
    )
    tenantIds.push(...agentTenantRows.map((r) => r.tenant_id))
  }

  const mtdSpend = roundCredits(await sumConsumptionsForTenants(tenantIds, startOfMonthIso()))
  const last30Spend = roundCredits(await sumConsumptionsForTenants(tenantIds, daysAgoIso(30)))
  const burnRateDaily = roundCredits(last30Spend / 30)
  const totalAvailable = roundCredits(agencyPool + allocatedTotal - agencyReserved)
  const daysUntilExhausted = burnRateDaily > 0
    ? Math.max(0, Math.floor(totalAvailable / burnRateDaily))
    : null

  const transactions = await credits.transactions('agency', agencyId, { limit: 50 })
  const isLowBalance = agencyPool < settings.low_balance_alert_threshold

  const allocationSlices = [
    ...agentAllocations.map((row) => ({
      key: row.agent_user_id,
      label: row.agent_name,
      credits: row.credits_remaining,
      kind: 'agent',
    })),
    ...(agencyPool > 0
      ? [{
        key: 'unallocated',
        label: 'Unallocated pool',
        credits: agencyPool,
        kind: 'pool',
      }]
      : []),
  ]

  return {
    agency_id: agencyId,
    balance: {
      credits_remaining: agencyPool,
      credits_reserved: agencyReserved,
      currency: agencyBalance.currency || 'USD',
      hard_block: agencyPool <= 0,
    },
    kpis: {
      wallet_balance: agencyPool,
      mtd_spend: mtdSpend,
      burn_rate_daily: burnRateDaily,
      days_until_exhausted: daysUntilExhausted,
      allocated_to_agents: allocatedTotal,
      total_available: totalAvailable,
    },
    allocation: {
      slices: allocationSlices,
      allocated_total: allocatedTotal,
      unallocated_pool: agencyPool,
    },
    transactions,
    settings,
    alerts: {
      is_low_balance: isLowBalance,
      threshold: settings.low_balance_alert_threshold,
    },
    tenant_id: agencyTenantId(agencyId),
  }
}
