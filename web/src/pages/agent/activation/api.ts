import { API_BASE } from '@/api/client'
import type {
  ActivationState,
  ActivationStepId,
  AgencyInvitation,
  CompletedVia,
  ConnectedPortal,
  PortalRegistryEntry,
  ShareLinkPayload,
  WhatsAppActivationCode,
  WhatsAppBindingStatus,
} from './types'

function token(): string | null {
  try {
    return localStorage.getItem('fi_token') || localStorage.getItem('sa_token')
  } catch {
    return null
  }
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  const t = token()
  if (t) h.Authorization = `Bearer ${t}`
  return h
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url, {
    ...options,
    headers: { ...headers(), ...(options?.headers as Record<string, string> | undefined) },
  })
  const text = await res.text()
  const parsed = text
    ? (() => {
        try {
          return JSON.parse(text) as T
        } catch {
          return null
        }
      })()
    : null
  if (!res.ok) {
    const err = new Error(
      (parsed && typeof parsed === 'object' && 'error' in parsed
        ? String((parsed as { error?: unknown }).error)
        : `Request failed (${res.status})`) || `HTTP ${res.status}`,
    ) as Error & { status: number; body: unknown }
    err.status = res.status
    err.body = parsed
    throw err
  }
  return (parsed ?? ({} as T)) as T
}

function isNotFound(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 404)
}

export async function fetchActivationState(): Promise<ActivationState> {
  return request<ActivationState>('/agent/activation_state')
}

export async function completeActivationStep(
  stepId: ActivationStepId | string,
  completedVia: CompletedVia | string = 'dashboard_action',
  metadata?: Record<string, unknown>,
): Promise<ActivationState> {
  return request<ActivationState>('/agent/activation_state/complete', {
    method: 'POST',
    body: JSON.stringify({
      step_id: stepId,
      completed_via: completedVia,
      ...(metadata ? { metadata } : {}),
    }),
  })
}

export async function deferActivationStep(stepId: ActivationStepId | string): Promise<ActivationState> {
  return request<ActivationState>('/agent/activation_state/defer', {
    method: 'POST',
    body: JSON.stringify({ step_id: stepId }),
  })
}

export async function recordOnboardingEvent(body: Record<string, unknown>): Promise<void> {
  try {
    await request('/agent/onboarding-events', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  } catch {
    /* analytics — never block the wizard */
  }
}

export async function fetchPortalRegistry(countryCode: string | null | undefined): Promise<PortalRegistryEntry[]> {
  const code = (countryCode || '').trim().toUpperCase()
  const qs = code ? `?country=${encodeURIComponent(code)}` : ''
  try {
    const data = await request<PortalRegistryEntry[] | { portals?: PortalRegistryEntry[] }>(
      `/portal_registry${qs}`,
    )
    if (Array.isArray(data)) return data
    if (data && Array.isArray(data.portals)) return data.portals
    return []
  } catch (err) {
    if (isNotFound(err)) return []
    return []
  }
}

export async function fetchConnectedPortals(): Promise<ConnectedPortal[]> {
  try {
    const data = await request<ConnectedPortal[] | { credentials?: ConnectedPortal[] }>('/portal_credentials')
    if (Array.isArray(data)) return data
    if (data && Array.isArray(data.credentials)) return data.credentials
    return []
  } catch (err) {
    if (isNotFound(err)) return []
    return []
  }
}

export async function savePortalCredentials(
  portalCode: string,
  credentials: Record<string, string>,
): Promise<{ status?: string; masked_identifier?: string; error_class?: string; error_message?: string }> {
  return request('/portal_credentials', {
    method: 'POST',
    body: JSON.stringify({ portal_code: portalCode, credentials }),
  })
}

export async function fetchWhatsAppActivationCode(): Promise<WhatsAppActivationCode> {
  return request<WhatsAppActivationCode>('/auth/whatsapp/activation-code')
}

export async function regenerateWhatsAppActivationCode(): Promise<WhatsAppActivationCode> {
  return request<WhatsAppActivationCode>('/auth/whatsapp/activation-code', { method: 'POST' })
}

export async function fetchWhatsAppBindingStatus(): Promise<WhatsAppBindingStatus> {
  return request<WhatsAppBindingStatus>('/auth/whatsapp/binding-status')
}

export async function fetchAgencyInvitations(): Promise<AgencyInvitation[]> {
  try {
    const data = await request<AgencyInvitation[] | { invitations?: AgencyInvitation[] }>(
      '/agency/invitations',
    )
    if (Array.isArray(data)) return data
    if (data && Array.isArray(data.invitations)) return data.invitations
    return []
  } catch (err) {
    if (isNotFound(err)) return []
    return []
  }
}

export async function fetchShareLink(): Promise<ShareLinkPayload | null> {
  try {
    return await request<ShareLinkPayload>('/agency/invitations/share-link')
  } catch (err) {
    if (isNotFound(err)) return null
    return null
  }
}

export async function rotateShareLink(): Promise<ShareLinkPayload | null> {
  try {
    return await request<ShareLinkPayload>('/agency/invitations/rotate-share-link', { method: 'POST' })
  } catch {
    return null
  }
}

export async function rotateInvitationCode(): Promise<ShareLinkPayload | null> {
  try {
    return await request<ShareLinkPayload>('/agency/invitations/rotate-code', { method: 'POST' })
  } catch {
    return null
  }
}

export async function sendBulkInvitations(
  emails: string[],
  customMessage?: string,
): Promise<{ sent: number; failed: Array<{ email: string; reason: string }> }> {
  return request('/agency/invitations/bulk', {
    method: 'POST',
    body: JSON.stringify({ emails, custom_message: customMessage || undefined }),
  })
}

export async function resendInvitation(id: string): Promise<void> {
  await request(`/agency/invitations/${id}/resend`, { method: 'POST' })
}

export async function revokeInvitation(id: string): Promise<void> {
  await request(`/agency/invitations/${id}/revoke`, { method: 'POST' })
}
