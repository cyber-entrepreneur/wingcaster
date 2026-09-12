import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import request from 'supertest'
import { expect, it } from 'vitest'
import { finPostgresSuite } from '../../fin/testing/suite.js'
import { createAgentAccount, findUserById } from '../../identity.js'
import {
  authMiddleware,
  issueAuthToken,
  signElevatedToken,
  ELEVATION_HEADER,
  verifyToken,
} from '../../auth.js'
import { query } from '../../db.js'
import { registerSessionRoutes } from './session-routes.js'

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../../persistence/migrations')

const CHROME_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
const FIREFOX_WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0'

function buildApp() {
  const app = express()
  app.use(express.json())
  registerSessionRoutes(app)
  app.get('/protected', authMiddleware, (req, res) => {
    res.json({ ok: true, session_id: req.user.session_id })
  })
  return app
}

function reqLike({ ua = CHROME_MAC, ip = '192.0.2.42' } = {}) {
  return {
    get: (name) => (String(name).toLowerCase() === 'user-agent' ? ua : undefined),
    headers: { 'user-agent': ua, 'x-forwarded-for': ip },
    ip,
  }
}

async function seedUser() {
  const userId = randomUUID()
  const now = new Date().toISOString()
  const email = `sess-${userId}@x.test`
  await createAgentAccount({
    user: {
      id: userId,
      email,
      name: 'Session Tester',
      password_hash: 'x',
      role: 'agent',
      verified: true,
      verified_at: now,
      token_version: 0,
    },
    agent: {
      id: userId,
      email,
      name: 'Session Tester',
    },
  })
  return { userId, email, verified_at: now }
}

async function loginAs(userId, { ua, ip } = {}) {
  const user = await findUserById(userId)
  const token = await issueAuthToken(user, {}, { req: reqLike({ ua, ip }) })
  return { token, claims: verifyToken(token) }
}

finPostgresSuite('user_sessions + sign-out-everywhere', { seed: false }, ({ pool }) => {
  it('migration 339 creates user_sessions with the SET-004 columns', async () => {
    const table = await pool().query(`SELECT to_regclass('public.user_sessions') AS t`)
    expect(table.rows[0].t).toBeTruthy()

    const cols = await pool().query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'user_sessions'`,
    )
    const names = cols.rows.map((r) => r.column_name)
    expect(names).toEqual(expect.arrayContaining([
      'id', 'user_id', 'jwt_jti', 'device_summary', 'device_kind',
      'ip', 'ip_country_iso', 'ip_country', 'ip_city',
      'created_at', 'last_active_at', 'revoked_at',
    ]))

    const idx = await pool().query(
      `SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'user_sessions'`,
    )
    expect(idx.rows.map((r) => r.indexname)).toEqual(expect.arrayContaining([
      'idx_user_sessions_user',
      'idx_user_sessions_jti',
    ]))
  })

  it('migration 339 is idempotent', async () => {
    const sql = await readFile(join(migrationsDir, '339_user_sessions.sql'), 'utf8')
    await pool().query(sql)
    await pool().query(sql)
    const table = await pool().query(`SELECT to_regclass('public.user_sessions') AS t`)
    expect(table.rows[0].t).toBeTruthy()
  })

  it('issues a session row on login-shaped token mint and lists it as current', async () => {
    const { userId } = await seedUser()
    const { token, claims } = await loginAs(userId)
    expect(claims.session_id).toBeTruthy()
    expect(claims.jti).toBe(claims.session_id)

    const rows = await query('SELECT * FROM public.user_sessions WHERE user_id = $1', [userId])
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe(claims.session_id)
    expect(rows[0].jwt_jti).toBe(claims.session_id)
    expect(rows[0].device_kind).toBe('desktop')
    expect(rows[0].device_summary).toMatch(/Chrome 141 on macOS/)
    expect(rows[0].ip).toBe('192.0.2.42')
    expect(rows[0].ip_city).toBeNull()
    expect(rows[0].ip_country).toBeNull()
    expect(rows[0].revoked_at).toBeNull()

    const app = buildApp()
    const listed = await request(app)
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${token}`)
    expect(listed.status).toBe(200)
    expect(listed.body.sessions).toHaveLength(1)
    expect(listed.body.sessions[0]).toMatchObject({
      id: claims.session_id,
      is_current: true,
      device_kind: 'desktop',
      ip: '192.0.2.42',
      ip_city: null,
      ip_country: null,
    })
  })

  it('deleting another session kills that JWT and leaves the current session working', async () => {
    const { userId } = await seedUser()
    const current = await loginAs(userId, { ua: CHROME_MAC, ip: '192.0.2.42' })
    const other = await loginAs(userId, { ua: FIREFOX_WIN, ip: '203.0.113.7' })
    expect(current.claims.session_id).not.toBe(other.claims.session_id)

    const app = buildApp()
    const listed = await request(app)
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${current.token}`)
    expect(listed.status).toBe(200)
    expect(listed.body.sessions).toHaveLength(2)
    const currentRow = listed.body.sessions.find((s) => s.is_current)
    const otherRow = listed.body.sessions.find((s) => !s.is_current)
    expect(currentRow.id).toBe(current.claims.session_id)
    expect(otherRow.id).toBe(other.claims.session_id)

    const revoked = await request(app)
      .delete(`/api/auth/sessions/${other.claims.session_id}`)
      .set('Authorization', `Bearer ${current.token}`)
    expect(revoked.status).toBe(200)
    expect(revoked.body).toMatchObject({ ok: true, id: other.claims.session_id })

    const otherDead = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${other.token}`)
    expect(otherDead.status).toBe(401)
    expect(otherDead.body).toMatchObject({ code: 'SESSION_REVOKED' })

    const currentLive = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${current.token}`)
    expect(currentLive.status).toBe(200)
    expect(currentLive.body.session_id).toBe(current.claims.session_id)
  })

  it('sign-out-everywhere (elevated) revokes others and keeps the current JWT valid', async () => {
    const { userId } = await seedUser()
    const current = await loginAs(userId, { ua: CHROME_MAC, ip: '192.0.2.42' })
    const other = await loginAs(userId, { ua: FIREFOX_WIN, ip: '203.0.113.7' })
    const elevation = signElevatedToken({ userId, tokenVersion: 0 })

    const app = buildApp()
    const bulk = await request(app)
      .delete('/api/auth/sessions/all-except-current')
      .set('Authorization', `Bearer ${current.token}`)
      .set(ELEVATION_HEADER, elevation)
    expect(bulk.status).toBe(200)
    expect(bulk.body).toMatchObject({ revoked: 1 })

    expect((await request(app).get('/protected').set('Authorization', `Bearer ${other.token}`)).status).toBe(401)
    expect((await request(app).get('/protected').set('Authorization', `Bearer ${current.token}`)).status).toBe(200)

    const listed = await request(app)
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${current.token}`)
    expect(listed.body.sessions).toHaveLength(1)
    expect(listed.body.sessions[0].is_current).toBe(true)
  })

  it('POST /api/auth/sign-out-everywhere is an elevated alias of all-except-current', async () => {
    const { userId } = await seedUser()
    const current = await loginAs(userId)
    const other = await loginAs(userId, { ua: FIREFOX_WIN, ip: '203.0.113.7' })
    const elevation = signElevatedToken({ userId, tokenVersion: 0 })

    const app = buildApp()
    const bulk = await request(app)
      .post('/api/auth/sign-out-everywhere')
      .set('Authorization', `Bearer ${current.token}`)
      .set(ELEVATION_HEADER, elevation)
    expect(bulk.status).toBe(200)
    expect(bulk.body.revoked).toBe(1)

    expect((await request(app).get('/protected').set('Authorization', `Bearer ${other.token}`)).body.code).toBe('SESSION_REVOKED')
    expect((await request(app).get('/protected').set('Authorization', `Bearer ${current.token}`)).status).toBe(200)
  })

  it('un-elevated all-except-current is 401 step_up_required', async () => {
    const { userId } = await seedUser()
    const current = await loginAs(userId)
    const app = buildApp()
    const res = await request(app)
      .delete('/api/auth/sessions/all-except-current')
      .set('Authorization', `Bearer ${current.token}`)
    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ code: 'step_up_required' })
  })

  it('token_version bump still invalidates even when the session row is not revoked', async () => {
    const { userId } = await seedUser()
    const current = await loginAs(userId)
    await query(
      `UPDATE public.users
          SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{token_version}', '1'::jsonb, true)
        WHERE id = $1`,
      [userId],
    )
    const stillActive = await query(
      `SELECT revoked_at FROM public.user_sessions WHERE id = $1`,
      [current.claims.session_id],
    )
    expect(stillActive[0].revoked_at).toBeNull()

    const app = buildApp()
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${current.token}`)
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/sign in again/i)
  })

  it('user_sessions.user_id is ON DELETE CASCADE', async () => {
    const def = await pool().query(
      `SELECT pg_get_constraintdef(oid) AS def
         FROM pg_constraint
        WHERE conrelid = 'public.user_sessions'::regclass
          AND contype = 'f'`,
    )
    expect(def.rows.some((r) => /user_id/i.test(r.def) && /ON DELETE CASCADE/i.test(r.def))).toBe(true)
  })
})
