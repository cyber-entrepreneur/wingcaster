/**
 * AGN-CRD-004 — Standing credit allocation rules for an agency wallet.
 *
 * Rules apply to future top-ups only; existing balances are unchanged.
 * Percentage mode requires the sum of per-agent overrides to be ≤ 100%;
 * any remainder stays in the shared agency pool.
 */

import { randomUUID } from 'node:crypto'
import { query } from '../../db.js'
import { findUserById } from '../../identity.js'
import { listAgencyMemberships } from '../../tenant-authorization.js'

export const ALLOCATION_MODES = Object.freeze([
  'manual',
  'percentage',
  'cap_per_agent',
  'hybrid',
])

const DEFAULT_MODE = 'manual'

export function isAllocationMode(value) {
  return ALLOCATION_MODES.includes(value)
}

function roundPercentage(value) {
  if (value == null) return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100) / 100
}

function roundCap(value) {
  if (value == null) return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100) / 100
}

export function validateAllocationRulesPayload({ mode, overrides = [] }) {
  if (!isAllocationMode(mode)) {
    return { ok: false, error: `mode must be one of: ${ALLOCATION_MODES.join(', ')}` }
  }

  const normalized = []
  const seen = new Set()

  for (const row of overrides) {
    const agentUserId = row?.agent_user_id
    if (!agentUserId || typeof agentUserId !== 'string') {
      return { ok: false, error: 'Each override requires agent_user_id' }
    }
    if (seen.has(agentUserId)) {
      return { ok: false, error: 'Duplicate agent_user_id in overrides' }
    }
    seen.add(agentUserId)

    const percentage = row.percentage == null ? null : roundPercentage(row.percentage)
    const capUsd = row.cap_usd == null ? null : roundCap(row.cap_usd)

    if (percentage != null && (percentage < 0 || percentage > 100)) {
      return { ok: false, error: 'percentage must be between 0 and 100' }
    }
    if (capUsd != null && capUsd <= 0) {
      return { ok: false, error: 'cap_usd must be greater than 0' }
    }

    if (mode === 'percentage' && percentage == null) {
      return { ok: false, error: 'percentage overrides are required in percentage mode' }
    }
    if (mode === 'cap_per_agent' && capUsd == null) {
      return { ok: false, error: 'cap_usd overrides are required in cap_per_agent mode' }
    }
    if (mode === 'hybrid' && percentage == null && capUsd == null) {
      return { ok: false, error: 'hybrid overrides require percentage or cap_usd' }
    }
    if (mode === 'manual' && (percentage != null || capUsd != null)) {
      return { ok: false, error: 'manual mode does not accept per-agent overrides' }
    }

    normalized.push({
      agent_user_id: agentUserId,
      percentage,
      cap_usd: capUsd,
    })
  }

  if (mode === 'percentage' || mode === 'hybrid') {
    const total = normalized.reduce((sum, row) => sum + (row.percentage || 0), 0)
    if (total > 100) {
      return { ok: false, error: 'percentage overrides must sum to 100 or less' }
    }
  }

  return { ok: true, mode, overrides: normalized }
}

async function hydrateOverrideNames(overrides) {
  const hydrated = []
  for (const row of overrides) {
    const user = await findUserById(row.agent_user_id)
    hydrated.push({
      agent_user_id: row.agent_user_id,
      agent_name: user?.name || user?.email || row.agent_user_id,
      percentage: row.percentage == null ? null : Number(row.percentage),
      cap_usd: row.cap_usd == null ? null : Number(row.cap_usd),
    })
  }
  return hydrated
}

export async function loadAgencyCreditAllocationRules(agencyId) {
  const [ruleRows, overrideRows] = await Promise.all([
    query('SELECT * FROM agency_credit_allocation_rules WHERE agency_id = $1', [agencyId]),
    query(
      `SELECT agent_user_id, percentage, cap_usd
       FROM agency_credit_allocation_overrides
       WHERE agency_id = $1
       ORDER BY agent_user_id`,
      [agencyId],
    ),
  ])

  const rule = ruleRows[0]
  const overrides = await hydrateOverrideNames(overrideRows)
  const percentageTotal = overrides.reduce((sum, row) => sum + (row.percentage || 0), 0)

  return {
    agency_id: agencyId,
    mode: rule?.mode || DEFAULT_MODE,
    overrides,
    percentage_total: roundPercentage(percentageTotal) ?? 0,
    shared_pool_percentage: roundPercentage(Math.max(0, 100 - percentageTotal)) ?? 100,
    updated_by: rule?.updated_by || null,
    updated_at: rule?.updated_at || null,
    created_at: rule?.created_at || null,
    is_default: !rule,
  }
}

export async function listAgencyAgentsForAllocation(agencyId) {
  const memberships = await listAgencyMemberships(agencyId)
  const agents = []
  for (const membership of memberships) {
    const user = await findUserById(membership.user_id)
    agents.push({
      user_id: membership.user_id,
      name: user?.name || user?.email || membership.user_id,
      role: membership.role,
    })
  }
  agents.sort((a, b) => a.name.localeCompare(b.name))
  return agents
}

export async function saveAgencyCreditAllocationRules(agencyId, { mode, overrides }, updatedBy) {
  const validation = validateAllocationRulesPayload({ mode, overrides })
  if (!validation.ok) return validation

  const now = new Date().toISOString()
  const existing = await query(
    'SELECT agency_id FROM agency_credit_allocation_rules WHERE agency_id = $1',
    [agencyId],
  )

  if (existing[0]) {
    await query(
      `UPDATE agency_credit_allocation_rules
       SET mode = $2, updated_by = $3, updated_at = $4
       WHERE agency_id = $1`,
      [agencyId, validation.mode, updatedBy, now],
    )
  } else {
    await query(
      `INSERT INTO agency_credit_allocation_rules (agency_id, mode, updated_by, updated_at, created_at)
       VALUES ($1, $2, $3, $4, $4)`,
      [agencyId, validation.mode, updatedBy, now],
    )
  }

  await query('DELETE FROM agency_credit_allocation_overrides WHERE agency_id = $1', [agencyId])

  for (const row of validation.overrides) {
    await query(
      `INSERT INTO agency_credit_allocation_overrides
         (id, agency_id, agent_user_id, percentage, cap_usd, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6)`,
      [
        randomUUID(),
        agencyId,
        row.agent_user_id,
        row.percentage,
        row.cap_usd,
        now,
      ],
    )
  }

  return { ok: true, rules: await loadAgencyCreditAllocationRules(agencyId) }
}
