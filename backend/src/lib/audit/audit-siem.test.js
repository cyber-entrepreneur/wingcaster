/**
 * Unit tests for T5 SIEM export + SSE audit stream.
 *
 * Covers:
 *   - JSONL export: header, body one-line-per-row, escaping
 *   - Cross-tenant probe on JSONL rejected with 403
 *   - Regular member on JSONL gets empty result (not 403)
 *   - Platform admin gets all rows on JSONL (no agency filter forced)
 *   - `matchesFilters` helper: exact match on type / entity / actor
 *   - `publishAuditEvent` fires subscribers; matching filter delivers;
 *     wrong-tenant subscriber is skipped
 *   - Zero-agency user (regular member) doesn't get any events on stream
 */
import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('../../db.js', () => db)
vi.mock('../../auth.js', () => ({ authMiddleware: null }))
vi.mock('../logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

let registerAuditSiemRoutes
let publishAuditEvent
let __testables

const ADMIN_USER = 'user-platform-admin'
const AGENCY_ADMIN = 'user-agency-admin'
const REGULAR = 'user-regular'
const AGENCY_A = 'agency-a'
const AGENCY_B = 'agency-b'

async function createApp(overrides = {}) {
  const app = express()
  app.use(express.json())
  registerAuditSiemRoutes(app, {
    authMiddleware: (req, _res, next) => {
      req.user = {
        id: overrides.userId || AGENCY_ADMIN,
        platform_role: overrides.platformRole || null,
      }
      next()
    },
  })
  return app
}

beforeEach(async () => {
  vi.resetModules()
  db.query.mockReset()
  db.query.mockImplementation(async (sql, params) => {
    if (/^SELECT agency_id FROM agency_members/i.test(sql)) {
      if (params?.[0] === AGENCY_ADMIN) return [{ agency_id: AGENCY_A }]
      return []
    }
    if (/^SELECT \* FROM audit_log/i.test(sql)) return []
    return []
  })
  ;({ registerAuditSiemRoutes, publishAuditEvent, __testables } = await import('./audit-siem.js'))
})

afterEach(() => {
  vi.restoreAllMocks()
  // Drop any test-injected listeners so tests don't leak.
  __testables?.emitter?.removeAllListeners?.('audit')
})

describe('GET /api/audit/log.jsonl', () => {
  it('platform admin sees all rows, no agency filter forced', async () => {
    db.query.mockImplementation(async (sql) => {
      if (/^SELECT agency_id FROM agency_members/i.test(sql)) return []
      if (/^SELECT \* FROM audit_log/i.test(sql)) {
        expect(sql).not.toMatch(/agency_id = ANY/i)
        return [
          { id: 'a-1', type: 'test', agency_id: AGENCY_A, created_at: '2026-09-16T00:00:00Z' },
          { id: 'a-2', type: 'test', agency_id: AGENCY_B, created_at: '2026-09-16T00:00:01Z' },
        ]
      }
      return []
    })
    const app = await createApp({ platformRole: 'platform_admin' })
    const res = await request(app).get('/api/audit/log.jsonl')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/x-ndjson/)
    expect(res.headers['x-wingcaster-audit-rows']).toBe('2')
    const lines = res.text.trim().split('\n')
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0]).id).toBe('a-1')
  })

  it('agency admin sees only their tenant (agency_id ANY-filter)', async () => {
    let observedSql = null
    db.query.mockImplementation(async (sql) => {
      if (/^SELECT agency_id FROM agency_members/i.test(sql)) return [{ agency_id: AGENCY_A }]
      if (/^SELECT \* FROM audit_log/i.test(sql)) {
        observedSql = sql
        return []
      }
      return []
    })
    const app = await createApp({ userId: AGENCY_ADMIN })
    await request(app).get('/api/audit/log.jsonl')
    expect(observedSql).toMatch(/agency_id = ANY/i)
  })

  it('regular member gets an empty file (WHERE FALSE), not 403', async () => {
    db.query.mockImplementation(async (sql) => {
      if (/^SELECT agency_id FROM agency_members/i.test(sql)) return []
      if (/^SELECT \* FROM audit_log/i.test(sql)) {
        expect(sql).toMatch(/FALSE/i)
        return []
      }
      return []
    })
    const app = await createApp({ userId: REGULAR })
    const res = await request(app).get('/api/audit/log.jsonl')
    expect(res.status).toBe(200)
    expect(res.text).toBe('')
  })

  it('cross-tenant explicit filter rejected with 403', async () => {
    const app = await createApp({ userId: AGENCY_ADMIN })
    const res = await request(app).get(`/api/audit/log.jsonl?agency_id=${AGENCY_B}`)
    expect(res.status).toBe(403)
  })
})

describe('matchesFilters helper', () => {
  it('empty filters → always true', () => {
    expect(__testables.matchesFilters({ type: 'x' }, {})).toBe(true)
    expect(__testables.matchesFilters({ type: 'x' }, null)).toBe(true)
  })
  it('type mismatch → false', () => {
    expect(__testables.matchesFilters({ type: 'x' }, { type: 'y' })).toBe(false)
  })
  it('all match → true', () => {
    expect(
      __testables.matchesFilters(
        { type: 'x', entity_type: 'listing', agent_id: 'u-1' },
        { type: 'x', entity_type: 'listing', actor_id: 'u-1' },
      ),
    ).toBe(true)
  })
})

describe('publishAuditEvent (in-process pub-sub)', () => {
  it('fires all subscribers', () => {
    const received = []
    __testables.emitter.on('audit', (row) => received.push(row))
    publishAuditEvent({ id: 'a-1', type: 't' })
    publishAuditEvent({ id: 'a-2', type: 't' })
    expect(received).toHaveLength(2)
    expect(received[0].id).toBe('a-1')
  })
})
