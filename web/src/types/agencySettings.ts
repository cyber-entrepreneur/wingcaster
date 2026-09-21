// AGN-SET-001 — Agency settings home overview.
export type AgencyRole = 'owner' | 'admin' | 'member' | 'guest'

export interface AgencySettingsOverview {
  agency: {
    id: string
    name: string | null
    slug: string | null
    license_number: string | null
    accepting_applications: boolean
  }
  my_role: AgencyRole | string
  stats: {
    member_count: number
    pending_applications: number
    mfa_required: boolean
    pending_ownership_transfer: boolean
    accepting_applications: boolean
  }
}
