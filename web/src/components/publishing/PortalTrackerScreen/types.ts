import type { PortalStatus } from '@/components/ui/portal-status-pill'

/** Tracker row from GET /api/publishing/tracker (BE-BLOCKER-11). */
export type TrackerRow = {
  distribution_attempt_id: string
  /** publishing_jobs.id or legacy distribution_jobs.id — receipt deep-link. */
  job_id?: string | null
  listing: {
    id: string | null
    address_line: string | null
    thumbnail_url: string | null
  }
  portal: {
    code: string | null
    display_name: string | null
    channel_token_key: string | null
  }
  submitted_at: string | null
  updated_at: string | null
  status: PortalStatus
  error_class: string | null
  error_message: string | null
  credits_charged: number
  portal_live_url: string | null
}

export type TrackerListResponse = {
  rows: TrackerRow[]
  next_cursor: string | null
  has_more: boolean
  total: number
}

export type TrackerTopFailureClass = {
  class: string
  display_label: string
  count: number
} | null

export type TrackerSummaryResponse = {
  scope: {
    from: string | null
    to: string | null
    filters_applied: {
      status: string[]
      portal: string[]
      listing_id: string | null
      from?: string | null
      to?: string | null
    }
  }
  total_submissions: number
  success_rate: number
  credits_spent: number
  top_failure_class: TrackerTopFailureClass
}

export type TrackerFilters = {
  status: PortalStatus[]
  portal: string[]
  listingId: string | null
  listingLabel: string | null
  from: string | null
  to: string | null
}

export const TRACKER_STATUS_OPTIONS: { value: PortalStatus; label: string }[] = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'in_review', label: 'In review' },
  { value: 'live', label: 'Live' },
  { value: 'rejected', label: 'Not accepted' },
  { value: 'expired', label: 'Timed out' },
  { value: 'failed', label: 'Delivery failed' },
]

/** Default MENA portals for filter chips (portal_registry codes). */
export const DEFAULT_PORTAL_OPTIONS: { value: string; label: string }[] = [
  { value: 'property_finder', label: 'Property Finder' },
  { value: 'bayut', label: 'Bayut' },
  { value: 'dubizzle', label: 'Dubizzle' },
  { value: 'aqar', label: 'Aqar' },
  { value: 'wasalt', label: 'Wasalt' },
]

export const EMPTY_TRACKER_FILTERS: TrackerFilters = {
  status: [],
  portal: [],
  listingId: null,
  listingLabel: null,
  from: null,
  to: null,
}

export function filtersAreActive(filters: TrackerFilters): boolean {
  return (
    filters.status.length > 0 ||
    filters.portal.length > 0 ||
    Boolean(filters.listingId) ||
    Boolean(filters.from) ||
    Boolean(filters.to)
  )
}

export function receiptPathForRow(row: TrackerRow): string {
  const jobId = row.job_id || row.distribution_attempt_id
  return `/publish/receipts/${encodeURIComponent(jobId)}`
}
