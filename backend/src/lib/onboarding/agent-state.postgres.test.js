import { randomUUID } from 'node:crypto'
import express from 'express'
import request from 'supertest'
import { expect, it } from 'vitest'
import { finPostgresSuite } from '../../fin/testing/suite.js'
import { createAgentAccount } from '../../identity.js'
import { signToken } from '../../auth.js'
import { query } from '../../db.js'
import {
  patchAgentOnboardingState,
  registerRoutes,
} from './agent-state.js'

function buildApp() {
  const app = express()
  app.use(express.json())
  registerRoutes(app)
  return app
}

async function agentSession() {
  const userId = randomUUID()
  const now = new Date().toISOString()
  const email = `ob-${userId}@x.test`
  await createAgentAccount({
    user: {
      id: userId,
      email,
      name: 'Onboard',
      password_hash: 'x',
      role: 'agent',
      verified: true,
      verified_at: now,
    },
    agent: { id: userId, email, name: 'Onboard' },
  })
  const token = signToken({
    id: userId,
    email,
    name: 'Onboard',
    token_version: 0,
    verified_at: now,
  })
  return { userId, token }
}

finPostgresSuite('agent onboarding state', { seed: false }, ({ pool }) => {
  it('migration creates agent_onboarding_state with user_id PK', async () => {
    const table = await pool().query(`SELECT to_regclass('public.agent_onboarding_state') AS t`)
    expect(table.rows[0].t).toBeTruthy()
    const cols = await pool().query(
      `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'agent_onboarding_state'
        ORDER BY ordinal_position`,
    )
    const byName = Object.fromEntries(cols.rows.map((r) => [r.column_name, r]))
    expect(byName.user_id).toBeTruthy()
    expect(byName.step).toBeTruthy()
    expect(byName.path).toBeTruthy()
    expect(byName.checklist.data_type).toBe('jsonb')
    expect(byName.dismissed_forever).toBeTruthy()
    expect(byName.updated_at).toBeTruthy()
    const pk = await pool().query(`
      SELECT a.attname
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
       WHERE i.indrelid = 'public.agent_onboarding_state'::regclass
         AND i.indisprimary
    `)
    expect(pk.rows.map((r) => r.attname)).toEqual(['user_id'])
  })

  it('GET before write returns default and does not insert a row', async () => {
    const { userId, token } = await agentSession()
    const app = buildApp()
    const res = await request(app)
      .get('/api/user/onboarding-state')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      step: 'welcome',
      path: null,
      checklist: {},
      dismissed_forever: false,
    })
    const rows = await query(
      'SELECT user_id FROM public.agent_onboarding_state WHERE user_id = $1',
      [userId],
    )
    expect(rows).toHaveLength(0)
  })

  it('PATCH persists and GET returns stored state', async () => {
    const { userId, token } = await agentSession()
    const app = buildApp()
    const patched = await request(app)
      .patch('/api/user/onboarding-state')
      .set('Authorization', `Bearer ${token}`)
      .send({
        step: 'choose_path',
        path: 'seller',
        checklist_delta: { profile: true },
        dismissed_forever: false,
      })
    expect(patched.status).toBe(200)
    expect(patched.body).toMatchObject({
      step: 'choose_path',
      path: 'seller',
      checklist: { profile: true },
      dismissed_forever: false,
    })

    const got = await request(app)
      .get('/api/user/onboarding-state')
      .set('Authorization', `Bearer ${token}`)
    expect(got.status).toBe(200)
    expect(got.body).toEqual(patched.body)

    const row = await query(
      `SELECT step, path, checklist, dismissed_forever FROM public.agent_onboarding_state WHERE user_id = $1`,
      [userId],
    )
    expect(row[0].step).toBe('choose_path')
    expect(row[0].checklist).toEqual({ profile: true })

    const second = await request(app)
      .patch('/api/user/onboarding-state')
      .set('Authorization', `Bearer ${token}`)
      .send({ checklist_delta: { notifications: true } })
    expect(second.status).toBe(200)
    expect(second.body.step).toBe('choose_path')
    expect(second.body.path).toBe('seller')
    expect(second.body.checklist).toEqual({ profile: true, notifications: true })
  })

  it('concurrent PATCHes merge checklist_delta safely', async () => {
    const { userId, token } = await agentSession()
    const app = buildApp()
    await request(app)
      .patch('/api/user/onboarding-state')
      .set('Authorization', `Bearer ${token}`)
      .send({ step: 'tour', checklist_delta: { base: true } })

    const [httpA, httpB, httpC] = await Promise.all([
      request(app).patch('/api/user/onboarding-state')
        .set('Authorization', `Bearer ${token}`)
        .send({ checklist_delta: { a: 1 } }),
      request(app).patch('/api/user/onboarding-state')
        .set('Authorization', `Bearer ${token}`)
        .send({ checklist_delta: { b: 2 } }),
      request(app).patch('/api/user/onboarding-state')
        .set('Authorization', `Bearer ${token}`)
        .send({ step: 'done', checklist_delta: { c: 3 } }),
    ])
    expect([httpA.status, httpB.status, httpC.status]).toEqual([200, 200, 200])

    await Promise.all([
      patchAgentOnboardingState(userId, { checklist_delta: { d: 4 } }),
      patchAgentOnboardingState(userId, { checklist_delta: { e: 5 } }),
    ])

    const got = await request(app)
      .get('/api/user/onboarding-state')
      .set('Authorization', `Bearer ${token}`)
    expect(got.status).toBe(200)
    expect(got.body.checklist).toMatchObject({
      base: true,
      a: 1,
      b: 2,
      c: 3,
      d: 4,
      e: 5,
    })
    expect(got.body.step).toBe('done')
  })

  it('rejects unauthenticated requests', async () => {
    const app = buildApp()
    const get = await request(app).get('/api/user/onboarding-state')
    expect(get.status).toBe(401)
    const patch = await request(app).patch('/api/user/onboarding-state').send({ step: 'x' })
    expect(patch.status).toBe(401)
  })

  it('rejects invalid PATCH bodies', async () => {
    const { token } = await agentSession()
    const app = buildApp()
    const asArray = await request(app)
      .patch('/api/user/onboarding-state')
      .set('Authorization', `Bearer ${token}`)
      .send({ checklist_delta: ['not-an-object'] })
    expect(asArray.status).toBe(400)
    const empty = await request(app)
      .patch('/api/user/onboarding-state')
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(empty.status).toBe(400)
  })
})
