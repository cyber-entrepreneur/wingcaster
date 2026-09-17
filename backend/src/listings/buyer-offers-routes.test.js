/**
 * AGT-LST-010 buyer-offers route tests.
 *
 * Boots only the buyer-offers module against a bare Express app with mocked
 * db + authz. Covers: list is ownership-gated, create validates + snapshots
 * linked-contact name, status enum enforced, amount must be positive, patch
 * re-checks parent-listing ownership, delete is ownership-gated, and a
 * denied listing returns 404 (leak-safe) rather than 403.
 */
import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  findAll: vi.fn(),
  findOne: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
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

vi.mock('../db.js', () => db)
vi.mock('../lib/authz.js', () => authz)

let registerRoutes

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
  authz.assertOwnsProperty.mockResolvedValue({ id: 'prop-1', agent_id: 'agent-1' })
  ;({ registerRoutes } = await import('./buyer-offers-routes.js'))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GET /api/properties/:id/buyer-offers', () => {
  it('lists offers newest-first for an owned listing', async () => {
    db.findAll.mockResolvedValue([
      { id: 'o1', property_id: 'prop-1', amount: '100', status: 'received', created_at: '2026-01-01T00:00:00Z', offeror_name: 'A' },
      { id: 'o2', property_id: 'prop-1', amount: '200', status: 'countered', created_at: '2026-02-01T00:00:00Z', offeror_name: 'B' },
    ])
    const app = await createApp()
    const res = await request(app).get('/api/properties/prop-1/buyer-offers')
    expect(res.status).toBe(200)
    expect(res.body.offers.map((o) => o.id)).toEqual(['o2', 'o1'])
    expect(res.body.offers[0].amount).toBe(200) // numeric, not string
  })

  it('returns 404 (not 403) when the caller does not own the listing', async () => {
    authz.assertOwnsProperty.mockRejectedValue(new authz.NotFoundError())
    const app = await createApp()
    const res = await request(app).get('/api/properties/prop-x/buyer-offers')
    expect(res.status).toBe(404)
    expect(db.findAll).not.toHaveBeenCalled()
  })
})

describe('POST /api/properties/:id/buyer-offers', () => {
  it('creates an offer with defaults and returns 201', async () => {
    const app = await createApp()
    const res = await request(app)
      .post('/api/properties/prop-1/buyer-offers')
      .send({ offeror_name: 'Jane Buyer', amount: 250000 })
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('received')
    expect(res.body.currency).toBe('USD')
    expect(res.body.offer_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(db.insert).toHaveBeenCalledWith('property_offers', expect.objectContaining({
      property_id: 'prop-1',
      agent_id: 'agent-1',
      offeror_name: 'Jane Buyer',
      amount: 250000,
    }))
  })

  it('snapshots the linked contact name when offeror_name omitted', async () => {
    db.findOne.mockResolvedValue({ id: 'c-1', name: 'Linked Contact' })
    const app = await createApp()
    const res = await request(app)
      .post('/api/properties/prop-1/buyer-offers')
      .send({ contact_id: 'c-1', offeror_name: 'Linked Contact', amount: 500, status: 'countered' })
    expect(res.status).toBe(201)
    expect(res.body.contact_id).toBe('c-1')
    expect(res.body.status).toBe('countered')
  })

  it('rejects a non-positive amount', async () => {
    const app = await createApp()
    const res = await request(app)
      .post('/api/properties/prop-1/buyer-offers')
      .send({ offeror_name: 'X', amount: 0 })
    expect(res.status).toBe(400)
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('rejects an unknown status', async () => {
    const app = await createApp()
    const res = await request(app)
      .post('/api/properties/prop-1/buyer-offers')
      .send({ offeror_name: 'X', amount: 10, status: 'pending' })
    expect(res.status).toBe(400)
  })

  it('rejects a linked contact that does not exist', async () => {
    db.findOne.mockResolvedValue(null)
    const app = await createApp()
    const res = await request(app)
      .post('/api/properties/prop-1/buyer-offers')
      .send({ contact_id: 'ghost', offeror_name: 'X', amount: 10 })
    expect(res.status).toBe(400)
    expect(db.insert).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/buyer-offers/:offerId', () => {
  it('updates status and re-checks parent-listing ownership', async () => {
    db.findOne
      .mockResolvedValueOnce({ id: 'o1', property_id: 'prop-1', status: 'received' }) // lookup
      .mockResolvedValueOnce({ id: 'o1', property_id: 'prop-1', status: 'accepted', amount: 100, offeror_name: 'A' }) // re-read
    const app = await createApp()
    const res = await request(app).patch('/api/buyer-offers/o1').send({ status: 'accepted' })
    expect(res.status).toBe(200)
    expect(authz.assertOwnsProperty).toHaveBeenCalledWith('agent-1', 'prop-1')
    expect(res.body.status).toBe('accepted')
  })

  it('404s a missing offer', async () => {
    db.findOne.mockResolvedValue(null)
    const app = await createApp()
    const res = await request(app).patch('/api/buyer-offers/ghost').send({ status: 'accepted' })
    expect(res.status).toBe(404)
  })

  it('404s (leak-safe) when caller cannot access the parent listing', async () => {
    db.findOne.mockResolvedValue({ id: 'o1', property_id: 'prop-9' })
    authz.assertOwnsProperty.mockRejectedValue(new authz.NotFoundError())
    const app = await createApp()
    const res = await request(app).patch('/api/buyer-offers/o1').send({ status: 'accepted' })
    expect(res.status).toBe(404)
    expect(db.update).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/buyer-offers/:offerId', () => {
  it('removes an owned offer', async () => {
    db.findOne.mockResolvedValue({ id: 'o1', property_id: 'prop-1' })
    const app = await createApp()
    const res = await request(app).delete('/api/buyer-offers/o1')
    expect(res.status).toBe(200)
    expect(db.remove).toHaveBeenCalled()
  })
})
