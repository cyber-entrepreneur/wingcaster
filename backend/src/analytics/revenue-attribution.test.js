import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  findAll: vi.fn(),
}))

vi.mock('../db.js', () => db)

let getRevenueAttribution

beforeEach(async () => {
  vi.resetModules()
  db.findAll.mockReset()
  ;({ getRevenueAttribution } = await import('./revenue-attribution.js'))
})

describe('getRevenueAttribution', () => {
  it('aggregates revenue by channel, agent, and campaign for an agency', async () => {
    db.findAll.mockImplementation(async (collection) => {
      if (collection === 'closed_transactions') {
        return [
          {
            id: 'txn_1',
            agency_id: 'agc_1',
            agent_id: 'agt_1',
            contact_id: 'ctc_1',
            attribution_source: 'portal_lead',
            final_sold_price: 500000,
            currency: 'USD',
            closed_at: '2026-09-10T12:00:00Z',
            listing_id: 'lst_1',
            transaction_type: 'sale',
          },
          {
            id: 'txn_2',
            agency_id: 'agc_1',
            agent_id: 'agt_1',
            contact_id: 'ctc_2',
            attribution_source: 'referral',
            final_sold_price: 300000,
            currency: 'USD',
            closed_at: '2026-09-12T12:00:00Z',
            listing_id: 'lst_2',
            transaction_type: 'sale',
          },
          {
            id: 'txn_3',
            agency_id: 'agc_2',
            agent_id: 'agt_9',
            attribution_source: 'other',
            final_sold_price: 100000,
            currency: 'USD',
            closed_at: '2026-09-12T12:00:00Z',
            listing_id: 'lst_9',
            transaction_type: 'sale',
          },
        ]
      }
      if (collection === 'agents') {
        return [{ id: 'agt_1', name: 'Sara' }]
      }
      if (collection === 'campaigns') {
        return [{ id: 'cmp_1', agency_id: 'agc_1', name: 'Autumn push' }]
      }
      if (collection === 'campaign_enrollments') {
        return [{ id: 'enr_1', campaign_id: 'cmp_1', contact_id: 'ctc_1' }]
      }
      return []
    })

    const result = await getRevenueAttribution({ agencyId: 'agc_1' })

    expect(result.summary).toEqual({
      total_revenue: 800000,
      transaction_count: 2,
      average_deal_value: 400000,
      currency: 'USD',
    })
    expect(result.by_channel).toHaveLength(2)
    expect(result.by_agent[0]).toMatchObject({ agent_name: 'Sara', revenue: 800000, count: 2 })
    expect(result.by_campaign.find((row) => row.campaign_id === 'cmp_1')?.revenue).toBe(500000)
    expect(result.transactions).toHaveLength(2)
    expect(result.waterfall.length).toBeGreaterThan(0)
  })

  it('filters by channel and agent', async () => {
    db.findAll.mockImplementation(async (collection) => {
      if (collection === 'closed_transactions') {
        return [
          {
            id: 'txn_1',
            agency_id: 'agc_1',
            agent_id: 'agt_1',
            attribution_source: 'portal_lead',
            final_sold_price: 500000,
            currency: 'USD',
            closed_at: '2026-09-10T12:00:00Z',
            listing_id: 'lst_1',
            transaction_type: 'sale',
          },
          {
            id: 'txn_2',
            agency_id: 'agc_1',
            agent_id: 'agt_2',
            attribution_source: 'referral',
            final_sold_price: 300000,
            currency: 'USD',
            closed_at: '2026-09-12T12:00:00Z',
            listing_id: 'lst_2',
            transaction_type: 'sale',
          },
        ]
      }
      return []
    })

    const result = await getRevenueAttribution({
      agencyId: 'agc_1',
      channel: 'portal_lead',
      agentId: 'agt_1',
    })

    expect(result.summary.transaction_count).toBe(1)
    expect(result.summary.total_revenue).toBe(500000)
  })

  it('requires agencyId', async () => {
    await expect(getRevenueAttribution({})).rejects.toThrow('agencyId is required')
  })
})
