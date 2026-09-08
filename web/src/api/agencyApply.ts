/**
 * AGN-MEM-005 agency application API contracts (Wave 0.5 / Week 1 backend).
 */

export type AgencyApplicationAvailability =
  | 'immediately'
  | 'within_2_weeks'
  | 'within_a_month'
  | 'just_exploring'

export type AgencyApplicationBody = {
  message: string
  current_listings_count?: number
  portfolio_url?: string
  availability?: AgencyApplicationAvailability
  referral_source?: string
  invitation_code?: string
  consents: {
    terms?: boolean
    profile_share: true
  }
  guest_signup?: null | Record<string, unknown>
  locale?: string
}

export type AgencyPublicProfile = {
  id: string
  name: string
  slug: string | null
  logo?: string | null
  description?: string | null
  city?: string | null
  accepting_applications: boolean
  member_count?: number
  listings_count?: number
  /** Optional fields not always returned by GET /public today. */
  founded_year?: number | null
  primary_market?: string | null
  owner_note?: string | null
  owner_first_name?: string | null
  owner_last_initial?: string | null
  public_email?: string | null
  public_whatsapp?: string | null
  public_phone?: string | null
}

export type InvitationResolvePayload = {
  code: string
  agency: {
    id: string
    name: string
    slug: string | null
    logo?: string | null
    description?: string | null
  }
  expires_at: string
  single_use: boolean
  status: 'valid' | 'expired' | 'revoked' | 'used' | null
  /** Not yet on backend resolve payload — optional enrichment. */
  invited_by_first_name?: string | null
}

export type AgencyApplicationSuccess = {
  application: {
    id: string
    agency_id: string
    agency_name?: string
    status: string
    created_at?: string
    expected_response_by?: string
  }
  session?: { token?: string; expires_at?: string }
  redirect_to?: string
  success?: boolean
  message?: string
}

export type AgencyApplyApiError = Error & {
  status?: number
  code?: string
  error?: string
  existing_application_id?: string
  existing_status?: string
  expired_at?: string
  fallback_slug?: string
  field_errors?: Record<string, string>
}
