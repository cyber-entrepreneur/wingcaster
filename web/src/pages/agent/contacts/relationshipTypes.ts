/** AGT-CTC-007 / BE-BLOCKER-36 relationship contracts. */

export const PARTY_TYPES = ['buyer', 'seller', 'landlord', 'tenant'] as const
export type PartyType = (typeof PARTY_TYPES)[number]

export const RELATIONSHIP_TYPES = ['representation', 'mandate', 'affinity'] as const
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number]

export const EXCLUSIVITY = ['exclusive', 'non_exclusive'] as const
export type Exclusivity = (typeof EXCLUSIVITY)[number]

export const RELATIONSHIP_STATUSES = [
  'pending',
  'confirmed',
  'active',
  'suspended',
  'ended',
  'expired',
  'rejected',
] as const
export type RelationshipStatus = (typeof RELATIONSHIP_STATUSES)[number]

export type RelationshipScope = {
  areas?: string[]
  property_types?: string[]
  bedrooms?: { min?: number; max?: number }
  price_range?: { currency?: string; min?: number | null; max?: number | null }
  subject_property_ids?: string[]
  region?: string
  [key: string]: unknown
}

export type ConsentRecord = {
  method?: string
  summary?: string
  evidence?: {
    type?: string
    filename?: string
    asset_id?: string
  } | null
  captured_at?: string | null
  confirmed_at?: string | null
  confirmation_method?: string | null
  decision?: string | null
  [key: string]: unknown
}

export type ContactRelationship = {
  id: string
  tenant_id: string
  contact_id: string
  agent_user_id: string
  party_type: PartyType
  relationship_type: RelationshipType
  exclusivity: Exclusivity
  scope: RelationshipScope
  status: RelationshipStatus
  consent_record: ConsentRecord
  starts_at: string | null
  ends_at: string | null
  created_at: string
  updated_at: string
}

/**
 * PII-redacted cross-tenant/other-agent summary.
 * Never invent unmasked agent/agency/email/phone/price fields.
 */
export type RedactedRelationship = {
  id: 'redacted' | string
  relationship_type: RelationshipType
  party_type: PartyType
  exclusivity: Exclusivity
  status: RelationshipStatus
  starts_month: string | null
  ends_month: string | null
  scope_summary: {
    areas_region?: string
    property_types?: string[]
  }
}

export type CreateRelationshipBody = {
  party_type: PartyType
  relationship_type: RelationshipType
  exclusivity?: Exclusivity
  scope?: RelationshipScope
  starts_at?: string | null
  ends_at?: string | null
}

export type PatchRelationshipBody = {
  scope?: RelationshipScope
  starts_at?: string | null
  ends_at?: string | null
}

export type MineRelationshipsResponse = {
  relationships: ContactRelationship[]
}

export type OtherRelationshipsResponse = {
  relationships: RedactedRelationship[]
  disabled?: boolean
  error?: string
  message?: string
}

export type ExclusiveConflictError = {
  error: 'EXCLUSIVE_CONFLICT'
  message?: string
  conflicting_relationship_summary?: {
    party_type?: string
    status?: string
    ends_at_month?: string | null
  } | null
  status?: number
}

export type PublicConsentTerms = {
  purpose: string
  relationship_id: string
  contact_id: string
  party_type: PartyType
  relationship_type: RelationshipType
  exclusivity: Exclusivity
  scope: RelationshipScope
  starts_at: string | null
  ends_at: string | null
  status: RelationshipStatus
}

export type PublicConsentDecisionResponse = {
  success: boolean
  relationship: ContactRelationship
}

export type ContactSummary = {
  id: string
  name?: string | null
  email?: string | null
  phone?: string | null
  status?: string | null
  first_touch_channel?: string | null
  last_activity_at?: string | null
}
