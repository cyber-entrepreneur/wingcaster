import { describe, expect, it } from 'vitest'
import {
  LISTING_STATUSES,
  LISTING_STATUS_META,
  normalizeStatus,
} from './listingStatus'

describe('listingStatus', () => {
  it('defines all six statuses from the brief', () => {
    expect(LISTING_STATUSES).toEqual([
      'draft',
      'published',
      'unpublished',
      'underOffer',
      'closed',
      'archived',
    ])
    for (const s of LISTING_STATUSES) {
      expect(LISTING_STATUS_META[s].label).toBeTruthy()
      expect(LISTING_STATUS_META[s].glyph).toBeTruthy()
    }
  })

  it('normalizes aliases without mislabeling unpublished as pending/draft', () => {
    expect(normalizeStatus('unpublished')).toBe('unpublished')
    expect(normalizeStatus('pending')).toBe('underOffer')
    expect(normalizeStatus('under_offer')).toBe('underOffer')
    expect(normalizeStatus('sold')).toBe('closed')
    expect(normalizeStatus('rented')).toBe('closed')
    expect(normalizeStatus('active')).toBe('published')
    expect(normalizeStatus('archived')).toBe('archived')
  })
})
