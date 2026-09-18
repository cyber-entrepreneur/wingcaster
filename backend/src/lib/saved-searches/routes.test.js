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
const activity = vi.hoisted(() => ({ logActivity: vi.fn() }))
const runAlerts = vi.hoisted(() => ({ runAlertsForUser: vi.fn() }))

vi.mock('../../db.js', () => db)

let registerRoutes

const sample = {
  id: 'ss-1',
  user_id: 'agent-1',
  name: 'Beirut buyers',
  filters: { type: 'sale', city: 'Beirut' },
  alert_enabled: true,
  alert_channel: 'inapp',
  alert_frequency: 'daily',
  last_match_count: 3,
  created_at: '2026-09-18T00:00:00.000Z',
  updated_at: '2026-09-18T00:00:00.000Z',
}

async function createApp() {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.user = { id: 'agent-1' }
    next()
  })
  registerRoutes(app, {
    authMiddleware: (_req, _res, next) => next(),
    logActivity: activity.logActivity,
    runAlertsForUser: runAlerts.runAlertsForUser,
  })
  return app
}

beforeEach(async () => {
  vi.resetModules()
  for (const fn of Object.values(db)) fn.mockReset?.()
  activity.logActivity.mockReset()
  runAlerts.runAlertsForUser.mockReset().mockResolvedValue({ searches_processed: 1 })
  db.findAll.mockResolvedValue([sample])
  db.findOne.mockResolvedValue(sample)
  db.insert.mockResolvedValue(sample)
  db.update.mockImplementation(async (_c, _p, fn) => fn(sample))
  db.remove.mockResolvedValue(true)
  ;({ registerRoutes } = await import('./routes.js'))
})

afterEach(() => vi.restoreAllMocks())

describe('GET /api/saved-searches', () => {
  it('lists user saved searches', async () => {
    const app = await createApp()
    const res = await request(app).get('/api/saved-searches')
    expect(res.status).toBe(200)
    expect(res.body[0].name).toBe('Beirut buyers')
  })
})

describe('POST /api/saved-searches', () => {
  it('creates with strict validation', async () => {
    const app = await createApp()
    const res = await request(app)
      .post('/api/saved-searches')
      .send({
        name: 'Dubai rent',
        filters: { type: 'rent', city: 'Dubai' },
        alert_enabled: true,
        alert_channel: 'email',
        alert_frequency: 'weekly',
      })
    expect(res.status).toBe(201)
    expect(db.insert).toHaveBeenCalled()
  })

  it('rejects unknown fields', async () => {
    const app = await createApp()
    const res = await request(app)
      .post('/api/saved-searches')
      .send({ name: 'X', extra: true })
    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/saved-searches/:id', () => {
  it('returns 404 for foreign search', async () => {
    db.findOne.mockResolvedValue(null)
    const app = await createApp()
    const res = await request(app)
      .patch('/api/saved-searches/ss-9')
      .send({ alert_enabled: false })
    expect(res.status).toBe(404)
  })
})

describe('POST /api/saved-searches/run-alerts', () => {
  it('runs alerts for current user', async () => {
    const app = await createApp()
    const res = await request(app).post('/api/saved-searches/run-alerts').send({})
    expect(res.status).toBe(200)
    expect(runAlerts.runAlertsForUser).toHaveBeenCalledWith('agent-1', { force: true })
  })
})
