/**
 * Phase 7f/3 — inventory + wiring test.
 *
 * The point of 7f/3 is that every sensitive admin surface refuses to run
 * without a live step-up token. If a new admin route is added but nobody
 * remembers to wire `requireElevated`, the test suite must catch it.
 *
 * Strategy: for each route in the sensitive list, register the real route
 * module against a bare Express app whose fake authMiddleware always
 * succeeds, then hit the route without an `X-Elevated-Token` header. The
 * expected response is 401 with `code: 'step_up_required'`. Any route
 * that returns 200/201/400 has fallen off the gate — the test names
 * exactly which route regressed.
 *
 * The middleware itself is covered separately in auth-elevation.test.js;
 * this is the surface-level assertion: "these specific URLs are gated."
 */
import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const originalSecret = process.env.JWT_SECRET

// Fake platform-admin session — the middleware only ever runs
// requireElevated after authMiddleware + requirePlatformAdmin succeed,
// so the wiring test needs both to be no-ops.
const fakeAuth = (req, _res, next) => {
  req.user = { id: 'admin-1', token_version: 0 }
  req.agent = { id: 'admin-1' }
  next()
}
const fakePlatformAdmin = (_req, _res, next) => next()

async function withPatchedEnv(fn) {
  process.env.JWT_SECRET = 'phase-7f3-wiring-secret'
  vi.resetModules()
  try {
    return await fn()
  } finally {
    if (originalSecret === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = originalSecret
    vi.resetModules()
  }
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.resetModules()
})

/**
 * Expected shape of every step-up refusal — a stable contract because the
 * frontend `runElevated()` seam keys on it.
 */
function expectStepUpRequired(res) {
  expect(res.status).toBe(401)
  expect(res.body).toMatchObject({ code: 'step_up_required' })
  expect(res.body.max_age_seconds).toBeGreaterThan(0)
}

describe('7f/3 — auth surfaces on server.js', () => {
  // password/change + my-connections + 2fa/disable are declared directly
  // in server.js / auth-2fa.js. Rather than boot the whole app (heavy),
  // this section asserts the wire directly by inspecting the file text.
  // A grep-based check for "requireElevated" adjacent to each route is
  // fragile, so we import the auth modules and confirm requireElevated is
  // referenced on the same line as each URL literal.
  it('server.js gates password/change, POST /my-connections, PUT /my-connections/:id, DELETE /my-connections/:id', async () => {
    const fs = await import('node:fs/promises')
    const src = await fs.readFile('src/server.js', 'utf8')
    const lines = src.split('\n')
    const routes = [
      "app.post('/api/auth/password/change'",
      "app.post('/api/my-connections'",
      "app.put('/api/my-connections/:id'",
      "app.delete('/api/my-connections/:id'",
      "app.post('/api/admin/users/:id/promote'",
      "app.post('/api/admin/audit-log/retention'",
    ]
    for (const needle of routes) {
      const line = lines.find((l) => l.includes(needle))
      expect(line, `route not found: ${needle}`).toBeDefined()
      expect(line, `route missing requireElevated: ${needle}\n  actual: ${line}`).toMatch(/requireElevated\(\)/)
    }
  })

  it('auth-2fa.js gates POST /api/auth/2fa/totp/disable', async () => {
    const fs = await import('node:fs/promises')
    const src = await fs.readFile('src/auth-2fa.js', 'utf8')
    const line = src.split('\n').find((l) => l.includes("app.post('/api/auth/2fa/totp/disable'"))
    expect(line).toBeDefined()
    expect(line).toMatch(/requireElevated\(\)/)
  })
})

describe('7f/3 — fin/admin/pricing/routes', () => {
  const sensitive = [
    ['post', '/api/admin/fin/prices'],
    ['post', '/api/admin/fin/prices/p-1/versions'],
    ['post', '/api/admin/fin/prices/p-1/versions/v-1/activate'],
    ['post', '/api/admin/fin/prices/p-1/versions/v-1/deprecate'],
    ['post', '/api/admin/fin/contracts'],
    ['post', '/api/admin/fin/contracts/c-1/versions'],
    ['post', '/api/admin/fin/contracts/c-1/versions/v-1/activate'],
    ['post', '/api/admin/fin/contracts/c-1/suspend'],
    ['post', '/api/admin/fin/contracts/c-1/terminate'],
  ]

  let app
  beforeEach(async () => {
    await withPatchedEnv(async () => {
      const { registerFinPricingAdminRoutes } = await import('./fin/admin/pricing/routes.js')
      app = express()
      app.use(express.json())
      registerFinPricingAdminRoutes(app, {
        authMiddleware: (req, _res, next) => {
          req.user = { id: 'admin-1', token_version: 0, platform_role: 'platform_admin' }
          next()
        },
        requirePlatformAdmin: fakePlatformAdmin,
      })
    })
  })

  it.each(sensitive)('%s %s refuses without X-Elevated-Token', async (method, route) => {
    const res = await request(app)[method](route).send({})
    expectStepUpRequired(res)
  })

  it('declares all 11 /api/admin/fin/prices and /contracts routes', async () => {
    const fs = await import('node:fs/promises')
    const src = await fs.readFile('src/fin/admin/pricing/routes.js', 'utf8')
    expect(src).toContain("app.get('/api/admin/fin/prices'")
    expect(src).toContain("app.get('/api/admin/fin/prices/:id'")
    expect(src).toContain("app.post('/api/admin/fin/prices'")
    expect(src).toContain("app.post('/api/admin/fin/prices/:id/versions'")
    expect(src).toContain("app.post('/api/admin/fin/prices/:id/versions/:vid/activate'")
    expect(src).toContain("app.post('/api/admin/fin/prices/:id/versions/:vid/deprecate'")
    expect(src).toContain("app.post('/api/admin/fin/contracts'")
    expect(src).toContain("app.post('/api/admin/fin/contracts/:id/versions'")
    expect(src).toContain("app.post('/api/admin/fin/contracts/:id/versions/:vid/activate'")
    expect(src).toContain("app.post('/api/admin/fin/contracts/:id/suspend'")
    expect(src).toContain("app.post('/api/admin/fin/contracts/:id/terminate'")
    expect(src).toContain('writeGuards')
    expect(src).toContain('requireElevated()')
    expect(src).toContain('adminMutationLimiter')
    expect(src).toContain('requireIfMatch')
  })
})

describe('7f/3 — fin/admin/routes (ops writes)', () => {
  const sensitive = [
    ['post', '/api/admin/fin/facilities'],
    ['post', '/api/admin/fin/facilities/f-1/pause'],
    ['post', '/api/admin/fin/facilities/f-1/resume'],
    ['post', '/api/admin/fin/facilities/f-1/suspend'],
    ['post', '/api/admin/fin/facilities/f-1/close'],
    ['post', '/api/admin/fin/facilities/f-1/limit'],
    ['post', '/api/admin/fin/reconciliation/run'],
    ['post', '/api/admin/fin/reconciliation/drift/d-1/resolve'],
    ['post', '/api/admin/fin/approvals/a-1/approve'],
    ['post', '/api/admin/fin/approvals/a-1/reject'],
    ['post', '/api/admin/fin/dunning/cases/c-1/advance'],
    ['post', '/api/admin/fin/dunning/cases/c-1/cure'],
    ['post', '/api/admin/fin/dunning/cases/c-1/write-off'],
    ['post', '/api/admin/fin/billing/periods/p-1/close'],
    ['post', '/api/admin/fin/billing/periods/p-1/reopen'],
    ['post', '/api/admin/fin/invoices/i-1/void'],
    ['post', '/api/admin/fin/invoices/i-1/credit-note'],
    ['post', '/api/admin/fin/invoices/i-1/debit-note'],
    ['post', '/api/admin/fin/payments'],
    ['post', '/api/admin/fin/payments/p-1/apply'],
    ['post', '/api/admin/fin/payments/p-1/reverse'],
    ['post', '/api/admin/fin/accounting/periods/p-1/soft-close'],
    ['post', '/api/admin/fin/accounting/periods/p-1/hard-close'],
    ['post', '/api/admin/fin/accounting/periods/p-1/reopen'],
  ]

  let app
  beforeEach(async () => {
    await withPatchedEnv(async () => {
      const { registerFinOpsAdminRoutes } = await import('./fin/admin/routes.js')
      app = express()
      app.use(express.json())
      registerFinOpsAdminRoutes(app, {
        authMiddleware: (req, _res, next) => {
          req.user = { id: 'admin-1', token_version: 0, platform_role: 'platform_admin' }
          next()
        },
        requirePlatformAdmin: fakePlatformAdmin,
      })
    })
  })

  it.each(sensitive)('%s %s refuses without X-Elevated-Token', async (method, route) => {
    const res = await request(app)[method](route).send({})
    expectStepUpRequired(res)
  })

  it('declares ops write routes behind writeGuards', async () => {
    const fs = await import('node:fs/promises')
    const src = await fs.readFile('src/fin/admin/routes.js', 'utf8')
    expect(src).toContain("app.post('/api/admin/fin/facilities'")
    expect(src).toContain("app.post('/api/admin/fin/reconciliation/run'")
    expect(src).toContain("app.post('/api/admin/fin/approvals/:id/approve'")
    expect(src).toContain("app.post('/api/admin/fin/dunning/cases/:id/advance'")
    expect(src).toContain("app.post('/api/admin/fin/billing/periods/:id/close'")
    expect(src).toContain("app.post('/api/admin/fin/invoices/:id/void'")
    expect(src).toContain("app.post('/api/admin/fin/payments'")
    expect(src).toContain("app.post('/api/admin/fin/accounting/periods/:id/soft-close'")
    expect(src).toContain('writeGuards')
    expect(src).toContain('requireElevated()')
    expect(src).toContain('adminMutationLimiter')
    expect(src).toContain('requireIfMatch')
    expect(src).toContain("default-src 'self'")
  })
})
