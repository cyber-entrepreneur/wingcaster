export type AgencyBrandFont = 'system' | 'ibm-plex-sans' | 'archivo' | 'playfair-display'

export interface AgencyBranding {
  agency_id: string
  name: string
  description: string
  logo_url: string | null
  favicon_url: string | null
  primary_color: string | null
  accent_color: string | null
  font_family: AgencyBrandFont
  updated_at: string | null
  updated_by: string | null
  is_default: boolean
}

export interface AgencyBrandingResponse {
  branding: AgencyBranding
}

export interface AgencyBrandingUpdate {
  name: string
  description: string
  logo_url: string | null
  favicon_url: string | null
  primary_color: string
  accent_color: string
  font_family: AgencyBrandFont
}
