import { beforeEach, describe, expect, it, vi } from 'vitest'

const analytics = vi.hoisted(() => ({
  getWhiteLabelAnalytics: vi.fn(),
}))

const tenantAuth = vi.hoisted(() => ({
  listUserAgencyMemberships: vi.fn(),
}))

vi.mock('./analytics.js', () => analytics)
vi.mock('../tenant-authorization.js', () => tenantAuth)

let registerWhiteLabelAnalyticsRoutes

beforeEach(async () => {
  vi.resetModules()
  analytics.getWhiteLabelAnalytics.mockReset()
  tenantAuth.listUserAgencyMemberships.mockReset()
  analytics.getWhiteLabelAnalytics.mockResolvedValue({ kpis: { visitors: 10 } })
  tenantAuth.listUserAgencyMemberships.mockResolvedValue([
    { agency_id: 'agc_1', affiliation_mode: 'exclusive' },
  ])
  ;({ registerWhiteLabelAnalyticsRoutes } = await import('./analytics-routes.js'))
})

function makeApp() {
  const routes = []
  const app = {
    get(path, ...handlers) {
      routes.push({ path, handlers })
    },
  }
  return {
    app,
    async invoke(query = {}) {
      const route = routes.find((row) => row.path === '/api/agency/white-label/analytics')
      const handler = route.handlers[route.handlers.length - 1]
      const req = { user: { id: 'usr_1' }, query }
      const res = {
        statusCode: 200,
        body: null,
        status(code) {
          this.statusCode = code
          return this
        },
        json(payload) {
          this.body = payload
          return this
        },
      }
      await handler(req, res)
      return res
    },
  }
}

describe('registerWhiteLabelAnalyticsRoutes', () => {
  it('returns 403 without exclusive agency membership', async () => {
    tenantAuth.listUserAgencyMemberships.mockResolvedValue([])
    const { app, invoke } = makeApp()
    registerWhiteLabelAnalyticsRoutes(app, { authMiddleware: (_req, _res, next) => next?.() })
    const res = await invoke()
    expect(res.statusCode).toBe(403)
  })

  it('returns analytics payload for agency members', async () => {
    const { app, invoke } = makeApp()
    registerWhiteLabelAnalyticsRoutes(app, { authMiddleware: (_req, _res, next) => next?.() })
    const res = await invoke({ start_date: '2026-09-01', end_date: '2026-09-30' })
    expect(res.statusCode).toBe(200)
    expect(analytics.getWhiteLabelAnalytics).toHaveBeenCalledWith({
      agencyId: 'agc_1',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    })
    expect(res.body.kpis.visitors).toBe(10)
  })

  it('rejects unknown query parameters', async () => {
    const { app, invoke } = makeApp()
    registerWhiteLabelAnalyticsRoutes(app, { authMiddleware: (_req, _res, next) => next?.() })
    const res = await invoke({ extra: 'nope' })
    expect(res.statusCode).toBe(400)
  })
})
