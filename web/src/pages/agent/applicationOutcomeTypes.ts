/**
 * AGT-REC-004 application outcome — API + view-model types
 * (brief §Backend contract).
 */

export type ApplicationOutcomeStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'withdrawn'

export type ApplicationRejectedBy = 'agency' | 'applicant' | null

export type ApplicationOutcomePayload = {
  application: {
    id: string
    status: ApplicationOutcomeStatus
    rejected_by: ApplicationRejectedBy
    submitted_at: string
    viewed_at: string | null
    decided_at: string | null
    resolved_at: string | null
    expires_at: string
    sla_days: number
  }
  agency: {
    tenant_id: string
    slug: string
    display_name: string
    logo_url: string | null
    primary_market_label: string | null
    suspended_at: string | null
    deleted_at: string | null
    public_profile_url: string
  }
  decision: {
    resolver: {
      user_id: string
      display_name: string
      role_label: string
      avatar_url: string | null
    } | null
    message: string | null
    role_offered: string | null
    capability_pack: 'standard' | 'senior' | 'custom' | null
    affiliation_mode: 'exclusive' | 'non_exclusive' | null
  }
}

export type ApplicationOutcomeActionResult = {
  success: boolean
  application?: ApplicationOutcomePayload['application']
  token?: string
  active_tenant_id?: string
  activeTenantId?: string
}
