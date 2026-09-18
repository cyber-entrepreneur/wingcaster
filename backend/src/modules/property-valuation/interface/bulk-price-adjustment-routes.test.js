import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  query: vi.fn(),
}))

const tenantAuth = vi.hoisted(() => ({
  listUserAgencyMemberships: vi.fn(),
  listAgencyMemberships: vi.fn(),
}))

vi.mock('../../../db.js', () => db)
vi.mock('../../../auth.js', () => ({
  authMiddleware: (_req, _res, next) => next(),
}))
vi.mock('../../../tenant-authorization.js', () => tenantAuth)

const AGENCY_ID = 'agency-1'
const ADMIN_USER = 'user-admin'
const MEMBER_USER = 'user-member'

const dal = {
  findAll: vi.fn(),
  findOne: vi.fn(),
  update: vi.fn(),
}

const analysisService = {
  getAnalysis: vi.fn(),
}

let registerBulkPriceAdjustmentRoutes

async function createApp(userId = ADMIN_USER) {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.user = { id: userId }
    next()
  })
  registerBulkPriceAdjustmentRoutes(app, {
    dal,
    analysisService,
    recalculationJobService: { invalidateForPropertyChange: vi.fn() },
    logger: { warn: vi.fn() },
  })
  return app
}

beforeEach(async () => {
  vi.resetModules()
  db.query.mockReset()
  tenantAuth.listUserAgencyMemberships.mockReset()
  tenantAuth.listAgencyMemberships.mockReset()
  dal.findAll.mockReset()
  dal.findOne.mockReset()
  dal.update.mockReset()
  analysisService.getAnalysis.mockReset()

  tenantAuth.listUserAgencyMemberships.mockImplementation(async (userId) => {
    if (userId === ADMIN_USER) return [{ agency_id: AGENCY_ID, user_id: userId, role: 'owner' }]
    if (userId === MEMBER_USER) return [{ agency_id: AGENCY_ID, user_id: userId, role: 'agent' }]
    return []
  })
  tenantAuth.listAgencyMemberships.mockResolvedValue([{ user_id: 'agent-1' }])
  dal.findAll.mockImplementation(async (collection) => {
    if (collection === 'agents') return [{ id: 'agent-1', name: 'Agent One' }]
    if (collection === 'properties') {
      return [{ id: 'prop-1', price: 100, title: 'Listing 1', agent_id: 'agent-1', agency_id: AGENCY_ID, status: 'active' }]
    }
    return []
  })
  analysisService.getAnalysis.mockResolvedValue({ median_price: 120 })
  db.query.mockResolvedValue([])

  ;({ registerBulkPriceAdjustmentRoutes } = await import('./bulk-price-adjustment-routes.js'))
})

describe('POST /api/agency/pricing/bulk-adjust/preview', () => {
  it('returns preview rows for admin', async () => {
    const app = await createApp()
    const res = await request(app)
      .post('/api/agency/pricing/bulk-adjust/preview')
      .send({ listing_ids: ['prop-1'], strategy: 'recommendation' })

    expect(res.status).toBe(200)
    expect(res.body.preview.rows).toHaveLength(1)
    expect(res.body.preview.rows[0].price_after).toBe(120)
  })

  it('blocks non-admin members', async () => {
    const app = await createApp(MEMBER_USER)
    const res = await request(app)
      .post('/api/agency/pricing/bulk-adjust/preview')
      .send({ listing_ids: ['prop-1'], strategy: 'recommendation' })

    expect(res.status).toBe(403)
  })
})

describe('POST /api/agency/pricing/bulk-adjust', () => {
  it('requires typed confirmation', async () => {
    const app = await createApp()
    const res = await request(app)
      .post('/api/agency/pricing/bulk-adjust')
      .send({
        listing_ids: ['prop-1'],
        strategy: 'recommendation',
        confirmation: 'wrong',
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/confirmation/)
  })
})
