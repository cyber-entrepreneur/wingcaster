/**
 * Shared types + helpers for AGN-MEM-002 / AGN-MEM-002b.
 * Backend list today returns raw agency_applications rows; we normalize client-side.
 */

import type { LcStatus } from '@/theme/status'

/** Application lifecycle statuses for the WF-02 approver queue. */
export type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'expired'

export type ApplicationWithin = '7d' | '30d' | '90d' | 'all'

/** Raw row shape from GET /api/agencies/:id/applications (array). */
export interface AgencyApplicationRaw {
  id: string
  agency_id: string
  applicant_user_id?: string | null
  agent_email?: string | null
  agent_name?: string | null
  agent_phone?: string | null
  message?: string | null
  current_listings_count?: number | null
  portfolio_url?: string | null
  availability?: string | null
  referral_source?: string | null
  status: string
  created_at?: string | null
  updated_at?: string | null
  expires_at?: string | null
  expected_response_by?: string | null
  approved_at?: string | null
  approved_by?: string | null
  approved_role?: string | null
  affiliation_mode?: string | null
  rejected_at?: string | null
  rejected_by?: string | null
  rejection_reason?: string | null
  /** Optional enriched fields if backend uplifts later. */
  city?: string | null
  years_experience?: number | null
  avatar_url?: string | null
}

export interface ApplicationApplicant {
  id: string
  display_name: string
  avatar_url: string | null
  city: string | null
  years_experience: number | null
  listings_count: number | null
  email: string | null
  email_masked: string
  phone: string | null
  phone_masked: string
  portfolio_url: string | null
}

export interface ApplicationRow {
  id: string
  status: ApplicationStatus
  applied_at: string
  expires_at: string | null
  message: string
  applicant: ApplicationApplicant
  decision: {
    decided_at: string | null
    decided_by: string | null
    role_assigned: string | null
    reason: string | null
  } | null
}

/** Brief: pending→draft ○, approved→published ●, rejected→closed ◆, expired→archived ▢ */
export function applicationStatusToLc(status: ApplicationStatus): LcStatus {
  switch (status) {
    case 'pending':
      return 'draft'
    case 'approved':
      return 'published'
    case 'rejected':
      return 'closed'
    case 'expired':
      return 'archived'
    default:
      return 'draft'
  }
}

export function applicationStatusLabel(status: ApplicationStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending'
    case 'approved':
      return 'Approved'
    case 'rejected':
      return 'Rejected'
    case 'expired':
      return 'Expired'
    default:
      return status
  }
}

export function normalizeApplicationStatus(raw: string | null | undefined): ApplicationStatus {
  const s = String(raw || '').toLowerCase()
  if (s === 'approved' || s === 'rejected' || s === 'expired' || s === 'pending') return s
  return 'pending'
}

function maskEmail(email: string | null | undefined): string {
  if (!email) return '—'
  const [local, domain] = email.split('@')
  if (!domain) return '***'
  const head = local.slice(0, 1) || '*'
  return `${head}***@${domain}`
}

function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '—'
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 4) return '+X XXX XXXX'
  return `+${digits.slice(0, 3)} X${'X'.repeat(Math.max(0, digits.length - 6))} ${digits.slice(-4)}`
}

export function normalizeApplication(raw: AgencyApplicationRaw): ApplicationRow {
  const status = normalizeApplicationStatus(raw.status)
  const name = (raw.agent_name || raw.agent_email || 'Applicant').trim()
  const email = raw.agent_email || null
  const phone = raw.agent_phone || null
  const decidedAt = raw.approved_at || raw.rejected_at || null
  const decidedBy = raw.approved_by || raw.rejected_by || null

  return {
    id: raw.id,
    status,
    applied_at: raw.created_at || raw.updated_at || new Date(0).toISOString(),
    expires_at: raw.expires_at || null,
    message: raw.message || '',
    applicant: {
      id: raw.applicant_user_id || raw.id,
      display_name: name,
      avatar_url: raw.avatar_url || null,
      city: raw.city || null,
      years_experience: raw.years_experience ?? null,
      listings_count: raw.current_listings_count ?? null,
      email,
      email_masked: maskEmail(email),
      phone,
      phone_masked: maskPhone(phone),
      portfolio_url: raw.portfolio_url || null,
    },
    decision:
      status === 'pending'
        ? null
        : {
            decided_at: decidedAt,
            decided_by: decidedBy,
            role_assigned: raw.approved_role || null,
            reason: raw.rejection_reason || null,
          },
  }
}

export function formatRelativeApplied(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'
  const diffMs = Math.max(0, now - then)
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 48) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function withinCutoffMs(within: ApplicationWithin, now = Date.now()): number | null {
  switch (within) {
    case '7d':
      return now - 7 * 86400000
    case '30d':
      return now - 30 * 86400000
    case '90d':
      return now - 90 * 86400000
    case 'all':
    default:
      return null
  }
}

export function startOfWeekMs(now = Date.now()): number {
  const d = new Date(now)
  const day = d.getUTCDay() // 0 Sun
  const diff = (day + 6) % 7 // Monday-start
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - diff)
  return d.getTime()
}

export function filterApplications(
  rows: ApplicationRow[],
  opts: {
    status: ApplicationStatus
    within: ApplicationWithin
    q: string
  },
): ApplicationRow[] {
  const cutoff = withinCutoffMs(opts.within)
  const q = opts.q.trim().toLowerCase()
  return rows.filter((row) => {
    if (row.status !== opts.status) return false
    if (cutoff != null && new Date(row.applied_at).getTime() < cutoff) return false
    if (q.length >= 1) {
      const hay = `${row.applicant.display_name} ${row.applicant.city || ''} ${row.applicant.email || ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

export function countApplications(rows: ApplicationRow[], now = Date.now()) {
  const weekStart = startOfWeekMs(now)
  let pending = 0
  let approved_this_week = 0
  let rejected_this_week = 0
  let expired_this_week = 0
  for (const row of rows) {
    if (row.status === 'pending') pending += 1
    const decided = row.decision?.decided_at
      ? new Date(row.decision.decided_at).getTime()
      : new Date(row.applied_at).getTime()
    if (row.status === 'approved' && decided >= weekStart) approved_this_week += 1
    if (row.status === 'rejected' && decided >= weekStart) rejected_this_week += 1
    if (row.status === 'expired' && decided >= weekStart) expired_this_week += 1
  }
  return { pending, approved_this_week, rejected_this_week, expired_this_week }
}

export function excerptMessage(message: string, max = 90): string {
  const trimmed = message.replace(/\s+/g, ' ').trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max).trimEnd()}…`
}

export function initials(name: string): string {
  return (name || 'A')
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export const APPLICATIONS_QUEUE_PATH = '/agency/members/applications'

/** Agent-side outcome deep-link (AGT-REC-004 / Agent 4). */
export function applicationOutcomePath(applicationId: string): string {
  return `/applications/${applicationId}`
}

export function buildQueueSearchParams(opts: {
  status: ApplicationStatus
  within: ApplicationWithin
  q: string
  page: number
  pageSize: number
}): string {
  const params = new URLSearchParams()
  params.set('status', opts.status)
  params.set('within', opts.within)
  if (opts.q) params.set('q', opts.q)
  if (opts.page > 1) params.set('page', String(opts.page))
  if (opts.pageSize !== 25) params.set('pageSize', String(opts.pageSize))
  return params.toString()
}
