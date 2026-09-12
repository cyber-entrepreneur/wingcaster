/** AGT-ACT activation wizard types — mirrors backend `activation_state` contract. */

export const ACTIVATION_STEP_IDS = [
  'whatsapp',
  'first_listing',
  'portal_credentials',
  'working_hours',
  'invite_team',
] as const

export type ActivationStepId = (typeof ACTIVATION_STEP_IDS)[number]

export type ActivationStepState =
  | 'complete'
  | 'in_progress'
  | 'not_started'
  | 'deferred'
  | 'locked'

export type CompletedVia =
  | 'onboarding'
  | 'whatsapp_intake'
  | 'dashboard_action'
  | 'direct'
  | 'bulk_import'

export type SignupPath = 'solo' | 'join' | 'agency'

export type LockReason =
  | 'portal_registry_empty_for_country'
  | 'solo_signup_path'
  | 'join_signup_path'

export interface ActivationStep {
  id: ActivationStepId | string
  order: number
  state: ActivationStepState
  completed_at: string | null
  completed_via: CompletedVia | string | null
  sub_route: string
  lock_reason?: LockReason | string | null
}

export interface ActivationState {
  user_id: string
  tenant_id: string
  signup_path: SignupPath
  country_code: string | null
  steps: ActivationStep[]
  completed_count: number
  total_count: number
}

export interface PortalRegistryEntry {
  code: string
  display_name: string
  publisher_config?: {
    description?: string
    credentials_schema?: Record<string, unknown>
  }
}

export interface ConnectedPortal {
  portal_code: string
  status: 'connected' | 'failed' | 'connecting' | 'not_connected'
  masked_identifier?: string | null
  error_class?: string | null
}

export interface AgencyInvitation {
  id: string
  email: string
  sent_at: string | null
  status: 'pending' | 'accepted' | 'expired' | 'declined'
  method?: string
}

export interface ShareLinkPayload {
  url: string
  code: string
  expires_at?: string | null
}

export interface WhatsAppActivationCode {
  display_code: string
  parseable_code?: string
  shared_number_e164: string
  expires_at: string
}

export interface WhatsAppBindingStatus {
  bound: boolean
  phone_e164?: string
  bound_at?: string | null
  error?: string
  error_class?: string
}
