import { describe, expect, it } from 'vitest'
import { LISTING_STATUSES, mapStatusToApi, normalizeStatus } from './listingStatus'

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

  it('maps all 6 UI statuses to backend validation enum', () => {
    expect(mapStatusToApi('published')).toBe('active')
    expect(mapStatusToApi('unpublished')).toBe('unpublished')
    expect(mapStatusToApi('draft')).toBe('draft')
    expect(mapStatusToApi('archived')).toBe('archived')
    expect(mapStatusToApi('underOffer')).toBe('underOffer')
    expect(mapStatusToApi('closed')).toBe('closed')
  })
})
