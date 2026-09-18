import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const tenantAuth = vi.hoisted(() => ({
  listUserAgencyMemberships: vi.fn(),
}))

const revenueAttribution = vi.hoisted(() => ({
  getRevenueAttribution: vi.fn(),
}))

vi.mock('../tenant-authorization.js', () => tenantAuth)
vi.mock('./revenue-attribution.js', () => revenueAttribution)

let registerRevenueAttributionRoutes

async function createApp(userId = 'usr_owner') {
  const app = express()
  app.use(express.json())
  registerRevenueAttributionRoutes(app, {
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
  revenueAttribution.getRevenueAttribution.mockReset()

  tenantAuth.listUserAgencyMemberships.mockResolvedValue([
    { agency_id: 'agc_1', user_id: 'usr_owner', affiliation_mode: 'exclusive', role: 'owner' },
  ])
  revenueAttribution.getRevenueAttribution.mockResolvedValue({
    generated_at: '2026-09-18T00:00:00.000Z',
    summary: { total_revenue: 100000, transaction_count: 1, average_deal_value: 100000, currency: 'USD' },
  })

  ;({ registerRevenueAttributionRoutes } = await import('./revenue-attribution-routes.js'))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GET /api/agency/analytics/revenue-attribution', () => {
  it('returns attribution payload for exclusive agency members', async () => {
    const app = await createApp()
    const res = await request(app).get('/api/agency/analytics/revenue-attribution?start_date=2026-09-01')
    expect(res.status).toBe(200)
    expect(revenueAttribution.getRevenueAttribution).toHaveBeenCalledWith({
      agencyId: 'agc_1',
      startDate: '2026-09-01',
      endDate: undefined,
      channel: undefined,
      agentId: undefined,
      campaignId: undefined,
    })
    expect(res.body.summary.total_revenue).toBe(100000)
  })

  it('returns 403 when caller has no exclusive membership', async () => {
    tenantAuth.listUserAgencyMemberships.mockResolvedValue([])
    const app = await createApp('usr_solo')
    const res = await request(app).get('/api/agency/analytics/revenue-attribution')
    expect(res.status).toBe(403)
    expect(revenueAttribution.getRevenueAttribution).not.toHaveBeenCalled()
  })

  it('rejects unknown query parameters', async () => {
    const app = await createApp()
    const res = await request(app).get('/api/agency/analytics/revenue-attribution?foo=bar')
    expect(res.status).toBe(400)
    expect(revenueAttribution.getRevenueAttribution).not.toHaveBeenCalled()
  })
})
