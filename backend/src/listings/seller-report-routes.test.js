/**
 * AGT-LST-015 seller-report route tests.
 */
import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  findAll: vi.fn(),
  findOne: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
}))

const authz = vi.hoisted(() => ({
  assertOwnsProperty: vi.fn(),
  NotFoundError: class NotFoundError extends Error {
    constructor() {
      super('not found')
      this.name = 'NotFoundError'
      this.status = 404
    }
  },
}))

const reportData = vi.hoisted(() => ({
  buildSellerReportPayload: vi.fn(),
}))

vi.mock('../db.js', () => db)
vi.mock('../lib/authz.js', () => authz)
vi.mock('./seller-report-data.js', () => reportData)

let registerRoutes

const property = {
  id: 'prop-1',
  agent_id: 'agent-1',
  agency_id: 'agency-1',
  title: 'Seaside Villa',
  status: 'published',
  price: 500000,
  created_at: '2026-01-01T00:00:00Z',
}

const reportRow = {
  id: 'report-1',
  property_id: 'prop-1',
  agent_id: 'agent-1',
  agency_id: 'agency-1',
  state_of_play: null,
  agent_summary: null,
  show_offer_amounts: false,
  show_full_address: false,
  layout_template: 'standard',
  status: 'live',
  frozen_snapshot: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const payload = {
  generated_at: '2026-02-01T00:00:00Z',
  report: { status: 'live', layout_template: 'standard' },
  property: { id: 'prop-1', title: 'Seaside Villa' },
  summary: { inquiries_received: 2 },
  is_empty: false,
}

async function createApp(userId = 'agent-1') {
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
  vi.resetModules()
  for (const fn of Object.values(db)) fn.mockReset?.()
  authz.assertOwnsProperty.mockReset()
  reportData.buildSellerReportPayload.mockReset()
  authz.assertOwnsProperty.mockResolvedValue(property)
  reportData.buildSellerReportPayload.mockResolvedValue(payload)
  db.findOne.mockImplementation(async (collection, predicate) => {
    const rows = {
      seller_reports: [reportRow],
      seller_report_share_tokens: [{
        id: 'token-1',
        report_id: 'report-1',
        token: 'wc_rpt_testtoken',
        recipient_email: null,
        revoked_at: null,
        created_at: '2026-02-01T00:00:00Z',
      }],
      properties: [property],
    }[collection] || []
    return rows.find((row) => predicate(row)) || null
  })
  db.findAll.mockResolvedValue([])
  db.insert.mockImplementation(async (_collection, row) => row)
  db.update.mockImplementation(async (_collection, _predicate, updater) => updater(reportRow))
  ;({ registerRoutes } = await import('./seller-report-routes.js'))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GET /api/properties/:id/seller-report', () => {
  it('returns report payload for an owned listing', async () => {
    const app = await createApp()
    const res = await request(app).get('/api/properties/prop-1/seller-report')
    expect(res.status).toBe(200)
    expect(res.body.payload.property.title).toBe('Seaside Villa')
    expect(res.body.report.property_id).toBe('prop-1')
  })

  it('returns 404 when ownership is denied', async () => {
    authz.assertOwnsProperty.mockRejectedValue(new authz.NotFoundError())
    const app = await createApp()
    const res = await request(app).get('/api/properties/prop-x/seller-report')
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/properties/:id/seller-report', () => {
  it('updates commentary fields with strict validation', async () => {
    const app = await createApp()
    const res = await request(app)
      .patch('/api/properties/prop-1/seller-report')
      .send({
        state_of_play: 'Two offers under review.',
        agent_summary: 'Buyers are comparing financing options.',
        show_offer_amounts: true,
      })
    expect(res.status).toBe(200)
    expect(db.update).toHaveBeenCalled()
    expect(res.body.report.show_offer_amounts).toBe(true)
  })

  it('rejects unknown fields', async () => {
    const app = await createApp()
    const res = await request(app)
      .patch('/api/properties/prop-1/seller-report')
      .send({ hacker_field: true })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/properties/:id/seller-report/share-tokens', () => {
  it('creates a share token', async () => {
    const app = await createApp()
    const res = await request(app)
      .post('/api/properties/prop-1/seller-report/share-tokens')
      .send({})
    expect(res.status).toBe(201)
    expect(res.body.token).toMatch(/^wc_rpt_/)
    expect(db.insert).toHaveBeenCalledWith('seller_report_share_tokens', expect.objectContaining({
      report_id: 'report-1',
    }))
  })
})

describe('GET /api/public/seller-reports/:shareToken', () => {
  it('returns a client-safe payload for an active token', async () => {
    const app = await createApp()
    const res = await request(app).get('/api/public/seller-reports/wc_rpt_testtoken')
    expect(res.status).toBe(200)
    expect(res.body.payload.property.title).toBe('Seaside Villa')
    expect(reportData.buildSellerReportPayload).toHaveBeenCalledWith(expect.objectContaining({
      clientSafe: true,
    }))
  })

  it('returns 404 for a revoked token', async () => {
    db.findOne.mockImplementation(async (collection, predicate) => {
      if (collection === 'seller_report_share_tokens') {
        const row = {
          id: 'token-1',
          report_id: 'report-1',
          token: 'wc_rpt_revoked',
          revoked_at: '2026-02-02T00:00:00Z',
        }
        return predicate(row) ? row : null
      }
      return null
    })
    const app = await createApp()
    const res = await request(app).get('/api/public/seller-reports/wc_rpt_revoked')
    expect(res.status).toBe(404)
  })
})
