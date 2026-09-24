/**
 * SHR-ERR-002 access-request route tests.
 *
 * Boots only the access-request module against a bare Express app backed by a
 * tiny in-memory DAL (so dedupe + recipient notification behave realistically).
 * Covers: file → 201 + persisted row, idempotent re-file → 200 already_requested,
 * platform scope notifies every platform admin (and never the requester),
 * agency scope notifies the agency owner, a missing agency stays leak-safe (still
 * 201, no notification), strict validation, GET /mine ownership scoping, and
 * GET /:id leak-safe 404 for a request the caller does not own.
 */
import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => ({ data: {} }))

function matchOpenTarget(row, requesterId, scope, agencyId, resourceId) {
  return (
    row.requester_id === requesterId &&
    row.status === 'open' &&
    row.scope === scope &&
    (row.agency_id ?? null) === (agencyId ?? null) &&
    (row.resource_id ?? null) === (resourceId ?? null)
  )
}

const db = vi.hoisted(() => ({
  query: vi.fn(async (sql, params = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim()
    if (normalized.includes('FROM public.access_requests') && normalized.includes('requester_id = $1') && normalized.includes("status = 'open'")) {
      const [requesterId, scope, agencyId, resourceId] = params
      const row = (store.data.access_requests || []).find((r) => matchOpenTarget(r, requesterId, scope, agencyId, resourceId))
      return row ? [row] : []
    }
    if (normalized.includes('FROM public.access_requests') && normalized.includes('id = $1') && normalized.includes('requester_id = $2')) {
      const [id, requesterId] = params
      const row = (store.data.access_requests || []).find((r) => r.id === id && r.requester_id === requesterId)
      return row ? [row] : []
    }
    if (normalized.includes('FROM public.access_requests') && normalized.includes('requester_id = $1') && normalized.includes('ORDER BY created_at DESC')) {
      const [requesterId] = params
      const rows = (store.data.access_requests || [])
        .filter((r) => r.requester_id === requesterId)
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      return rows
    }
    if (normalized.includes('FROM public.users') && normalized.includes('platform_role = $1')) {
      const [role] = params
      return (store.data.users || []).filter((u) => u.platform_role === role).map((u) => ({ id: u.id }))
    }
    throw new Error(`unexpected query in test: ${normalized}`)
  }),
  findOne: vi.fn((collection, pred) => {
    const rows = store.data[collection] || []
    return Promise.resolve(rows.find(pred) || undefined)
  }),
  insert: vi.fn((collection, row) => {
    ;(store.data[collection] ||= []).push(row)
    return Promise.resolve(row)
  }),
  update: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('../db.js', () => db)

let registerRoutes

function createApp(user = { id: 'req-1', name: 'Req One' }) {
  const app = express()
  app.use(express.json())
  registerRoutes(app, {
    authMiddleware: (req, _res, next) => {
      req.user = user
      next()
    },
  })
  return app
}

beforeEach(async () => {
  store.data = { access_requests: [], users: [], agencies: [], notifications: [] }
  db.query.mockClear()
  db.findOne.mockClear()
  db.insert.mockClear()
  ;({ registerRoutes } = await import('./access-request-routes.js'))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('registerRoutes wiring', () => {
  it('throws without authMiddleware', () => {
    expect(() => registerRoutes(express(), {})).toThrow(/authMiddleware/)
  })
})

describe('POST /api/access-requests', () => {
  it('files a request and returns 201 with a persisted row', async () => {
    const app = createApp()
    const res = await request(app).post('/api/access-requests').send({ scope: 'platform', area_label: 'Tenants' })
    expect(res.status).toBe(201)
    expect(res.body.already_requested).toBe(false)
    expect(res.body.request).toMatchObject({
      requester_id: 'req-1',
      requester_name: 'Req One',
      scope: 'platform',
      area_label: 'Tenants',
      status: 'open',
    })
    expect(store.data.access_requests).toHaveLength(1)
  })

  it('is idempotent: re-filing the same open request returns it without duplicating', async () => {
    const app = createApp()
    const first = await request(app).post('/api/access-requests').send({ scope: 'platform', area_label: 'Tenants' })
    const second = await request(app).post('/api/access-requests').send({ scope: 'platform', area_label: 'Tenants (again)' })
    expect(second.status).toBe(200)
    expect(second.body.already_requested).toBe(true)
    expect(second.body.request.id).toBe(first.body.request.id)
    expect(store.data.access_requests).toHaveLength(1)
  })

  it('treats a different resource as a distinct request', async () => {
    const app = createApp()
    await request(app).post('/api/access-requests').send({ scope: 'resource', resource_id: 'r1' })
    const res = await request(app).post('/api/access-requests').send({ scope: 'resource', resource_id: 'r2' })
    expect(res.status).toBe(201)
    expect(store.data.access_requests).toHaveLength(2)
  })

  it('notifies every platform admin for platform scope, but never the requester', async () => {
    store.data.users = [
      { id: 'req-1', platform_role: 'platform_admin' },
      { id: 'admin-2', platform_role: 'platform_admin' },
      { id: 'agent-9', platform_role: null },
    ]
    const app = createApp()
    const res = await request(app).post('/api/access-requests').send({ scope: 'platform', area_label: 'Usage' })
    expect(res.status).toBe(201)
    const recipients = store.data.notifications.map((n) => n.user_id)
    expect(recipients).toEqual(['admin-2'])
    expect(store.data.notifications[0]).toMatchObject({ type: 'system', title: 'Access requested' })
    expect(store.data.notifications[0].metadata).toMatchObject({ kind: 'access_request', scope: 'platform' })
  })

  it('notifies the agency owner for agency scope', async () => {
    store.data.agencies = [{ id: 'a1', owner_id: 'owner-1' }]
    const app = createApp()
    const res = await request(app).post('/api/access-requests').send({ scope: 'agency', agency_id: 'a1', area_label: 'Members' })
    expect(res.status).toBe(201)
    expect(store.data.notifications.map((n) => n.user_id)).toEqual(['owner-1'])
  })

  it('stays leak-safe when the target agency does not resolve (still 201, no notification)', async () => {
    const app = createApp()
    const res = await request(app).post('/api/access-requests').send({ scope: 'agency', agency_id: 'ghost' })
    expect(res.status).toBe(201)
    expect(store.data.notifications).toHaveLength(0)
  })

  it('rejects an unknown scope', async () => {
    const app = createApp()
    const res = await request(app).post('/api/access-requests').send({ scope: 'root' })
    expect(res.status).toBe(400)
    expect(store.data.access_requests).toHaveLength(0)
  })

  it('rejects an unknown field (strict schema)', async () => {
    const app = createApp()
    const res = await request(app).post('/api/access-requests').send({ scope: 'platform', escalate: true })
    expect(res.status).toBe(400)
  })
})

describe('GET /api/access-requests/mine', () => {
  it('returns only the caller\'s own requests, newest first', async () => {
    store.data.access_requests = [
      { id: 'a', requester_id: 'req-1', scope: 'platform', status: 'open', created_at: '2026-01-01T00:00:00Z' },
      { id: 'b', requester_id: 'req-1', scope: 'agency', status: 'open', created_at: '2026-02-01T00:00:00Z' },
      { id: 'c', requester_id: 'other', scope: 'platform', status: 'open', created_at: '2026-03-01T00:00:00Z' },
    ]
    const app = createApp()
    const res = await request(app).get('/api/access-requests/mine')
    expect(res.status).toBe(200)
    expect(res.body.requests.map((r) => r.id)).toEqual(['b', 'a'])
  })
})

describe('GET /api/access-requests/:id', () => {
  it('returns an owned request', async () => {
    store.data.access_requests = [{ id: 'a', requester_id: 'req-1', scope: 'platform', status: 'open', created_at: '2026-01-01T00:00:00Z' }]
    const app = createApp()
    const res = await request(app).get('/api/access-requests/a')
    expect(res.status).toBe(200)
    expect(res.body.request.id).toBe('a')
  })

  it('404s (leak-safe) a request owned by someone else', async () => {
    store.data.access_requests = [{ id: 'a', requester_id: 'other', scope: 'platform', status: 'open', created_at: '2026-01-01T00:00:00Z' }]
    const app = createApp()
    const res = await request(app).get('/api/access-requests/a')
    expect(res.status).toBe(404)
  })

  it('404s an unknown request', async () => {
    const app = createApp()
    const res = await request(app).get('/api/access-requests/ghost')
    expect(res.status).toBe(404)
  })
})
