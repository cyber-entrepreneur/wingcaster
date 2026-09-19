import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('../../db.js', () => ({
  query: vi.fn(),
  transaction: vi.fn(async (work) => work({ query: vi.fn() })),
}))

import { query } from '../../db.js'
import { listCanonicalResolutionQueue } from './admin-resolution.js'

describe('canonical admin-resolution', () => {
  beforeEach(() => {
    vi.mocked(query).mockReset()
  })

  it('maps queue rows with dispute counts', async () => {
    vi.mocked(query).mockResolvedValueOnce([
      {
        id: 'c1',
        primary_listing_id: 'p1',
        address_label: '123 Main',
        city: 'Dubai',
        neighborhood: 'Marina',
        sibling_count: 3,
        primary_agency_name: 'Elite Realty',
        updated_at: '2026-01-01T00:00:00.000Z',
        data: { resolution_hold: true },
      },
    ])
    const items = await listCanonicalResolutionQueue()
    expect(items).toEqual([
      expect.objectContaining({
        id: 'c1',
        address: '123 Main',
        sibling_count: 3,
        dispute_count: 2,
        on_hold: true,
        primary_agency_name: 'Elite Realty',
      }),
    ])
  })
})
