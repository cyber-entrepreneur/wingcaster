import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const tenantAuth = vi.hoisted(() => ({
  listUserAgencyMemberships: vi.fn(),
}))

const listingsPerformance = vi.hoisted(() => ({
  getListingsPerformance: vi.fn(),
}))

vi.mock('../tenant-authorization.js', () => tenantAuth)
vi.mock('./listings-performance.js', () => listingsPerformance)

let registerListingsPerformanceRoutes

async function createApp(userId = 'usr_owner') {
  const app = express()
  app.use(express.json())
  registerListingsPerformanceRoutes(app, {
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
  listingsPerformance.getListingsPerformance.mockReset()

  tenantAuth.listUserAgencyMemberships.mockResolvedValue([
    { agency_id: 'agc_1', user_id: 'usr_owner', affiliation_mode: 'exclusive', role: 'owner' },
  ])
  listingsPerformance.getListingsPerformance.mockResolvedValue({
    generated_at: '2026-09-18T00:00:00.000Z',
    overview: { listings: 2, total_views: 140 },
    rows: [],
  })

  ;({ registerListingsPerformanceRoutes } = await import('./listings-performance-routes.js'))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GET /api/agency/analytics/listings-performance', () => {
  it('returns listings performance payload for exclusive agency members', async () => {
    const app = await createApp()
    const res = await request(app).get('/api/agency/analytics/listings-performance?area=Beirut')
    expect(res.status).toBe(200)
    expect(listingsPerformance.getListingsPerformance).toHaveBeenCalledWith({
      agencyId: 'agc_1',
      startDate: undefined,
      endDate: undefined,
      agentId: undefined,
      area: 'Beirut',
      propertyType: undefined,
    })
    expect(res.body.overview.listings).toBe(2)
  })

  it('returns 403 when caller has no exclusive membership', async () => {
    tenantAuth.listUserAgencyMemberships.mockResolvedValue([])
    const app = await createApp('usr_solo')
    const res = await request(app).get('/api/agency/analytics/listings-performance')
    expect(res.status).toBe(403)
    expect(listingsPerformance.getListingsPerformance).not.toHaveBeenCalled()
  })

  it('rejects unknown query parameters', async () => {
    const app = await createApp()
    const res = await request(app).get('/api/agency/analytics/listings-performance?foo=bar')
    expect(res.status).toBe(400)
    expect(listingsPerformance.getListingsPerformance).not.toHaveBeenCalled()
  })
})
