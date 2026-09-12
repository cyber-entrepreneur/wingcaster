import { describe, expect, it } from 'vitest'
import { LISTING_STATUSES, normalizeStatus } from './listingStatus'

describe('listingStatus', () => {
  it('defines all 6 listing statuses from AGT-LST-001/002', () => {
    expect(LISTING_STATUSES).toEqual([
      'draft',
      'published',
      'unpublished',
      'underOffer',
      'closed',
      'archived',
    ])
  })

  it('maps pending to underOffer, not unpublished or draft', () => {
    expect(normalizeStatus('pending')).toBe('underOffer')
    expect(normalizeStatus('active')).toBe('published')
    expect(normalizeStatus('sold')).toBe('closed')
  })
})
