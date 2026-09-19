/**
 * PA-PVA-011 — Canonical property resolution admin API helpers.
 */
import { api } from '@/api/client'

export type CanonicalQueueItem = {
  id: string
  address?: string
  city?: string
  neighborhood?: string
  sibling_count?: number
  primary_listing_id?: string | null
  primary_agency_name?: string | null
  on_hold?: boolean
  dispute_count?: number
  updated_at?: string
}

export type CanonicalSibling = {
  id: string
  title?: string
  price?: number | string | null
  price_unit?: string
  status?: string
  agent_name?: string | null
  agency_name?: string | null
  listed_date?: string
  photos?: string
  updated_at?: string
  is_primary?: boolean
}

export type CanonicalDetail = {
  id: string
  primary_listing_id?: string | null
  location?: string | null
  city?: string | null
  neighborhood?: string | null
  on_hold?: boolean
  hold_reason?: string | null
  siblings?: CanonicalSibling[]
  primary_agency_name?: string | null
  dispute_count?: number
  updated_at?: string
}

export const canonicalResolutionApi = {
  list: (): Promise<{ items: CanonicalQueueItem[] }> => api.getAdminCanonicalResolutionQueue(),
  get: (id: string): Promise<{ canonical: CanonicalDetail }> => api.getAdminCanonicalResolution(id),
  changePrimary: (id: string, body: { listing_id: string; reason?: string }) =>
    api.postAdminCanonicalChangePrimary(id, body),
  split: (id: string, body: { listing_id: string; reason?: string }) =>
    api.postAdminCanonicalSplit(id, body),
  merge: (id: string, body: { target_canonical_id: string; reason?: string }) =>
    api.postAdminCanonicalMerge(id, body),
  hold: (id: string, body: { reason?: string; release?: boolean }) =>
    api.postAdminCanonicalHold(id, body),
}
