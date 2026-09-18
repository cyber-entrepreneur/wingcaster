import { describe, expect, it, vi } from 'vitest'
import { registerAdminRoutes } from './admin-routes.js'

function fakeExpress() {
  const routes = []
  const app = {
    get: (path, ...handlers) => routes.push({ method: 'get', path, handlers }),
    post: (path, ...handlers) => routes.push({ method: 'post', path, handlers }),
    put: (path, ...handlers) => routes.push({ method: 'put', path, handlers }),
    delete: (path, ...handlers) => routes.push({ method: 'delete', path, handlers }),
  }
  return { app, routes }
}

function mockRes() {
  const res = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

const logger = { warn: () => {}, error: () => {}, info: () => {}, debug: () => {}, child: () => logger }

const sampleArea = {
  id: 'area-1',
  name: 'Dubai Marina',
  slug: 'dubai-marina',
  level: 'neighborhood',
  status: 'scoring_enabled',
  center_latitude: 25.0805,
  center_longitude: 55.1403,
  summary: 'Waterfront community',
}

function buildServices(overrides = {}) {
  return {
    areaService: {
      getById: vi.fn(async (id) => (id === 'area-1' ? sampleArea : null)),
      update: vi.fn(async (id, patch) => (id === 'area-1' ? { ...sampleArea, ...patch } : null)),
      list: vi.fn(async () => ({ items: [sampleArea], total: 1 })),
      create: vi.fn(),
      remove: vi.fn(),
    },
    dimensionService: { list: vi.fn(async () => []) },
    sourceTypeService: { list: vi.fn(async () => []) },
    sourceService: {
      listForArea: vi.fn(async () => [{ id: 'src-1', name: 'Google Places', source_type_id: 'st-1' }]),
      create: vi.fn(async (payload) => ({ id: 'src-new', ...payload })),
      update: vi.fn(async (id, patch) => (id === 'src-1' ? { id, ...patch } : null)),
      remove: vi.fn(async () => true),
    },
    signalService: { list: vi.fn(async () => ({ items: [], total: 0 })), verify: vi.fn(), reject: vi.fn() },
    scoreService: { calculateForArea: vi.fn(), manualOverride: vi.fn() },
    aiConfigService: { list: vi.fn(), getActive: vi.fn(), create: vi.fn(), getById: vi.fn(), update: vi.fn(), remove: vi.fn() },
    googleService: {
      listUsage: vi.fn(async () => []),
      getMonthlySpend: vi.fn(async () => 42.5),
    },
    inspectorService: { listSubmissions: vi.fn(async () => []) },
    googleRefreshWorker: {
      refreshOneArea: vi.fn(async () => ({
        area_id: 'area-1',
        source_types: 2,
        signals_before: 1,
        signals_after: 3,
        signals_created: 2,
      })),
    },
    config: { googleMapsBudgetUsdMonthly: 50 },
    logger,
    ...overrides,
  }
}

describe('area admin routes (PA-ARE-002)', () => {
  it('registers detail and source endpoints', () => {
    const { app, routes } = fakeExpress()
    registerAdminRoutes(app, buildServices())
    const paths = routes.map((r) => `${r.method.toUpperCase()} ${r.path}`)
    expect(paths).toContain('GET /api/admin/areas/:id/detail')
    expect(paths).toContain('GET /api/admin/areas/:areaId/sources')
    expect(paths).toContain('POST /api/admin/areas/:areaId/sources')
  })

  it('returns composite detail payload with google budget', async () => {
    const services = buildServices()
    const { app, routes } = fakeExpress()
    registerAdminRoutes(app, services)
    const route = routes.find((r) => r.path === '/api/admin/areas/:id/detail')
    const handler = route.handlers[route.handlers.length - 1]
    const req = { params: { id: 'area-1' }, user: { id: 'admin-1' } }
    const res = mockRes()
    await handler(req, res, () => {})
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      area: sampleArea,
      sources: expect.any(Array),
      google_budget: expect.objectContaining({
        monthly_spend_usd: 42.5,
        budget_usd_monthly: 50,
        quota_exceeded: false,
      }),
    }))
  })

  it('returns 404 for unknown area detail', async () => {
    const services = buildServices()
    const { app, routes } = fakeExpress()
    registerAdminRoutes(app, services)
    const route = routes.find((r) => r.path === '/api/admin/areas/:id/detail')
    const handler = route.handlers[route.handlers.length - 1]
    const req = { params: { id: 'missing' }, user: { id: 'admin-1' } }
    const res = mockRes()
    await handler(req, res, () => {})
    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('validates update body strictly', async () => {
    const services = buildServices()
    const { app, routes } = fakeExpress()
    registerAdminRoutes(app, services)
    const route = routes.find((r) => r.method === 'put' && r.path === '/api/admin/areas/:id')
    const handler = route.handlers[route.handlers.length - 1]
    const req = { params: { id: 'area-1' }, body: { name: 'Updated', unexpected: true }, user: { id: 'admin-1' } }
    const res = mockRes()
    await handler(req, res, () => {})
    expect(res.status).toHaveBeenCalledWith(400)
    expect(services.areaService.update).not.toHaveBeenCalled()
  })

  it('updates area on valid payload', async () => {
    const services = buildServices()
    const { app, routes } = fakeExpress()
    registerAdminRoutes(app, services)
    const route = routes.find((r) => r.method === 'put' && r.path === '/api/admin/areas/:id')
    const handler = route.handlers[route.handlers.length - 1]
    const req = {
      params: { id: 'area-1' },
      body: { summary: 'New summary', lifestyle_profile: 'Active nightlife' },
      user: { id: 'admin-1' },
    }
    const res = mockRes()
    await handler(req, res, () => {})
    expect(services.areaService.update).toHaveBeenCalledWith('area-1', expect.objectContaining({
      summary: 'New summary',
      lifestyle_profile: 'Active nightlife',
    }))
    expect(res.json).toHaveBeenCalled()
  })

  it('returns quota-exceeded code when refresh hits budget cap', async () => {
    const services = buildServices({
      googleRefreshWorker: {
        refreshOneArea: vi.fn(async () => {
          throw new Error('Google Maps monthly budget cap reached')
        }),
      },
    })
    const { app, routes } = fakeExpress()
    registerAdminRoutes(app, services)
    const route = routes.find((r) => r.path === '/api/admin/areas/:id/refresh-google-signals')
    const handler = route.handlers[route.handlers.length - 1]
    const req = { params: { id: 'area-1' }, user: { id: 'admin-1' } }
    const res = mockRes()
    await handler(req, res, () => {})
    expect(res.status).toHaveBeenCalledWith(429)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'GOOGLE_QUOTA_EXCEEDED' }))
  })

  it('rejects invalid source create payload', async () => {
    const services = buildServices()
    const { app, routes } = fakeExpress()
    registerAdminRoutes(app, services)
    const route = routes.find((r) => r.path === '/api/admin/areas/:areaId/sources' && r.method === 'post')
    const handler = route.handlers[route.handlers.length - 1]
    const req = { params: { areaId: 'area-1' }, body: { name: 'No type id' }, user: { id: 'admin-1' } }
    const res = mockRes()
    await handler(req, res, () => {})
    expect(res.status).toHaveBeenCalledWith(400)
    expect(services.sourceService.create).not.toHaveBeenCalled()
  })
})
