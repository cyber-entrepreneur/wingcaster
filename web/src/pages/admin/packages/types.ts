/**
 * PA-PKG family (package admin — WF-07 package publishing) shared types.
 * Mirrors the real backend payloads in `backend/src/lib/packages/reads.js`
 * (schema fields: version_number, state, properties_covered, monthly_price_minor,
 * effective_from/effective_to, approval_request_id) — NOT the idealized brief
 * schema. Screens render what the API actually returns.
 */

export type PackageVersionState =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'PUBLISHED'
  | 'DEPRECATED'

export interface PackageActiveVersion {
  id: string
  version_number: number
  state: PackageVersionState
  properties_covered: number | null
  monthly_price_minor: number | null
  effective_from: string | null
  effective_to: string | null
}

export interface PackageRow {
  id: string
  code: string
  display_name: string
  tier: string | null
  target_audience: string | null
  currency: string | null
  billing_cadence: string | null
  active: boolean
  environment: string
  subscribers_count: number
  active_version: PackageActiveVersion | null
  updated_at?: string | null
}

export interface PackageListResponse {
  packages: PackageRow[]
  env: 'live' | 'test'
  test_env_hint?: { live_has_packages: boolean }
}

export interface PackageFeatureQuota {
  id: string
  feature_id: string
  feature_code: string
  display_name: string
  category: string | null
  meter_unit: string | null
  credits_per_property: number | null
}

export interface PackageFeatureFlag {
  id: string
  feature_code: string
  enabled: boolean
}

export interface PackageVersionDetail {
  id: string
  package_id: string
  version_number: number
  state: PackageVersionState
  properties_covered: number | null
  monthly_price_minor: number | null
  effective_from: string | null
  effective_to: string | null
  approval_request_id: string | null
  created_at: string | null
  updated_at?: string | null
  package_code: string
  package_display_name: string
  tier: string | null
  target_audience: string | null
  currency: string | null
  billing_cadence: string | null
  package_active: boolean
  package_environment: string
  quotas: PackageFeatureQuota[]
  flags: PackageFeatureFlag[]
  approval: ApprovalRequestRow | null
  is_own_submission?: boolean
}

export interface ApprovalRequestRow {
  id: string
  status: string
  action_kind: string
  created_by_actor_id: string | null
  created_at: string | null
  min_distinct_approvers?: number | null
}

/** One row from `listPendingApprovals` — a PENDING_APPROVAL version + its diff. */
export interface PendingApprovalRow {
  id: string
  version_number: number
  state: PackageVersionState
  package_id: string
  package_display_name: string
  package_code: string
  tier: string | null
  package_environment: string
  properties_covered: number | null
  monthly_price_minor: number | null
  approval_id: string | null
  approval_status: string | null
  requester_actor_id: string | null
  submitted_at: string | null
  is_own_submission: boolean
  diff: PackageVersionDiffSummary
}

export interface PackageVersionDiffSummary {
  properties_covered_delta: number
  monthly_price_minor_delta: number
  quotas_added: number
  quotas_removed: number
  quotas_changed: number
  flags_changed: number
  versus_version_id: string | null
  versus_version_number: number | null
}

export interface PendingApprovalsResponse {
  approvals: PendingApprovalRow[]
  env: 'live' | 'test'
}

export interface MeteredFeature {
  id: string
  code: string
  display_name: string
  category: string | null
  meter_unit: string | null
  active: boolean
}

export interface PackageDetailResponse extends PackageRow {
  versions: PackageVersionDetail[]
}

/** `true` when the diff touches price or property coverage (two-person trigger). */
export function diffRequiresTwoPerson(diff: PackageVersionDiffSummary): boolean {
  return diff.monthly_price_minor_delta !== 0 || diff.properties_covered_delta !== 0
}
