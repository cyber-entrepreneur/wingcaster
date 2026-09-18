/**
 * SHR-INT-002 source-performance route tests.
 *
 * Mocks the aggregation fn + the platform-admin guard to assert scoping:
 * an ordinary caller is scoped to their own agentId; scope=all is honoured
 * only for a verified platform admin; agency_id + dates pass through.
 */
import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const analytics = vi.hoisted(() => ({ getSourcePerformance: vi.fn() }))
const guards = vi.hoisted(() => ({ isPlatformAdmin: vi.fn() }))

vi.mock('./source-performance.js', () => analytics)
vi.mock('../lib/auth-guards.js', () => guards)

let registerRoutes

function createApp(userId = 'agent-1') {
  const app = express()
  app.use(express.json())
  registerRoutes(app, {
    authMiddleware: (req, _res, next) => {
      req.user = { id: userId }
      next()
    },
  })
  return app
}

beforeEach(async () => {
  analytics.getSourcePerformance.mockReset().mockResolvedValue({ totals: {}, sources: [], bazaar: {} })
  guards.isPlatformAdmin.mockReset().mockResolvedValue(false)
  ;({ registerRoutes } = await import('./source-performance-routes.js'))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('registerRoutes wiring', () => {
  it('throws without authMiddleware', () => {
    expect(() => registerRoutes(express(), {})).toThrow(/authMiddleware/)
  })
})

describe('GET /api/analytics/source-performance', () => {
  it('scopes to the caller by default', async () => {
    const app = createApp('agent-1')
    const res = await request(app).get('/api/analytics/source-performance')
    expect(res.status).toBe(200)
    expect(analytics.getSourcePerformance).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: 'agent-1', agencyId: null }),
    )
  })

  it('passes agency_id and date window through', async () => {
    const app = createApp('agent-1')
    await request(app).get('/api/analytics/source-performance?agency_id=a1&start_date=2026-01-01&end_date=2026-02-01')
    expect(analytics.getSourcePerformance).toHaveBeenCalledWith(
      expect.objectContaining({ agencyId: 'a1', startDate: '2026-01-01', endDate: '2026-02-01' }),
    )
  })

  it('ignores scope=all for a non-admin (stays self-scoped)', async () => {
    guards.isPlatformAdmin.mockResolvedValue(false)
    const app = createApp('agent-1')
    await request(app).get('/api/analytics/source-performance?scope=all')
    expect(analytics.getSourcePerformance).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: 'agent-1' }),
    )
  })

  it('honours scope=all for a platform admin (agentId null)', async () => {
    guards.isPlatformAdmin.mockResolvedValue(true)
    const app = createApp('pa-1')
    await request(app).get('/api/analytics/source-performance?scope=all')
    expect(analytics.getSourcePerformance).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: null }),
    )
  })
})
