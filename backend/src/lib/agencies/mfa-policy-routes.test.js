/**
 * Fast unit tests for issue #190 admin-enforced 2FA policy routes.
 *
 * Boots only the mfa-policy route module against a bare Express app with
 * mocked db + identity. Covers the four contracts that matter for this
 * surface:
 *   - admin gate (owner/admin only can GET or PUT)
 *   - PUT validation (grace_days bounds, allowed_factors whitelist)
 *   - PUT writes audit_log row with before/after snapshot
 *   - GET synthesizes DEFAULT policy when no row exists
 *
 * evaluateMfaPolicyForSignIn / mfaEnforcementGate are covered by their own
 * postgres-backed suite (see mfa-policy.postgres.test.js).
 */
import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  findAll: vi.fn(),
  findOne: vi.fn(),
  insert: vi.fn(),
  query: vi.fn(),
  update: vi.fn(),
}))

const identity = vi.hoisted(() => ({
  findUserById: vi.fn(),
}))

const tenantAuth = vi.hoisted(() => ({
  getAgencyMembership: vi.fn(),
}))

vi.mock('../../db.js', () => db)
vi.mock('../../identity.js', () => identity)
vi.mock('../../tenant-authorization.js', () => tenantAuth)
vi.mock('../logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

let registerAgencyMfaPolicyRoutes

const AGENCY = { id: 'agency-1', slug: 'aleph-realty', name: 'Aleph Realty' }
const ADMIN_USER = 'user-admin'
const MEMBER_USER = 'user-member'

async function createApp(overrides = {}) {
  const app = express()
  app.use(express.json())
  registerAgencyMfaPolicyRoutes(app, {
    authMiddleware: (req, res, next) => {
      const uid = overrides.userId || ADMIN_USER
      req.user = { id: uid }
      next()
    },
  })
  return app
}

beforeEach(async () => {
  vi.resetModules()
  db.findAll.mockReset()
  db.findOne.mockReset()
  db.insert.mockReset()
  db.query.mockReset()
  db.update.mockReset()
  identity.findUserById.mockReset()
  tenantAuth.getAgencyMembership.mockReset()

  db.findOne.mockImplementation((collection, predicate) => {
    if (collection === 'agencies') {
      return [AGENCY].find(predicate) || null
    }
    return null
  })
  tenantAuth.getAgencyMembership.mockImplementation(async (agencyId, userId) => {
    if (userId === ADMIN_USER) return { agency_id: agencyId, user_id: userId, role: 'owner' }
    if (userId === MEMBER_USER) return { agency_id: agencyId, user_id: userId, role: 'agent' }
    return null
  })

  ;({ registerAgencyMfaPolicyRoutes } = await import('./mfa-policy-routes.js'))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GET /api/agencies/:id/security/mfa-policy', () => {
  it('returns the default policy when no row exists yet', async () => {
    db.query.mockResolvedValue([]) // no policy row
    const app = await createApp()
    const res = await request(app).get(`/api/agencies/${AGENCY.id}/security/mfa-policy`)
    expect(res.status).toBe(200)
    expect(res.body.policy).toMatchObject({
      agency_id: AGENCY.id,
      required: false,
      grace_days: 14,
      allowed_factors: [],
      is_default: true,
    })
  })

  it('returns the stored policy when a row exists', async () => {
    db.query.mockResolvedValue([
      {
        agency_id: AGENCY.id,
        required: true,
        grace_days: 7,
        allowed_factors: ['totp', 'passkey'],
        updated_by: ADMIN_USER,
        updated_at: '2026-09-16T12:00:00Z',
        created_at: '2026-09-01T00:00:00Z',
      },
    ])
    const app = await createApp()
    const res = await request(app).get(`/api/agencies/${AGENCY.id}/security/mfa-policy`)
    expect(res.status).toBe(200)
    expect(res.body.policy).toMatchObject({
      required: true,
      grace_days: 7,
      allowed_factors: ['totp', 'passkey'],
      is_default: false,
    })
  })

  it('refuses non-admin members with 403', async () => {
    db.query.mockResolvedValue([])
    const app = await createApp({ userId: MEMBER_USER })
    const res = await request(app).get(`/api/agencies/${AGENCY.id}/security/mfa-policy`)
    expect(res.status).toBe(403)
  })

  it('returns 404 when the agency does not exist', async () => {
    db.query.mockResolvedValue([])
    const app = await createApp()
    const res = await request(app).get(`/api/agencies/does-not-exist/security/mfa-policy`)
    expect(res.status).toBe(404)
  })
})

describe('PUT /api/agencies/:id/security/mfa-policy', () => {
  beforeEach(() => {
    // The handler makes at least three query calls per PUT:
    //   1. loadAgencyMfaPolicy(before)     → SELECT
    //   2. upsertPolicy() existing lookup  → SELECT
    //   3. upsertPolicy() UPDATE           → returns []
    // Route SELECTs by matching the SQL; UPDATEs get []. That way the
    // UPDATE branch is exercised (existing row is non-empty at step 2).
    const EXISTING_ROW = {
      agency_id: AGENCY.id,
      required: false,
      grace_days: 14,
      allowed_factors: [],
      updated_by: null,
      updated_at: null,
      created_at: '2026-09-01T00:00:00Z',
    }
    db.query.mockImplementation(async (sql) => {
      if (/^SELECT\b/i.test(sql)) return [EXISTING_ROW]
      return []
    })
  })

  it('updates required=true and audit_log gets before/after snapshot', async () => {
    const app = await createApp()
    const res = await request(app)
      .put(`/api/agencies/${AGENCY.id}/security/mfa-policy`)
      .send({ required: true, grace_days: 7 })
    expect(res.status).toBe(200)
    expect(res.body.policy).toMatchObject({ required: true, grace_days: 7 })

    // Update happened
    const updateCalls = db.query.mock.calls.filter((c) => /^UPDATE agency_mfa_policy/i.test(c[0]))
    expect(updateCalls.length).toBe(1)

    // Audit row written
    const auditCalls = db.insert.mock.calls.filter((c) => c[0] === 'audit_log')
    expect(auditCalls.length).toBe(1)
    const audit = auditCalls[0][1]
    expect(audit).toMatchObject({
      type: 'agency_mfa_policy_updated',
      entity_type: 'agency_mfa_policy',
      entity_id: AGENCY.id,
      agency_id: AGENCY.id,
      agent_id: ADMIN_USER,
    })
    expect(audit.metadata.before.required).toBe(false)
    expect(audit.metadata.after.required).toBe(true)
    expect(audit.metadata.after.grace_days).toBe(7)
  })

  it('rejects grace_days > 90', async () => {
    const app = await createApp()
    const res = await request(app)
      .put(`/api/agencies/${AGENCY.id}/security/mfa-policy`)
      .send({ grace_days: 999 })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/grace_days must be between/)
  })

  it('rejects grace_days < 0', async () => {
    const app = await createApp()
    const res = await request(app)
      .put(`/api/agencies/${AGENCY.id}/security/mfa-policy`)
      .send({ grace_days: -1 })
    expect(res.status).toBe(400)
  })

  it('rejects allowed_factors containing an unsupported factor', async () => {
    const app = await createApp()
    const res = await request(app)
      .put(`/api/agencies/${AGENCY.id}/security/mfa-policy`)
      .send({ allowed_factors: ['totp', 'sms_only'] })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/unsupported factor/)
  })

  it('rejects a body with no editable fields', async () => {
    const app = await createApp()
    const res = await request(app)
      .put(`/api/agencies/${AGENCY.id}/security/mfa-policy`)
      .send({ some_other_field: true })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/No editable fields/)
  })

  it('normalises allowed_factors to unique + sorted', async () => {
    const app = await createApp()
    const res = await request(app)
      .put(`/api/agencies/${AGENCY.id}/security/mfa-policy`)
      .send({ allowed_factors: ['totp', 'passkey', 'totp', 'backup_code'] })
    expect(res.status).toBe(200)
    expect(res.body.policy.allowed_factors).toEqual(['backup_code', 'passkey', 'totp'])
  })

  it('refuses non-admin members with 403', async () => {
    const app = await createApp({ userId: MEMBER_USER })
    const res = await request(app)
      .put(`/api/agencies/${AGENCY.id}/security/mfa-policy`)
      .send({ required: true })
    expect(res.status).toBe(403)
    expect(db.insert).not.toHaveBeenCalled()
  })
})

describe('evaluateMfaPolicyForSignIn', () => {
  let evaluate

  beforeEach(async () => {
    ;({ evaluateMfaPolicyForSignIn: evaluate } = await import('./mfa-policy-routes.js'))
  })

  it('returns block:false when user is already enrolled', async () => {
    const decision = await evaluate({ id: 'u-1', totp_enabled: true })
    expect(decision.block).toBe(false)
    expect(db.findAll).not.toHaveBeenCalled()
  })

  it('returns block:false when user has no memberships', async () => {
    db.findAll.mockResolvedValue([])
    const decision = await evaluate({ id: 'u-1', totp_enabled: false })
    expect(decision.block).toBe(false)
  })

  it('returns block:false when policy required=false', async () => {
    db.findAll.mockResolvedValue([
      { user_id: 'u-1', agency_id: AGENCY.id, status: 'active', joined_at: '2026-01-01T00:00:00Z' },
    ])
    db.query.mockResolvedValue([
      { agency_id: AGENCY.id, required: false, grace_days: 14, allowed_factors: [] },
    ])
    const decision = await evaluate({ id: 'u-1', totp_enabled: false })
    expect(decision.block).toBe(false)
  })

  it('returns block:true when grace expired (policy set long ago)', async () => {
    const longAgo = new Date(Date.now() - 100 * 86400000).toISOString()
    db.findAll.mockResolvedValue([
      { user_id: 'u-1', agency_id: AGENCY.id, status: 'active', joined_at: longAgo },
    ])
    db.query.mockResolvedValue([
      {
        agency_id: AGENCY.id,
        required: true,
        grace_days: 14,
        allowed_factors: [],
        updated_at: longAgo,
      },
    ])
    const decision = await evaluate({ id: 'u-1', totp_enabled: false })
    expect(decision.block).toBe(true)
    expect(decision.reason).toBe('grace_expired')
  })

  it('returns banner (not block) when policy active but grace remaining', async () => {
    const yesterday = new Date(Date.now() - 1 * 86400000).toISOString()
    db.findAll.mockResolvedValue([
      { user_id: 'u-1', agency_id: AGENCY.id, status: 'active', joined_at: yesterday },
    ])
    db.query.mockResolvedValue([
      {
        agency_id: AGENCY.id,
        required: true,
        grace_days: 14,
        allowed_factors: [],
        updated_at: yesterday,
      },
    ])
    const decision = await evaluate({ id: 'u-1', totp_enabled: false })
    expect(decision.block).toBe(false)
    expect(decision.banner).toBe('grace_active')
    expect(decision.days_left).toBeGreaterThan(0)
    expect(decision.days_left).toBeLessThanOrEqual(14)
  })

  it('picks the strictest deadline across multiple agencies', async () => {
    const long = new Date(Date.now() - 30 * 86400000).toISOString()
    const recent = new Date(Date.now() - 1 * 86400000).toISOString()
    db.findAll.mockResolvedValue([
      { user_id: 'u-1', agency_id: 'agency-lax', status: 'active', joined_at: recent },
      { user_id: 'u-1', agency_id: 'agency-strict', status: 'active', joined_at: long },
    ])
    db.query.mockImplementation((_sql, params) => {
      if (params?.[0] === 'agency-strict') {
        return Promise.resolve([
          {
            agency_id: 'agency-strict',
            required: true,
            grace_days: 14,
            allowed_factors: [],
            updated_at: long,
          },
        ])
      }
      if (params?.[0] === 'agency-lax') {
        return Promise.resolve([
          {
            agency_id: 'agency-lax',
            required: true,
            grace_days: 60,
            allowed_factors: [],
            updated_at: recent,
          },
        ])
      }
      return Promise.resolve([])
    })
    const decision = await evaluate({ id: 'u-1', totp_enabled: false })
    // Strict deadline (long ago) has already passed → block wins.
    expect(decision.block).toBe(true)
    expect(decision.agency_id).toBe('agency-strict')
  })
})

describe('mfaEnforcementGate (middleware)', () => {
  let gate
  beforeEach(async () => {
    ;({ mfaEnforcementGate: gate } = await import('../auth/mfa-enforcement.js'))
  })

  function makeReqRes(method, path, user = { id: 'u-1' }) {
    const req = { method, path, user }
    const res = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code
        return this
      },
      json(payload) {
        this.body = payload
        return this
      },
    }
    return { req, res }
  }

  it('passes GET/HEAD/OPTIONS without evaluating', async () => {
    const next = vi.fn()
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      const { req, res } = makeReqRes(method, '/api/anything')
      await gate(req, res, next)
    }
    expect(next).toHaveBeenCalledTimes(3)
    expect(identity.findUserById).not.toHaveBeenCalled()
  })

  it('passes whitelisted enrollment paths on POST', async () => {
    const next = vi.fn()
    const { req, res } = makeReqRes('POST', '/api/auth/2fa/totp/verify')
    await gate(req, res, next)
    expect(next).toHaveBeenCalled()
    expect(identity.findUserById).not.toHaveBeenCalled()
  })

  it('passes when user is enrolled', async () => {
    identity.findUserById.mockResolvedValue({ id: 'u-1', totp_enabled: true })
    const next = vi.fn()
    const { req, res } = makeReqRes('POST', '/api/listings')
    await gate(req, res, next)
    expect(next).toHaveBeenCalled()
  })

  it('blocks non-enrolled user past grace with 403 MFA_ENROLLMENT_REQUIRED', async () => {
    identity.findUserById.mockResolvedValue({ id: 'u-1', totp_enabled: false })
    const longAgo = new Date(Date.now() - 100 * 86400000).toISOString()
    db.findAll.mockResolvedValue([
      { user_id: 'u-1', agency_id: AGENCY.id, status: 'active', joined_at: longAgo },
    ])
    db.query.mockResolvedValue([
      { agency_id: AGENCY.id, required: true, grace_days: 14, allowed_factors: [], updated_at: longAgo },
    ])
    const next = vi.fn()
    const { req, res } = makeReqRes('POST', '/api/listings')
    await gate(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(403)
    expect(res.body.error).toBe('MFA_ENROLLMENT_REQUIRED')
    expect(res.body.agency_id).toBe(AGENCY.id)
  })

  it('passes non-enrolled user when policy is not required', async () => {
    identity.findUserById.mockResolvedValue({ id: 'u-1', totp_enabled: false })
    db.findAll.mockResolvedValue([
      { user_id: 'u-1', agency_id: AGENCY.id, status: 'active', joined_at: '2026-01-01T00:00:00Z' },
    ])
    db.query.mockResolvedValue([
      { agency_id: AGENCY.id, required: false, grace_days: 14, allowed_factors: [] },
    ])
    const next = vi.fn()
    const { req, res } = makeReqRes('POST', '/api/listings')
    await gate(req, res, next)
    expect(next).toHaveBeenCalled()
  })

  it('is fail-open: on evaluation error, passes rather than locking users out', async () => {
    identity.findUserById.mockRejectedValue(new Error('db down'))
    const next = vi.fn()
    const { req, res } = makeReqRes('POST', '/api/listings')
    await gate(req, res, next)
    expect(next).toHaveBeenCalled()
  })
})
