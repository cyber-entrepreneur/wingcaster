import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const tenantAuth = vi.hoisted(() => ({
  listUserAgencyMemberships: vi.fn(),
}))

const agentLeaderboard = vi.hoisted(() => ({
  getAgentLeaderboard: vi.fn(),
  METRICS: ['revenue', 'closings', 'response_time', 'conversion_rate'],
}))

vi.mock('../tenant-authorization.js', () => tenantAuth)
vi.mock('./agent-leaderboard.js', () => agentLeaderboard)

let registerAgentLeaderboardRoutes

async function createApp(userId = 'usr_owner') {
  const app = express()
  app.use(express.json())
  registerAgentLeaderboardRoutes(app, {
    authMiddleware: (req, _res, next) => {
      req.user = { id: userId }
      next()
    },
  })
  return app
}

beforeEach(async () => {
  vi.resetModules()
  tenantAuth.listUserAgencyMemberships.mockReset()
  agentLeaderboard.getAgentLeaderboard.mockReset()

  tenantAuth.listUserAgencyMemberships.mockResolvedValue([
    { agency_id: 'agc_1', user_id: 'usr_owner', affiliation_mode: 'exclusive', role: 'owner' },
  ])
  agentLeaderboard.getAgentLeaderboard.mockResolvedValue({
    generated_at: '2026-09-18T00:00:00.000Z',
    metric: 'revenue',
    leaderboard: [{ rank: 1, agent_name: 'Alex Agent', revenue: 300000 }],
  })

  ;({ registerAgentLeaderboardRoutes } = await import('./agent-leaderboard-routes.js'))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GET /api/agency/analytics/agent-leaderboard', () => {
  it('returns leaderboard payload for exclusive agency members', async () => {
    const app = await createApp()
    const res = await request(app).get('/api/agency/analytics/agent-leaderboard?metric=closings')
    expect(res.status).toBe(200)
    expect(agentLeaderboard.getAgentLeaderboard).toHaveBeenCalledWith({
      agencyId: 'agc_1',
      startDate: undefined,
      endDate: undefined,
      metric: 'closings',
    })
    expect(res.body.leaderboard[0].agent_name).toBe('Alex Agent')
  })

  it('returns 403 when caller has no exclusive membership', async () => {
    tenantAuth.listUserAgencyMemberships.mockResolvedValue([])
    const app = await createApp('usr_solo')
    const res = await request(app).get('/api/agency/analytics/agent-leaderboard')
    expect(res.status).toBe(403)
    expect(agentLeaderboard.getAgentLeaderboard).not.toHaveBeenCalled()
  })

  it('rejects unknown query parameters', async () => {
    const app = await createApp()
    const res = await request(app).get('/api/agency/analytics/agent-leaderboard?foo=bar')
    expect(res.status).toBe(400)
    expect(agentLeaderboard.getAgentLeaderboard).not.toHaveBeenCalled()
  })
})
