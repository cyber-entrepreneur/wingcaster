import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  findAll: vi.fn(),
}))

vi.mock('../db.js', () => db)

let getAgentLeaderboard

beforeEach(async () => {
  vi.resetModules()
  db.findAll.mockReset()
  db.findAll.mockImplementation(async (collection) => {
    if (collection === 'agents') {
      return [
        { id: 'agt_1', agency_id: 'agc_1', name: 'Alex Agent' },
        { id: 'agt_2', agency_id: 'agc_1', name: 'Bella Broker' },
      ]
    }
    if (collection === 'agency_members') {
      return [
        { agency_id: 'agc_1', user_id: 'agt_1', status: 'active' },
        { agency_id: 'agc_1', user_id: 'agt_2', status: 'active' },
      ]
    }
    if (collection === 'inquiries') {
      return [
        { id: 'inq_1', agency_id: 'agc_1', agent_id: 'agt_1', created_at: '2026-09-15T10:00:00.000Z' },
        { id: 'inq_2', agency_id: 'agc_1', agent_id: 'agt_2', created_at: '2026-09-14T10:00:00.000Z' },
      ]
    }
    if (collection === 'opportunities') {
      return [
        {
          id: 'opp_1',
          agency_id: 'agc_1',
          agent_id: 'agt_1',
          stage: 'closed_won',
          deal_value: 300000,
          closed_at: '2026-09-16T10:00:00.000Z',
        },
        {
          id: 'opp_2',
          agency_id: 'agc_1',
          agent_id: 'agt_2',
          stage: 'closed_won',
          deal_value: 100000,
          closed_at: '2026-09-15T10:00:00.000Z',
        },
      ]
    }
    if (collection === 'properties') {
      return [
        { id: 'prop_1', agency_id: 'agc_1', agent_id: 'agt_1', status: 'active' },
      ]
    }
    if (collection === 'conversations') {
      return [
        { id: 'conv_1', assigned_agent_id: 'agt_1', created_at: '2026-09-15T10:00:00.000Z' },
      ]
    }
    if (collection === 'conversation_messages') {
      return [
        { id: 'msg_1', conversation_id: 'conv_1', direction: 'inbound', created_at: '2026-09-15T10:00:00.000Z' },
        { id: 'msg_2', conversation_id: 'conv_1', direction: 'outbound', created_at: '2026-09-15T10:10:00.000Z' },
      ]
    }
    return []
  })

  ;({ getAgentLeaderboard } = await import('./agent-leaderboard.js'))
})

describe('getAgentLeaderboard', () => {
  it('requires agencyId', async () => {
    await expect(getAgentLeaderboard({})).rejects.toThrow('agencyId is required')
  })

  it('ranks agents by revenue with medals for top three', async () => {
    const result = await getAgentLeaderboard({ agencyId: 'agc_1', metric: 'revenue' })
    expect(result.leaderboard).toHaveLength(2)
    expect(result.leaderboard[0].agent_id).toBe('agt_1')
    expect(result.leaderboard[0].rank).toBe(1)
    expect(result.leaderboard[0].medal).toBe('gold')
    expect(result.leaderboard[0].revenue).toBe(300000)
    expect(result.leaderboard[0].median_response_minutes).toBe(10)
  })

  it('rejects unknown metrics', async () => {
    await expect(getAgentLeaderboard({ agencyId: 'agc_1', metric: 'invalid' })).rejects.toThrow(
      'metric must be one of',
    )
  })
})
