import { api } from '@/api/client'
import type {
  TrackerFilters,
  TrackerListResponse,
  TrackerSummaryResponse,
} from './types'

export function buildTrackerSearchParams(
  filters: TrackerFilters,
  extras: { after?: string | null; limit?: number; sort?: string } = {},
): URLSearchParams {
  const qs = new URLSearchParams()
  if (filters.status.length) qs.set('status', filters.status.join(','))
  if (filters.portal.length) qs.set('portal', filters.portal.join(','))
  if (filters.listingId) qs.set('listing_id', filters.listingId)
  if (filters.from) qs.set('from', filters.from)
  if (filters.to) qs.set('to', filters.to)
  if (extras.after) qs.set('after', extras.after)
  if (extras.limit != null) qs.set('limit', String(extras.limit))
  if (extras.sort) qs.set('sort', extras.sort)
  return qs
}

export function filtersFromSearchParams(params: URLSearchParams): TrackerFilters {
  const statusRaw = params.get('status')
  const portalRaw = params.get('portal')
  const status = statusRaw
    ? (statusRaw.split(',').map((s) => s.trim()).filter(Boolean) as TrackerFilters['status'])
    : []
  const portal = portalRaw
    ? portalRaw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
    : []
  return {
    status,
    portal,
    listingId: params.get('listing_id'),
    listingLabel: params.get('listing_label'),
    from: params.get('from'),
    to: params.get('to'),
  }
}

export function filtersToSearchParams(filters: TrackerFilters): URLSearchParams {
  const qs = buildTrackerSearchParams(filters)
  if (filters.listingLabel && filters.listingId) {
    qs.set('listing_label', filters.listingLabel)
  }
  return qs
}

function paramsRecord(qs: URLSearchParams): Record<string, string> | undefined {
  if (![...qs.keys()].length) return undefined
  return Object.fromEntries(qs.entries())
}

export async function fetchTrackerList(
  filters: TrackerFilters,
  extras: { after?: string | null; limit?: number } = {},
): Promise<TrackerListResponse> {
  const qs = buildTrackerSearchParams(filters, { ...extras, limit: extras.limit ?? 20 })
  return api.getPublishingTracker(paramsRecord(qs)) as Promise<TrackerListResponse>
}

export async function fetchTrackerSummary(
  filters: TrackerFilters,
): Promise<TrackerSummaryResponse> {
  const qs = buildTrackerSearchParams(filters)
  return api.getPublishingTrackerSummary(paramsRecord(qs)) as Promise<TrackerSummaryResponse>
}

export type ListingSuggestion = {
  id: string
  label: string
}

export async function searchMyListings(query: string): Promise<ListingSuggestion[]> {
  const q = query.trim()
  if (!q) return []
  try {
    const res = await api.getProperties({ q, limit: '8', scope: 'mine' })
    const rows = Array.isArray(res) ? res : ((res as { properties?: unknown[]; items?: unknown[] })?.properties
      ?? (res as { items?: unknown[] })?.items
      ?? [])
    return (rows as Array<Record<string, unknown>>)
      .slice(0, 8)
      .map((row) => {
        const id = String(row.id ?? '')
        const address =
          (row.address as string) ||
          (row.address_line as string) ||
          (row.title as string) ||
          (row.location as string) ||
          id
        return { id, label: address }
      })
      .filter((r) => r.id)
  } catch {
    return []
  }
}
