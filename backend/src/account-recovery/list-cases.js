/**
 * BE-ACR-01 — GET /api/admin/account-recovery list extension.
 */

import { findAll } from '../db.js'
import {
  PENDING_AT_RISK_HOURS,
  buildAgentPayload,
  buildListCaseRow,
  loadEvidenceSummary,
  matchesSearch,
  parsePageParams,
  parseWithin,
  resolveCaseTier,
  resolveRequestEnv,
  sortCases,
  weekCutoff,
} from './case-serializers.js'

const LIST_STATUSES = new Set([
  'pending_review',
  'approved',
  'rejected',
  'awaiting_info',
  'completed',
  'expired',
])

const TIER_FILTERS = new Set(['standard', 'elevated', 'high_value'])
const CHANNEL_FILTERS = new Set(['email', 'sms', 'whatsapp', 'phone_call'])

function withinWindow(iso, windowMs, now) {
  if (windowMs == null) return true
  if (!iso) return false
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return false
  return t >= (now.getTime() - windowMs)
}

function decisionAt(row) {
  return row.approved_at || row.rejected_at || row.reviewed_at || row.completed_at || row.updated_at || row.created_at
}

/**
 * @param {{ req: import('express').Request, viewerId: string }} args
 */
export async function listAccountRecoveryCases({ req, viewerId }) {
  const now = new Date()
  const env = resolveRequestEnv(req)
  const q = req.query || {}
  const statusRaw = String(q.status || 'pending_review').toLowerCase()
  const status = LIST_STATUSES.has(statusRaw) ? statusRaw : 'pending_review'
  const tier = q.tier ? String(q.tier).toLowerCase() : null
  const channel = q.channel ? String(q.channel).toLowerCase() : null
  const within = parseWithin(q.within || '7d')
  const search = String(q.q || '').trim()
  const sort = q.sort || 'sla_remaining:asc'
  const { page, pageSize } = parsePageParams(q)

  const all = await findAll('account_recovery_cases')
  const enriched = []

  for (const recoveryCase of all) {
    const tiers = await resolveCaseTier(recoveryCase)
    const agent = await buildAgentPayload(recoveryCase.user_id)
    const evidence = await loadEvidenceSummary(recoveryCase.id)
    const row = buildListCaseRow({
      recoveryCase,
      agent,
      evidence,
      tiers,
      viewerId,
      env,
      now,
    })
    // Keep raw fields for filtering/counts
    enriched.push({
      ...row,
      _raw: recoveryCase,
      _tiers: tiers,
    })
  }

  const filtered = enriched.filter((row) => {
    if (row.status !== status) return false
    if (tier && TIER_FILTERS.has(tier) && row.account_value_tier !== tier) return false
    if (channel && CHANNEL_FILTERS.has(channel) && row.preferred_channel !== channel) return false
    if (!withinWindow(row.created_at, within, now)) return false
    if (!matchesSearch(row._raw, row.agent, search)) return false
    return true
  })

  const sorted = sortCases(filtered, sort)
  const total = sorted.length
  const start = (page - 1) * pageSize
  const pageRows = sorted.slice(start, start + pageSize).map((row) => {
    const { _raw, _tiers, ...publicRow } = row
    return publicRow
  })

  const weekStart = weekCutoff(now)
  const counts = {
    pending_review: 0,
    pending_at_risk: 0,
    high_value_awaiting_two_person: 0,
    approved_this_week: 0,
    rejected_this_week: 0,
    awaiting_info_this_week: 0,
    completed_this_week: 0,
    expired_this_week: 0,
  }

  for (const row of enriched) {
    if (row.status === 'pending_review') {
      counts.pending_review += 1
      if (row.sla_hours_remaining < PENDING_AT_RISK_HOURS) counts.pending_at_risk += 1
      if (row.requires_two_person) counts.high_value_awaiting_two_person += 1
    }

    const at = decisionAt(row._raw)
    const atMs = at ? new Date(at).getTime() : NaN
    if (!Number.isFinite(atMs) || atMs < weekStart.getTime()) continue

    if (row.status === 'approved') counts.approved_this_week += 1
    else if (row.status === 'rejected') counts.rejected_this_week += 1
    else if (row.status === 'awaiting_info') counts.awaiting_info_this_week += 1
    else if (row.status === 'completed') counts.completed_this_week += 1
    else if (row.status === 'expired') counts.expired_this_week += 1
  }

  return {
    cases: pageRows,
    pagination: {
      page,
      page_size: pageSize,
      total,
      has_next: start + pageSize < total,
    },
    counts,
  }
}
