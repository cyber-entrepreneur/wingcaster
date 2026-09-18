/**
 * AGT-PUB-007 scheduled-publish route tests.
 * Bare Express app, mocked db + authz. Covers future-time validation,
 * ownership gating (leak-safe 404), list, and cancel (pending-only).
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
const pg = vi.hoisted(() => ({ query: vi.fn(async () => []) }))
const authz = vi.hoisted(() => ({
  assertOwnsProperty: vi.fn(),
  NotFoundError: class NotFoundError extends Error {
    constructor() {
      super('nf')
      this.name = 'NotFoundError'
      this.status = 404
    }
  },
}))

vi.mock('../../db.js', () => db)
vi.mock('../../persistence/postgres-adapter.js', () => pg)
vi.mock('../authz.js', () => authz)

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

const future = () => new Date(Date.now() + 86_400_000).toISOString()

beforeEach(async () => {
  vi.resetModules()
  for (const fn of Object.values(db)) fn.mockReset?.()
  pg.query.mockReset().mockResolvedValue([])
  authz.assertOwnsProperty.mockReset().mockResolvedValue({ id: 'prop-1' })
  ;({ registerRoutes } = await import('./scheduled-publish-routes.js'))
})

afterEach(() => vi.restoreAllMocks())

describe('POST /api/properties/:id/scheduled-publications', () => {
  it('schedules a future publish (201)', async () => {
    const app = await createApp()
    const res = await request(app)
      .post('/api/properties/prop-1/scheduled-publications')
      .send({ portals: ['property_finder'], scheduled_at: future(), timezone: 'Asia/Beirut', recurrence: 'weekly' })
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('pending')
    expect(res.body.recurrence).toBe('weekly')
    expect(db.insert).toHaveBeenCalledWith('scheduled_publications', expect.objectContaining({
      property_id: 'prop-1',
      agent_id: 'agent-1',
      status: 'pending',
    }))
  })

  it('rejects a past time with PAST_TIME', async () => {
    const app = await createApp()
    const res = await request(app)
      .post('/api/properties/prop-1/scheduled-publications')
      .send({ portals: ['pf'], scheduled_at: new Date(Date.now() - 1000).toISOString() })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('PAST_TIME')
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('rejects an empty portals list', async () => {
    const app = await createApp()
    const res = await request(app)
      .post('/api/properties/prop-1/scheduled-publications')
      .send({ portals: [], scheduled_at: future() })
    expect(res.status).toBe(400)
  })

  it('404s (leak-safe) when the caller does not own the listing', async () => {
    authz.assertOwnsProperty.mockRejectedValue(new authz.NotFoundError())
    const app = await createApp()
    const res = await request(app)
      .post('/api/properties/prop-x/scheduled-publications')
      .send({ portals: ['pf'], scheduled_at: future() })
    expect(res.status).toBe(404)
    expect(db.insert).not.toHaveBeenCalled()
  })
})

describe('GET + DELETE', () => {
  it('lists scheduled publications for an owned listing', async () => {
    db.findAll.mockResolvedValue([
      { id: 's1', property_id: 'prop-1', portals: ['pf'], status: 'pending', recurrence: 'none', created_at: '2026-01-01' },
    ])
    const app = await createApp()
    const res = await request(app).get('/api/properties/prop-1/scheduled-publications')
    expect(res.status).toBe(200)
    expect(res.body.scheduled).toHaveLength(1)
  })

  it('cancels a pending schedule', async () => {
    db.findOne.mockResolvedValue({ id: 's1', property_id: 'prop-1', status: 'pending' })
    const app = await createApp()
    const res = await request(app).delete('/api/scheduled-publications/s1')
    expect(res.status).toBe(200)
    expect(db.update).toHaveBeenCalled()
  })

  it('refuses to cancel a non-pending schedule (409)', async () => {
    db.findOne.mockResolvedValue({ id: 's1', property_id: 'prop-1', status: 'published' })
    const app = await createApp()
    const res = await request(app).delete('/api/scheduled-publications/s1')
    expect(res.status).toBe(409)
    expect(db.update).not.toHaveBeenCalled()
  })
})
