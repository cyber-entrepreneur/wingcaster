import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const tenantAuth = vi.hoisted(() => ({
  listUserAgencyMemberships: vi.fn(),
}))

const reportsHome = vi.hoisted(() => ({
  getAgencyReportsHome: vi.fn(),
}))

vi.mock('../tenant-authorization.js', () => tenantAuth)
vi.mock('./agency-reports-home.js', () => reportsHome)

let registerAgencyReportsHomeRoutes

async function createApp(userId = 'usr_owner') {
  const app = express()
  app.use(express.json())
  registerAgencyReportsHomeRoutes(app, {
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
  reportsHome.getAgencyReportsHome.mockReset()

  tenantAuth.listUserAgencyMemberships.mockResolvedValue([
    { agency_id: 'agc_1', user_id: 'usr_owner', affiliation_mode: 'exclusive', role: 'owner' },
  ])
  reportsHome.getAgencyReportsHome.mockResolvedValue({
    generated_at: '2026-09-18T00:00:00.000Z',
    agency_id: 'agc_1',
    cards: [{ id: 'listings', kpi_value: 3 }],
  })

  ;({ registerAgencyReportsHomeRoutes } = await import('./agency-reports-home-routes.js'))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GET /api/agency/analytics/reports-home', () => {
  it('returns reports-home payload for exclusive agency members', async () => {
    const app = await createApp()
    const res = await request(app).get('/api/agency/analytics/reports-home')
    expect(res.status).toBe(200)
    expect(reportsHome.getAgencyReportsHome).toHaveBeenCalledWith({ agencyId: 'agc_1' })
    expect(res.body.cards[0].kpi_value).toBe(3)
  })

  it('returns 403 when caller has no exclusive membership', async () => {
    tenantAuth.listUserAgencyMemberships.mockResolvedValue([])
    const app = await createApp('usr_solo')
    const res = await request(app).get('/api/agency/analytics/reports-home')
    expect(res.status).toBe(403)
    expect(reportsHome.getAgencyReportsHome).not.toHaveBeenCalled()
  })

  it('rejects unknown query parameters', async () => {
    const app = await createApp()
    const res = await request(app).get('/api/agency/analytics/reports-home?foo=bar')
    expect(res.status).toBe(400)
    expect(reportsHome.getAgencyReportsHome).not.toHaveBeenCalled()
  })
})
