import { LC_STATUS_GLYPH } from '@/theme/status'

/** Six listing statuses per AGT-LST-001 / Broadcast status model. */
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
    description: 'An offer is in play. Still active but flagged.',
    glyph: LC_STATUS_GLYPH.underOffer,
  },
  closed: {
    label: 'Sold',
    description: 'Deal closed (sold or rented). Retained for history.',
    glyph: LC_STATUS_GLYPH.closed,
  },
  archived: {
    label: 'Archived',
    description: 'Retired from active management. Hidden from default views.',
    glyph: LC_STATUS_GLYPH.archived,
  },
}

export function normalizeStatus(raw: string | undefined | null): ListingStatus {
  const value = (raw || '').toLowerCase().trim().replace(/[\s_-]+/g, '')
  if (value === 'draft') return 'draft'
  if (value === 'published' || value === 'active' || value === 'live') return 'published'
  if (value === 'unpublished') return 'unpublished'
  if (
    value === 'underoffer' ||
    value === 'pending' ||
    value === 'review' ||
    value === 'paused'
  ) {
    return 'underOffer'
  }
  if (value === 'closed' || value === 'sold' || value === 'rented' || value === 'won') {
    return 'closed'
  }
  if (value === 'archived' || value === 'inactive') return 'archived'
  return 'draft'
}
