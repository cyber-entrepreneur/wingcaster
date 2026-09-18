/**
 * SHR-ERR-005 platform-status route tests.
 *
 * Boots only the platform-status module against a bare Express app with a
 * mocked db. Covers: the public GET /api/status returns only live notices and
 * the highest-severity overall status; admin list/create/patch are gated by
 * requirePlatformAdmin (403 when denied); create validates status enum, title,
 * URL, and the starts/ends window; patch 404s an unknown id.
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

vi.mock('../db.js', () => db)

let registerRoutes

function createApp({ adminOk = true, userId = 'pa-1' } = {}) {
  const app = express()
  app.use(express.json())
  registerRoutes(app, {
    authMiddleware: (req, _res, next) => {
      req.user = { id: userId }
      next()
    },
    requirePlatformAdmin: (req, res, next) =>
      adminOk ? next() : res.status(403).json({ error: 'Forbidden: platform admin required' }),
  })
  return app
}

beforeEach(async () => {
  vi.resetModules()
  for (const fn of Object.values(db)) fn.mockReset?.()
  db.findAll.mockResolvedValue([])
  db.insert.mockResolvedValue(undefined)
  db.update.mockResolvedValue(1)
  ;({ registerRoutes } = await import('./platform-status-routes.js'))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('registerRoutes wiring', () => {
  it('throws without authMiddleware / requirePlatformAdmin', () => {
    const app = express()
    expect(() => registerRoutes(app, { requirePlatformAdmin: () => {} })).toThrow(/authMiddleware/)
    expect(() => registerRoutes(app, { authMiddleware: () => {} })).toThrow(/requirePlatformAdmin/)
  })
})

describe('GET /api/status (public)', () => {
  it('returns ok with no active notices', async () => {
    db.findAll.mockResolvedValue([])
    const app = createApp()
    const res = await request(app).get('/api/status')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok', notices: [] })
  })

  it('reports the highest-severity live notice as the overall status', async () => {
    db.findAll.mockResolvedValue([
      { id: 'a', status: 'info', title: 'Info', active: true, created_at: '2026-01-01T00:00:00Z' },
      { id: 'b', status: 'maintenance', title: 'Down', active: true, created_at: '2026-01-02T00:00:00Z' },
      { id: 'c', status: 'degraded', title: 'Slow', active: true, created_at: '2026-01-03T00:00:00Z' },
    ])
    const app = createApp()
    const res = await request(app).get('/api/status')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('maintenance')
    // sorted highest-severity first
    expect(res.body.notices.map((n) => n.id)).toEqual(['b', 'c', 'a'])
    expect(res.body.notices[0].active).toBe(true)
  })

  it('hides notices outside their starts/ends window', async () => {
    const future = new Date(Date.now() + 3_600_000).toISOString()
    const past = new Date(Date.now() - 3_600_000).toISOString()
    db.findAll.mockResolvedValue([
      { id: 'scheduled', status: 'maintenance', title: 'Later', active: true, starts_at: future, created_at: past },
      { id: 'expired', status: 'degraded', title: 'Over', active: true, ends_at: past, created_at: past },
      { id: 'live', status: 'info', title: 'Now', active: true, starts_at: past, created_at: past },
    ])
    const app = createApp()
    const res = await request(app).get('/api/status')
    expect(res.body.notices.map((n) => n.id)).toEqual(['live'])
    expect(res.body.status).toBe('info')
  })

  it('is reachable without platform-admin (no gate on the public read)', async () => {
    const app = createApp({ adminOk: false })
    const res = await request(app).get('/api/status')
    expect(res.status).toBe(200)
  })
})

describe('GET /api/admin/status-notices', () => {
  it('lists every notice newest-first for an admin', async () => {
    db.findAll.mockResolvedValue([
      { id: 'old', status: 'info', title: 'Old', active: false, created_at: '2026-01-01T00:00:00Z' },
      { id: 'new', status: 'info', title: 'New', active: true, created_at: '2026-02-01T00:00:00Z' },
    ])
    const app = createApp()
    const res = await request(app).get('/api/admin/status-notices')
    expect(res.status).toBe(200)
    expect(res.body.notices.map((n) => n.id)).toEqual(['new', 'old'])
  })

  it('403s a non-admin caller', async () => {
    const app = createApp({ adminOk: false })
    const res = await request(app).get('/api/admin/status-notices')
    expect(res.status).toBe(403)
    expect(db.findAll).not.toHaveBeenCalled()
  })
})

describe('POST /api/admin/status-notices', () => {
  it('publishes a notice with defaults and returns 201', async () => {
    const app = createApp()
    const res = await request(app).post('/api/admin/status-notices').send({ title: 'Scheduled maintenance' })
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('info')
    expect(res.body.active).toBe(true)
    expect(res.body.title).toBe('Scheduled maintenance')
    expect(db.insert).toHaveBeenCalledWith(
      'platform_status_notices',
      expect.objectContaining({ title: 'Scheduled maintenance', status: 'info', created_by: 'pa-1' }),
    )
  })

  it('persists severity, body, learn-more URL, and window', async () => {
    const app = createApp()
    const res = await request(app).post('/api/admin/status-notices').send({
      status: 'maintenance',
      title: 'Publishing paused',
      body: 'Portal publishing is paused while we upgrade.',
      learn_more_url: 'https://status.wingcaster.test/incident/42',
      starts_at: '2026-09-18T22:00:00Z',
      ends_at: '2026-09-18T23:00:00Z',
    })
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('maintenance')
    expect(res.body.learn_more_url).toBe('https://status.wingcaster.test/incident/42')
    expect(res.body.ends_at).toBe('2026-09-18T23:00:00Z')
  })

  it('rejects an unknown status', async () => {
    const app = createApp()
    const res = await request(app).post('/api/admin/status-notices').send({ status: 'nuke', title: 'X' })
    expect(res.status).toBe(400)
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('rejects an empty title', async () => {
    const app = createApp()
    const res = await request(app).post('/api/admin/status-notices').send({ title: '   ' })
    expect(res.status).toBe(400)
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('rejects a non-URL learn_more_url', async () => {
    const app = createApp()
    const res = await request(app).post('/api/admin/status-notices').send({ title: 'X', learn_more_url: 'not-a-url' })
    expect(res.status).toBe(400)
  })

  it('rejects an unknown field (strict schema)', async () => {
    const app = createApp()
    const res = await request(app).post('/api/admin/status-notices').send({ title: 'X', severity: 'high' })
    expect(res.status).toBe(400)
  })

  it('rejects a window whose end precedes its start', async () => {
    const app = createApp()
    const res = await request(app).post('/api/admin/status-notices').send({
      title: 'Backwards',
      starts_at: '2026-09-18T23:00:00Z',
      ends_at: '2026-09-18T22:00:00Z',
    })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('BAD_WINDOW')
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('403s a non-admin caller before touching the db', async () => {
    const app = createApp({ adminOk: false })
    const res = await request(app).post('/api/admin/status-notices').send({ title: 'X' })
    expect(res.status).toBe(403)
    expect(db.insert).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/admin/status-notices/:id', () => {
  it('resolves a notice (active=false) and returns the updated row', async () => {
    db.findOne
      .mockResolvedValueOnce({ id: 'n1', status: 'degraded', title: 'Slow', active: true, created_at: '2026-01-01T00:00:00Z' })
      .mockResolvedValueOnce({ id: 'n1', status: 'degraded', title: 'Slow', active: false, created_at: '2026-01-01T00:00:00Z' })
    const app = createApp()
    const res = await request(app).patch('/api/admin/status-notices/n1').send({ active: false })
    expect(res.status).toBe(200)
    expect(res.body.active).toBe(false)
    expect(db.update).toHaveBeenCalled()
  })

  it('404s an unknown notice', async () => {
    db.findOne.mockResolvedValue(null)
    const app = createApp()
    const res = await request(app).patch('/api/admin/status-notices/ghost').send({ active: false })
    expect(res.status).toBe(404)
    expect(db.update).not.toHaveBeenCalled()
  })

  it('rejects an empty patch body', async () => {
    db.findOne.mockResolvedValue({ id: 'n1', status: 'info', title: 'X', active: true, created_at: '2026-01-01T00:00:00Z' })
    const app = createApp()
    const res = await request(app).patch('/api/admin/status-notices/n1').send({})
    expect(res.status).toBe(400)
    expect(db.update).not.toHaveBeenCalled()
  })

  it('rejects a window that would end before it starts using the existing start', async () => {
    db.findOne.mockResolvedValue({
      id: 'n1',
      status: 'maintenance',
      title: 'Window',
      active: true,
      starts_at: '2026-09-18T23:00:00Z',
      created_at: '2026-01-01T00:00:00Z',
    })
    const app = createApp()
    const res = await request(app).patch('/api/admin/status-notices/n1').send({ ends_at: '2026-09-18T22:00:00Z' })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('BAD_WINDOW')
    expect(db.update).not.toHaveBeenCalled()
  })

  it('403s a non-admin caller', async () => {
    const app = createApp({ adminOk: false })
    const res = await request(app).patch('/api/admin/status-notices/n1').send({ active: false })
    expect(res.status).toBe(403)
    expect(db.findOne).not.toHaveBeenCalled()
  })
})
