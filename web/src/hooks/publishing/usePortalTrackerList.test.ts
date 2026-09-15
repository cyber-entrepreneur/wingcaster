// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  filtersFromSearchParams,
  filtersToQueryParams,
  searchParamsFromFilters,
} from './usePortalTrackerList'

describe('usePortalTrackerList URL helpers', () => {
  it('hydrates filters from URL (status, portal, within, q)', () => {
    const params = new URLSearchParams(
      'status=rejected,failed&portal=bayut&within=7d&q=marina&listing_id=lst_1',
    )
    const filters = filtersFromSearchParams(params)
    expect(filters.status).toEqual(['rejected', 'failed'])
    expect(filters.portal).toEqual(['bayut'])
    expect(filters.submittedWithin).toBe('7d')
    expect(filters.q).toBe('marina')
    expect(filters.listing_id).toBe('lst_1')
  })

  it('round-trips filters into search params', () => {
    const next = searchParamsFromFilters({
      status: ['live'],
      portal: ['bayut', 'dubizzle'],
      submittedWithin: '30d',
      q: 'gate',
      listing_id: '',
    })
    expect(next.get('status')).toBe('live')
    expect(next.get('portal')).toBe('bayut,dubizzle')
    expect(next.get('within')).toBe('30d')
    expect(next.get('q')).toBe('gate')
    expect(next.get('listing_id')).toBeNull()
  })

  it('maps submittedWithin + cursor into API query params', () => {
    const params = filtersToQueryParams(
      {
        status: ['in_review'],
        portal: [],
        submittedWithin: 'month',
        q: '',
        listing_id: '',
      },
      { after: 'cursor_abc', limit: 20 },
    )
    expect(params.status).toBe('in_review')
    expect(params.after).toBe('cursor_abc')
    expect(params.limit).toBe('20')
    expect(params.from).toBeTruthy()
    expect(params.to).toBeTruthy()
  })
})
