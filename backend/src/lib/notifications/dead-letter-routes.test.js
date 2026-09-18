/**
 * PA-NDL-001 — Notifications dead-letter queue admin route tests.
 *
 * Boots only the DLQ admin routes against a bare Express app with mocked
 * db, auth-guard, and dispatcher. Covers: PA gating (403), list filtering +
 * enrichment + ignored exclusion, strict query validation, retry-one (requeues
 * + re-dispatches), 404 for a missing/non-dead item, and mark-ignored.
 */
import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  findAll: vi.fn(),
  findOne: vi.fn(),
  update: vi.fn(),
}))
const guards = vi.hoisted(() => ({ isPlatformAdmin: vi.fn() }))
const dispatch = vi.hoisted(() => ({ processPendingNotificationRetries: vi.fn() }))

vi.mock('../../db.js', () => db)
vi.mock('../auth-guards.js', () => guards)
vi.mock('./dispatch.js', () => dispatch)

let registerRoutes

async function createApp(userId = 'pa-1') {
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
  for (const fn of Object.values(db)) fn.mockReset()
  guards.isPlatformAdmin.mockReset()
  dispatch.processPendingNotificationRetries.mockReset()
  guards.isPlatformAdmin.mockResolvedValue(true)
  db.update.mockResolvedValue(undefined)
  dispatch.processPendingNotificationRetries.mockResolvedValue({ processed: 1 })
  ;({ registerRoutes } = await import('./dead-letter-routes.js'))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GET /api/admin/notifications/dead-letter', () => {
  it('forbids non-platform-admins', async () => {
    guards.isPlatformAdmin.mockResolvedValue(false)
    const app = await createApp()
    const res = await request(app).get('/api/admin/notifications/dead-letter')
    expect(res.status).toBe(403)
    expect(db.findAll).not.toHaveBeenCalled()
  })

  it('lists dead + failed items newest-first, enriched, ignored excluded by default', async () => {
    db.findAll.mockResolvedValue([
      { id: 'r1', notification_id: 'n1', channel: 'email', status: 'dead_letter', attempts: 5, last_error: 'SMTP 550', created_at: '2026-02-01T00:00:00Z' },
      { id: 'r2', notification_id: 'n2', channel: 'sms', status: 'failed', attempts: 3, last_error: 'carrier reject', created_at: '2026-03-01T00:00:00Z' },
    ])
    db.findOne.mockImplementation(async (_c, pred) => {
      if (pred({ id: 'n1' })) return { id: 'n1', type: 'viewing_reminder', title: 'Viewing tomorrow' }
      if (pred({ id: 'n2' })) return { id: 'n2', type: 'offer_update', title: 'Offer countered' }
      return null
    })
    const app = await createApp()
    const res = await request(app).get('/api/admin/notifications/dead-letter')
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(2)
    expect(res.body.items.map((i) => i.id)).toEqual(['r2', 'r1']) // newest first
    expect(res.body.items[0].event_type).toBe('offer_update')
    expect(res.body.items[1].title).toBe('Viewing tomorrow')
    // default predicate excludes ignored
    const pred = db.findAll.mock.calls[0][1]
    expect(pred({ status: 'ignored' })).toBe(false)
    expect(pred({ status: 'dead_letter' })).toBe(true)
  })

  it('filters by channel and error search', async () => {
    db.findAll.mockResolvedValue([
      { id: 'r1', channel: 'email', status: 'dead_letter', last_error: 'SMTP 550', created_at: '2026-02-01T00:00:00Z' },
      { id: 'r2', channel: 'sms', status: 'failed', last_error: 'carrier reject', created_at: '2026-03-01T00:00:00Z' },
    ])
    db.findOne.mockResolvedValue(null)
    const app = await createApp()
    const res = await request(app).get('/api/admin/notifications/dead-letter?channel=email&q=smtp')
    expect(res.status).toBe(200)
    expect(res.body.items.map((i) => i.id)).toEqual(['r1'])
  })

  it('rejects an unknown query key (strict)', async () => {
    const app = await createApp()
    const res = await request(app).get('/api/admin/notifications/dead-letter?bogus=1')
    expect(res.status).toBe(400)
  })

  it('rejects an invalid channel enum', async () => {
    const app = await createApp()
    const res = await request(app).get('/api/admin/notifications/dead-letter?channel=carrier-pigeon')
    expect(res.status).toBe(400)
  })
})

describe('POST /api/admin/notifications/dead-letter/:id/retry', () => {
  it('requeues a dead item and re-runs the dispatcher', async () => {
    db.findOne
      .mockResolvedValueOnce({ id: 'r1', status: 'dead_letter', channel: 'email', attempts: 5 })
      .mockResolvedValueOnce({ id: 'r1', status: 'pending', channel: 'email', attempts: 5 })
    const app = await createApp()
    const res = await request(app).post('/api/admin/notifications/dead-letter/r1/retry').send({})
    expect(res.status).toBe(200)
    expect(db.update).toHaveBeenCalledTimes(1)
    expect(dispatch.processPendingNotificationRetries).toHaveBeenCalledTimes(1)
    expect(res.body.item.status).toBe('pending')
  })

  it('returns 404 for a missing item', async () => {
    db.findOne.mockResolvedValue(null)
    const app = await createApp()
    const res = await request(app).post('/api/admin/notifications/dead-letter/nope/retry').send({})
    expect(res.status).toBe(404)
    expect(db.update).not.toHaveBeenCalled()
  })

  it('returns 404 for an item that is not in a dead state', async () => {
    db.findOne.mockResolvedValue({ id: 'r1', status: 'completed' })
    const app = await createApp()
    const res = await request(app).post('/api/admin/notifications/dead-letter/r1/retry').send({})
    expect(res.status).toBe(404)
    expect(dispatch.processPendingNotificationRetries).not.toHaveBeenCalled()
  })
})

describe('POST /api/admin/notifications/dead-letter/:id/ignore', () => {
  it('marks a dead item ignored with a reason', async () => {
    db.findOne
      .mockResolvedValueOnce({ id: 'r1', status: 'failed', data: {} })
      .mockResolvedValueOnce({ id: 'r1', status: 'ignored', data: { ignored_reason: 'known bad address' } })
    const app = await createApp()
    const res = await request(app)
      .post('/api/admin/notifications/dead-letter/r1/ignore')
      .send({ reason: 'known bad address' })
    expect(res.status).toBe(200)
    expect(res.body.item.status).toBe('ignored')
    const mutator = db.update.mock.calls[0][2]
    expect(mutator({ id: 'r1', status: 'failed', data: {} }).status).toBe('ignored')
  })

  it('rejects an unknown body key (strict)', async () => {
    const app = await createApp()
    const res = await request(app)
      .post('/api/admin/notifications/dead-letter/r1/ignore')
      .send({ reason: 'ok', extra: true })
    expect(res.status).toBe(400)
    expect(db.findOne).not.toHaveBeenCalled()
  })
})

describe('POST /api/admin/notifications/retry-pending', () => {
  it('bulk-processes pending retries', async () => {
    const app = await createApp()
    const res = await request(app).post('/api/admin/notifications/retry-pending').send({ limit: 10 })
    expect(res.status).toBe(200)
    expect(dispatch.processPendingNotificationRetries).toHaveBeenCalledWith({ limit: 10 })
  })
})
