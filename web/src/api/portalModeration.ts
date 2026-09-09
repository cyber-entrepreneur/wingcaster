/**
 * Thin types + helpers for PA-MOD-002 portal moderation detail.
 * Routes: GET/POST /api/admin/moderation/portals/:submissionId[/*]
 * Env-scoped via X-Wingcaster-Env on every call (api client headers).
 */

export type ModerationStatus =
  | 'pending'
  | 'pending_moderation'
  | 'approved'
  | 'rejected'
  | 'request_info'
  | 'portal_error'
  | 'expired'
  | 'pending_second_approval'

export type TenureRiskTier = 'low' | 'medium' | 'high' | 'unknown'

export type ValidatorSeverity = 'pass' | 'warn' | 'fail'

export interface ValidatorLintCheck {
  code: string
  severity: ValidatorSeverity
  message: string
  expected?: string
  actual?: string
}

export interface PortalModerationSubmission {
  id: string
  submitted_at: string
  status: ModerationStatus
  env: 'live' | 'test'
  is_own: boolean
  is_already_decided: boolean
  step_up_required: boolean
  decision?: {
    actor_name?: string
    actor_id?: string
    decided_at?: string
    reason_code?: string
    notes?: string
    state?: string
  } | null
  listing: {
    id: string
    title: string
    address_line: string
    hero_image_url?: string | null
  }
  listing_preview: {
    hero_image_url?: string | null
    gallery?: string[]
    price: { amount_minor: number; currency: string; basis: string }
    specs: { beds: number; baths: number; area_m2: number }
    amenities: string[]
    description: string
    agent_contact: {
      phone_masked: string
      email_masked: string
      whatsapp_deeplink?: string | null
    }
  }
  agent: {
    id: string
    display_name: string
    avatar_url?: string | null
  }
  agent_context: {
    wingcaster_tenure_month: string
    portfolio_size: number
    prior_decision_summary_30d: {
      approved: number
      rejected: number
      request_info: number
    }
  }
  agency: {
    id: string
    name: string
    tenant_url: string
    two_person_reject_required?: boolean
  }
  portal: {
    code: string
    display_name: string
    country_code: string
    country_flag_emoji?: string
  }
  validator_lint: {
    pass_count?: number
    warn_count?: number
    fail_count?: number
    checks: ValidatorLintCheck[]
  }
  tenure_risk: {
    tier: TenureRiskTier
    score?: number
    signals?: string[]
    reasons?: string[]
  }
  portal_payload_preview: Record<string, unknown> | unknown
  notification_previews: {
    approve: string
    reject: string
    request_info: string
  }
  queue_position?: {
    position: number
    total: number
  }
}

export interface PortalModerationDetailResponse {
  submission: PortalModerationSubmission
}

export interface SubmissionSiblingResponse {
  next_submission_id: string | null
}

export interface SubmissionHistoryRow {
  portal_code: string
  portal_display_name?: string
  submitted_at: string
  status: string
  decided_at?: string | null
  decided_by?: string | null
}

export interface AuditTrailEvent {
  id?: string
  at: string
  actor?: string | null
  kind: string
  description: string
}

export interface ModerationActionResult {
  state?: string
  approval_request_id?: string
  status?: string
  error?: string
}

export interface RevealContactResult {
  phone_full?: string
  email_full?: string
}

export const REJECT_REASON_OPTIONS = [
  { value: 'portal_outage', label: 'Portal outage' },
  { value: 'fails_portal_validation', label: 'Fails portal validation' },
  { value: 'duplicate_listing', label: 'Duplicate listing' },
  { value: 'suspected_fraud', label: 'Suspected fraud' },
  { value: 'insufficient_photos', label: 'Insufficient photos' },
  { value: 'compliance_conflict', label: 'Compliance conflict' },
  { value: 'other', label: 'Other' },
] as const

export const REQUEST_INFO_REASON_OPTIONS = [
  { value: 'missing_trakheesi', label: 'Missing trakheesi number' },
  { value: 'photo_count_below_min', label: 'Photo count below minimum' },
  { value: 'description_too_short', label: 'Description too short' },
  { value: 'category_mapping_unclear', label: 'Category mapping unclear' },
  { value: 'broker_license_expired', label: 'Broker license expired' },
  { value: 'other', label: 'Other' },
] as const

export function reasonLabel(
  options: ReadonlyArray<{ value: string; label: string }>,
  code: string,
): string {
  return options.find((o) => o.value === code)?.label ?? code
}

export function substituteNotificationPreview(
  template: string,
  vars: { reason_code_label?: string; notes?: string },
): string {
  return template
    .replace(/\{reason_code_label\}/g, vars.reason_code_label ?? '—')
    .replace(/\{notes\}/g, vars.notes?.trim() ? vars.notes.trim() : '—')
}

export function formatTenureMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return ym
  const date = new Date(Date.UTC(y, m - 1, 1))
  return date.toLocaleString('en', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export function formatPriceMinor(amountMinor: number, currency: string): string {
  const major = amountMinor / 100
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(major)
  } catch {
    return `${currency} ${major.toLocaleString('en')}`
  }
}

export function lintCounts(checks: ValidatorLintCheck[]): {
  pass: number
  warn: number
  fail: number
} {
  let pass = 0
  let warn = 0
  let fail = 0
  for (const c of checks) {
    if (c.severity === 'fail') fail += 1
    else if (c.severity === 'warn') warn += 1
    else pass += 1
  }
  return { pass, warn, fail }
}

export function sortLintChecks(checks: ValidatorLintCheck[]): ValidatorLintCheck[] {
  const rank: Record<ValidatorSeverity, number> = { fail: 0, warn: 1, pass: 2 }
  return [...checks].sort((a, b) => rank[a.severity] - rank[b.severity])
}

export function moderationStatusLabel(status: ModerationStatus | string): string {
  switch (status) {
    case 'pending':
    case 'pending_moderation':
      return 'Pending'
    case 'approved':
      return 'Approved'
    case 'rejected':
      return 'Rejected'
    case 'request_info':
      return 'Request info'
    case 'portal_error':
      return 'Portal error'
    case 'expired':
      return 'Expired'
    case 'pending_second_approval':
      return 'Pending second approval'
    default:
      return status
  }
}

export function isHighRisk(tier: TenureRiskTier | undefined): boolean {
  return tier === 'high'
}

export function requiresTwoPersonReject(
  submission: Pick<PortalModerationSubmission, 'tenure_risk' | 'agency'>,
): boolean {
  return (
    isHighRisk(submission.tenure_risk?.tier) &&
    Boolean(submission.agency?.two_person_reject_required)
  )
}
