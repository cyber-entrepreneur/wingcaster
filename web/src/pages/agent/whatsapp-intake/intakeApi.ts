import { API_BASE } from '@/api/client'

const TOKEN_KEY = 'fi_token'

export function getIntakeAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY) || localStorage.getItem('sa_token')
  } catch {
    return null
  }
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = getIntakeAuthToken()
  if (token) headers.Authorization = `Bearer ${token}`
  try {
    const raw = sessionStorage.getItem('wingcaster.env') ?? localStorage.getItem('wingcaster.env')
    headers['X-Wingcaster-Env'] = raw === 'test' || raw === 'TEST' ? 'test' : 'live'
  } catch {
    headers['X-Wingcaster-Env'] = 'live'
  }
  return headers
}

export interface IntakeFetchResult<T> {
  ok: boolean
  status: number
  data: T | null
  error?: string
}

export async function intakeFetch<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<IntakeFetchResult<T>> {
  const url = `${API_BASE}${path}`
  try {
    const res = await fetch(url, {
      ...init,
      headers: { ...authHeaders(), ...(init?.headers as Record<string, string> | undefined) },
    })
    const text = await res.text()
    let data: T | null = null
    if (text) {
      try {
        data = JSON.parse(text) as T
      } catch {
        data = null
      }
    }
    if (!res.ok) {
      const errObj = (data || {}) as { error?: string }
      return {
        ok: false,
        status: res.status,
        data,
        error: errObj.error || `Request failed (${res.status})`,
      }
    }
    return { ok: true, status: res.status, data }
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: err instanceof Error ? err.message : 'Network error',
    }
  }
}

export interface ActivationCodePayload {
  display_code: string
  parseable_code?: string
  shared_number_e164: string
  expires_at: string
}

export interface BindingStatusPayload {
  bound: boolean
  phone_e164?: string
  bound_at?: string
}

export interface BindingRow {
  id: string
  phone_e164: string
  active_from?: string
  last_used_at?: string | null
}

export interface InboundStatusPayload {
  bound: boolean
  binding_id: string
  latest_message_at: string | null
  draft_session_id: string | null
}

export async function getActivationCode(): Promise<IntakeFetchResult<ActivationCodePayload>> {
  return intakeFetch<ActivationCodePayload>('/auth/whatsapp/activation-code')
}

export async function getCurrentActivationCode(): Promise<IntakeFetchResult<ActivationCodePayload>> {
  const current = await intakeFetch<ActivationCodePayload>('/auth/whatsapp/activation-code/current')
  if (current.ok && current.data?.display_code) return current
  return getActivationCode()
}

/** Explicit regenerate (invalidates prior code). */
export async function postActivationCode(): Promise<IntakeFetchResult<ActivationCodePayload>> {
  return intakeFetch<ActivationCodePayload>('/auth/whatsapp/activation-code', { method: 'POST' })
}

/**
 * WLB-001 primary CTA: prefer GET (idempotent get-or-create), else POST.
 */
export async function issueActivationCode(): Promise<IntakeFetchResult<ActivationCodePayload>> {
  const existing = await getCurrentActivationCode()
  if (existing.ok && existing.data?.display_code) return existing
  return postActivationCode()
}

export async function getBindingStatus(): Promise<IntakeFetchResult<BindingStatusPayload>> {
  return intakeFetch<BindingStatusPayload>('/auth/whatsapp/binding-status')
}

export async function listBindings(): Promise<IntakeFetchResult<BindingRow[]>> {
  return intakeFetch<BindingRow[]>('/auth/whatsapp/bindings')
}

export async function getInboundStatus(
  bindingId: string,
): Promise<IntakeFetchResult<InboundStatusPayload>> {
  return intakeFetch<InboundStatusPayload>(
    `/intake/inbound-status/${encodeURIComponent(bindingId)}`,
  )
}

export async function postOnboardingEvent(body: Record<string, unknown>): Promise<void> {
  await intakeFetch('/users/me/onboarding-events', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function completeActivationStep(
  stepId: string,
  completedVia = 'whatsapp_intake',
  metadata?: Record<string, unknown>,
): Promise<void> {
  await intakeFetch('/agent/activation_state/complete', {
    method: 'POST',
    body: JSON.stringify({
      step_id: stepId,
      completed_via: completedVia,
      metadata: metadata ?? {},
    }),
  })
}

export async function deferActivationStep(stepId: string): Promise<void> {
  await intakeFetch('/agent/activation_state/defer', {
    method: 'POST',
    body: JSON.stringify({ step_id: stepId }),
  })
}

export async function discardDraft(draftId: string): Promise<IntakeFetchResult<{ success?: boolean }>> {
  return intakeFetch(`/agent/whatsapp-listings/drafts/${encodeURIComponent(draftId)}/discard`, {
    method: 'POST',
    body: '{}',
  })
}

export interface DraftProgressCapability {
  mode?: 'sse' | 'poll'
  sse?: boolean
  poll?: boolean
  poll_interval_ms?: number
}

export interface DraftFieldSnapshot {
  key: string
  label?: string
  state: 'idle' | 'thinking' | 'streaming' | 'complete'
  value?: string | number | string[]
  streamedText?: string
}

export interface DraftStateSnapshot {
  session_id?: string | null
  draft_id?: string | null
  session_state?: string | null
  draft_status?: string | null
  draft_ready?: boolean
  error?: string | null
  fields?: DraftFieldSnapshot[]
  completed_fields?: number
  total_fields?: number
  poll_interval_ms?: number
  mode?: string
}

export async function headDraftProgress(sessionId: string): Promise<{
  ok: boolean
  status: number
  sse: boolean
  pollIntervalMs: number
}> {
  const url = `${API_BASE}/whatsapp-listings/drafts/${encodeURIComponent(sessionId)}/progress`
  try {
    const res = await fetch(url, { method: 'HEAD', headers: authHeaders() })
    const sseHeader = res.headers.get('X-Draft-Progress-SSE')
    const interval = Number(res.headers.get('X-Draft-Progress-Poll-Interval-Ms') || 3000)
    const sse = res.ok && sseHeader !== '0' && (sseHeader === '1' || res.status === 200)
    return { ok: res.ok, status: res.status, sse, pollIntervalMs: Number.isFinite(interval) ? interval : 3000 }
  } catch {
    return { ok: false, status: 0, sse: false, pollIntervalMs: 3000 }
  }
}

export async function getProgressCapability(): Promise<IntakeFetchResult<DraftProgressCapability>> {
  return intakeFetch<DraftProgressCapability>('/whatsapp-listings/drafts/progress-capability')
}

export async function getDraftState(sessionId: string): Promise<IntakeFetchResult<DraftStateSnapshot>> {
  return intakeFetch<DraftStateSnapshot>(
    `/whatsapp-listings/drafts/${encodeURIComponent(sessionId)}/state`,
  )
}

export function draftProgressSseUrl(sessionId: string): string {
  const token = getIntakeAuthToken()
  const base = `${API_BASE}/whatsapp-listings/drafts/${encodeURIComponent(sessionId)}/progress`
  if (!token) return base
  const join = base.includes('?') ? '&' : '?'
  return `${base}${join}token=${encodeURIComponent(token)}`
}
