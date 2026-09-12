/** WF-06 PA-PVA-009 / 009b — admin agent price-report shapes (BE-BLOCKER-26). */

export type PriceReportStatus =
  | 'pending_review'
  | 'verified'
  | 'incorporated'
  | 'rejected'
  | 'request_info'
  | 'expired'
  | 'pending_second_approval'

export type DeltaDirection = 'above' | 'below' | 'in_band'
export type RiskTier = 'low' | 'medium' | 'high' | 'unknown'
export type AgentTier = 'pro' | 'pro_elite' | string
export type DeltaBucket = 'in_band' | 'above_5' | 'above_10' | 'below_5' | 'below_10'

export interface PriceReportAgent {
  id: string
  display_name: string
  avatar_url?: string | null
  tier: AgentTier
  tenure_days?: number | null
}

export interface PriceReportAgency {
  id: string
  name: string
  tenant_url?: string | null
}

export interface PriceReportSubject {
  segment_label: string
  segment_id: string
  country_code?: string | null
  country_flag_emoji?: string | null
  comparable_listings_count?: number
  property_type?: string | null
  bedroom_range?: string | null
}

export interface PriceReportRecommendation {
  price_low?: number | null
  price_high?: number | null
  price_point?: number | null
  currency: string
}

export interface PriceReportBenchmarkDelta {
  benchmark_price_point?: number | null
  benchmark_currency?: string | null
  delta_pct: number
  delta_direction: DeltaDirection
  delta_tier: RiskTier
  benchmark_computed_at?: string | null
  stale?: boolean
}

export interface PriceReportListItem {
  id: string
  submitted_at: string | null
  agent: PriceReportAgent
  agency?: PriceReportAgency | null
  subject: PriceReportSubject
  recommendation: PriceReportRecommendation
  benchmark_delta: PriceReportBenchmarkDelta
  sources: { comparable_count: number; evidence_file_count: number }
  tenure_risk: { tier: RiskTier; score?: number | null; signals?: string[] }
  composite_risk_tier: RiskTier
  status: PriceReportStatus
  review?: {
    decided_at?: string | null
    decided_by?: string | null
    reason_code?: string | null
    notes?: string | null
    incorporated?: boolean
    weight?: number | null
  } | null
  is_own?: boolean
  step_up_required?: boolean
  two_person_required?: boolean
  env?: string
  approval_request_id?: string | null
  /** PAQueueRow compatibility */
  isOwn?: boolean
}

export interface PriceReportCitedComparable {
  id: string
  address: string
  price: number
  currency: string
  price_per_sqft?: number | null
  beds?: number | null
  baths?: number | null
  status?: string | null
  source_portal?: string | null
  source_url?: string | null
}

export interface PriceReportEvidenceFile {
  id: string
  filename: string
  mime?: string | null
  size_bytes?: number | null
  uploaded_at?: string | null
  url?: string | null
}

export interface PriceReportAuditEntry {
  actor?: { id?: string; name?: string; role?: string } | null
  action: string
  at: string
  reason?: string | null
  notes?: string | null
}

export interface PriceReportDetail extends PriceReportListItem {
  parameters?: {
    segment_definition?: string | null
    time_window?: string | null
    analysis_basis?: string | null
    recommendation_type?: string | null
  }
  analysis?: { format?: string; body?: unknown }
  cited_comparables?: PriceReportCitedComparable[]
  evidence_files?: PriceReportEvidenceFile[]
  audit_trail?: PriceReportAuditEntry[]
  resubmit_of?: string | null
}

export interface PriceReportListResponse {
  reports: PriceReportListItem[]
  pagination: {
    page: number
    page_size: number
    total: number
    has_next: boolean
  }
  counts: {
    pending: number
    pending_high_delta: number
    incorporated_this_month: number
    signal_only_this_month: number
    rejected_this_month: number
  }
}

export interface PriceReportReviewBody {
  status: 'verified' | 'rejected' | 'request_info'
  incorporate?: boolean
  /** 0–100 signal weight. Incorporate defaults to 100; signal-only typically < 100. */
  weight?: number
  reason_code?: string
  notes?: string
}

export interface PriceReportReviewResult {
  success?: boolean
  status?: string
  incorporated?: boolean
  pending_second_approval?: boolean
  request_id?: string
  approval_request_id?: string
  benchmark_id?: string | null
  benchmark_refresh_queued?: boolean
  refresh_job_id?: string | null
}

export interface BenchmarkSeriesPoint {
  date: string
  price: number
  confidence_low?: number | null
  confidence_high?: number | null
}

export interface BenchmarkSeriesResponse {
  points: BenchmarkSeriesPoint[]
  currency: string
  segment_id?: string
  window?: string
  env?: string
}

export interface PriceReportListQuery {
  status?: string
  country?: string
  segment?: string
  delta?: string
  tier?: string
  within?: string
  q?: string
  page?: number
  pageSize?: number
  sort?: string
}

export const REJECT_REASON_OPTIONS = [
  { value: 'insufficient_evidence', label: 'Insufficient evidence' },
  { value: 'thesis_not_supported', label: 'Thesis not supported by comps' },
  { value: 'duplicate_report', label: 'Duplicate report' },
  { value: 'data_unverifiable', label: 'Cited data unverifiable' },
  { value: 'out_of_scope_segment', label: 'Out-of-scope segment' },
  { value: 'off_topic', label: 'Off-topic' },
  { value: 'other', label: 'Other' },
] as const

export const REQUEST_INFO_REASON_OPTIONS = [
  { value: 'need_additional_comps', label: 'Need additional comparables' },
  { value: 'cite_transaction_source', label: 'Cite source of transaction data' },
  { value: 'clarify_thesis', label: 'Clarify thesis assumptions' },
  { value: 'attach_evidence', label: 'Attach evidence files' },
  { value: 'narrow_segment', label: 'Narrow segment definition' },
  { value: 'other', label: 'Other' },
] as const

export const HIGH_DELTA_THRESHOLD_PCT = 10
