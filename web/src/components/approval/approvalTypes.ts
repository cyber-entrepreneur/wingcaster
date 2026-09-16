/**
 * WF-20 two-person execute cluster — shared payload types.
 * Mirrors the backend contract in `backend/src/fin/admin/approvals/execute-preview.js`
 * and `approvals-escalate-withdraw.js`.
 */

export type ApprovalValueTier = 'standard' | 'elevated' | 'high_value'

export interface ApprovalActor {
  id: string | null
  display_name: string
  avatar_url?: string | null
  initials: string
}

export interface ApprovalFirstApprover extends ApprovalActor {
  signed_off_at?: string | null
}

export interface ExecutePreviewRequest {
  id: string
  last6: string
  version: number
  workflow_code: string
  workflow_label: string
  submitted_at: string
  submitted_by: ApprovalActor
  value_tier: ApprovalValueTier
  status: string
  action_kind?: string | null
}

export interface ExecuteDiffRow {
  field: string
  before: string | null
  after: string | null
  kind?: 'money' | 'string' | 'date' | string
}

export type RiskSeverity = 'info' | 'warn' | 'danger'

export interface RiskSignal {
  severity: RiskSeverity
  label: string
  detail?: string | null
}

export interface LedgerRow {
  account_code: string
  account_label: string
  debit: string | null
  credit: string | null
}

export interface LedgerImpact {
  currency: string
  rows: LedgerRow[]
  totals: { debit: string; credit: string }
  balanced: boolean
}

export interface ExecutePreview {
  request: ExecutePreviewRequest
  action_summary: string
  two_person: {
    requires_two_person: boolean
    first_approver: ApprovalFirstApprover | null
    second_approver_slot: { candidate_id: string | null; initials: string }
  }
  diff: ExecuteDiffRow[]
  risk_signals: RiskSignal[] | null
  ledger_impact: LedgerImpact | null
  confirmation_phrase: string | null
  self_approval: boolean
  step_up_required: boolean
  outcome_url_template: string | null
  env: string
}

export interface ExecuteResult {
  ok: boolean
  request_id: string
  executed_at: string
  outcome_url: string
  ledger_journal_id?: string | null
  short_action_summary: string
}

export interface EligibleEscalationTarget {
  id: string
  display_name: string
  initials: string
  role: string
  capability_match: boolean
  out_of_office: boolean
  request_type?: string | null
}

export interface EligibleEscalationTargets {
  targets: EligibleEscalationTarget[]
  hop: number
  max_hops: number
}

/** Escalation reason vocabulary — mirrors ESCALATION_REASON_VOCAB on the server. */
export const ESCALATION_REASONS = [
  'out_of_scope_authority',
  'conflict_of_interest',
  'requires_domain_expertise',
  'contentious',
  'compliance_concern',
  'other',
] as const

export type EscalationReason = (typeof ESCALATION_REASONS)[number]

export type NotifyChannel = 'email' | 'slack' | 'teams'
