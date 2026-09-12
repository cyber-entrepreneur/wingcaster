import { LC_STATUS_GLYPH } from '@/theme/status'

export type ListingStatus =
  | 'draft'
  | 'published'
  | 'unpublished'
  | 'underOffer'
  | 'closed'
  | 'archived'

export const LISTING_STATUSES: ListingStatus[] = [
  'draft',
  'published',
  'unpublished',
  'underOffer',
  'closed',
  'archived',
]

export interface ListingStatusMeta {
  label: string
  description: string
  glyph: string
}

export const LISTING_STATUS_META: Record<ListingStatus, ListingStatusMeta> = {
  draft: {
    label: 'Draft',
    description: 'Work in progress. Not visible anywhere.',
    glyph: LC_STATUS_GLYPH.draft,
  },
  published: {
    label: 'Published',
    description: 'Live on connected portals and social channels.',
    glyph: LC_STATUS_GLYPH.published,
  },
  unpublished: {
    label: 'Unpublished',
    description: 'Taken down from portals and channels. Kept in your workspace.',
    glyph: LC_STATUS_GLYPH.unpublished,
  },
  underOffer: {
    label: 'Under offer',
    description: 'An offer is in progress. Listing stays visible.',
    glyph: LC_STATUS_GLYPH.underOffer,
  },
  closed: {
    label: 'Closed',
    description: 'Sold or rented. No longer accepting inquiries.',
    glyph: LC_STATUS_GLYPH.closed,
  },
  archived: {
    label: 'Archived',
    description: 'Retired from active management. Hidden from default views.',
    glyph: LC_STATUS_GLYPH.archived,
  },
}

export function normalizeStatus(raw: string | undefined | null): ListingStatus {
  const value = (raw || '').toLowerCase().trim()
  if ((LISTING_STATUSES as string[]).includes(value)) return value as ListingStatus
  if (value === 'active' || value === 'live') return 'published'
  if (value === 'sold' || value === 'rented' || value === 'won') return 'closed'
  if (value === 'pending' || value === 'under_offer' || value === 'under-offer') return 'underOffer'
  if (value === 'inactive') return 'archived'
  return 'draft'
}
