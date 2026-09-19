import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const tenantAuth = vi.hoisted(() => ({
  listUserAgencyMemberships: vi.fn(),
}))

const campaignPerformance = vi.hoisted(() => ({
  getCampaignPerformance: vi.fn(),
}))

vi.mock('../tenant-authorization.js', () => tenantAuth)
vi.mock('./campaign-performance.js', () => campaignPerformance)

let registerCampaignPerformanceRoutes

async function createApp(userId = 'usr_owner') {
  const app = express()
  app.use(express.json())
  registerCampaignPerformanceRoutes(app, {
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
  campaignPerformance.getCampaignPerformance.mockReset()

  tenantAuth.listUserAgencyMemberships.mockResolvedValue([
    { agency_id: 'agc_1', user_id: 'usr_owner', affiliation_mode: 'exclusive', role: 'owner' },
  ])
  campaignPerformance.getCampaignPerformance.mockResolvedValue({
    generated_at: '2026-09-18T00:00:00.000Z',
    overview: { campaigns: 2, total_enrollments: 5 },
    rows: [],
  })

  ;({ registerCampaignPerformanceRoutes } = await import('./campaign-performance-routes.js'))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GET /api/agency/analytics/campaign-performance', () => {
  it('returns campaign performance payload for exclusive agency members', async () => {
    const app = await createApp()
    const res = await request(app).get('/api/agency/analytics/campaign-performance?channel=email')
    expect(res.status).toBe(200)
    expect(campaignPerformance.getCampaignPerformance).toHaveBeenCalledWith({
      agencyId: 'agc_1',
      startDate: undefined,
      endDate: undefined,
      channel: 'email',
      agentId: undefined,
    })
    expect(res.body.overview.campaigns).toBe(2)
  })

  it('returns 403 when caller has no exclusive membership', async () => {
    tenantAuth.listUserAgencyMemberships.mockResolvedValue([])
    const app = await createApp('usr_solo')
    const res = await request(app).get('/api/agency/analytics/campaign-performance')
    expect(res.status).toBe(403)
    expect(campaignPerformance.getCampaignPerformance).not.toHaveBeenCalled()
  })

  it('rejects unknown query parameters', async () => {
    const app = await createApp()
    const res = await request(app).get('/api/agency/analytics/campaign-performance?foo=bar')
    expect(res.status).toBe(400)
    expect(campaignPerformance.getCampaignPerformance).not.toHaveBeenCalled()
  })
})
