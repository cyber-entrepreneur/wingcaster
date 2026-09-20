import type { AudienceRule } from '@/components/campaigns/campaign-builder-shared'

export type AudienceType = 'static' | 'dynamic'
export type AudienceMemberSource = 'crm' | 'followers' | 'lookalike' | 'uploaded'
export type AudienceMembershipState =
  | 'matched'
  | 'contactable'
  | 'frequency_capped'
  | 'opted_out'
  | 'conflicting'

export interface AudienceRules {
  tags_filter?: string[]
  audience_rules?: AudienceRule[]
  static_contact_ids?: string[]
}

export interface Audience {
  id: string
  agency_id: string | null
  agent_id: string | null
  name: string
  type: AudienceType
  rules: AudienceRules
  tags_filter: string[]
  audience_rules: AudienceRule[]
  static_contact_ids?: string[]
  member_source: AudienceMemberSource
  estimated_size: number | null
  created_at: string
  updated_at: string
  data?: Record<string, unknown>
}

export interface AudienceResolveResult {
  audienceId: string
  matched: number
  contactable: number
  frequency_capped: number
  opted_out: number
  conflicting: number
  memberIds: Record<AudienceMembershipState, string[]>
}
