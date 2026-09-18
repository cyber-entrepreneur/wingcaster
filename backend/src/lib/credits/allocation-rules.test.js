/**
 * Unit tests for AGN-CRD-004 credit allocation rules.
 */
import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { validateAllocationRulesPayload } from './allocation-rules.js'

const db = vi.hoisted(() => ({
  query: vi.fn(),
}))

const identity = vi.hoisted(() => ({
  findUserById: vi.fn(),
}))

const tenantAuth = vi.hoisted(() => ({
  getAgencyMembership: vi.fn(),
  listUserAgencyMemberships: vi.fn(),
  listAgencyMemberships: vi.fn(),
}))

vi.mock('../../db.js', () => db)
vi.mock('../../identity.js', () => identity)
vi.mock('../../tenant-authorization.js', () => tenantAuth)
vi.mock('../../auth.js', () => ({
  authMiddleware: (req, _res, next) => next(),
}))
vi.mock('./errors.js', () => ({
  sendCreditError: (res, err) => res.status(500).json({ error: err.message }),
}))

const AGENCY_ID = 'agency-1'
const ADMIN_USER = 'user-admin'
const MEMBER_USER = 'user-member'
const AGENT_A = 'agent-a'
const AGENT_B = 'agent-b'

let registerCreditAllocationRulesRoutes

async function createApp(overrides = {}) {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.user = { id: overrides.userId || ADMIN_USER }
    next()
  })
  registerCreditAllocationRulesRoutes(app)
  return app
}

beforeEach(async () => {
  vi.resetModules()
  db.query.mockReset()
  identity.findUserById.mockReset()
  tenantAuth.getAgencyMembership.mockReset()
  tenantAuth.listUserAgencyMemberships.mockReset()
  tenantAuth.listAgencyMemberships.mockReset()

  tenantAuth.listUserAgencyMemberships.mockImplementation(async (userId) => {
    if (userId === ADMIN_USER) return [{ agency_id: AGENCY_ID, user_id: userId, role: 'owner' }]
    if (userId === MEMBER_USER) return [{ agency_id: AGENCY_ID, user_id: userId, role: 'agent' }]
    return []
  })
  tenantAuth.listAgencyMemberships.mockResolvedValue([
    { user_id: AGENT_A, role: 'agent' },
    { user_id: AGENT_B, role: 'agent' },
  ])
  tenantAuth.getAgencyMembership.mockImplementation(async (agencyId, userId) => {
    if (agencyId !== AGENCY_ID) return null
    if ([AGENT_A, AGENT_B, ADMIN_USER].includes(userId)) {
      return { agency_id: agencyId, user_id: userId, role: userId === ADMIN_USER ? 'owner' : 'agent' }
    }
    return null
  })
  identity.findUserById.mockImplementation(async (userId) => ({
    id: userId,
    name: `Name ${userId}`,
    email: `${userId}@example.com`,
  }))

  ;({ registerCreditAllocationRulesRoutes } = await import('./allocation-rules-routes.js'))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('validateAllocationRulesPayload', () => {
  it('rejects percentage totals above 100', () => {
    const result = validateAllocationRulesPayload({
      mode: 'percentage',
      overrides: [
        { agent_user_id: AGENT_A, percentage: 60 },
        { agent_user_id: AGENT_B, percentage: 50 },
      ],
    })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/sum/)
  })

  it('accepts percentage totals at or below 100', () => {
    const result = validateAllocationRulesPayload({
      mode: 'percentage',
      overrides: [
        { agent_user_id: AGENT_A, percentage: 60 },
        { agent_user_id: AGENT_B, percentage: 40 },
      ],
    })
    expect(result.ok).toBe(true)
  })
})

describe('GET /api/agency/credits/allocation-rules', () => {
  it('returns default manual rules when no row exists', async () => {
    db.query.mockImplementation(async (sql) => {
      if (sql.includes('agency_credit_allocation_rules')) return []
      if (sql.includes('agency_credit_allocation_overrides')) return []
      return []
    })

    const app = await createApp()

    const res = await request(app).get('/api/agency/credits/allocation-rules')
    expect(res.status).toBe(200)
    expect(res.body.rules).toMatchObject({
      agency_id: AGENCY_ID,
      mode: 'manual',
      is_default: true,
      shared_pool_percentage: 100,
    })
    expect(res.body.agents).toHaveLength(2)
  })

  it('blocks non-admin members', async () => {
    const app = await createApp({ userId: MEMBER_USER })

    const res = await request(app).get('/api/agency/credits/allocation-rules')
    expect(res.status).toBe(403)
  })
})

describe('PUT /api/agency/credits/allocation-rules', () => {
  it('persists percentage overrides', async () => {
    const savedOverrides = []
    db.query.mockImplementation(async (sql, params = []) => {
      if (sql.startsWith('SELECT agency_id FROM agency_credit_allocation_rules')) return []
      if (sql.startsWith('INSERT INTO agency_credit_allocation_rules')) return []
      if (sql.startsWith('DELETE FROM agency_credit_allocation_overrides')) return []
      if (sql.startsWith('INSERT INTO agency_credit_allocation_overrides')) {
        savedOverrides.push({
          agent_user_id: params[2],
          percentage: params[3],
          cap_usd: params[4],
        })
        return []
      }
      if (sql.includes('FROM agency_credit_allocation_rules')) {
        return [{ agency_id: AGENCY_ID, mode: 'percentage', updated_by: ADMIN_USER, updated_at: '2026-09-18T00:00:00.000Z' }]
      }
      if (sql.includes('FROM agency_credit_allocation_overrides')) return savedOverrides
      return []
    })

    const app = await createApp()

    const res = await request(app)
      .put('/api/agency/credits/allocation-rules')
      .send({
        mode: 'percentage',
        overrides: [
          { agent_user_id: AGENT_A, percentage: 30 },
          { agent_user_id: AGENT_B, percentage: 20 },
        ],
      })

    expect(res.status).toBe(200)
    expect(res.body.rules.mode).toBe('percentage')
    expect(res.body.rules.percentage_total).toBe(50)
    expect(res.body.rules.shared_pool_percentage).toBe(50)
  })

  it('rejects overrides for agents outside the agency', async () => {
    const app = await createApp()

    const res = await request(app)
      .put('/api/agency/credits/allocation-rules')
      .send({
        mode: 'percentage',
        overrides: [{ agent_user_id: 'outsider', percentage: 10 }],
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/not in your agency/)
  })
})
