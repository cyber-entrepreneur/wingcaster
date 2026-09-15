import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const dal = vi.hoisted(() => ({
  findAll: vi.fn(async () => []),
  findOne: vi.fn(async () => null),
  insert: vi.fn(async (_c, item) => item),
  update: vi.fn(async () => 1),
  remove: vi.fn(async () => 1),
  // Batch ownership path used by mapOwnedProperties (replaces N sequential assertOwnsProperty).
  query: vi.fn(async (_sql, params = []) => {
    const ids = Array.isArray(params[0]) ? params[0] : []
    return ids.map((id) => ({
      id,
      agent_id: 'user-1',
      agency_id: null,
      tenant_id: 'personal:user-1',
      status: 'active',
      price: 100000,
      marketplace_syndicated: false,
      title: `Listing ${id}`,
      type: 'sale',
      city: 'Dubai',
      location: 'JVC',
      bedrooms: 2,
      bathrooms: 2,
      area: 100,
      views: 10,
      listed_date: '2026-01-01',
      reference: `REF-${id}`,
      data: {},
    }))
  }),
  // Transaction wrap used by #161 β bulk-audit atomic write.
  transaction: vi.fn(async (work) => work({})),
}))

const identity = vi.hoisted(() => ({
  findUserById: vi.fn(async () => ({
    id: 'user-1',
    email: 'agent@example.test',
    preferred_locale: 'en',
    active_tenant_id: 'personal:user-1',
    created_at: '2025-01-01T00:00:00.000Z',
    data: {},
  })),
  updateUser: vi.fn(async (_id, patch) => ({
    id: 'user-1',
    data: patch.data || {},
  })),
}))

const authz = vi.hoisted(() => ({
  assertOwnsProperty: vi.fn(async (_userId, id) => ({
    id,
    agent_id: 'user-1',
    title: `Listing ${id}`,
    price: 100000,
    status: 'active',
    type: 'sale',
    city: 'Dubai',
    location: 'JVC',
    bedrooms: 2,
    bathrooms: 2,
    area: 100,
    views: 10,
    listed_date: '2026-01-01',
    reference: `REF-${id}`,
  })),
}))

vi.mock('../db.js', () => dal)
vi.mock('../identity.js', () => identity)
vi.mock('../tenant-authorization.js', () => ({
  personalTenantId: (userId) => `personal:${userId}`,
}))
vi.mock('./authz.js', () => authz)

import { registerWave8ProRoutes } from './wave8-pro-routes.js'

function buildApp() {
  const app = express()
  app.use(express.json())
  const authMiddleware = (req, _res, next) => {
    req.user = { id: 'user-1' }
    next()
  }
  registerWave8ProRoutes(app, { authMiddleware })
  return app
}

describe('wave8-pro-routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dal.findOne.mockImplementation(async (collection, filter) => {
      if (collection === 'tenant_memberships') {
        const row = {
          id: 'mem-1',
          user_id: 'user-1',
          tenant_id: 'personal:user-1',
          status: 'active',
          data: {
            ui_mode: 'pro',
            dashboard_layout: [{ i: 'kpi-active', x: 0, y: 0, w: 3, h: 2 }],
            dashboard_density: 'comfortable',
            column_prefs: { listings: { columns: ['hrid', 'title'], density: 'compact' } },
          },
          updated_at: '2026-09-01T00:00:00.000Z',
        }
        return filter(row) ? row : null
      }
      if (collection === 'tenants') {
        const row = {
          id: 'personal:user-1',
          data: { saved_views: [] },
        }
        return filter(row) ? row : null
      }
      return null
    })
  })

  it('GET /api/users/me/dashboard-layout reads top-level prefs after fromRow strip', async () => {
    dal.findOne.mockImplementation(async (collection, filter) => {
      if (collection === 'tenant_memberships') {
        const row = {
          id: 'mem-1',
          user_id: 'user-1',
          tenant_id: 'personal:user-1',
          status: 'active',
          dashboard_layout: [{ i: 'kpi-active', x: 0, y: 0, w: 3, h: 2 }],
          dashboard_density: 'compact',
          updated_at: '2026-09-01T00:00:00.000Z',
        }
        return filter(row) ? row : null
      }
      return null
    })
    const res = await request(buildApp()).get('/api/users/me/dashboard-layout')
    expect(res.status).toBe(200)
    expect(res.body.density).toBe('compact')
    expect(res.body.layout[0].i).toBe('kpi-active')
  })

  it('GET /api/users/me/dashboard-layout returns layout + density', async () => {
    const res = await request(buildApp()).get('/api/users/me/dashboard-layout')
    expect(res.status).toBe(200)
    expect(res.body.density).toBe('comfortable')
    expect(res.body.layout).toHaveLength(1)
    expect(res.body.layout[0].i).toBe('kpi-active')
  })

  it('PATCH /api/users/me/dashboard-layout persists layout and density', async () => {
    const res = await request(buildApp())
      .patch('/api/users/me/dashboard-layout')
      .send({
        layout: [{ i: 'urgent', x: 0, y: 0, w: 8, h: 3 }],
        density: 'compact',
      })
    expect(res.status).toBe(200)
    expect(res.body.density).toBe('compact')
    expect(res.body.layout[0].i).toBe('urgent')
    expect(dal.update).toHaveBeenCalled()
    const updater = dal.update.mock.calls.find((c) => c[0] === 'tenant_memberships')?.[2]
    const next = updater({ id: 'mem-1', data: {} })
    expect(next.data.dashboard_density).toBe('compact')
    expect(next.dashboard_density).toBe('compact')
    expect(next.data.dashboard_layout[0].i).toBe('urgent')
    expect(next.dashboard_layout[0].i).toBe('urgent')
  })

  it('PATCH /api/users/me/list-prefs merges column prefs', async () => {
    const res = await request(buildApp())
      .patch('/api/users/me/list-prefs')
      .send({
        listings: {
          columns: ['hrid', 'title', 'price'],
          widths: { title: 280 },
          density: 'spacious',
        },
      })
    expect(res.status).toBe(200)
    expect(res.body.listings.columns).toEqual(['hrid', 'title', 'price'])
    expect(res.body.listings.widths.title).toBe(280)
    expect(res.body.listings.density).toBe('spacious')
  })

  it('saved-views CRUD create / rename / delete', async () => {
    const app = buildApp()
    const created = await request(app)
      .post('/api/tenants/personal:user-1/saved-views')
      .send({ name: 'Below market', filter: { status: ['published'] }, shared_with_tenant: true })
    expect(created.status).toBe(201)
    expect(created.body.name).toBe('Below market')
    expect(created.body.id).toMatch(/^sv_/)

    const viewId = created.body.id
    // Persist into subsequent findOne
    dal.findOne.mockImplementation(async (collection, filter) => {
      if (collection === 'tenant_memberships') {
        const row = {
          id: 'mem-1',
          user_id: 'user-1',
          tenant_id: 'personal:user-1',
          status: 'active',
          data: {},
        }
        return filter(row) ? row : null
      }
      if (collection === 'tenants') {
        const row = {
          id: 'personal:user-1',
          data: {
            saved_views: [{
              ...created.body,
              owner_user_id: 'user-1',
            }],
          },
        }
        return filter(row) ? row : null
      }
      return null
    })

    const renamed = await request(app)
      .patch(`/api/tenants/personal:user-1/saved-views/${viewId}`)
      .send({ name: 'Below market in JVC' })
    expect(renamed.status).toBe(200)
    expect(renamed.body.name).toBe('Below market in JVC')

    const deleted = await request(app).delete(`/api/tenants/personal:user-1/saved-views/${viewId}`)
    expect(deleted.status).toBe(200)
    expect(deleted.body.success).toBe(true)
  })

  it('bulk delete requires typed confirm phrase', async () => {
    const bad = await request(buildApp())
      .delete('/api/properties/bulk')
      .send({ ids: ['p1', 'p2'], confirmed_phrase: 'delete' })
    expect(bad.status).toBe(400)
    expect(bad.body.expected).toBe('delete 2')

    const ok = await request(buildApp())
      .delete('/api/properties/bulk')
      .send({ ids: ['p1', 'p2'], confirmed_phrase: 'delete 2' })
    expect(ok.status).toBe(200)
    expect(ok.body.deleted).toEqual(['p1', 'p2'])
    expect(dal.remove).toHaveBeenCalled()
  })

  it('pro-nudge dismiss persists users.data timestamp', async () => {
    const res = await request(buildApp()).post('/api/users/me/pro-nudge/dismiss')
    expect(res.status).toBe(200)
    expect(res.body.pro_nudge_dismissed_at).toBeTruthy()
    expect(identity.updateUser).toHaveBeenCalled()
    const patch = identity.updateUser.mock.calls[0][1]
    expect(patch.data.pro_nudge_dismissed_at).toBeTruthy()
  })

  it('GET pro-nudge eligible when ≥20 listings and ≥14 days', async () => {
    dal.findAll.mockResolvedValue(Array.from({ length: 20 }, (_, i) => ({ id: `p${i}` })))
    const res = await request(buildApp()).get('/api/users/me/pro-nudge')
    expect(res.status).toBe(200)
    expect(res.body.eligible).toBe(true)
    expect(res.body.listing_count).toBe(20)
  })

  it('bulk change-owner rejects recipient outside active tenant', async () => {
    const res = await request(buildApp())
      .post('/api/properties/bulk/change-owner')
      .send({ ids: ['p1'], owner_user_id: 'outsider-1' })
    expect(res.status).toBe(403)
    expect(res.body.error).toMatch(/not a member/i)
    expect(dal.update).not.toHaveBeenCalled()
    expect(dal.query).not.toHaveBeenCalled()
  })

  it('bulk change-owner succeeds for same-tenant recipient and writes audit', async () => {
    dal.findOne.mockImplementation(async (collection, filter) => {
      if (collection === 'tenant_memberships') {
        const rows = [
          {
            id: 'mem-1',
            user_id: 'user-1',
            tenant_id: 'personal:user-1',
            status: 'active',
            data: {},
            updated_at: '2026-09-01T00:00:00.000Z',
          },
          {
            id: 'mem-2',
            user_id: 'user-2',
            tenant_id: 'personal:user-1',
            status: 'active',
            data: {},
          },
        ]
        return rows.find((row) => filter(row)) || null
      }
      return null
    })

    const res = await request(buildApp())
      .post('/api/properties/bulk/change-owner')
      .send({ ids: ['p1'], owner_user_id: 'user-2' })
    expect(res.status).toBe(200)
    expect(res.body.updated).toEqual(['p1'])
    expect(dal.transaction).toHaveBeenCalled()
    // mapOwnedProperties also uses query() for ownership SELECT — isolate audit INSERT.
    const auditCalls = dal.query.mock.calls.filter(
      ([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO public.audit_log'),
    )
    expect(auditCalls).toHaveLength(1)
    const [, auditParams] = auditCalls[0]
    expect(auditParams).toEqual(
      expect.arrayContaining([
        expect.any(String),
        'user-1',
        'personal:user-1',
        'property_bulk',
        'change_owner',
        'property',
        'p1',
      ]),
    )
    const metadata = auditParams.find((p) => p && typeof p === 'object' && p.batch_id)
    expect(metadata).toEqual(expect.objectContaining({
      actor_user_id: 'user-1',
      owner_user_id: 'user-2',
      batch_id: expect.any(String),
      before: expect.objectContaining({ agent_id: 'user-1' }),
      after: expect.objectContaining({ agent_id: 'user-2' }),
    }))
  })

  it('bulk archive writes per-property audit rows in one txn-wrapped INSERT', async () => {
    const res = await request(buildApp())
      .post('/api/properties/bulk/archive')
      .send({ ids: ['p1', 'p2'] })
    expect(res.status).toBe(200)
    expect(res.body.updated).toEqual(['p1', 'p2'])
    expect(dal.transaction).toHaveBeenCalled()
    // Ownership SELECT (#167) + one multi-row audit INSERT (#161) — not a single query().
    const auditCalls = dal.query.mock.calls.filter(
      ([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO public.audit_log'),
    )
    expect(auditCalls).toHaveLength(1)
    const [sql, params] = auditCalls[0]
    expect(sql).toContain('INSERT INTO public.audit_log')
    // One value-group per property id (shared batch_id across rows).
    expect(sql.match(/\(\$/g)?.length).toBe(2)
    expect(params.filter((p) => p === 'p1' || p === 'p2')).toEqual(['p1', 'p2'])
    expect(params).toContain('personal:user-1')
    const metadatas = params.filter((p) => p && typeof p === 'object' && p.batch_id)
    expect(metadatas).toHaveLength(2)
    expect(metadatas[0].batch_id).toBe(metadatas[1].batch_id)
    expect(metadatas[0]).toEqual(expect.objectContaining({
      actor_user_id: 'user-1',
      after: { status: 'archived' },
    }))
  })
})
