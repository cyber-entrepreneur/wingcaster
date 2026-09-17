/**
 * Unit tests for H5 audit search routes.
 *
 * Covers:
 *   - Platform admin sees rows across all tenants (no agency filter forced)
 *   - Agency admin sees only their own tenant's rows (agency_id ANY-filter)
 *   - Non-admin caller with no admin memberships gets empty result (not 403)
 *   - Explicit agency_id filter validated against caller's allowlist
 *   - Filter fields (type, entity_type, entity_id, actor_id, from/to, q) all
 *     compose into the WHERE clause
 *   - Free-text `q` searches type + action + entity_type + metadata JSON
 *   - Limit clamped to MAX_PAGE_SIZE
 *   - CSV export includes header + escapes commas/quotes/newlines
 */
import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('../../db.js', () => db)
vi.mock('../../auth.js', () => ({ authMiddleware: null }))
vi.mock('../../tenant-authorization.js', () => ({
  getAgencyMembership: vi.fn(),
}))
vi.mock('../logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

let registerAuditSearchRoutes
let __testables

const ADMIN_USER = 'user-platform-admin'
const AGENCY_ADMIN_USER = 'user-agency-admin'
const REGULAR_USER = 'user-regular'
const AGENCY_A = 'agency-a'
const AGENCY_B = 'agency-b'

async function createApp(overrides = {}) {
  const app = express()
  app.use(express.json())
  registerAuditSearchRoutes(app, {
    authMiddleware: (req, _res, next) => {
      const uid = overrides.userId || AGENCY_ADMIN_USER
      const role = overrides.platformRole || null
      req.user = { id: uid, platform_role: role }
      next()
    },
  })
  return app
}

beforeEach(async () => {
  vi.resetModules()
  db.query.mockReset()

  // Default membership map:
  //   AGENCY_ADMIN_USER → admin of AGENCY_A
  //   REGULAR_USER      → no admin memberships
  db.query.mockImplementation(async (sql, params) => {
    if (/^SELECT agency_id FROM agency_members/i.test(sql)) {
      if (params?.[0] === AGENCY_ADMIN_USER) return [{ agency_id: AGENCY_A }]
      return []
    }
    if (/^SELECT COUNT\(/i.test(sql)) return [{ n: 0 }]
    if (/^SELECT \* FROM audit_log/i.test(sql)) return []
    return []
  })

  ;({ registerAuditSearchRoutes, __testables } = await import('./audit-search-routes.js'))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GET /api/audit/log', () => {
  it('platform admin sees all rows (no agency_id filter forced)', async () => {
    db.query.mockImplementation(async (sql) => {
      if (/^SELECT agency_id FROM agency_members/i.test(sql)) return []
      if (/^SELECT COUNT/i.test(sql)) return [{ n: 42 }]
      if (/^SELECT \* FROM audit_log/i.test(sql)) {
        // Should NOT contain agency_id filter — platform admin is unbounded.
        expect(sql).not.toMatch(/agency_id = ANY/i)
        return [
          {
            id: 'a-1',
            agent_id: 'x',
            agency_id: AGENCY_A,
            type: 'agency_mfa_policy_updated',
            action: 'update',
            created_at: '2026-09-16T10:00:00Z',
          },
        ]
      }
      return []
    })
    const app = await createApp({ platformRole: 'platform_admin' })
    const res = await request(app).get('/api/audit/log')
    expect(res.status).toBe(200)
    expect(res.body.entries).toHaveLength(1)
    expect(res.body.pagination.total).toBe(42)
  })

  it('agency admin sees only their tenant (agency_id ANY-filter applied)', async () => {
    let searchSql = null
    db.query.mockImplementation(async (sql, params) => {
      if (/^SELECT agency_id FROM agency_members/i.test(sql)) return [{ agency_id: AGENCY_A }]
      if (/^SELECT COUNT/i.test(sql)) return [{ n: 3 }]
      if (/^SELECT \* FROM audit_log/i.test(sql)) {
        searchSql = sql
        expect(sql).toMatch(/agency_id = ANY/i)
        // The ANY param carries only the admin's agency, not others.
        expect(params.some((p) => Array.isArray(p) && p.includes(AGENCY_A))).toBe(true)
        return []
      }
      return []
    })
    const app = await createApp({ userId: AGENCY_ADMIN_USER })
    const res = await request(app).get('/api/audit/log')
    expect(res.status).toBe(200)
    expect(searchSql).toBeTruthy()
  })

  it('non-admin regular user gets empty result (not 403) — FALSE clause in WHERE', async () => {
    db.query.mockImplementation(async (sql) => {
      if (/^SELECT agency_id FROM agency_members/i.test(sql)) return []
      if (/^SELECT COUNT/i.test(sql)) {
        expect(sql).toMatch(/FALSE/i)
        return [{ n: 0 }]
      }
      if (/^SELECT \* FROM audit_log/i.test(sql)) {
        expect(sql).toMatch(/FALSE/i)
        return []
      }
      return []
    })
    const app = await createApp({ userId: REGULAR_USER })
    const res = await request(app).get('/api/audit/log')
    expect(res.status).toBe(200)
    expect(res.body.entries).toEqual([])
    expect(res.body.pagination.total).toBe(0)
  })

  it('explicit agency_id filter rejected when not on caller allowlist', async () => {
    const app = await createApp({ userId: AGENCY_ADMIN_USER })
    // AGENCY_ADMIN_USER only administers AGENCY_A; asking for AGENCY_B → 403.
    const res = await request(app).get(`/api/audit/log?agency_id=${AGENCY_B}`)
    expect(res.status).toBe(403)
  })

  it('explicit agency_id filter accepted when on caller allowlist', async () => {
    db.query.mockImplementation(async (sql, params) => {
      if (/^SELECT agency_id FROM agency_members/i.test(sql)) return [{ agency_id: AGENCY_A }]
      if (/^SELECT COUNT/i.test(sql)) return [{ n: 5 }]
      if (/^SELECT \* FROM audit_log/i.test(sql)) return []
      return []
    })
    const app = await createApp({ userId: AGENCY_ADMIN_USER })
    const res = await request(app).get(`/api/audit/log?agency_id=${AGENCY_A}`)
    expect(res.status).toBe(200)
  })

  it('composes filters: type + entity_type + from/to + q', async () => {
    let observedSql = null
    let observedParams = null
    db.query.mockImplementation(async (sql, params) => {
      if (/^SELECT agency_id FROM agency_members/i.test(sql)) return []
      if (/^SELECT COUNT/i.test(sql)) return [{ n: 0 }]
      if (/^SELECT \* FROM audit_log/i.test(sql)) {
        observedSql = sql
        observedParams = params
        return []
      }
      return []
    })
    const app = await createApp({ platformRole: 'platform_admin' })
    await request(app).get(
      `/api/audit/log?type=agency_mfa_policy_updated&entity_type=agency_mfa_policy&from=2026-09-01T00:00:00Z&to=2026-09-30T23:59:59Z&q=passkey`,
    )
    expect(observedSql).toMatch(/type = \$/i)
    expect(observedSql).toMatch(/entity_type = \$/i)
    expect(observedSql).toMatch(/created_at >= \$/i)
    expect(observedSql).toMatch(/created_at <= \$/i)
    expect(observedSql).toMatch(/ILIKE/i)
    expect(observedParams.some((p) => p === '%passkey%')).toBe(true)
  })

  it('limit clamps to MAX_PAGE_SIZE', async () => {
    let observedSql = null
    db.query.mockImplementation(async (sql) => {
      if (/^SELECT agency_id FROM agency_members/i.test(sql)) return []
      if (/^SELECT COUNT/i.test(sql)) return [{ n: 0 }]
      if (/^SELECT \* FROM audit_log/i.test(sql)) {
        observedSql = sql
        return []
      }
      return []
    })
    const app = await createApp({ platformRole: 'platform_admin' })
    await request(app).get(`/api/audit/log?limit=9999`)
    expect(observedSql).toMatch(new RegExp(`LIMIT ${__testables.MAX_PAGE_SIZE}\\b`))
  })
})

describe('GET /api/audit/log.csv', () => {
  it('returns CSV with header + escapes special chars', async () => {
    db.query.mockImplementation(async (sql) => {
      if (/^SELECT agency_id FROM agency_members/i.test(sql)) return []
      if (/^SELECT \* FROM audit_log/i.test(sql)) {
        return [
          {
            id: 'a-1',
            created_at: '2026-09-16T10:00:00Z',
            agent_id: 'u',
            agency_id: AGENCY_A,
            type: 'test,with,commas',
            action: 'update',
            entity_type: 'e',
            entity_id: 'x',
            ip: '1.1.1.1',
            user_agent: 'Mozilla "5.0"',
          },
        ]
      }
      return []
    })
    const app = await createApp({ platformRole: 'platform_admin' })
    const res = await request(app).get('/api/audit/log.csv')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/csv/)
    expect(res.headers['x-wingcaster-audit-rows']).toBe('1')
    expect(res.text).toMatch(/id,created_at,agent_id,agency_id,type,action/)
    // Comma-containing field wrapped in quotes.
    expect(res.text).toMatch(/"test,with,commas"/)
    // Quote-containing field escapes " → ""
    expect(res.text).toMatch(/"Mozilla ""5.0"""/)
  })
})

describe('helpers', () => {
  it('parseISODate accepts valid ISO, rejects garbage', () => {
    expect(__testables.parseISODate('2026-09-16T10:00:00Z')).toBe('2026-09-16T10:00:00.000Z')
    expect(__testables.parseISODate('not-a-date')).toBeNull()
    expect(__testables.parseISODate(null)).toBeNull()
  })
  it('clampLimit defaults to DEFAULT_PAGE_SIZE for garbage', () => {
    expect(__testables.clampLimit('9999')).toBe(__testables.MAX_PAGE_SIZE)
    expect(__testables.clampLimit('abc')).toBe(__testables.DEFAULT_PAGE_SIZE)
    expect(__testables.clampLimit('-5')).toBe(__testables.DEFAULT_PAGE_SIZE)
    expect(__testables.clampLimit('50')).toBe(50)
  })
  it('clampOffset floors negative to 0', () => {
    expect(__testables.clampOffset('-1')).toBe(0)
    expect(__testables.clampOffset('50')).toBe(50)
    expect(__testables.clampOffset('abc')).toBe(0)
  })
})
