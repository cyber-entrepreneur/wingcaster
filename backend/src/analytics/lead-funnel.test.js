import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  findAll: vi.fn(),
}))

vi.mock('../db.js', () => db)

let getLeadFunnel

beforeEach(async () => {
  vi.resetModules()
  db.findAll.mockReset()
  ;({ getLeadFunnel } = await import('./lead-funnel.js'))
})

describe('getLeadFunnel', () => {
  it('aggregates inquiry → viewing → opportunity → won funnel for an agency', async () => {
    db.findAll.mockImplementation(async (collection) => {
      if (collection === 'inquiries') {
        return [
          { id: 'inq_1', agency_id: 'agc_1', agent_id: 'agt_1', source: 'bazaar', property_id: 'prop_1', created_at: '2026-09-01T10:00:00Z' },
          { id: 'inq_2', agency_id: 'agc_1', agent_id: 'agt_1', source: 'direct', property_id: 'prop_2', created_at: '2026-09-02T10:00:00Z' },
          { id: 'inq_3', agency_id: 'agc_2', agent_id: 'agt_9', source: 'bayut', created_at: '2026-09-02T10:00:00Z' },
        ]
      }
      if (collection === 'viewings') {
        return [
          { id: 'vw_1', agency_id: 'agc_1', inquiry_id: 'inq_1', created_at: '2026-09-03T10:00:00Z' },
        ]
      }
      if (collection === 'opportunities') {
        return [
          { id: 'opp_1', agency_id: 'agc_1', inquiry_id: 'inq_1', stage: 'closed_won', deal_value: 500000, created_at: '2026-09-04T10:00:00Z' },
        ]
      }
      if (collection === 'properties') {
        return [
          { id: 'prop_1', neighborhood: 'Marina', city: 'Dubai' },
          { id: 'prop_2', neighborhood: 'JLT', city: 'Dubai' },
        ]
      }
      if (collection === 'agents') {
        return [{ id: 'agt_1', name: 'Sara' }]
      }
      return []
    })

    const result = await getLeadFunnel({ agencyId: 'agc_1' })

    expect(result.funnel).toEqual({
      inquiries: 2,
      viewings: 1,
      opportunities: 1,
      closed_won: 1,
      closed_lost: 0,
    })
    expect(result.conversion_rates.inquiry_to_viewing).toBe(50)
    expect(result.conversion_rates.opportunity_to_won).toBe(100)
    expect(result.by_source).toHaveLength(2)
    expect(result.by_agent[0]).toMatchObject({ agent_id: 'agt_1', agent_name: 'Sara', won: 1 })
    expect(result.sankey.links.length).toBeGreaterThan(0)
  })

  it('filters by source, agent, and area', async () => {
    db.findAll.mockImplementation(async (collection) => {
      if (collection === 'inquiries') {
        return [
          { id: 'inq_1', agency_id: 'agc_1', agent_id: 'agt_1', source: 'bazaar', property_id: 'prop_1', created_at: '2026-09-01T10:00:00Z' },
          { id: 'inq_2', agency_id: 'agc_1', agent_id: 'agt_2', source: 'direct', property_id: 'prop_2', created_at: '2026-09-01T10:00:00Z' },
        ]
      }
      if (collection === 'properties') {
        return [
          { id: 'prop_1', neighborhood: 'Marina', city: 'Dubai' },
          { id: 'prop_2', neighborhood: 'JLT', city: 'Dubai' },
        ]
      }
      return []
    })

    const result = await getLeadFunnel({
      agencyId: 'agc_1',
      source: 'bazaar',
      agentId: 'agt_1',
      area: 'Marina',
    })

    expect(result.funnel.inquiries).toBe(1)
    expect(result.scope.filters).toEqual({
      source: 'bazaar',
      agent_id: 'agt_1',
      area: 'Marina',
    })
  })

  it('requires agencyId', async () => {
    await expect(getLeadFunnel({})).rejects.toThrow('agencyId is required')
  })
})
