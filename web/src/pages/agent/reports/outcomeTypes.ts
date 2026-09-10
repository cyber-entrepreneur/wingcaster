import type { StatusHeroProps } from '@/components/recipient'

/** Screen-level outcome variants for AGT-REC-002 / AGT-REC-003. */
export type ComparableOutcomeVariant =
  | 'pending'
  | 'pending_in_review'
  | 'approved_removed'
  | 'approved_quarantined'
  | 'rejected'
  | 'more_info'
  | 'expired'
  | 'withdrawn'
  | 'superseded'

export type PriceOutcomeVariant =
  | 'pending'
  | 'pending_in_review'
  | 'approved_incorporated'
  | 'approved_signal_only'
  | 'rejected'
  | 'more_info'
  | 'expired'
  | 'withdrawn'
  | 'superseded'

export type OutcomeHeroMapping = {
  heroState: StatusHeroProps['state']
  emphasis: NonNullable<StatusHeroProps['emphasis']>
  variant: ComparableOutcomeVariant | PriceOutcomeVariant
}

export type ReportEvidenceItem = {
  kind?: string
  signed_url?: string
  url?: string
  filename?: string
}

export type OriginalReportBody = {
  reasonLabel?: string | null
  notes?: string | null
  marketSegmentLabel?: string | null
  methodologyNotes?: string | null
  priceBands?: Array<{ label: string; value_aed?: number; value?: number; currency?: string }>
  evidence?: ReportEvidenceItem[]
}

export type ComparableReportRow = {
  id: string
  status?: string
  reason?: string
  notes?: string | null
  comparable_id?: string
  comparable_type?: string
  submitted_at?: string
  created_at?: string
  picked_up_at?: string | null
  reviewed_at?: string | null
  decided_at?: string | null
  resolved_at?: string | null
  expires_at?: string | null
  decision_notes?: string | null
  decision_reason_code?: string | null
  reviewed_by?: string | null
  superseded_by_report_id?: string | null
  sla_hours?: number
  data?: {
    decision?: {
      action?: string
      notes?: string | null
      decided_at?: string
      decided_by?: string
      market_impact?: {
        valuations_affected?: number
        affected_property_ids?: string[]
      }
      resolver?: {
        display_name?: string
        avatar_url?: string | null
      }
    }
    market_impact?: {
      valuations_affected?: number
      affected_property_ids?: string[]
    }
    evidence?: ReportEvidenceItem[]
    comparable?: {
      address_label?: string
      market_label?: string
      source_label?: string
    }
    picked_up_at?: string | null
    withdrawn_at?: string | null
    [key: string]: unknown
  } | null
}

export type AgentPriceReportRow = {
  id: string
  status?: string
  notes?: string | null
  review_notes?: string | null
  reason_code?: string | null
  incorporated?: boolean
  incorporated_at?: string | null
  reviewed_at?: string | null
  reviewed_by?: string | null
  created_at?: string
  expires_at?: string | null
  external_property_title?: string | null
  external_property_location?: string | null
  property_type?: string | null
  sold_price?: number
  currency?: string
  sold_date?: string | null
  supporting_document_url?: string | null
  segment_label?: string | null
  recommendation_price_low?: number | null
  recommendation_price_high?: number | null
  recommendation_price_point?: number | null
  resubmit_of?: string | null
  superseded_by_report_id?: string | null
  data?: {
    signal_weight?: number
    applied_weight?: number
    weight?: number
    picked_up_at?: string | null
    withdrawn_at?: string | null
    more_info_summary?: string | null
    methodology_notes?: string | null
    evidence_files?: ReportEvidenceItem[]
    attachments?: ReportEvidenceItem[]
    resolver?: {
      display_name?: string
      avatar_url?: string | null
    }
    live_signal_url?: string | null
    public_profile_url?: string | null
    [key: string]: unknown
  } | null
}
