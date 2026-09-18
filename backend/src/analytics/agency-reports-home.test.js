import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  findAll: vi.fn(),
}))

vi.mock('../db.js', () => db)

let getAgencyReportsHome

beforeEach(async () => {
  vi.resetModules()
  db.findAll.mockReset()
  db.findAll.mockImplementation(async (collection) => {
    if (collection === 'properties') {
      return [
        { id: 'prop_1', agency_id: 'agc_1', status: 'active', views: 120, created_at: '2026-09-17T10:00:00.000Z' },
        { id: 'prop_2', agency_id: 'agc_1', status: 'draft', views: 30, created_at: '2026-09-10T10:00:00.000Z' },
        { id: 'prop_3', agency_id: 'agc_2', status: 'active', views: 999, created_at: '2026-09-17T10:00:00.000Z' },
      ]
    }
    if (collection === 'inquiries') {
      return [
        { id: 'inq_1', agency_id: 'agc_1', created_at: '2026-09-16T10:00:00.000Z' },
        { id: 'inq_2', agency_id: 'agc_1', created_at: '2026-09-01T10:00:00.000Z' },
      ]
    }
    if (collection === 'opportunities') {
      return [
        {
          id: 'opp_1',
          agency_id: 'agc_1',
          agent_id: 'agt_1',
          stage: 'closed_won',
          deal_value: 250000,
          closed_at: '2026-09-15T10:00:00.000Z',
          created_at: '2026-09-01T10:00:00.000Z',
        },
        {
          id: 'opp_2',
          agency_id: 'agc_1',
          agent_id: 'agt_2',
          stage: 'proposal',
          deal_value: 100000,
          created_at: '2026-09-16T10:00:00.000Z',
        },
      ]
    }
    if (collection === 'agents') {
      return [
        { id: 'agt_1', agency_id: 'agc_1', name: 'Alex Agent' },
        { id: 'agt_2', agency_id: 'agc_1', name: 'Bella Broker' },
      ]
    }
    if (collection === 'campaigns') {
      return [
        { id: 'cmp_1', agency_id: 'agc_1', status: 'active' },
        { id: 'cmp_2', agency_id: 'agc_1', status: 'draft' },
      ]
    }
    if (collection === 'campaign_enrollments') {
      return [{ id: 'enr_1', campaign_id: 'cmp_1', created_at: '2026-09-14T10:00:00.000Z' }]
    }
    if (collection === 'website_analytics') {
      return [
        { id: 'evt_1', agency_id: 'agc_1', page: '/listings', created_at: '2026-09-16T10:00:00.000Z' },
        { id: 'evt_2', agency_id: 'agc_1', page: '/about', created_at: '2026-09-15T10:00:00.000Z' },
      ]
    }
    if (collection === 'ai_usage_daily') {
      return [{ user_id: 'usr_1', tenant_id: 'agc_1', usage_date: '2026-09-16', suggestions_used: 12 }]
    }
    if (collection === 'agency_members') {
      return [{ agency_id: 'agc_1', user_id: 'agt_1', status: 'active' }]
    }
    return []
  })

  ;({ getAgencyReportsHome } = await import('./agency-reports-home.js'))
})

describe('getAgencyReportsHome', () => {
  it('requires agencyId', async () => {
    await expect(getAgencyReportsHome({})).rejects.toThrow('agencyId is required')
  })

  it('returns summary cards scoped to the agency', async () => {
    const result = await getAgencyReportsHome({ agencyId: 'agc_1' })
    expect(result.agency_id).toBe('agc_1')
    expect(result.cards).toHaveLength(7)

    const listings = result.cards.find((card) => card.id === 'listings')
    expect(listings.kpi_value).toBe(1)
    expect(listings.secondary_value).toBe(150)
    expect(listings.trend).toHaveLength(7)

    const leads = result.cards.find((card) => card.id === 'leads')
    expect(leads.kpi_value).toBeGreaterThanOrEqual(1)

    const revenue = result.cards.find((card) => card.id === 'revenue')
    expect(revenue.kpi_value).toBe(250000)
  })
})
