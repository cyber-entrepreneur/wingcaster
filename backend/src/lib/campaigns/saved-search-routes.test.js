/**
 * AGT-CMP-005 saved-search route tests.
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

const runAlerts = vi.hoisted(() => vi.fn())

let registerRoutes

async function createApp(userId = 'agent-1') {
  const app = express()
  app.use(express.json())
  registerRoutes(app, {
    authMiddleware: (req, _res, next) => {
      req.user = { id: userId }
      next()
    },
    runSavedSearchAlertsForUser: runAlerts,
    logActivity: vi.fn(),
  })
  return app
}

beforeEach(async () => {
  vi.resetModules()
  for (const fn of Object.values(db)) fn.mockReset?.()
  runAlerts.mockReset()
  runAlerts.mockResolvedValue({ searches_processed: 1, total_matches: 2, results: [] })
  db.findAll.mockResolvedValue([])
  db.findOne.mockResolvedValue(null)
  db.insert.mockImplementation(async (_collection, row) => row)
  db.update.mockImplementation(async (_collection, _predicate, updater) => updater({
    id: 'ss-1',
    user_id: 'agent-1',
    name: 'Downtown buyers',
    filters: { city: 'Beirut' },
    alert_enabled: true,
    alert_channel: 'inapp',
    alert_frequency: 'daily',
    last_match_count: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }))
  ;({ registerRoutes } = await import('./saved-search-routes.js'))
})

afterEach(() => {
  vi.restoreAllMocks()
})

vi.mock('../../db.js', () => db)

describe('GET /api/saved-searches', () => {
  it('lists saved searches for the caller', async () => {
    db.findAll.mockResolvedValue([
      {
        id: 'ss-1',
        user_id: 'agent-1',
        name: 'Marina flats',
        filters: { city: 'Dubai', minPrice: 500000 },
        alert_enabled: true,
        alert_channel: 'email',
        alert_frequency: 'weekly',
        last_alert_run_at: null,
        last_match_count: 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ])
    const app = await createApp()
    const res = await request(app).get('/api/saved-searches')
    expect(res.status).toBe(200)
    expect(res.body.saved_searches[0].filter_summary).toContain('Dubai')
  })
})

describe('POST /api/saved-searches', () => {
  it('creates a saved search with strict validation', async () => {
    const app = await createApp()
    const res = await request(app)
      .post('/api/saved-searches')
      .send({
        name: 'Beirut 2-bed',
        filters: { city: 'Beirut', bedrooms: 2 },
        alert_enabled: true,
        alert_channel: 'inapp',
        alert_frequency: 'daily',
      })
    expect(res.status).toBe(201)
    expect(res.body.name).toBe('Beirut 2-bed')
    expect(db.insert).toHaveBeenCalledWith('saved_searches', expect.objectContaining({
      user_id: 'agent-1',
      name: 'Beirut 2-bed',
    }))
  })

  it('rejects unknown fields', async () => {
    const app = await createApp()
    const res = await request(app)
      .post('/api/saved-searches')
      .send({ name: 'Bad', hacker: true })
    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/saved-searches/:id', () => {
  it('returns 404 for another user saved search', async () => {
    db.findOne.mockResolvedValue(null)
    const app = await createApp()
    const res = await request(app)
      .patch('/api/saved-searches/ss-x')
      .send({ alert_enabled: false })
    expect(res.status).toBe(404)
  })
})

describe('POST /api/saved-searches/run-alerts', () => {
  it('runs alerts for the caller', async () => {
    const app = await createApp()
    const res = await request(app).post('/api/saved-searches/run-alerts').send({})
    expect(res.status).toBe(200)
    expect(runAlerts).toHaveBeenCalledWith('agent-1', { force: true })
    expect(res.body.searches_processed).toBe(1)
  })
})
