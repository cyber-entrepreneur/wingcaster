import express from 'express'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../db.js', () => ({
  transaction: vi.fn(async (fn) => fn({ query: vi.fn() })),
}))

vi.mock('../../pricing/prices.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    listActivePriceCatalog: vi.fn(async () => ([
      { id: 'price-1', code: 'social.post', currency: 'USD', unit_rate_minor: 99 },
    ])),
  }
})

vi.mock('../../pricing/contracts.js', () => ({
  createContract: vi.fn(),
  draftContractVersion: vi.fn(),
  activateContractVersion: vi.fn(),
  suspendContract: vi.fn(),
  terminateContract: vi.fn(),
}))

async function mount({ role = 'platform_admin' } = {}) {
  const { registerFinPricingAdminRoutes } = await import('./routes.js')
  const app = express()
  app.use(express.json())
  registerFinPricingAdminRoutes(app, {
    authMiddleware: (req, _res, next) => {
      req.user = { id: 'admin-1', platform_role: role, token_version: 0 }
      next()
    },
    requirePlatformAdmin: (req, res, next) => {
      if (req.user?.platform_role !== 'platform_admin') return res.status(403).json({ error: 'Forbidden' })
      next()
    },
  })
  return app
}

describe('PA-CON-003 contract version routes', () => {
  it('GET /api/admin/fin/prices/active-catalog requires platform admin', async () => {
    const app = await mount({ role: 'agent' })
    const res = await request(app).get('/api/admin/fin/prices/active-catalog')
    expect(res.status).toBe(403)
  })

  it('GET /api/admin/fin/prices/active-catalog returns active prices', async () => {
    const app = await mount()
    const res = await request(app).get('/api/admin/fin/prices/active-catalog')
    expect(res.status).toBe(200)
    expect(res.body.prices[0].code).toBe('social.post')
  })

  it('POST /api/admin/fin/contracts/:id/versions validates body strictly', async () => {
    const app = await mount()
    const res = await request(app)
      .post('/api/admin/fin/contracts/c-1/versions')
      .set('X-Elevated-Token', 'fake')
      .set('If-Match', '"1"')
      .send({ effective_from: '2026-01-01T00:00:00.000Z', unexpected: true })
    expect([400, 401]).toContain(res.status)
  })
})
