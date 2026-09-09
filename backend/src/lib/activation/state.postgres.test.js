import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import request from 'supertest'
import { expect, it } from 'vitest'
import { finPostgresSuite } from '../../fin/testing/suite.js'
import { createAgentAccount } from '../../identity.js'
import { signToken } from '../../auth.js'
import { query } from '../../db.js'
import { registerRoutes } from './routes.js'
import {
  completeActivationStep,
  getActivationState,
  seedActivationContext,
} from './state.js'
import { ACTIVATION_STEP_IDS } from './steps.js'

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../../persistence/migrations')

function buildApp() {
  const app = express()
  app.use(express.json())
  registerRoutes(app)
  return app
}

async function agentSession({ countryCode = 'AE', name = 'Activate' } = {}) {
  const userId = randomUUID()
  const now = new Date().toISOString()
  const email = `act-${userId}@x.test`
  await createAgentAccount({
    user: {
      id: userId,
      email,
      name,
      password_hash: 'x',
      role: 'agent',
      verified: true,
      verified_at: now,
      iso_country: countryCode,
      country_code: countryCode,
    },
    agent: {
      id: userId,
      email,
      name,
      iso_country: countryCode,
      country_code: countryCode,
    },
  })
  const token = signToken({
    id: userId,
    email,
    name,
    token_version: 0,
    verified_at: now,
  })
  return { userId, token, email }
}

finPostgresSuite('activation state + onboarding_events', { seed: false }, ({ pool }) => {
  it('migration 334 creates onboarding_events and agent_activation_state', async () => {
    const events = await pool().query(`SELECT to_regclass('public.onboarding_events') AS t`)
    expect(events.rows[0].t).toBeTruthy()
    const state = await pool().query(`SELECT to_regclass('public.agent_activation_state') AS t`)
    expect(state.rows[0].t).toBeTruthy()

    const eventCols = await pool().query(
      `SELECT column_name, data_type
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'onboarding_events'
        ORDER BY ordinal_position`,
    )
    const eventByName = Object.fromEntries(eventCols.rows.map((r) => [r.column_name, r]))
    expect(eventByName.user_id).toBeTruthy()
    expect(eventByName.family).toBeTruthy()
    expect(eventByName.event_type).toBeTruthy()
    expect(eventByName.step_id).toBeTruthy()
    expect(eventByName.completed_via).toBeTruthy()
    expect(eventByName.metadata.data_type).toBe('jsonb')
    expect(eventByName.created_at).toBeTruthy()

    const idx = await pool().query(
      `SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'onboarding_events'`,
    )
    const names = idx.rows.map((r) => r.indexname)
    expect(names).toEqual(expect.arrayContaining([
      'idx_onboarding_events_user_created',
      'idx_onboarding_events_user_step',
    ]))
  })

  it('migration 334 is idempotent', async () => {
    const sql = await readFile(join(migrationsDir, '334_onboarding_events.sql'), 'utf8')
    await pool().query(sql)
    await pool().query(sql)
    const table = await pool().query(`SELECT to_regclass('public.onboarding_events') AS t`)
    expect(table.rows[0].t).toBeTruthy()
  })

  it('GET activation_state returns contract shape with five steps', async () => {
    const { userId, token } = await agentSession()
    await seedActivationContext(userId, { signup_path: 'solo', country_code: 'AE' })
    const app = buildApp()
    const res = await request(app)
      .get('/api/agent/activation_state')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.user_id).toBe(userId)
    expect(res.body.tenant_id).toBe(`personal:${userId}`)
    expect(res.body.signup_path).toBe('solo')
    expect(res.body.country_code).toBe('AE')
    expect(res.body.total_count).toBe(5)
    expect(res.body.completed_count).toBe(0)
    expect(res.body.steps).toHaveLength(5)
    expect(res.body.steps.map((s) => s.id)).toEqual([...ACTIVATION_STEP_IDS])
    for (const step of res.body.steps) {
      expect(step).toMatchObject({
        id: expect.any(String),
        order: expect.any(Number),
        state: expect.stringMatching(/^(complete|in_progress|not_started|deferred|locked)$/),
        sub_route: expect.stringMatching(/^\/activate\//),
      })
      expect(Object.prototype.hasOwnProperty.call(step, 'completed_at')).toBe(true)
      expect(Object.prototype.hasOwnProperty.call(step, 'completed_via')).toBe(true)
    }
    const invite = res.body.steps.find((s) => s.id === 'invite_team')
    expect(invite.state).toBe('locked')
  })

  it('solo locks invite_team; join/agency unlocks it', async () => {
    const { userId, token } = await agentSession()
    const app = buildApp()

    await seedActivationContext(userId, { signup_path: 'solo', country_code: 'AE' })
    const solo = await request(app)
      .get('/api/agent/activation_state')
      .set('Authorization', `Bearer ${token}`)
    expect(solo.body.steps.find((s) => s.id === 'invite_team').state).toBe('locked')

    await seedActivationContext(userId, { signup_path: 'join' })
    const join = await request(app)
      .get('/api/agent/activation_state')
      .set('Authorization', `Bearer ${token}`)
    expect(join.body.steps.find((s) => s.id === 'invite_team').state).toBe('not_started')

    await seedActivationContext(userId, { signup_path: 'agency' })
    const agency = await request(app)
      .get('/api/agent/activation_state')
      .set('Authorization', `Bearer ${token}`)
    expect(agency.body.steps.find((s) => s.id === 'invite_team').state).toBe('not_started')
  })

  it('portal_credentials locks when country has no portal_registry rows', async () => {
    const { userId, token } = await agentSession({ countryCode: 'ZZ' })
    await seedActivationContext(userId, { signup_path: 'solo', country_code: 'ZZ' })
    const app = buildApp()
    const res = await request(app)
      .get('/api/agent/activation_state')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.steps.find((s) => s.id === 'portal_credentials').state).toBe('locked')
  })

  it('complete / defer round-trip appends events and updates counts', async () => {
    const { userId, token } = await agentSession()
    await seedActivationContext(userId, { signup_path: 'agency', country_code: 'AE' })
    const app = buildApp()

    const completed = await request(app)
      .post('/api/agent/activation_state/complete')
      .set('Authorization', `Bearer ${token}`)
      .send({ step_id: 'whatsapp', completed_via: 'onboarding' })
    expect(completed.status).toBe(200)
    const wa = completed.body.steps.find((s) => s.id === 'whatsapp')
    expect(wa.state).toBe('complete')
    expect(wa.completed_via).toBe('onboarding')
    expect(wa.completed_at).toBeTruthy()
    expect(completed.body.completed_count).toBe(1)

    const deferred = await request(app)
      .post('/api/agent/activation_state/defer')
      .set('Authorization', `Bearer ${token}`)
      .send({ step_id: 'working_hours' })
    expect(deferred.status).toBe(200)
    expect(deferred.body.steps.find((s) => s.id === 'working_hours').state).toBe('deferred')
    expect(deferred.body.completed_count).toBe(1)

    const got = await request(app)
      .get('/api/agent/activation_state')
      .set('Authorization', `Bearer ${token}`)
    expect(got.body.completed_count).toBe(1)
    expect(got.body.steps.find((s) => s.id === 'whatsapp').state).toBe('complete')
    expect(got.body.steps.find((s) => s.id === 'working_hours').state).toBe('deferred')

    const events = await query(
      `SELECT event_type, step_id, completed_via
         FROM public.onboarding_events
        WHERE user_id = $1
        ORDER BY created_at ASC, id ASC`,
      [userId],
    )
    expect(events.map((e) => e.event_type)).toEqual(
      expect.arrayContaining(['step_complete', 'step_defer']),
    )
    expect(events.find((e) => e.event_type === 'step_complete')).toMatchObject({
      step_id: 'whatsapp',
      completed_via: 'onboarding',
    })
    expect(events.find((e) => e.event_type === 'step_defer')).toMatchObject({
      step_id: 'working_hours',
    })
  })

  it('defer does not increment completed_count; complete of locked step is 409', async () => {
    const { userId, token } = await agentSession()
    await seedActivationContext(userId, { signup_path: 'solo', country_code: 'AE' })
    const app = buildApp()

    const deferred = await request(app)
      .post('/api/agent/activation_state/defer')
      .set('Authorization', `Bearer ${token}`)
      .send({ step_id: 'first_listing' })
    expect(deferred.status).toBe(200)
    expect(deferred.body.completed_count).toBe(0)

    const locked = await request(app)
      .post('/api/agent/activation_state/complete')
      .set('Authorization', `Bearer ${token}`)
      .send({ step_id: 'invite_team', completed_via: 'direct' })
    expect(locked.status).toBe(409)
    expect(locked.body.code).toBe('STEP_LOCKED')
  })

  it('concurrent complete events all append', async () => {
    const { userId, token } = await agentSession()
    await seedActivationContext(userId, { signup_path: 'agency', country_code: 'AE' })
    const app = buildApp()

    const [a, b, c] = await Promise.all([
      request(app).post('/api/agent/activation_state/complete')
        .set('Authorization', `Bearer ${token}`)
        .send({ step_id: 'whatsapp', completed_via: 'onboarding', metadata: { n: 1 } }),
      request(app).post('/api/agent/activation_state/complete')
        .set('Authorization', `Bearer ${token}`)
        .send({ step_id: 'whatsapp', completed_via: 'direct', metadata: { n: 2 } }),
      request(app).post('/api/agent/activation_state/complete')
        .set('Authorization', `Bearer ${token}`)
        .send({ step_id: 'whatsapp', completed_via: 'dashboard_action', metadata: { n: 3 } }),
    ])
    expect([a.status, b.status, c.status]).toEqual([200, 200, 200])

    await Promise.all([
      completeActivationStep(userId, { step_id: 'first_listing', completed_via: 'direct' }),
      completeActivationStep(userId, { step_id: 'first_listing', completed_via: 'onboarding' }),
    ])

    const events = await query(
      `SELECT event_type, step_id FROM public.onboarding_events
        WHERE user_id = $1 AND event_type = 'step_complete'`,
      [userId],
    )
    expect(events.filter((e) => e.step_id === 'whatsapp')).toHaveLength(3)
    expect(events.filter((e) => e.step_id === 'first_listing')).toHaveLength(2)

    const state = await getActivationState(userId)
    expect(state.steps.find((s) => s.id === 'whatsapp').state).toBe('complete')
    expect(state.steps.find((s) => s.id === 'first_listing').state).toBe('complete')
    expect(state.completed_count).toBeGreaterThanOrEqual(2)
  })

  it('auto-completes whatsapp from active binding and first_listing from published property', async () => {
    const { userId, token } = await agentSession()
    await seedActivationContext(userId, { signup_path: 'solo', country_code: 'AE' })

    await query(
      `INSERT INTO public.user_whatsapp_bindings
         (id, user_id, phone_e164, shared_number_index, active_from)
       VALUES ($1, $2, $3, 0, NOW())`,
      [randomUUID(), userId, '+15551234567'],
    )
    await query(
      `INSERT INTO public.properties (id, agent_id, title, status, data)
       VALUES ($1, $2, 'First', 'active', '{}'::jsonb)`,
      [randomUUID(), userId],
    )

    const app = buildApp()
    const res = await request(app)
      .get('/api/agent/activation_state')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.steps.find((s) => s.id === 'whatsapp').state).toBe('complete')
    expect(res.body.steps.find((s) => s.id === 'whatsapp').completed_via).toBe('whatsapp_intake')
    expect(res.body.steps.find((s) => s.id === 'first_listing').state).toBe('complete')
    expect(res.body.completed_count).toBeGreaterThanOrEqual(2)

    const autoEvents = await query(
      `SELECT step_id, event_type FROM public.onboarding_events
        WHERE user_id = $1 AND event_type = 'auto_complete'`,
      [userId],
    )
    expect(autoEvents.map((e) => e.step_id).sort()).toEqual(['first_listing', 'whatsapp'])
  })

  it('POST onboarding-events returns 202 on both paths', async () => {
    const { userId, token } = await agentSession()
    const app = buildApp()

    const me = await request(app)
      .post('/api/users/me/onboarding-events')
      .set('Authorization', `Bearer ${token}`)
      .send({ event: 'tour_step_viewed', tour_step: 'whatsapp_qr', family: 'wlb' })
    expect(me.status).toBe(202)
    expect(me.body).toEqual({ accepted: true })

    const alias = await request(app)
      .post('/api/agent/onboarding-events')
      .set('Authorization', `Bearer ${token}`)
      .send({ event: 'tour_dismissed', tour_step: 2 })
    expect(alias.status).toBe(202)

    const rows = await query(
      `SELECT family, event_type, step_id, metadata
         FROM public.onboarding_events
        WHERE user_id = $1
        ORDER BY created_at ASC`,
      [userId],
    )
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      family: 'wlb',
      event_type: 'tour_step_viewed',
      step_id: 'whatsapp_qr',
    })
    expect(rows[0].metadata.tour_step).toBe('whatsapp_qr')
    expect(rows[1].event_type).toBe('tour_dismissed')
  })

  it('rejects unauthenticated and invalid bodies', async () => {
    const app = buildApp()
    expect((await request(app).get('/api/agent/activation_state')).status).toBe(401)
    expect(
      (await request(app).post('/api/agent/activation_state/complete').send({ step_id: 'whatsapp' })).status,
    ).toBe(401)

    const { token } = await agentSession()
    const badStep = await request(app)
      .post('/api/agent/activation_state/complete')
      .set('Authorization', `Bearer ${token}`)
      .send({ step_id: 'not_a_step' })
    expect(badStep.status).toBe(400)

    const emptyTour = await request(app)
      .post('/api/users/me/onboarding-events')
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(emptyTour.status).toBe(400)
  })

  it('does not break agent_onboarding_state table or routes', async () => {
    const table = await pool().query(`SELECT to_regclass('public.agent_onboarding_state') AS t`)
    expect(table.rows[0].t).toBeTruthy()
    // Activation module must not register /api/user/onboarding-state.
    const app = buildApp()
    const res = await request(app).get('/api/user/onboarding-state')
    expect(res.status).toBe(404)
  })
})
