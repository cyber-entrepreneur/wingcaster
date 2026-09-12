/**
 * Shared sample payloads for Wave 8 activation-polish quality suites.
 */
import type { Property } from '@/types'
import type {
  ContactRelationship,
  PublicConsentTerms,
  RedactedRelationship,
} from '@/pages/agent/contacts/relationshipTypes'

export const FIXED_NOW = new Date('2026-09-12T12:00:00.000Z').getTime()

export function sampleListing(overrides: Partial<Property> = {}): Property {
  return {
    id: 'prop_marina_01',
    canonical_id: 'WC-DXB-0042',
    title: 'Marina Gate 2BR with balcony',
    description: 'Bright apartment overlooking the marina.',
    type: 'sale',
    property_type: 'apartment',
    price: 2_150_000,
    price_unit: 'AED',
    bedrooms: 2,
    bathrooms: 2,
    area: 1180,
    area_unit: 'sqft',
    location: 'Dubai Marina',
    city: 'Dubai',
    neighborhood: 'Dubai Marina',
    address: 'Marina Gate Tower 1',
    amenities: ['balcony', 'parking'],
    furnished: true,
    photos: [],
    agent_id: 'usr_sara',
    agent_name: 'Sara Agent',
    agent_photo: '',
    agent_license: 'BRN-1001',
    agency_name: 'Personal',
    listed_date: new Date(FIXED_NOW - 12 * 86_400_000).toISOString(),
    permit_number: 'PERM-7788',
    reference: 'DXB-M-0042',
    featured: false,
    views: 412,
    status: 'active',
    inquiries_new_count: 3,
    ...overrides,
  }
}

export function sampleListings(): Property[] {
  return [
    sampleListing(),
    sampleListing({
      id: 'prop_jvc_02',
      canonical_id: 'WC-DXB-0091',
      title: 'JVC townhouse — corner plot',
      property_type: 'townhouse',
      price: 3_400_000,
      bedrooms: 3,
      bathrooms: 3,
      area: 2100,
      location: 'Jumeirah Village Circle',
      neighborhood: 'JVC',
      reference: 'DXB-J-0091',
      views: 188,
      status: 'draft',
      listed_date: new Date(FIXED_NOW - 2 * 86_400_000).toISOString(),
    }),
    sampleListing({
      id: 'prop_business_bay_03',
      canonical_id: 'WC-DXB-0155',
      title: 'Business Bay studio — high floor',
      property_type: 'studio',
      price: 980_000,
      bedrooms: 0,
      bathrooms: 1,
      area: 520,
      location: 'Business Bay',
      neighborhood: 'Business Bay',
      reference: 'DXB-B-0155',
      views: 67,
      status: 'unpublished',
      listed_date: new Date(FIXED_NOW - 40 * 86_400_000).toISOString(),
    }),
  ]
}

export function sampleConsentTerms(
  overrides: Partial<PublicConsentTerms> = {},
): PublicConsentTerms {
  return {
    purpose: 'relationship_consent',
    relationship_id: 'rel_wave8',
    contact_id: 'cnt_wave8',
    party_type: 'buyer',
    relationship_type: 'representation',
    exclusivity: 'exclusive',
    scope: { areas: ['dubai-marina'], property_types: ['apartment'] },
    starts_at: '2026-09-08T00:00:00.000Z',
    ends_at: '2027-03-08T00:00:00.000Z',
    status: 'pending',
    ...overrides,
  }
}

export function sampleMineRelationship(
  overrides: Partial<ContactRelationship> = {},
): ContactRelationship {
  return {
    id: 'rel_1',
    tenant_id: 'personal:usr_sara',
    contact_id: 'cnt_wave8',
    agent_user_id: 'usr_sara',
    party_type: 'buyer',
    relationship_type: 'representation',
    exclusivity: 'exclusive',
    scope: {
      areas: ['dubai-marina'],
      property_types: ['apartment'],
      price_range: { currency: 'AED', min: 1_200_000, max: 2_400_000 },
    },
    status: 'pending',
    consent_record: {},
    starts_at: '2026-09-08T00:00:00.000Z',
    ends_at: '2027-03-08T00:00:00.000Z',
    created_at: '2026-09-05T10:00:00.000Z',
    updated_at: '2026-09-05T10:00:00.000Z',
    ...overrides,
  }
}

export function sampleRedactedRelationship(
  overrides: Partial<RedactedRelationship> = {},
): RedactedRelationship {
  return {
    id: 'redacted',
    relationship_type: 'representation',
    party_type: 'buyer',
    exclusivity: 'exclusive',
    status: 'active',
    starts_month: '2026-06',
    ends_month: '2027-06',
    scope_summary: { areas_region: 'Dubai', property_types: ['apartment'] },
    ...overrides,
  }
}

export const sampleInboxConversation = {
  id: 'conv_wave8',
  contact_name: 'Omar Hassan',
  channel: 'whatsapp',
  source: 'bayut',
  last_message_at: new Date(FIXED_NOW - 3_600_000).toISOString(),
  last_message_preview: 'Is the Marina Gate 2BR still available this week?',
  unread_count: 2,
  is_unread_by_agent: true,
  priority_score: 82,
  priority_reason: 'hot lead',
}
