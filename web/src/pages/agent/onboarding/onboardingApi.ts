import { API_BASE, api } from '@/api/client'

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = localStorage.getItem('fi_token') || localStorage.getItem('sa_token')
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options?.headers as Record<string, string> | undefined) },
    credentials: 'include',
  })
  const body = await parseJson(res)
  if (!res.ok) {
    const error = new Error(
      (body as { error?: string } | null)?.error || `HTTP ${res.status}`,
    ) as Error & { status: number }
    error.status = res.status
    throw error
  }
  return body as T
}

export interface ActivationCodePayload {
  display_code: string
  shared_number_e164: string
  expires_at: string
}

export interface BindingStatusPayload {
  bound: boolean
  phone_e164?: string
  bound_at?: string
}

export interface WhatsAppDraft {
  id: string
  status: 'collecting' | 'awaiting_approval' | 'published' | 'discarded' | string
  created_at?: string
  title?: string
  price?: number | string
  priceLabel?: string
  currency?: string
  beds?: number
  baths?: number
  area?: string
  areaLabel?: string
  address?: string
  area_name?: string
  building_name?: string
  floor?: string
  description?: string
  photos?: Array<string | { url?: string }>
  photo_urls?: string[]
  property_id?: string
  listing_id?: string
  [key: string]: unknown
}

export async function postActivationCode(): Promise<ActivationCodePayload> {
  return request<ActivationCodePayload>('/auth/whatsapp/activation-code', { method: 'POST' })
}

export async function getBindingStatus(): Promise<BindingStatusPayload> {
  return request<BindingStatusPayload>('/auth/whatsapp/binding-status')
}

export async function getMarketingAgentCount(): Promise<number | null> {
  try {
    const body = await request<{ count?: number; agentCount?: number; agent_count?: number }>(
      '/marketing/agent-count',
    )
    const n = body.count ?? body.agentCount ?? body.agent_count
    return typeof n === 'number' && Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

export async function listWhatsAppDrafts(): Promise<WhatsAppDraft[]> {
  const data = await api.getWhatsAppListingsDrafts()
  return Array.isArray(data) ? (data as WhatsAppDraft[]) : []
}

export async function getWhatsAppDraft(id: string): Promise<WhatsAppDraft> {
  return api.getWhatsAppListingsDraft(id) as Promise<WhatsAppDraft>
}

export async function approveWhatsAppDraft(id: string): Promise<{ success?: boolean; result?: { id?: string; property_id?: string } }> {
  return api.approveWhatsAppListingsDraft(id, false) as Promise<{
    success?: boolean
    result?: { id?: string; property_id?: string }
  }>
}

export async function discardWhatsAppDraft(id: string): Promise<void> {
  await api.discardWhatsAppListingsDraft(id)
}

export interface PublishedListingThumb {
  id: string
  title?: string
  address?: string
  priceLabel?: string
  photoUrl?: string
  sourceChannel?: string | null
}

export async function getPublishedListing(id: string): Promise<PublishedListingThumb | null> {
  try {
    const property = (await api.getProperty(id)) as Record<string, unknown>
    const photos = property.photos as Array<{ url?: string } | string> | undefined
    const first = Array.isArray(photos) ? photos[0] : undefined
    const photoUrl =
      typeof first === 'string'
        ? first
        : first?.url || (typeof property.cover_image === 'string' ? property.cover_image : undefined)
    const price = property.price
    const currency = typeof property.currency === 'string' ? property.currency : 'AED'
    const priceLabel =
      typeof property.price_label === 'string'
        ? property.price_label
        : typeof price === 'number'
          ? `${currency} ${new Intl.NumberFormat('en-US').format(price)}`
          : undefined
    return {
      id,
      title: typeof property.title === 'string' ? property.title : undefined,
      address: typeof property.address === 'string' ? property.address : undefined,
      priceLabel,
      photoUrl,
      sourceChannel: null,
    }
  } catch (error) {
    if ((error as { status?: number }).status === 404) return null
    throw error
  }
}

export function trackOnboardingEvent(name: string, props?: Record<string, unknown>): void {
  void api.trackEvent({ event: name, ...props }).catch(() => {
    /* analytics must never block the funnel */
  })
}
