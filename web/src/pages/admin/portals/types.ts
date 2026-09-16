/**
 * PA-POR portal-registry admin types.
 *
 * Backend contract:
 *  - PA-POR-001 list  → docs/design/briefs/PA-POR-001-portal-list-brief.md
 *  - PA-POR-002 form  → docs/design/briefs/PA-POR-002-add-edit-portal-brief.md
 *  - PA-POR-003 audit → docs/design/briefs/PA-POR-003-portal-activation-history-brief.md
 *
 * Shapes mirror backend/src/lib/portals/store.js `serializePortalAdmin` +
 * admin-routes.js `/history` response. Env-shared catalog identity; env-scoped
 * connected-agent counts (X-Wingcaster-Env).
 */

export type PortalAdapterStatus = 'live' | 'stub' | 'deprecated'

export type PortalStatusFilter = 'all' | 'live' | 'stub' | 'deprecated'

export type PortalActiveFilter = 'true' | 'false' | 'all'

export type PortalListSort =
  | 'last_change:desc'
  | 'last_change:asc'
  | 'code:asc'
  | 'display_name:asc'
  | 'connected:desc'
  | 'country_count:desc'

export type PortalActivationAction = 'activate' | 'deactivate'

export type PortalPendingState = 'pending' | 'approved' | 'rejected' | 'withdrawn'

export interface PortalActorRef {
  id: string
  display_name?: string | null
  profile_url?: string | null
}

export interface PortalPendingActivation {
  id: string
  portal_code: string
  action: PortalActivationAction
  state: PortalPendingState
  submitter_user_id: string | null
  approver_user_id: string | null
  submitter_notes: string | null
  approver_notes: string | null
  effective_from: string | null
  created_at?: string | null
  resolved_at?: string | null
}

/** Row/object shape from GET /api/admin/portals[/:code]. */
export interface PortalAdmin {
  id: string
  code: string
  display_name: string
  description: string | null
  logo_url: string | null
  country_codes: string[]
  primary_language: string | null
  adapter_class_name: string
  adapter_status: PortalAdapterStatus
  publisher_config: Record<string, unknown>
  inbound_config: Record<string, unknown>
  validator_ref: string | null
  is_active: boolean
  current_version: number
  connected_agents_env: number
  connected_agents_env_name: string
  connected_agencies_env: number
  last_change_at: string | null
  last_change_by: PortalActorRef | null
  pending_activation: PortalPendingActivation | null
  sla_hours: number | null
  deprecated_at: string | null
  effective_from: string | null
  created_at: string | null
  updated_at: string | null
}

export interface PortalListPagination {
  page: number
  page_size: number
  total: number
  has_next: boolean
}

export interface PortalListCounts {
  total: number
  live: number
  stub: number
  deprecated: number
  countries_covered: number
}

export interface PortalListResponse {
  portals: PortalAdmin[]
  pagination: PortalListPagination
  counts: PortalListCounts
}

export interface PortalListQuery {
  status?: PortalStatusFilter
  active?: PortalActiveFilter
  country?: string
  q?: string
  page?: number
  pageSize?: number
  sort?: PortalListSort
}

/** Body accepted by POST /api/admin/portals. */
export interface PortalCreateBody {
  code: string
  display_name: string
  description?: string | null
  logo_url?: string | null
  country_codes: string[]
  primary_language?: string | null
  adapter_class_name?: string
  publisher_config?: Record<string, unknown>
  inbound_config?: Record<string, unknown>
  validator_ref?: string | null
  sla_hours?: number | null
}

/** Body accepted by PATCH /api/admin/portals/:code (code is immutable). */
export type PortalUpdateBody = Partial<Omit<PortalCreateBody, 'code'>>

export type PortalHistoryEventType =
  | 'created'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'withdrawn'
  | 'activated'
  | 'deactivated'
  | 'adapter_upgraded'
  | 'sla_changed'
  | 'country_coverage_changed'
  | 'validator_ruleset_changed'
  | 'publisher_config_changed'
  | 'inbound_config_changed'
  | 'deprecated'

export interface PortalHistoryDiff {
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
}

export interface PortalHistoryEvent {
  id: string
  portal_code: string
  event_type: PortalHistoryEventType | string
  event_at: string
  submitter: PortalActorRef | null
  approver: PortalActorRef | null
  submitter_notes: string | null
  approver_notes: string | null
  diff: PortalHistoryDiff
  version_created: number | null
}

export interface PortalHistoryResponse {
  events: PortalHistoryEvent[]
  pagination: PortalListPagination
  counts: Record<string, number>
}

export interface PortalHistoryQuery {
  events?: string[]
  actor?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}
