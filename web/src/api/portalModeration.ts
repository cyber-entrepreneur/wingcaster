/**
 * PA-MOD-001 queue list/actions + PA-MOD-002 detail types/helpers.
 *
 * Queue contract: docs/design/briefs/PA-MOD-001-portal-moderation-queue-brief.md
 * Detail contract: docs/design/briefs/PA-MOD-002-portal-moderation-detail-brief.md
 *
 * Every request carries `X-Wingcaster-Env` (LIVE/TEST) — never co-mingles envs.
 * Backend surface `[BE-BLOCKER-02b]` may still be landing; callers must handle 404.
 */
import { API_BASE, getElevatedToken } from '@/api/client'

// --- PA-MOD-001 queue types ---

export type PortalModerationStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'request_info'
  | 'portal_error'
  | 'expired'

export type PortalModerationRiskTier = 'low' | 'medium' | 'high' | 'unknown'

export type PortalModerationWithin = '24h' | '7d' | '30d' | 'all'

export interface PortalModerationListQuery {
  status?: PortalModerationStatus | string
  portal?: string
  country?: string
  risk?: PortalModerationRiskTier | 'any' | string
  within?: PortalModerationWithin | string
  q?: string
  page?: number
  pageSize?: number
  sort?: string
}

export interface PortalModerationAgent {
  id: string
  display_name: string
  avatar_url?: string | null
}

export interface PortalModerationAgency {
  id: string
  name: string
  tenant_url?: string
}

export interface PortalModerationListing {
  id: string
  title: string
  address_line?: string
  hero_image_url?: string | null
}

export interface PortalModerationPortal {
  code: string
  display_name: string
  country_code: string
  country_flag_emoji?: string
}

export interface PortalModerationLintCheck {
  code: string
  severity: 'pass' | 'warn' | 'fail' | string
  message: string
}

export interface PortalModerationValidatorLint {
  pass_count: number
  warn_count: number
  fail_count: number
  checks: PortalModerationLintCheck[]
}

export interface PortalModerationTenureRisk {
  tier: PortalModerationRiskTier
  score?: number
  signals?: string[]
}

/** Queue row shape from GET /api/admin/moderation/portals */
export interface PortalModerationListItem {
  id: string
  submitted_at: string
  sla_hours_remaining: number
  sla_hours_total: number
  agent: PortalModerationAgent
  agency: PortalModerationAgency
  listing: PortalModerationListing
  portal: PortalModerationPortal
  validator_lint: PortalModerationValidatorLint
  tenure_risk: PortalModerationTenureRisk
  status: PortalModerationStatus | string
  decision?: { reason_code?: string; notes?: string } | null
  is_own: boolean
  step_up_required: boolean
  env: 'live' | 'test' | string
}

export interface PortalModerationListResponse {
  submissions: PortalModerationListItem[]
  pagination: {
    page: number
    page_size: number
    total: number
    has_next: boolean
  }
  counts: {
    pending: number
    pending_at_risk: number
    approved_this_week: number
    rejected_this_week: number
    request_info_this_week?: number
    portal_error_this_week?: number
    expired?: number
  }
}

export interface PortalRegistryOption {
  code: string
  display_name: string
  country_codes: string[]
  is_active?: boolean
}

export interface BulkActionResult {
  succeeded: string[]
  failed: Array<{ id: string; error: string }>
}

export const REJECT_REASON_OPTIONS = [
  { value: 'portal_outage', label: 'Portal outage' },
  { value: 'fails_portal_validation', label: 'Fails portal validation' },
  { value: 'duplicate_listing', label: 'Duplicate listing' },
  { value: 'suspected_fraud', label: 'Suspected fraud' },
  { value: 'insufficient_photos', label: 'Insufficient photos' },
  { value: 'compliance_conflict', label: 'Compliance conflict' },
  { value: 'other', label: 'Other' },
] as const

export const REQUEST_INFO_REASON_OPTIONS = [
  { value: 'missing_trakheesi', label: 'Missing trakheesi number' },
  { value: 'photo_count_below_min', label: 'Photo count below minimum' },
  { value: 'description_too_short', label: 'Description too short' },
  { value: 'category_mapping_unclear', label: 'Category mapping unclear' },
  { value: 'broker_license_expired', label: 'Broker license expired' },
  { value: 'other', label: 'Other' },
] as const

function readEnvHeader(): 'live' | 'test' {
  try {
    const raw = sessionStorage.getItem('wingcaster.env') ?? localStorage.getItem('wingcaster.env')
    if (raw === 'test' || raw === 'TEST') return 'test'
  } catch {
    /* private mode */
  }
  return 'live'
}

function readAuthToken(): string | null {
  try {
    return localStorage.getItem('fi_token') || localStorage.getItem('sa_token')
  } catch {
    return null
  }
}

function buildHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = readAuthToken()
  if (token) h.Authorization = `Bearer ${token}`
  const elevated = getElevatedToken()
  if (elevated) h['X-Elevated-Token'] = elevated
  h['X-Wingcaster-Env'] = readEnvHeader()
  return h
}

async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`
  const res = await fetch(url, {
    ...options,
    headers: { ...buildHeaders(), ...(options?.headers || {}) },
  })
  const bodyText = await res.text()
  const parseJson = () => {
    if (!bodyText) return null
    try {
      return JSON.parse(bodyText)
    } catch {
      return null
    }
  }

  if (!res.ok) {
    const err = parseJson() || { error: `Request failed (${res.status})`, status: res.status }
    const error = new Error((err as { error?: string }).error || `HTTP ${res.status}`) as Error &
      Record<string, unknown>
    Object.assign(error, err as Record<string, unknown>, { status: res.status })
    throw error
  }

  if (!bodyText) return null as T
  return parseJson() as T
}

function toQuery(params: PortalModerationListQuery): string {
  const sp = new URLSearchParams()
  if (params.status) sp.set('status', params.status)
  if (params.portal) sp.set('portal', params.portal)
  if (params.country) sp.set('country', params.country)
  if (params.risk && params.risk !== 'any') sp.set('risk', params.risk)
  if (params.within) sp.set('within', params.within)
  if (params.q && params.q.trim().length >= 2) sp.set('q', params.q.trim())
  if (params.page) sp.set('page', String(params.page))
  if (params.pageSize) sp.set('pageSize', String(params.pageSize))
  if (params.sort) sp.set('sort', params.sort)
  const qs = sp.toString()
  return qs ? `?${qs}` : ''
}

/** GET /api/admin/moderation/portals */
export function listPortalModeration(
  query: PortalModerationListQuery = {},
): Promise<PortalModerationListResponse> {
  return requestJson(`/admin/moderation/portals${toQuery(query)}`)
}

/** GET /api/admin/portals — portal_registry filter options */
export async function listPortalRegistryOptions(): Promise<PortalRegistryOption[]> {
  const body = await requestJson<PortalRegistryOption[] | { portals: PortalRegistryOption[] }>(
    '/admin/portals',
  )
  if (Array.isArray(body)) return body
  return body?.portals ?? []
}

export function approvePortalSubmission(submissionId: string): Promise<unknown> {
  return requestJson(`/admin/moderation/portals/${encodeURIComponent(submissionId)}/approve`, {
    method: 'POST',
    body: '{}',
  })
}

export function rejectPortalSubmission(
  submissionId: string,
  payload: { reason_code: string; notes: string },
): Promise<unknown> {
  return requestJson(`/admin/moderation/portals/${encodeURIComponent(submissionId)}/reject`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function requestInfoPortalSubmission(
  submissionId: string,
  payload: { reason_code: string; notes: string },
): Promise<unknown> {
  return requestJson(`/admin/moderation/portals/${encodeURIComponent(submissionId)}/request-info`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function undoApprovePortalSubmission(submissionId: string): Promise<unknown> {
  return requestJson(`/admin/moderation/portals/${encodeURIComponent(submissionId)}/undo-approve`, {
    method: 'POST',
    body: '{}',
  })
}

export function undoRejectPortalSubmission(submissionId: string): Promise<unknown> {
  return requestJson(`/admin/moderation/portals/${encodeURIComponent(submissionId)}/undo-reject`, {
    method: 'POST',
    body: '{}',
  })
}

export function retryPublishPortalSubmission(submissionId: string): Promise<unknown> {
  return requestJson(`/admin/moderation/portals/${encodeURIComponent(submissionId)}/retry-publish`, {
    method: 'POST',
    body: '{}',
  })
}

export function bulkApprovePortalSubmissions(submissionIds: string[]): Promise<BulkActionResult> {
  return requestJson('/admin/moderation/portals/bulk-approve', {
    method: 'POST',
    body: JSON.stringify({ submission_ids: submissionIds }),
  })
}

export function bulkRejectPortalSubmissions(
  submissionIds: string[],
  payload: { reason_code: string; notes: string },
): Promise<BulkActionResult> {
  return requestJson('/admin/moderation/portals/bulk-reject', {
    method: 'POST',
    body: JSON.stringify({ submission_ids: submissionIds, ...payload }),
  })
}

export function bulkRequestInfoPortalSubmissions(
  submissionIds: string[],
  payload: { reason_code: string; notes: string },
): Promise<BulkActionResult> {
  return requestJson('/admin/moderation/portals/bulk-request-info', {
    method: 'POST',
    body: JSON.stringify({ submission_ids: submissionIds, ...payload }),
  })
}

/** CSV export URL (same query as list). Caller triggers browser download. */
export function portalModerationCsvPath(query: PortalModerationListQuery = {}): string {
  return `${API_BASE}/admin/moderation/portals.csv${toQuery(query)}`
}

// --- PA-MOD-002 detail types + helpers ---

export type ModerationStatus =
  | 'pending'
  | 'pending_moderation'
  | 'approved'
  | 'rejected'
  | 'request_info'
  | 'portal_error'
  | 'expired'
  | 'pending_second_approval'

export type TenureRiskTier = 'low' | 'medium' | 'high' | 'unknown'

export type ValidatorSeverity = 'pass' | 'warn' | 'fail'

export interface ValidatorLintCheck {
  code: string
  severity: ValidatorSeverity
  message: string
  expected?: string
  actual?: string
}

/** Detail view shape from GET /api/admin/moderation/portals/:submissionId */
export interface PortalModerationSubmission {
  id: string
  submitted_at: string
  status: ModerationStatus
  env: 'live' | 'test'
  is_own: boolean
  is_already_decided: boolean
  step_up_required: boolean
  decision?: {
    actor_name?: string
    actor_id?: string
    decided_at?: string
    reason_code?: string
    notes?: string
    state?: string
  } | null
  listing: {
    id: string
    title: string
    address_line: string
    hero_image_url?: string | null
  }
  listing_preview: {
    hero_image_url?: string | null
    gallery?: string[]
    price: { amount_minor: number; currency: string; basis: string }
    specs: { beds: number; baths: number; area_m2: number }
    amenities: string[]
    description: string
    agent_contact: {
      phone_masked: string
      email_masked: string
      whatsapp_deeplink?: string | null
    }
  }
  agent: {
    id: string
    display_name: string
    avatar_url?: string | null
  }
  agent_context: {
    wingcaster_tenure_month: string
    portfolio_size: number
    prior_decision_summary_30d: {
      approved: number
      rejected: number
      request_info: number
    }
  }
  agency: {
    id: string
    name: string
    tenant_url: string
    two_person_reject_required?: boolean
  }
  portal: {
    code: string
    display_name: string
    country_code: string
    country_flag_emoji?: string
  }
  validator_lint: {
    pass_count?: number
    warn_count?: number
    fail_count?: number
    checks: ValidatorLintCheck[]
  }
  tenure_risk: {
    tier: TenureRiskTier
    score?: number
    signals?: string[]
    reasons?: string[]
  }
  portal_payload_preview: Record<string, unknown> | unknown
  notification_previews: {
    approve: string
    reject: string
    request_info: string
  }
  queue_position?: {
    position: number
    total: number
  }
}

export interface PortalModerationDetailResponse {
  submission: PortalModerationSubmission
}

export interface SubmissionSiblingResponse {
  next_submission_id: string | null
}

export interface SubmissionHistoryRow {
  portal_code: string
  portal_display_name?: string
  submitted_at: string
  status: string
  decided_at?: string | null
  decided_by?: string | null
}

export interface AuditTrailEvent {
  id?: string
  at: string
  actor?: string | null
  kind: string
  description: string
}

export interface ModerationActionResult {
  state?: string
  approval_request_id?: string
  status?: string
  error?: string
}

export interface RevealContactResult {
  phone_full?: string
  email_full?: string
}

export function reasonLabel(
  options: ReadonlyArray<{ value: string; label: string }>,
  code: string,
): string {
  return options.find((o) => o.value === code)?.label ?? code
}

export function substituteNotificationPreview(
  template: string,
  vars: { reason_code_label?: string; notes?: string },
): string {
  return template
    .replace(/\{reason_code_label\}/g, vars.reason_code_label ?? '—')
    .replace(/\{notes\}/g, vars.notes?.trim() ? vars.notes.trim() : '—')
}

export function formatTenureMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return ym
  const date = new Date(Date.UTC(y, m - 1, 1))
  return date.toLocaleString('en', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export function formatPriceMinor(amountMinor: number, currency: string): string {
  const major = amountMinor / 100
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(major)
  } catch {
    return `${currency} ${major.toLocaleString('en')}`
  }
}

export function lintCounts(checks: ValidatorLintCheck[]): {
  pass: number
  warn: number
  fail: number
} {
  let pass = 0
  let warn = 0
  let fail = 0
  for (const c of checks) {
    if (c.severity === 'fail') fail += 1
    else if (c.severity === 'warn') warn += 1
    else pass += 1
  }
  return { pass, warn, fail }
}

export function sortLintChecks(checks: ValidatorLintCheck[]): ValidatorLintCheck[] {
  const rank: Record<ValidatorSeverity, number> = { fail: 0, warn: 1, pass: 2 }
  return [...checks].sort((a, b) => rank[a.severity] - rank[b.severity])
}

export function moderationStatusLabel(status: ModerationStatus | string): string {
  switch (status) {
    case 'pending':
    case 'pending_moderation':
      return 'Pending'
    case 'approved':
      return 'Approved'
    case 'rejected':
      return 'Rejected'
    case 'request_info':
      return 'Request info'
    case 'portal_error':
      return 'Portal error'
    case 'expired':
      return 'Expired'
    case 'pending_second_approval':
      return 'Pending second approval'
    default:
      return status
  }
}

export function isHighRisk(tier: TenureRiskTier | undefined): boolean {
  return tier === 'high'
}

export function requiresTwoPersonReject(
  submission: Pick<PortalModerationSubmission, 'tenure_risk' | 'agency'>,
): boolean {
  return (
    isHighRisk(submission.tenure_risk?.tier) &&
    Boolean(submission.agency?.two_person_reject_required)
  )
}
