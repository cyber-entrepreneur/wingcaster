/**
 * PA-GOO-001 — Google usage/budget route tests.
 *
 * Boots only the google-usage routes with mocked db, auth-guard, and step-up.
 * Covers: PA gating, summary aggregation (MTD spend, per-operation, top
 * consumers, headroom/projection/over-budget), strict query validation, budget
 * read defaults, budget PUT create/update, and validation (threshold + max).
 * Also unit-tests the pure buildSummary aggregator.
 */
import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildSummary } from './usage-routes.js'

const db = vi.hoisted(() => ({
  findAll: vi.fn(),
  findOne: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
}))
const guards = vi.hoisted(() => ({
  isPlatformAdmin: vi.fn(),
  requirePlatformAdmin: vi.fn((req, res, next) => next()),
}))
const auth = vi.hoisted(() => ({ requireElevated: vi.fn(() => (req, res, next) => next()) }))

vi.mock('../../db.js', () => db)
vi.mock('../auth-guards.js', () => guards)
vi.mock('../../auth.js', () => auth)

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
  guards.requirePlatformAdmin.mockReset()
  guards.requirePlatformAdmin.mockImplementation((req, res, next) => next())
  auth.requireElevated.mockReset()
  auth.requireElevated.mockImplementation(() => (req, res, next) => next())
  guards.isPlatformAdmin.mockResolvedValue(true)
  db.insert.mockResolvedValue(undefined)
  db.update.mockResolvedValue(undefined)
  ;({ registerRoutes } = await import('./usage-routes.js'))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('buildSummary', () => {
  it('aggregates MTD spend, operations, top consumers, and projection', () => {
    const now = new Date('2026-03-10T12:00:00Z')
    const rows = [
      { operation: 'places', area_id: 'a1', request_count: 2, cost_estimate_usd: 10, created_at: '2026-03-01T00:00:00Z' },
      { operation: 'places', area_id: 'a2', request_count: 1, cost_estimate_usd: 5, created_at: '2026-03-05T00:00:00Z' },
      { operation: 'distance', area_id: 'a1', request_count: 3, cost_estimate_usd: 15, created_at: '2026-03-09T00:00:00Z' },
      // Previous month — excluded from MTD.
      { operation: 'places', area_id: 'a1', request_count: 9, cost_estimate_usd: 99, created_at: '2026-02-15T00:00:00Z' },
    ]
    const s = buildSummary(rows, { budget_usd_monthly: 100, alert_threshold_pct: 80, updated_at: null }, { days: 30, top: 5 }, now)
    expect(s.mtd_spend_usd).toBe(30)
    expect(s.mtd_requests).toBe(6)
    expect(s.by_operation[0]).toEqual({ operation: 'places', requests: 3, cost: 15 })
    expect(s.top_consumers[0]).toEqual({ area_id: 'a1', requests: 5, cost: 25 })
    expect(s.headroom_usd).toBe(70)
    expect(s.pct_consumed).toBe(30)
    expect(s.over_budget).toBe(false)
    // projection: 30 / day10 * 31 days = 93
    expect(s.projected_month_end_usd).toBe(93)
    expect(s.daily).toHaveLength(30)
  })

  it('flags over-budget and near-threshold', () => {
    const now = new Date('2026-03-10T12:00:00Z')
    const over = buildSummary(
      [{ operation: 'places', area_id: 'a1', request_count: 1, cost_estimate_usd: 120, created_at: '2026-03-02T00:00:00Z' }],
      { budget_usd_monthly: 100, alert_threshold_pct: 80, updated_at: null },
      { days: 7, top: 5 },
      now,
    )
    expect(over.over_budget).toBe(true)
    const near = buildSummary(
      [{ operation: 'places', area_id: 'a1', request_count: 1, cost_estimate_usd: 85, created_at: '2026-03-02T00:00:00Z' }],
      { budget_usd_monthly: 100, alert_threshold_pct: 80, updated_at: null },
      { days: 7, top: 5 },
      now,
    )
    expect(near.over_budget).toBe(false)
    expect(near.near_threshold).toBe(true)
  })
})

describe('GET /api/admin/google-usage/summary', () => {
  it('forbids non-platform-admins', async () => {
    guards.isPlatformAdmin.mockResolvedValue(false)
    const app = await createApp()
    const res = await request(app).get('/api/admin/google-usage/summary')
    expect(res.status).toBe(403)
    expect(db.findAll).not.toHaveBeenCalled()
  })

  it('returns a summary payload', async () => {
    db.findAll.mockResolvedValue([
      { operation: 'places', area_id: 'a1', request_count: 1, cost_estimate_usd: 3, created_at: new Date().toISOString() },
    ])
    db.findOne.mockResolvedValue(null) // budget defaults
    const app = await createApp()
    const res = await request(app).get('/api/admin/google-usage/summary')
    expect(res.status).toBe(200)
    expect(res.body.summary.budget_usd_monthly).toBe(500)
    expect(Array.isArray(res.body.summary.daily)).toBe(true)
  })

  it('rejects an unknown query key (strict)', async () => {
    const app = await createApp()
    const res = await request(app).get('/api/admin/google-usage/summary?bogus=1')
    expect(res.status).toBe(400)
  })
})

describe('GET /api/admin/google-usage/budget', () => {
  it('returns defaults + constraints when unset', async () => {
    db.findOne.mockResolvedValue(null)
    const app = await createApp()
    const res = await request(app).get('/api/admin/google-usage/budget')
    expect(res.status).toBe(200)
    expect(res.body.config.budget_usd_monthly).toBe(500)
    expect(res.body.config.alert_threshold_pct).toBe(80)
    expect(res.body.constraints.max_budget_usd_monthly).toBe(10000000)
  })
})

describe('PUT /api/admin/google-usage/budget', () => {
  it('creates the config when none exists', async () => {
    db.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'default',
      budget_usd_monthly: 800,
      alert_threshold_pct: 75,
      updated_by: 'pa-1',
    })
    const app = await createApp()
    const res = await request(app)
      .put('/api/admin/google-usage/budget')
      .send({ budget_usd_monthly: 800, alert_threshold_pct: 75 })
    expect(res.status).toBe(200)
    expect(db.insert).toHaveBeenCalledTimes(1)
    expect(res.body.config.budget_usd_monthly).toBe(800)
  })

  it('updates the config when it exists', async () => {
    db.findOne
      .mockResolvedValueOnce({ id: 'default', budget_usd_monthly: 500, alert_threshold_pct: 80 })
      .mockResolvedValueOnce({ id: 'default', budget_usd_monthly: 1000, alert_threshold_pct: 90, updated_by: 'pa-1' })
    const app = await createApp()
    const res = await request(app)
      .put('/api/admin/google-usage/budget')
      .send({ budget_usd_monthly: 1000, alert_threshold_pct: 90 })
    expect(res.status).toBe(200)
    expect(db.update).toHaveBeenCalledTimes(1)
    expect(db.insert).not.toHaveBeenCalled()
    expect(res.body.config.alert_threshold_pct).toBe(90)
  })

  it('rejects an out-of-range alert threshold', async () => {
    const app = await createApp()
    const res = await request(app)
      .put('/api/admin/google-usage/budget')
      .send({ budget_usd_monthly: 500, alert_threshold_pct: 0 })
    expect(res.status).toBe(400)
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('rejects an unknown key (strict)', async () => {
    const app = await createApp()
    const res = await request(app)
      .put('/api/admin/google-usage/budget')
      .send({ budget_usd_monthly: 500, alert_threshold_pct: 80, sneaky: true })
    expect(res.status).toBe(400)
  })
})
