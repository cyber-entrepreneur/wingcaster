/** WF-05 bad-comparable report types (PA-PVA-008 / 008b). */

export type ComparableReportStatus =
  | 'pending'
  | 'confirmed_removed'
  | 'confirmed_quarantined'
  | 'rejected'
  | 'awaiting_info'
  | 'expired'
  | 'pending_second_approval'
  | 'REMOVE_PROPOSED'

export type ReasonCategory =
  | 'wrong_price'
  | 'wrong_area'
  | 'already_sold'
  | 'duplicate'
  | 'spam'
  | 'other'

export type SeverityTier = 'low' | 'medium' | 'high' | 'critical'

export type MarketImpactTier = 'none' | 'low' | 'medium' | 'high'

export type SubmittedWithin = '24h' | '7d' | '30d' | 'all'

export interface AgencyRef {
  id: string
  name: string
  tenant_url?: string
}

export interface ReporterPatternSignals {
  reports_against_agency_last_30d: number
  days_window: number
  agency_name?: string
}

export interface ComparableReporter {
  id: string
  display_name: string
  avatar_url?: string | null
  agency: AgencyRef
  pattern_flag: boolean
  pattern_signals?: ReporterPatternSignals | null
}

export interface ComparableSnapshot {
  id: string
  title: string
  address_line: string
  thumb_url?: string | null
  source: 'agency_owned' | 'external_scrape' | string
  source_display: string
  source_url?: string | null
  owning_agency: AgencyRef
  current_fields?: Record<string, unknown>
}

export interface MarketImpact {
  tier: MarketImpactTier
  valuations_affected: number
  pct_move_median: number
  pct_move_max: number
  top_markets?: Array<{ market: string; count: number }>
}

export interface EvidenceFile {
  filename: string
  uploaded_at: string
  size_bytes?: number
  content_type?: string
  url?: string
}

export interface EvidencePayload {
  file_count: number
  files: EvidenceFile[]
}

export interface FieldDiff {
  field: string
  current: unknown
  observed: unknown
}

export interface ReporterClaim {
  reported_field: string
  observed_value: unknown
  observed_at?: string | null
  reason_text?: string
  field_diffs?: FieldDiff[]
}

export interface ComparableReportListItem {
  id: string
  created_at: string
  sla_hours_remaining: number
  sla_hours_total: number
  status: ComparableReportStatus
  reason_category: ReasonCategory
  severity: SeverityTier
  reporter: ComparableReporter
  comparable: ComparableSnapshot
  reported_field?: string
  reported_value?: unknown
  observed_value?: unknown
  delta_pct?: number | null
  market_impact: MarketImpact
  evidence: EvidencePayload
  is_own: boolean
  requires_two_person: boolean
  env: 'live' | 'test'
  decided_at?: string | null
  decided_by?: string | null
  decision_reason?: string | null
  decision_notes?: string | null
  proposal?: {
    proposed_by?: { id: string; display_name: string; initials?: string }
    proposed_at?: string
    approval_request_id?: string
  } | null
}

export interface ComparableReportDetail extends ComparableReportListItem {
  reporter_claim?: ReporterClaim
  related_reports?: Array<{
    id: string
    reporter: string
    reason_category: ReasonCategory | string
    status: ComparableReportStatus | string
    decided_at?: string | null
  }>
}

export interface ComparableReportCounts {
  pending: number
  pending_at_risk: number
  high_impact_awaiting_two_person: number
  confirmed_removed_this_week: number
  confirmed_quarantined_this_week: number
  rejected_this_week: number
  awaiting_info_this_week?: number
  expired_this_week?: number
}

export interface ComparableReportListResponse {
  reports: ComparableReportListItem[]
  pagination: {
    page: number
    page_size: number
    total: number
    has_next: boolean
  }
  counts: ComparableReportCounts
}

export interface AffectedValuationRow {
  valuation_id: string
  agency?: string
  listing_address?: string
  current_valuation?: number | null
  projected_valuation?: number | null
  delta_pct?: number | null
}

export interface ReporterHistoryRow {
  id: string
  reason_category: string
  status: string
  decided_at?: string | null
  comparable_title?: string
}

export interface AuditTrailEvent {
  id?: string
  at: string
  actor?: string
  kind: string
  description: string
}

export interface BulkDecisionResult {
  status: number
  succeeded: string[]
  failed: Array<{ id: string; error: string }>
}

export interface DecisionResponse {
  status?: string
  approval_request_id?: string
  recalculation_job_id?: string
  valuations_affected?: number
  [key: string]: unknown
}

export interface ComparableReportListQuery {
  status?: string
  category?: string
  severity?: string
  impact?: string
  within?: SubmittedWithin
  q?: string
  page?: number
  pageSize?: number
  sort?: string
}
