export interface AgencyPublicProfileSettings {
  agency_id: string
  show_team: boolean
  show_listings: boolean
  show_reviews: boolean
  show_closed_transactions: boolean
  show_contact_form: boolean
  hero_title: string
  hero_body: string
  meta_description: string
  updated_at: string | null
  updated_by: string | null
  is_default: boolean
}

export type AgencyPublicProfileUpdate = Pick<
  AgencyPublicProfileSettings,
  | 'show_team'
  | 'show_listings'
  | 'show_reviews'
  | 'show_closed_transactions'
  | 'show_contact_form'
  | 'hero_title'
  | 'hero_body'
  | 'meta_description'
>

export interface AgencyPublicProfileSettingsResponse {
  settings: AgencyPublicProfileSettings
}
