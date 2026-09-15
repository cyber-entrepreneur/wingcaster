/**
 * Thin PA-ACR-001 API helpers for account-recovery queue list + reveal-audit + CSV.
 * Contract: docs/design/briefs/PA-ACR-001-account-recovery-queue-brief.md §Backend contract.
 *
 * Every request carries `X-Wingcaster-Env` (LIVE/TEST) — never co-mingles envs.
 */
import { API_BASE, getElevatedToken } from '@/api/client'

export type AccountRecoveryStatus =
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'awaiting_info'
  | 'completed'
  | 'expired'

export type AccountValueTier = 'standard' | 'elevated' | 'high_value'

export type PreferredChannel = 'email' | 'sms' | 'whatsapp' | 'phone_call'

export type AccountRecoveryWithin = '24h' | '7d' | '30d' | 'all'

export type RevealAuditField =
  | 'email'
  | 'phone'
  | 'username'
  | 'ip'
  | 'row'
  | 'name'
  | 'contact'
  | 'user_agent'

export interface AccountRecoveryListQuery {
  status?: AccountRecoveryStatus | string
  tier?: AccountValueTier | 'any' | string
  channel?: PreferredChannel | 'any' | string
  within?: AccountRecoveryWithin | string
  q?: string
  page?: number
  pageSize?: number
  sort?: string
}

export interface AccountRecoveryAgency {
  id: string
  name: string
  tenant_url?: string
}

export interface AccountRecoveryAgent {
  id: string
  display_name_masked: string
  display_name_full: string
  avatar_url?: string | null
  email_masked?: string | null
  email_full?: string | null
  phone_masked?: string | null
  phone_full?: string | null
  username_masked?: string | null
  username_full?: string | null
  role?: string | null
  agency?: AccountRecoveryAgency | null
  plan_tier?: string | null
}

export interface AccountRecoveryEvidenceFile {
  id?: string
  filename: string
  uploaded_at?: string
  size_bytes?: number | null
  content_type?: string | null
}

export interface AccountRecoveryEvidence {
  file_count: number
  files: AccountRecoveryEvidenceFile[]
}

export interface AccountRecoveryCase {
  id: string
  created_at: string
  sla_hours_remaining: number
  sla_hours_total: number
  status: AccountRecoveryStatus | string
  reason: string
  reason_category?: string | null
  preferred_channel?: PreferredChannel | string | null
  contact?: string | null
  requested_ip?: string | null
  agent: AccountRecoveryAgent | null
  evidence: AccountRecoveryEvidence
  account_value_tier: AccountValueTier | string
  requires_two_person: boolean
  is_own: boolean
  env: 'live' | 'test' | string
}

export interface AccountRecoveryListResponse {
  cases: AccountRecoveryCase[]
  pagination: {
    page: number
    page_size: number
    total: number
    has_next: boolean
  }
  counts: {
    pending_review: number
    pending_at_risk: number
    high_value_awaiting_two_person: number
    approved_this_week: number
    rejected_this_week: number
    awaiting_info_this_week?: number
    completed_this_week?: number
    expired_this_week?: number
  }
}

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

export function toAccountRecoveryQuery(params: AccountRecoveryListQuery): string {
  const sp = new URLSearchParams()
  if (params.status) sp.set('status', params.status)
  if (params.tier && params.tier !== 'any') sp.set('tier', params.tier)
  if (params.channel && params.channel !== 'any') sp.set('channel', params.channel)
  if (params.within) sp.set('within', params.within)
  if (params.q && params.q.trim().length >= 2) sp.set('q', params.q.trim())
  if (params.page) sp.set('page', String(params.page))
  if (params.pageSize) sp.set('pageSize', String(params.pageSize))
  if (params.sort) sp.set('sort', params.sort)
  const qs = sp.toString()
  return qs ? `?${qs}` : ''
}

/** GET /api/admin/account-recovery — `{ cases, pagination, counts }` */
export function listAccountRecoveryCases(
  query: AccountRecoveryListQuery = {},
): Promise<AccountRecoveryListResponse> {
  return requestJson(`/admin/account-recovery${toAccountRecoveryQuery(query)}`)
}

/**
 * POST /api/admin/account-recovery/:caseId/reveal-audit
 * Must succeed before UI unmasks PII.
 */
export function revealAccountRecoveryPii(
  caseId: string,
  field: RevealAuditField,
): Promise<unknown> {
  return requestJson(`/admin/account-recovery/${encodeURIComponent(caseId)}/reveal-audit`, {
    method: 'POST',
    body: JSON.stringify({ field }),
  })
}

/** CSV export URL (same query as list). Caller triggers browser download. */
export function accountRecoveryCsvPath(
  query: AccountRecoveryListQuery = {},
  opts: { mask?: boolean } = {},
): string {
  const mask = opts.mask !== false
  const base = toAccountRecoveryQuery(query)
  const join = base ? '&' : '?'
  return `${API_BASE}/admin/account-recovery.csv${base}${join}mask=${mask ? 'true' : 'false'}`
}
