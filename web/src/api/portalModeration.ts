/**
 * Thin PA-MOD-001 API helpers for portal moderation queue list + actions.
 * Contract: docs/design/briefs/PA-MOD-001-portal-moderation-queue-brief.md §Backend contract.
 *
 * Every request carries `X-Wingcaster-Env` (LIVE/TEST) — never co-mingles envs.
 * Backend surface `[BE-BLOCKER-02b]` may still be landing; callers must handle 404.
 */
import { API_BASE, getElevatedToken } from '@/api/client'

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

export interface PortalModerationSubmission {
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
  submissions: PortalModerationSubmission[]
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
  { value: 'missing_trakheesi_number', label: 'Missing trakheesi number' },
  { value: 'photo_count_below_minimum', label: 'Photo count below minimum' },
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
