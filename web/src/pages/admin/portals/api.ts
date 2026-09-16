/**
 * PA-POR portal-registry admin API helpers (BE-BLOCKER-35).
 * Colocated fetch wrappers over the platform-admin portal routes.
 *
 * Every request carries `X-Wingcaster-Env` (LIVE/TEST) + Authorization +
 * (when present) the elevated step-up token — never co-mingles envs.
 */
import { API_BASE, getElevatedToken } from '@/api/client'
import { getWingcasterEnv, WINGCASTER_ENV_HEADER } from '@/hooks/useEnv'
import type {
  PortalAdmin,
  PortalCreateBody,
  PortalHistoryQuery,
  PortalHistoryResponse,
  PortalListQuery,
  PortalListResponse,
  PortalPendingActivation,
  PortalUpdateBody,
} from './types'

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
  h[WINGCASTER_ENV_HEADER] = getWingcasterEnv()
  return h
}

async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
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

function listQueryString(query: PortalListQuery): string {
  const sp = new URLSearchParams()
  if (query.status) sp.set('status', query.status)
  if (query.active) sp.set('active', query.active)
  if (query.country) sp.set('country', query.country)
  if (query.q && query.q.trim().length >= 2) sp.set('q', query.q.trim())
  if (query.page) sp.set('page', String(query.page))
  if (query.pageSize) sp.set('pageSize', String(query.pageSize))
  if (query.sort) sp.set('sort', query.sort)
  const qs = sp.toString()
  return qs ? `?${qs}` : ''
}

function historyQueryString(query: PortalHistoryQuery): string {
  const sp = new URLSearchParams()
  if (query.events && query.events.length) sp.set('events', query.events.join(','))
  if (query.actor) sp.set('actor', query.actor)
  if (query.from) sp.set('from', query.from)
  if (query.to) sp.set('to', query.to)
  if (query.page) sp.set('page', String(query.page))
  if (query.pageSize) sp.set('pageSize', String(query.pageSize))
  const qs = sp.toString()
  return qs ? `?${qs}` : ''
}

/** GET /api/admin/portals */
export function listPortals(query: PortalListQuery = {}): Promise<PortalListResponse> {
  return requestJson(`/admin/portals${listQueryString(query)}`)
}

/** CSV export URL (same query as the list). Caller triggers browser download. */
export function portalsCsvPath(query: PortalListQuery = {}): string {
  return `${API_BASE}/admin/portals.csv${listQueryString(query)}`
}

/** GET /api/admin/portals/:code (optionally a historical ?version=N snapshot). */
export function getPortal(code: string, opts?: { version?: number }): Promise<PortalAdmin> {
  const sp = new URLSearchParams()
  if (opts?.version != null) sp.set('version', String(opts.version))
  const qs = sp.toString()
  return requestJson(`/admin/portals/${encodeURIComponent(code)}${qs ? `?${qs}` : ''}`)
}

/** POST /api/admin/portals */
export function createPortal(body: PortalCreateBody): Promise<PortalAdmin> {
  return requestJson('/admin/portals', { method: 'POST', body: JSON.stringify(body) })
}

/** PATCH /api/admin/portals/:code */
export function updatePortal(code: string, body: PortalUpdateBody): Promise<PortalAdmin> {
  return requestJson(`/admin/portals/${encodeURIComponent(code)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

type PendingResponse = { pending?: PortalPendingActivation; pending_activation?: PortalPendingActivation }

/** POST /api/admin/portals/:code/activate — two-person submit half. */
export function requestActivation(
  code: string,
  body: { effective_from?: string | null; submitter_notes?: string | null },
): Promise<PendingResponse> {
  return requestJson(`/admin/portals/${encodeURIComponent(code)}/activate`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** POST /api/admin/portals/:code/deactivate — two-person submit half. */
export function requestDeactivation(
  code: string,
  body: { effective_from?: string | null; submitter_notes?: string | null },
): Promise<PendingResponse> {
  return requestJson(`/admin/portals/${encodeURIComponent(code)}/deactivate`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** POST /api/admin/portals/:code/{activate|deactivate}/approve — second approver. */
export function approveActivation(
  code: string,
  action: 'activate' | 'deactivate',
  body: { approver_notes?: string | null },
): Promise<{ portal: PortalAdmin; pending: PortalPendingActivation }> {
  return requestJson(`/admin/portals/${encodeURIComponent(code)}/${action}/approve`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** POST /api/admin/portals/:code/{activate|deactivate}/reject. */
export function rejectActivation(
  code: string,
  action: 'activate' | 'deactivate',
  body: { rejection_reason?: string | null; notes?: string | null },
): Promise<{ portal: PortalAdmin; pending: PortalPendingActivation }> {
  return requestJson(`/admin/portals/${encodeURIComponent(code)}/${action}/reject`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** POST /api/admin/portals/:code/{activate|deactivate}/withdraw — submitter only. */
export function withdrawActivation(
  code: string,
  action: 'activate' | 'deactivate',
): Promise<{ pending: PortalPendingActivation }> {
  return requestJson(`/admin/portals/${encodeURIComponent(code)}/${action}/withdraw`, {
    method: 'POST',
    body: '{}',
  })
}

/** POST /api/admin/portals/:code/deprecate — requires is_active=false. */
export function deprecatePortal(code: string, body: { notes?: string | null } = {}): Promise<PortalAdmin> {
  return requestJson(`/admin/portals/${encodeURIComponent(code)}/deprecate`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** GET /api/admin/portals/:code/history */
export function getPortalHistory(
  code: string,
  query: PortalHistoryQuery = {},
): Promise<PortalHistoryResponse> {
  return requestJson(`/admin/portals/${encodeURIComponent(code)}/history${historyQueryString(query)}`)
}

/** CSV export URL for a portal's activation history. */
export function portalHistoryCsvPath(code: string, query: PortalHistoryQuery = {}): string {
  return `${API_BASE}/admin/portals/${encodeURIComponent(code)}/history.csv${historyQueryString(query)}`
}
