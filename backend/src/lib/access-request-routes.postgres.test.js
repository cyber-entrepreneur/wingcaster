/**
 * SHR-ERR-002 — Real-Postgres coverage for access-request routes.
 *
 * Proves migration 810 creates public.access_requests and that owner-scoped
 * SQL prevents user A from reading user B's requests (GET /mine and GET /:id).
 */
import { randomUUID } from 'node:crypto'
import express from 'express'
import request from 'supertest'
import { expect, it } from 'vitest'
import { finPostgresSuite } from '../fin/testing/suite.js'
import { createAgentAccount } from '../identity.js'
import { authMiddleware, signToken } from '../auth.js'
import { registerRoutes } from './access-request-routes.js'

async function agentSession({ name = 'Requester' } = {}) {
  const userId = randomUUID()
  const now = new Date().toISOString()
  const email = `access-${userId.slice(0, 8)}@x.test`
  await createAgentAccount({
    user: {
      id: userId,
      email,
      name,
      password_hash: 'x',
      role: 'agent',
      verified: true,
      verified_at: now,
    },
    agent: { id: userId, email, name },
  })
  const token = signToken({
    id: userId,
    email,
    name,
    token_version: 0,
    verified_at: now,
  })
  return { userId, token, email, name }
}

function makeApp() {
  const app = express()
  app.use(express.json())
  registerRoutes(app, { authMiddleware })
  return app
}

finPostgresSuite('access-request routes (SHR-ERR-002)', { seed: false }, ({ pool }) => {
  it('migration 810 creates public.access_requests', async () => {
    const table = await pool().query(`SELECT to_regclass('public.access_requests') AS t`)
    expect(table.rows[0].t).toBeTruthy()

    const cols = await pool().query(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'access_requests'`,
    )
    const names = new Set(cols.rows.map((r) => r.column_name))
    for (const required of [
      'id', 'requester_id', 'requester_name', 'scope', 'agency_id', 'resource_type',
      'resource_id', 'area_label', 'reason', 'status', 'created_at', 'updated_at', 'data',
    ]) {
      expect(names.has(required), `missing column ${required}`).toBe(true)
    }
  })

  it('user A cannot read user B access requests via GET /mine or GET /:id', async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-access-request'
    const userA = await agentSession({ name: 'User A' })
    const userB = await agentSession({ name: 'User B' })
    const app = makeApp()

    const filed = await request(app)
      .post('/api/access-requests')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ scope: 'platform', area_label: 'Fin overview' })
      .expect(201)

    const requestId = filed.body.request.id
    expect(requestId).toBeTruthy()

    const mineB = await request(app)
      .get('/api/access-requests/mine')
      .set('Authorization', `Bearer ${userB.token}`)
      .expect(200)
    expect(mineB.body.requests).toEqual([])

    const byIdB = await request(app)
      .get(`/api/access-requests/${requestId}`)
      .set('Authorization', `Bearer ${userB.token}`)
      .expect(404)
    expect(byIdB.body.error).toMatch(/not found/i)

    const mineA = await request(app)
      .get('/api/access-requests/mine')
      .set('Authorization', `Bearer ${userA.token}`)
      .expect(200)
    expect(mineA.body.requests).toHaveLength(1)
    expect(mineA.body.requests[0].id).toBe(requestId)

    const byIdA = await request(app)
      .get(`/api/access-requests/${requestId}`)
      .set('Authorization', `Bearer ${userA.token}`)
      .expect(200)
    expect(byIdA.body.request.id).toBe(requestId)

    const rows = await pool().query(
      `SELECT requester_id FROM public.access_requests WHERE id = $1`,
      [requestId],
    )
    expect(rows.rows[0].requester_id).toBe(userA.userId)
  })

  it('re-filing the same open request is idempotent in Postgres', async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-access-request'
    const user = await agentSession({ name: 'Idempotent User' })
    const app = makeApp()

    const first = await request(app)
      .post('/api/access-requests')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ scope: 'platform', area_label: 'Tenants' })
      .expect(201)

    const second = await request(app)
      .post('/api/access-requests')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ scope: 'platform', area_label: 'Tenants again' })
      .expect(200)

    expect(second.body.already_requested).toBe(true)
    expect(second.body.request.id).toBe(first.body.request.id)

    const count = await pool().query(
      `SELECT COUNT(*)::int AS n FROM public.access_requests WHERE requester_id = $1`,
      [user.userId],
    )
    expect(count.rows[0].n).toBe(1)
  })
})
