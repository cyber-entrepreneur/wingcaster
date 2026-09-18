import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const tenantAuth = vi.hoisted(() => ({
  listUserAgencyMemberships: vi.fn(),
}))

const leadFunnel = vi.hoisted(() => ({
  getLeadFunnel: vi.fn(),
}))

vi.mock('../tenant-authorization.js', () => tenantAuth)
vi.mock('./lead-funnel.js', () => leadFunnel)

let registerLeadFunnelRoutes

async function createApp(userId = 'usr_owner') {
  const app = express()
  app.use(express.json())
  registerLeadFunnelRoutes(app, {
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
  leadFunnel.getLeadFunnel.mockReset()

  tenantAuth.listUserAgencyMemberships.mockResolvedValue([
    { agency_id: 'agc_1', user_id: 'usr_owner', affiliation_mode: 'exclusive', role: 'owner' },
  ])
  leadFunnel.getLeadFunnel.mockResolvedValue({
    generated_at: '2026-09-18T00:00:00.000Z',
    funnel: { inquiries: 1, viewings: 1, opportunities: 1, closed_won: 0, closed_lost: 0 },
  })

  ;({ registerLeadFunnelRoutes } = await import('./lead-funnel-routes.js'))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GET /api/agency/analytics/lead-funnel', () => {
  it('returns funnel payload for exclusive agency members', async () => {
    const app = await createApp()
    const res = await request(app).get('/api/agency/analytics/lead-funnel?start_date=2026-09-01')
    expect(res.status).toBe(200)
    expect(leadFunnel.getLeadFunnel).toHaveBeenCalledWith({
      agencyId: 'agc_1',
      startDate: '2026-09-01',
      endDate: undefined,
      source: undefined,
      agentId: undefined,
      area: undefined,
    })
    expect(res.body.funnel.inquiries).toBe(1)
  })

  it('returns 403 when caller has no exclusive membership', async () => {
    tenantAuth.listUserAgencyMemberships.mockResolvedValue([])
    const app = await createApp('usr_solo')
    const res = await request(app).get('/api/agency/analytics/lead-funnel')
    expect(res.status).toBe(403)
    expect(leadFunnel.getLeadFunnel).not.toHaveBeenCalled()
  })

  it('rejects unknown query parameters', async () => {
    const app = await createApp()
    const res = await request(app).get('/api/agency/analytics/lead-funnel?foo=bar')
    expect(res.status).toBe(400)
    expect(leadFunnel.getLeadFunnel).not.toHaveBeenCalled()
  })
})
