/**
 * Shared helpers for account-recovery list + detail serialization.
 */

import { findOne, query } from '../db.js'
import { deriveAccountValueTier } from './account-value-tier.js'
import {
  deriveReasonCategory,
  maskDisplayName,
  maskEmail,
  maskIp,
  maskPhone,
  maskUsername,
  maskUserAgent,
} from './mask.js'

export const SLA_HOURS_TOTAL = 24
export const PENDING_AT_RISK_HOURS = 4
export const DEFAULT_PAGE_SIZE = 25
export const MAX_PAGE_SIZE = 100

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export function resolveRequestEnv(req) {
  const header = req?.get?.('x-wingcaster-env') || req?.headers?.['x-wingcaster-env']
  const raw = String(header || process.env.WINGCASTER_ENV || 'live').trim().toLowerCase()
  if (raw === 'test' || raw === 'staging') return raw
  return 'live'
}

export function caseCreatedAt(recoveryCase) {
  return recoveryCase?.created_at || recoveryCase?.requested_at || null
}

export function slaHoursRemaining(recoveryCase, now = new Date()) {
  const created = caseCreatedAt(recoveryCase)
  if (!created) return SLA_HOURS_TOTAL
  const start = new Date(created).getTime()
  if (!Number.isFinite(start)) return SLA_HOURS_TOTAL
  const elapsedHours = (now.getTime() - start) / (60 * 60 * 1000)
  return Math.round((SLA_HOURS_TOTAL - elapsedHours) * 100) / 100
}

export function parseWithin(within = '7d') {
  const value = String(within || '7d').toLowerCase()
  if (value === 'all') return null
  if (value === '24h') return 24 * 60 * 60 * 1000
  if (value === '30d') return 30 * 24 * 60 * 60 * 1000
  return 7 * 24 * 60 * 60 * 1000
}

export function parsePageParams(queryParams = {}) {
  const page = Math.max(1, Number.parseInt(String(queryParams.page || '1'), 10) || 1)
  let pageSize = Number.parseInt(String(queryParams.pageSize || queryParams.page_size || DEFAULT_PAGE_SIZE), 10)
  if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = DEFAULT_PAGE_SIZE
  pageSize = Math.min(MAX_PAGE_SIZE, pageSize)
  return { page, pageSize }
}

/**
 * Evidence summary — graceful when Agent 3 table is absent.
 * @param {string} caseId
 */
export async function loadEvidenceSummary(caseId) {
  const empty = { file_count: 0, files: [] }
  if (!caseId) return empty
  try {
    const exists = await query(
      `SELECT to_regclass('public.account_recovery_evidence') AS reg`,
    )
    const reg = Array.isArray(exists) ? exists[0]?.reg : exists?.rows?.[0]?.reg
    if (!reg) return empty

    const rowsRaw = await query(
      `SELECT id, filename, uploaded_at, size_bytes, content_type
         FROM public.account_recovery_evidence
        WHERE case_id = $1
        ORDER BY uploaded_at ASC NULLS LAST, created_at ASC NULLS LAST
        LIMIT 50`,
      [caseId],
    )
    const rows = Array.isArray(rowsRaw) ? rowsRaw : (rowsRaw?.rows || [])
    return {
      file_count: rows.length,
      files: rows.map((r) => ({
        id: r.id || undefined,
        filename: r.filename,
        uploaded_at: r.uploaded_at,
        size_bytes: r.size_bytes != null ? Number(r.size_bytes) : null,
        content_type: r.content_type || null,
      })),
    }
  } catch {
    return empty
  }
}

async function loadAgencyContext(userId) {
  if (!userId) return { agency: null, plan_tier: null, role: null }
  try {
    const membershipRaw = await query(
      `SELECT tm.tenant_id, tm.role
         FROM public.tenant_memberships tm
        WHERE tm.user_id = $1
          AND tm.status = 'active'
          AND tm.affiliation_mode IS DISTINCT FROM 'personal'
          AND tm.tenant_id LIKE 'agency:%'
        ORDER BY CASE WHEN tm.role = 'owner' THEN 0 ELSE 1 END, tm.created_at ASC NULLS LAST
        LIMIT 1`,
      [String(userId)],
    )
    const membership = (Array.isArray(membershipRaw) ? membershipRaw : membershipRaw?.rows || [])[0]
    if (!membership) {
      const agent = await findOne('agents', (a) => a.id === userId || a.user_id === userId)
      if (agent?.agency_id) {
        const agency = await findOne('agencies', (g) => g.id === agent.agency_id)
        return {
          agency: agency
            ? {
                id: agency.id,
                name: agency.name,
                tenant_url: `/admin/tenants/${agency.id}`,
              }
            : null,
          plan_tier: null,
          role: agent.role || 'agent',
        }
      }
      return { agency: null, plan_tier: null, role: null }
    }

    const agencyId = String(membership.tenant_id).replace(/^agency:/, '')
    const agency = await findOne('agencies', (g) => g.id === agencyId || g.id === membership.tenant_id)
    let planTier = null
    try {
      const tierRaw = await query(
        `SELECT pp.tier
           FROM public.tenant_memberships tm
           JOIN public.credit_wallets w
             ON (
               (w.scope = 'agency' AND (
                 w.scope_id = REPLACE(tm.tenant_id, 'agency:', '')
                 OR ('agency:' || w.scope_id) = tm.tenant_id
               ))
               OR w.tenant_id::text = tm.tenant_id
             )
           JOIN public.tenant_subscriptions s ON s.tenant_id = w.tenant_id
           JOIN public.product_package_versions v ON v.id = s.package_version_id
           JOIN public.product_packages pp ON pp.id = v.package_id
          WHERE tm.user_id = $1
            AND tm.status = 'active'
            AND tm.affiliation_mode IS DISTINCT FROM 'personal'
            AND tm.tenant_id LIKE 'agency:%'
          ORDER BY s.created_at DESC NULLS LAST
          LIMIT 1`,
        [String(userId)],
      )
      planTier = (Array.isArray(tierRaw) ? tierRaw : tierRaw?.rows || [])[0]?.tier || null
    } catch {
      planTier = null
    }

    return {
      agency: agency
        ? {
            id: agency.id,
            name: agency.name,
            tenant_url: `/admin/tenants/${agency.id}`,
          }
        : {
            id: agencyId,
            name: agencyId,
            tenant_url: `/admin/tenants/${agencyId}`,
          },
      plan_tier: planTier,
      role: membership.role === 'owner' ? 'agency_owner' : (membership.role || 'agent'),
    }
  } catch {
    return { agency: null, plan_tier: null, role: null }
  }
}

/**
 * Resolve tier for a case — prefer stored columns, else derive.
 */
export async function resolveCaseTier(recoveryCase) {
  if (recoveryCase?.account_value_tier) {
    return {
      account_value_tier: recoveryCase.account_value_tier,
      requires_two_person: recoveryCase.requires_two_person === true
        || recoveryCase.account_value_tier === 'high_value',
    }
  }
  try {
    const derived = await deriveAccountValueTier(recoveryCase?.user_id)
    return {
      account_value_tier: derived.tier,
      requires_two_person: derived.requires_two_person,
    }
  } catch {
    return { account_value_tier: 'standard', requires_two_person: false }
  }
}

export async function buildAgentPayload(userId) {
  if (!userId) return null
  const user = await findOne('users', (u) => u.id === userId)
  const agent = await findOne('agents', (a) => a.id === userId || a.user_id === userId)
  const displayName = agent?.name || user?.name || user?.email || 'Unknown'
  const email = user?.email || agent?.email || null
  const phone = user?.phone || agent?.phone || null
  const username = user?.username || agent?.slug || null
  const { agency, plan_tier, role } = await loadAgencyContext(userId)

  return {
    id: userId,
    display_name_masked: maskDisplayName(displayName),
    display_name_full: displayName,
    avatar_url: agent?.avatar_url || agent?.photo_url || user?.avatar_url || null,
    email_masked: maskEmail(email),
    email_full: email,
    phone_masked: maskPhone(phone),
    phone_full: phone,
    username_masked: maskUsername(username),
    username_full: username,
    role: role || agent?.role || user?.role || 'agent',
    agency,
    plan_tier,
  }
}

export function buildListCaseRow({
  recoveryCase,
  agent,
  evidence,
  tiers,
  viewerId,
  env,
  now = new Date(),
}) {
  const contact = recoveryCase.contact || ''
  return {
    id: recoveryCase.id,
    created_at: caseCreatedAt(recoveryCase),
    sla_hours_remaining: slaHoursRemaining(recoveryCase, now),
    sla_hours_total: SLA_HOURS_TOTAL,
    status: recoveryCase.status,
    reason: recoveryCase.reason || '',
    reason_category: deriveReasonCategory(recoveryCase.reason, recoveryCase.reason_category),
    preferred_channel: recoveryCase.preferred_channel || null,
    contact: maskPhone(contact) || maskEmail(contact) || contact,
    requested_ip: maskIp(recoveryCase.requested_ip || recoveryCase.ip),
    agent,
    evidence: evidence || { file_count: 0, files: [] },
    account_value_tier: tiers.account_value_tier,
    requires_two_person: tiers.requires_two_person,
    is_own: Boolean(viewerId && recoveryCase.user_id && String(recoveryCase.user_id) === String(viewerId)),
    env,
  }
}

export function phoneCountryHint(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('971')) return 'AE'
  if (digits.startsWith('961')) return 'LB'
  if (digits.startsWith('966')) return 'SA'
  if (digits.startsWith('974')) return 'QA'
  if (digits.startsWith('973')) return 'BH'
  if (digits.startsWith('965')) return 'KW'
  if (digits.startsWith('968')) return 'OM'
  if (digits.startsWith('20')) return 'EG'
  if (digits.startsWith('1') && digits.length === 11) return 'US'
  return null
}

export function computeMismatches({ recoveryCase, onFile }) {
  const mismatches = []
  const providedContact = recoveryCase.contact || ''
  const channel = recoveryCase.preferred_channel || ''
  if (providedContact && channel === 'email' && onFile.email_full) {
    if (String(providedContact).toLowerCase() !== String(onFile.email_full).toLowerCase()) {
      mismatches.push({
        field: 'email',
        detail: 'Provided email does not match account email.',
      })
    }
  }
  if (providedContact && ['whatsapp', 'sms', 'phone_call', 'phone'].includes(channel) && onFile.phone_full) {
    const providedDigits = String(providedContact).replace(/\D/g, '')
    const onFileDigits = String(onFile.phone_full).replace(/\D/g, '')
    if (providedDigits && onFileDigits && providedDigits !== onFileDigits) {
      const a = phoneCountryHint(providedContact)
      const b = phoneCountryHint(onFile.phone_full)
      if (a && b && a !== b) {
        mismatches.push({
          field: 'phone',
          detail: `Provided contact phone country (${a}) differs from registered phone country (${b}).`,
        })
      } else {
        mismatches.push({
          field: 'phone',
          detail: 'Provided contact phone does not match registered phone.',
        })
      }
    }
  }
  return mismatches
}

export function buildProvidedBlock(recoveryCase) {
  const contact = recoveryCase.contact || ''
  const channel = recoveryCase.preferred_channel || 'email'
  const contactMasked = channel === 'email' ? maskEmail(contact) : maskPhone(contact)
  const ip = recoveryCase.requested_ip || recoveryCase.ip || null
  const ua = recoveryCase.requested_user_agent || recoveryCase.user_agent || null
  return {
    preferred_channel: channel,
    contact_masked: contactMasked || '***',
    contact_full: contact || null,
    request_ip_masked: maskIp(ip),
    request_ip_full: ip,
    request_user_agent_masked: maskUserAgent(ua),
    request_user_agent_full: ua,
  }
}

export async function buildOnFileBlock(userId, agentPayload) {
  const user = await findOne('users', (u) => u.id === userId)
  const agent = await findOne('agents', (a) => a.id === userId || a.user_id === userId)
  const email = user?.email || agent?.email || agentPayload?.email_full || null
  const phone = user?.phone || agent?.phone || agentPayload?.phone_full || null
  const username = user?.username || agent?.slug || agentPayload?.username_full || null

  let tenureDays = null
  const created = user?.created_at || agent?.created_at
  if (created) {
    const ms = Date.now() - new Date(created).getTime()
    if (Number.isFinite(ms) && ms >= 0) tenureDays = Math.floor(ms / (24 * 60 * 60 * 1000))
  }

  let lastLogin = user?.last_successful_login_at || user?.last_login_at || null
  if (!lastLogin) {
    try {
      const loginRaw = await query(
        `SELECT created_at
           FROM public.activity_log
          WHERE agent_id = $1
            AND type IN ('login_success', 'user_signed_in', 'session_created')
          ORDER BY created_at DESC
          LIMIT 1`,
        [String(userId)],
      )
      lastLogin = (Array.isArray(loginRaw) ? loginRaw : loginRaw?.rows || [])[0]?.created_at || null
    } catch {
      lastLogin = null
    }
  }

  return {
    email_masked: maskEmail(email),
    email_full: email,
    phone_masked: maskPhone(phone),
    phone_full: phone,
    username_masked: maskUsername(username),
    username_full: username,
    agency: agentPayload?.agency || null,
    plan_tier: agentPayload?.plan_tier || null,
    role: agentPayload?.role || agent?.role || user?.role || 'agent',
    tenure_days: tenureDays,
    last_successful_login_at: lastLogin,
  }
}

export async function buildTimeline(recoveryCase) {
  const entries = []
  const caseId = recoveryCase.id
  const userId = recoveryCase.user_id

  try {
    const rowsRaw = await query(
      `SELECT type, meta, created_at
         FROM public.activity_log
        WHERE (
          (meta->>'case_id') = $1
          OR agent_id = $2
        )
          AND type ILIKE '%recovery%'
        ORDER BY created_at ASC
        LIMIT 50`,
      [String(caseId), userId ? String(userId) : null],
    )
    const rows = Array.isArray(rowsRaw) ? rowsRaw : (rowsRaw?.rows || [])
    for (const row of rows) {
      const meta = typeof row.meta === 'string' ? JSON.parse(row.meta) : (row.meta || {})
      if (meta.case_id && String(meta.case_id) !== String(caseId) && row.type !== 'account_recovery_requested') {
        // Keep case-scoped events; allow agent-level recovery events without case_id only if recent to this case creation.
      }
      entries.push({
        at: row.created_at,
        channel: meta.preferred_channel || meta.channel || 'system',
        status: /fail|reject|expir/i.test(String(row.type)) ? 'failed' : 'info',
        message: humanizeActivity(row.type, meta, recoveryCase),
      })
    }
  } catch {
    // best-effort
  }

  if (!entries.length && caseCreatedAt(recoveryCase)) {
    entries.push({
      at: caseCreatedAt(recoveryCase),
      channel: 'system',
      status: 'info',
      message: 'Case escalated to PA review.',
    })
  }

  return entries
}

function humanizeActivity(type, meta, recoveryCase) {
  switch (type) {
    case 'account_recovery_requested':
      return `Recovery case submitted via ${meta.preferred_channel || recoveryCase.preferred_channel || 'unknown channel'}.`
    case 'account_recovery_approved':
      return 'Recovery approved — recovery link issued.'
    case 'account_recovery_rejected':
      return 'Recovery rejected.'
    case 'account_recovery_completed':
      return 'Applicant completed password reset.'
    case 'account_recovery_cast_vote':
      return `Vote recorded (${meta.vote || 'unknown'}).`
    default:
      return String(type || 'activity').replaceAll('_', ' ')
  }
}

export function buildFirstVote(recoveryCase) {
  if (!recoveryCase?.first_vote_reviewer_id || !recoveryCase?.first_vote) return null
  return {
    reviewer_id: recoveryCase.first_vote_reviewer_id,
    vote: recoveryCase.first_vote,
    at: recoveryCase.first_vote_at || null,
    notes: recoveryCase.first_vote_notes || '',
  }
}

export function buildCurrentReviewer(recoveryCase, viewerId) {
  const first = recoveryCase?.first_vote_reviewer_id || null
  const requiresTwo = recoveryCase?.requires_two_person === true
    || recoveryCase?.account_value_tier === 'high_value'
  const isFirstCandidate = !first
  const isSecondCandidate = Boolean(
    requiresTwo
    && first
    && viewerId
    && String(first) !== String(viewerId),
  )
  return {
    id: viewerId || null,
    is_first_reviewer_candidate: isFirstCandidate,
    is_second_reviewer_candidate: isSecondCandidate,
  }
}

export function buildDecision(recoveryCase) {
  if (!recoveryCase) return null
  if (recoveryCase.status === 'approved') {
    return {
      outcome: 'approved',
      at: recoveryCase.approved_at || recoveryCase.reviewed_at || null,
      by: recoveryCase.approved_by || recoveryCase.reviewed_by || null,
      notes: recoveryCase.review_notes || '',
    }
  }
  if (recoveryCase.status === 'rejected') {
    return {
      outcome: 'rejected',
      at: recoveryCase.rejected_at || recoveryCase.reviewed_at || null,
      by: recoveryCase.rejected_by || recoveryCase.reviewed_by || null,
      notes: recoveryCase.review_notes || '',
    }
  }
  return null
}

export function weekCutoff(now = new Date()) {
  return new Date(now.getTime() - WEEK_MS)
}

export function matchesSearch(recoveryCase, agent, q) {
  const needle = String(q || '').trim().toLowerCase()
  if (needle.length < 2) return true
  const id = String(recoveryCase.id || '').toLowerCase()
  const last4 = id.slice(-4)
  const haystacks = [
    id,
    last4,
    recoveryCase.email,
    recoveryCase.contact,
    agent?.display_name_full,
    agent?.display_name_masked,
    agent?.email_full,
    agent?.email_masked,
    agent?.phone_full,
    agent?.phone_masked,
    agent?.username_full,
    agent?.username_masked,
  ]
  return haystacks.some((h) => h && String(h).toLowerCase().includes(needle))
}

export function sortCases(rows, sort) {
  const key = String(sort || 'sla_remaining:asc').toLowerCase()
  const copy = [...rows]
  copy.sort((a, b) => {
    if (key === 'submitted_at:desc') {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }
    if (key === 'submitted_at:asc') {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    }
    if (key === 'agent_name:asc') {
      return String(a.agent?.display_name_full || '').localeCompare(String(b.agent?.display_name_full || ''))
    }
    // default sla_remaining:asc — lowest remaining first (at-risk first)
    const sla = (a.sla_hours_remaining ?? 0) - (b.sla_hours_remaining ?? 0)
    if (sla !== 0) return sla
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })
  return copy
}
