import type { PortalStatus } from '@/components/ui/portal-status-pill'

/** One ledger row from GET /api/publishing/tracker. */
export type PortalTrackerRow = {
  distribution_attempt_id: string
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

export type PortalTrackerListResponse = {
  rows: PortalTrackerRow[]
  next_cursor: string | null
  has_more: boolean
  total: number
}

export type PortalTrackerSummaryResponse = {
  scope: {
    from: string | null
    to: string | null
    filters_applied: {
      status: string[]
      portal: string[]
      listing_id: string | null
      q?: string | null
      from: string | null
      to: string | null
    }
  }
  total_submissions: number
  success_rate: number
  credits_spent: number
  top_failure_class: {
    class: string
    display_label: string
    count: number
  } | null
  /** Optional per-status counts when the API returns them. */
  by_status?: Partial<Record<PortalStatus, number>>
}

export type PortalTrackerFilters = {
  status: PortalStatus[]
  portal: string[]
  submittedWithin: '' | '7d' | '30d' | 'month'
  q: string
  listing_id: string
}

export const DEFAULT_TRACKER_FILTERS: PortalTrackerFilters = {
  status: [],
  portal: [],
  submittedWithin: '',
  q: '',
  listing_id: '',
}

export const TRACKER_STATUS_OPTIONS: { value: PortalStatus; label: string }[] = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'in_review', label: 'In review' },
  { value: 'live', label: 'Live' },
  { value: 'rejected', label: 'Not accepted' },
  { value: 'expired', label: 'Timed out' },
  { value: 'failed', label: 'Delivery failed' },
]

export const TRACKER_PORTAL_OPTIONS: { value: string; label: string }[] = [
  { value: 'bayut', label: 'Bayut' },
  { value: 'property_finder', label: 'Property Finder' },
  { value: 'dubizzle', label: 'dubizzle' },
  { value: 'aqar', label: 'Aqar' },
]

export type PortalSubmissionPushEvent = {
  type: 'portal_submission.status_changed' | 'connected' | string
  distribution_attempt_id?: string
  status?: PortalStatus | string
  payload?: {
    portal_name?: string | null
    listing_address?: string | null
    status?: string | null
  }
}
