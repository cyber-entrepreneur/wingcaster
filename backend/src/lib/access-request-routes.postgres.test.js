/**
 * SHR-ERR-002 access-request routes — Real-Postgres tenant-isolation proof.
 *
 * `access_requests` has no row-level security (it is reached through the legacy
 * app role, not the Growth-OS tenant layer), so its isolation is enforced
 * entirely by owner-scoped SQL in the route handlers — every read is keyed on
 * the authenticated `req.user.id` and pushed down to the database rather than
 * loading the table and filtering in JS.
 *
 * This test runs the real handlers against a real Postgres database and proves
 * the guarantee that matters: user A can never read user B's access requests,
 * through GET /mine (list scoping) or GET /:id (leak-safe 404). It fails if a
 * future change ever reintroduces a full-table load + JS filter that returns
 * another user's row.
 */
import express from 'express'
import request from 'supertest'
import { randomUUID } from 'node:crypto'
import { afterEach, expect, it } from 'vitest'
import { closeDb, configure, insert } from '../db.js'
import { skipIfNoPostgres, withTestDb } from '../testing/postgres.js'
import { registerRoutes } from './access-request-routes.js'

/** Build an app whose auth middleware authenticates as the given user. */
function appAs(user) {
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

async function seedRequest({ id, requesterId, scope = 'platform', createdAt }) {
  await insert('access_requests', {
    id,
    requester_id: requesterId,
    requester_name: `User ${requesterId}`,
    scope,
    agency_id: null,
    resource_type: null,
    resource_id: null,
    area_label: 'Some area',
    reason: null,
    status: 'open',
    created_at: createdAt,
    updated_at: createdAt,
  })
}

afterEach(async () => {
  await closeDb()
})

skipIfNoPostgres()('SHR-ERR-002 access-request routes (Real-PG)', () => {
  it('user A cannot read user B\'s access requests', async () => {
    await withTestDb(async (databaseUrl) => {
      configure({ databaseUrl, force: true })

      const userA = { id: `usr-a-${randomUUID()}`, name: 'Alice' }
      const userB = { id: `usr-b-${randomUUID()}`, name: 'Bob' }

      const aReq = `ar-a-${randomUUID()}`
      const bReq = `ar-b-${randomUUID()}`
      await seedRequest({ id: aReq, requesterId: userA.id, createdAt: '2026-01-01T00:00:00Z' })
      await seedRequest({ id: bReq, requesterId: userB.id, createdAt: '2026-02-01T00:00:00Z' })

      const asA = appAs(userA)

      // GET /mine — A sees only A's row, never B's, even though both exist.
      const mine = await request(asA).get('/api/access-requests/mine')
      expect(mine.status).toBe(200)
      const ids = mine.body.requests.map((r) => r.id)
      expect(ids).toEqual([aReq])
      expect(ids).not.toContain(bReq)

      // GET /:id — A can read A's own request...
      const own = await request(asA).get(`/api/access-requests/${aReq}`)
      expect(own.status).toBe(200)
      expect(own.body.request.id).toBe(aReq)

      // ...but B's request is a leak-safe 404, indistinguishable from a
      // non-existent one, and never leaks B's identity or existence.
      const others = await request(asA).get(`/api/access-requests/${bReq}`)
      expect(others.status).toBe(404)
      expect(JSON.stringify(others.body)).not.toContain(userB.id)

      // And symmetrically B sees only B's row.
      const asB = appAs(userB)
      const mineB = await request(asB).get('/api/access-requests/mine')
      expect(mineB.status).toBe(200)
      expect(mineB.body.requests.map((r) => r.id)).toEqual([bReq])
    })
  })
})
