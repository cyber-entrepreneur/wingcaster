import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  findAll: vi.fn(),
}))

vi.mock('../db.js', () => db)

let getWhiteLabelAnalytics

beforeEach(async () => {
  vi.resetModules()
  db.findAll.mockReset()
  db.findAll.mockImplementation(async (collection, filter) => {
    const applyFilter = (rows) => (typeof filter === 'function' ? rows.filter(filter) : rows)
    if (collection === 'website_analytics') {
      return applyFilter([
        {
          id: 'evt_1',
          agency_id: 'agc_1',
          page: '/',
          device: 'mobile',
          event_type: 'pageview',
          referrer: 'bazaar',
          property_id: 'prop_1',
          session_id: 'sess_1',
          created_at: '2026-09-15T10:00:00.000Z',
        },
        {
          id: 'evt_2',
          agency_id: 'agc_1',
          page: '/contact',
          device: 'desktop',
          event_type: 'inquiry',
          referrer: 'google',
          property_id: 'prop_1',
          session_id: 'sess_2',
          created_at: '2026-09-16T11:00:00.000Z',
        },
        {
          id: 'evt_3',
          agency_id: 'agc_2',
          page: '/',
          device: 'desktop',
          event_type: 'pageview',
          created_at: '2026-09-16T11:00:00.000Z',
        },
      ])
    }
    if (collection === 'properties') {
      return applyFilter([{ id: 'prop_1', agency_id: 'agc_1', title: 'Sea View Villa' }])
    }
    return []
  })

  ;({ getWhiteLabelAnalytics } = await import('./analytics.js'))
})

describe('getWhiteLabelAnalytics', () => {
  it('requires agencyId', async () => {
    await expect(getWhiteLabelAnalytics({})).rejects.toThrow('agencyId is required')
  })

  it('aggregates KPIs, sources, and top listings for the agency', async () => {
    const result = await getWhiteLabelAnalytics({
      agencyId: 'agc_1',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    })

    expect(result.kpis.visitors).toBe(2)
    expect(result.kpis.pageviews).toBe(1)
    expect(result.kpis.inquiries).toBe(1)
    expect(result.kpis.conversion_rate).toBe(100)
    expect(result.kpis.bazaar_referral_share).toBe(100)
    expect(result.top_listings[0]).toEqual({
      property_id: 'prop_1',
      title: 'Sea View Villa',
      views: 2,
    })
    expect(result.traffic_sources.some((row) => row.key === 'bazaar')).toBe(true)
  })
})
