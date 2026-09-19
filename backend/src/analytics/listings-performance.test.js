import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  findAll: vi.fn(),
}))

vi.mock('../db.js', () => db)

let getListingsPerformance

beforeEach(async () => {
  vi.resetModules()
  db.findAll.mockReset()
  db.findAll.mockImplementation(async (collection) => {
    if (collection === 'properties') {
      return [
        {
          id: 'prop_1',
          agency_id: 'agc_1',
          agent_id: 'agt_1',
          title: 'Sea View Villa',
          city: 'Beirut',
          neighborhood: 'Achrafieh',
          property_type: 'apartment',
          status: 'active',
          views: 100,
          created_at: '2026-09-10T10:00:00.000Z',
        },
        {
          id: 'prop_2',
          agency_id: 'agc_1',
          agent_id: 'agt_2',
          title: 'Downtown Loft',
          city: 'Beirut',
          neighborhood: 'Downtown',
          property_type: 'loft',
          status: 'active',
          views: 40,
          created_at: '2026-09-12T10:00:00.000Z',
        },
        { id: 'prop_3', agency_id: 'agc_2', title: 'Other agency', status: 'active', views: 999 },
      ]
    }
    if (collection === 'inquiries') {
      return [
        { id: 'inq_1', agency_id: 'agc_1', property_id: 'prop_1', created_at: '2026-09-15T10:00:00.000Z' },
        { id: 'inq_2', agency_id: 'agc_1', property_id: 'prop_1', created_at: '2026-09-16T10:00:00.000Z' },
        { id: 'inq_3', agency_id: 'agc_1', property_id: 'prop_2', created_at: '2026-09-14T10:00:00.000Z' },
      ]
    }
    if (collection === 'viewings') {
      return [
        { id: 'vw_1', agency_id: 'agc_1', property_id: 'prop_1', scheduled_at: '2026-09-16T12:00:00.000Z' },
      ]
    }
    if (collection === 'opportunities') {
      return [
        {
          id: 'opp_1',
          agency_id: 'agc_1',
          property_id: 'prop_1',
          stage: 'closed_won',
          created_at: '2026-09-17T10:00:00.000Z',
        },
      ]
    }
    if (collection === 'agents') {
      return [
        { id: 'agt_1', agency_id: 'agc_1', name: 'Alex Agent' },
        { id: 'agt_2', agency_id: 'agc_1', name: 'Bella Broker' },
      ]
    }
    if (collection === 'listing_events') {
      return [
        { id: 'evt_1', property_id: 'prop_1', type: 'view', channel: 'marketplace', created_at: '2026-09-15T10:00:00.000Z' },
        { id: 'evt_2', property_id: 'prop_1', type: 'click', channel: 'whatsapp', created_at: '2026-09-15T11:00:00.000Z' },
      ]
    }
    if (collection === 'profile_followers') {
      return [
        { id: 'fol_1', entity_type: 'property', entity_id: 'prop_1', status: 'active', created_at: '2026-09-14T10:00:00.000Z' },
      ]
    }
    return []
  })

  ;({ getListingsPerformance } = await import('./listings-performance.js'))
})

describe('getListingsPerformance', () => {
  it('requires agencyId', async () => {
    await expect(getListingsPerformance({})).rejects.toThrow('agencyId is required')
  })

  it('returns scoped listing performance rows and overview', async () => {
    const result = await getListingsPerformance({ agencyId: 'agc_1' })
    expect(result.agency_id).toBe('agc_1')
    expect(result.rows).toHaveLength(2)
    expect(result.overview.total_inquiries).toBe(3)
    expect(result.overview.total_viewings).toBe(1)
    expect(result.overview.total_conversions).toBe(1)
    expect(result.rows[0].id).toBe('prop_1')
    expect(result.rows[0].agent_name).toBe('Alex Agent')
    expect(result.by_channel.length).toBeGreaterThan(0)
  })

  it('filters by agent and property type', async () => {
    const result = await getListingsPerformance({
      agencyId: 'agc_1',
      agentId: 'agt_2',
      propertyType: 'loft',
    })
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].id).toBe('prop_2')
  })
})
