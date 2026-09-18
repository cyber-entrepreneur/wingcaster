/**
 * PA-AUD-002 — Audit retention policy route tests.
 *
 * Boots only the retention-policy routes against a bare Express app with mocked
 * db, auth-guard, and step-up middleware. Covers: PA gating on GET, defaults
 * when unset, read-back of a stored policy + constraints, PUT create/update,
 * strict validation, the financial 7-year floor, and category bounds.
 */
import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
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

const validBody = {
  financial_actions_days: 2555,
  pa_actions_days: 365,
  tenant_actions_days: 365,
  system_events_days: 90,
  export_before_purge: true,
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
  db.update.mockResolvedValue(undefined)
  db.insert.mockResolvedValue(undefined)
  ;({ registerRoutes } = await import('./retention-policy-routes.js'))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GET /api/admin/audit-log/retention-policy', () => {
  it('forbids non-platform-admins', async () => {
    guards.isPlatformAdmin.mockResolvedValue(false)
    const app = await createApp()
    const res = await request(app).get('/api/admin/audit-log/retention-policy')
    expect(res.status).toBe(403)
  })

  it('returns defaults + constraints when nothing is stored', async () => {
    db.findOne.mockResolvedValue(null)
    const app = await createApp()
    const res = await request(app).get('/api/admin/audit-log/retention-policy')
    expect(res.status).toBe(200)
    expect(res.body.policy.financial_actions_days).toBe(2555)
    expect(res.body.policy.pa_actions_days).toBe(365)
    expect(res.body.policy.export_before_purge).toBe(true)
    expect(res.body.constraints.financial_floor_days).toBe(2555)
    expect(res.body.constraints.max_category_days).toBe(3650)
  })

  it('reads back a stored policy', async () => {
    db.findOne.mockResolvedValue({
      id: 'default',
      financial_actions_days: 3000,
      pa_actions_days: 400,
      tenant_actions_days: 200,
      system_events_days: 60,
      export_before_purge: false,
      updated_by: 'pa-9',
      updated_at: '2026-01-01T00:00:00Z',
    })
    const app = await createApp()
    const res = await request(app).get('/api/admin/audit-log/retention-policy')
    expect(res.body.policy.financial_actions_days).toBe(3000)
    expect(res.body.policy.export_before_purge).toBe(false)
    expect(res.body.policy.updated_by).toBe('pa-9')
  })
})

describe('PUT /api/admin/audit-log/retention-policy', () => {
  it('creates the policy row when none exists', async () => {
    db.findOne
      .mockResolvedValueOnce(null) // existence check
      .mockResolvedValueOnce({ id: 'default', ...validBody, updated_by: 'pa-1' })
    const app = await createApp()
    const res = await request(app).put('/api/admin/audit-log/retention-policy').send(validBody)
    expect(res.status).toBe(200)
    expect(db.insert).toHaveBeenCalledTimes(1)
    expect(db.update).not.toHaveBeenCalled()
    expect(res.body.policy.pa_actions_days).toBe(365)
  })

  it('updates the policy row when it already exists', async () => {
    db.findOne
      .mockResolvedValueOnce({ id: 'default', ...validBody })
      .mockResolvedValueOnce({ id: 'default', ...validBody, tenant_actions_days: 200, updated_by: 'pa-1' })
    const app = await createApp()
    const res = await request(app)
      .put('/api/admin/audit-log/retention-policy')
      .send({ ...validBody, tenant_actions_days: 200 })
    expect(res.status).toBe(200)
    expect(db.update).toHaveBeenCalledTimes(1)
    expect(db.insert).not.toHaveBeenCalled()
    expect(res.body.policy.tenant_actions_days).toBe(200)
  })

  it('rejects a financial window below the 7-year floor', async () => {
    const app = await createApp()
    const res = await request(app)
      .put('/api/admin/audit-log/retention-policy')
      .send({ ...validBody, financial_actions_days: 2554 })
    expect(res.status).toBe(400)
    expect(db.insert).not.toHaveBeenCalled()
    expect(db.update).not.toHaveBeenCalled()
  })

  it('rejects an unknown key (strict)', async () => {
    const app = await createApp()
    const res = await request(app)
      .put('/api/admin/audit-log/retention-policy')
      .send({ ...validBody, sneaky: 1 })
    expect(res.status).toBe(400)
  })

  it('rejects a category below the minimum bound', async () => {
    const app = await createApp()
    const res = await request(app)
      .put('/api/admin/audit-log/retention-policy')
      .send({ ...validBody, pa_actions_days: 10 })
    expect(res.status).toBe(400)
  })
})
