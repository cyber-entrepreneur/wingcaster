/**
 * Real-Postgres coverage for BE-BLOCKER-10:
 *   GET /api/publishing/jobs/:id aggregation (JOIN family, no N+1)
 *   retry creates a new attempt
 *   404 leak-safe
 *   seeded publishing_job.completed push templates
 */
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
import { grant, reserve, consume } from '../credits/engine.js'
import { FEATURES } from '../credits/features.js'
import { syntheticTenantId } from '../credits/wallets.js'
import { authMiddleware } from '../../auth.js'
import { registerRoutes } from './jobs-routes.js'
import { LOAD_PUBLISHING_JOB_SQL, loadPublishingJobPayload } from './job-payload.js'
import { emitPublishingJobCompleted } from './notify-job-completed.js'

const MIGRATION_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../persistence/migrations/325_publishing_jobs.sql',
)

function buildApp() {
  const app = express()
  app.use(express.json())
  registerRoutes(app, { authMiddleware })
  return app
}

async function agentSession(label = 'pub') {
  const userId = randomUUID()
  const now = new Date().toISOString()
  const email = `${label}-${userId.slice(0, 8)}@x.test`
  await createAgentAccount({
    user: {
      id: userId,
      email,
      name: label,
      password_hash: 'x',
      role: 'agent',
      verified: true,
      verified_at: now,
    },
    agent: { id: userId, email, name: label, slug: `${label}-${userId.slice(0, 8)}` },
  })
  const token = signToken({
    id: userId,
    email,
    name: label,
    token_version: 0,
    verified_at: now,
  })
  return { userId, token, email }
}

async function seedFixture(ownerId) {
  const propertyId = randomUUID()
  const jobId = randomUUID()
  const bayutId = randomUUID()
  const olxId = randomUUID()
  const pfId = randomUUID()
  const now = new Date().toISOString()

  await query(
    `INSERT INTO public.properties (id, agent_id, title, status, data, created_at, updated_at)
     VALUES ($1, $2, 'Marina Apt', 'active', '{"short_ref":"DXB-1001"}'::jsonb, $3, $3)`,
    [propertyId, ownerId, now],
  )
  await query(
    `INSERT INTO public.publishing_jobs
       (id, property_id, agent_id, submitted_at, created_at, updated_at, data)
     VALUES ($1, $2, $3, $4, $4, $4, '{}'::jsonb)`,
    [jobId, propertyId, ownerId, now],
  )

  const dests = [
    { id: bayutId, platform: 'bayut', status: 'published', requestId: `req-${bayutId}` },
    { id: olxId, platform: 'olx', status: 'failed', requestId: `req-${olxId}` },
    { id: pfId, platform: 'property_finder', status: 'submitted', requestId: `req-${pfId}` },
  ]
  for (const dest of dests) {
    await query(
      `INSERT INTO public.distribution_jobs
         (id, property_id, agent_id, platform, status, publishing_job_id, retry_count, data, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 0, jsonb_build_object('request_id', $7::text), $8, $8)`,
      [dest.id, propertyId, ownerId, dest.platform, dest.status, jobId, dest.requestId, now],
    )
  }

  await query(
    `INSERT INTO public.distribution_attempts
       (id, distribution_job_id, status, error_class, error_message, attempted_at, data)
     VALUES
       ($1, $2, 'published', NULL, NULL, $8, '{}'::jsonb),
       ($3, $4, 'failed', 'portal_down', 'Bayut upstream 503', $8, '{}'::jsonb),
       ($5, $6, 'submitted', NULL, NULL, $8, jsonb_build_object('correlation_id', $7::text))`,
    [
      randomUUID(), bayutId,
      randomUUID(), olxId,
      randomUUID(), pfId, `corr-${pfId}`,
      now,
    ],
  )

  const tenantId = syntheticTenantId('personal', ownerId)
  await grant({
    tenantId,
    source: 'promo',
    amount: 100,
    currency: 'USD',
    grantRef: { idempotency_key: `pub-seed:${jobId}`, reason: 'test' },
  })
  await reserve({
    tenantId,
    feature: FEATURES.PUBLISHING_REALESTATE_BAYUT,
    requestId: dests[0].requestId,
    creditsAmount: 5,
  })
  await consume({
    tenantId,
    feature: FEATURES.PUBLISHING_REALESTATE_BAYUT,
    requestId: dests[0].requestId,
    callType: 'publish',
    creditsAmount: 5,
    relatedEntityType: 'distribution_job',
    relatedEntityId: bayutId,
  })
  await reserve({
    tenantId,
    feature: FEATURES.PUBLISHING_REALESTATE_PROPERTY_FINDER,
    requestId: dests[2].requestId,
    creditsAmount: 3,
  })

  return { propertyId, jobId, bayutId, olxId, pfId, tenantId }
}

finPostgresSuite('publishing job aggregation (BE-BLOCKER-10)', { seed: false }, ({ pool }) => {
  it('migration 325 creates publishing_jobs, FK, indexes, push channel, templates', async () => {
    const table = await pool().query(`SELECT to_regclass('public.publishing_jobs') AS t`)
    expect(table.rows[0].t).toBeTruthy()

    const col = await pool().query(`
      SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'distribution_jobs'
         AND column_name = 'publishing_job_id'
    `)
    expect(col.rows[0]?.column_name).toBe('publishing_job_id')

    const idx = await pool().query(`
      SELECT indexname FROM pg_indexes
       WHERE tablename IN ('publishing_jobs', 'distribution_jobs')
         AND indexname IN (
           'idx_publishing_jobs_agent_submitted',
           'idx_publishing_jobs_agent_id',
           'idx_distribution_jobs_publishing_job_id'
         )
       ORDER BY indexname
    `)
    expect(idx.rows.map((r) => r.indexname).sort()).toEqual([
      'idx_distribution_jobs_publishing_job_id',
      'idx_publishing_jobs_agent_id',
      'idx_publishing_jobs_agent_submitted',
    ])

    const check = await pool().query(`
      SELECT pg_get_constraintdef(oid) AS def
        FROM pg_constraint
       WHERE conrelid = 'public.platform_message_templates'::regclass
         AND conname = 'platform_msg_templates_channel_check'
    `)
    expect(check.rows[0]?.def).toMatch(/push/)

    const templates = await pool().query(`
      SELECT code FROM public.platform_message_templates
       WHERE code LIKE 'publishing_job.completed%'
       ORDER BY code
    `)
    expect(templates.rows.map((r) => r.code)).toEqual([
      'publishing_job.completed',
      'publishing_job.completed.all_failed',
      'publishing_job.completed.all_succeeded',
      'publishing_job.completed.in_review_only',
      'publishing_job.completed.mixed',
      'publishing_job.completed.partial',
    ])
  })

  it('migration 325 is idempotent', async () => {
    const sql = await readFile(MIGRATION_PATH, 'utf8')
    await pool().query(sql)
    await pool().query(sql)
    const n = await pool().query(
      `SELECT count(*)::int AS n FROM public.platform_message_templates
        WHERE code LIKE 'publishing_job.completed%'`,
    )
    expect(n.rows[0].n).toBe(6)
  })

  it('GET returns joined payload in one query family (no per-destination loop)', async () => {
    const { userId, token } = await agentSession('join')
    const fx = await seedFixture(userId)

    const calls = []
    const queryFn = async (sql, params) => {
      calls.push(sql)
      return query(sql, params)
    }
    const payload = await loadPublishingJobPayload(fx.jobId, userId, { queryFn })
    expect(calls).toHaveLength(1)
    expect(calls[0]).toBe(LOAD_PUBLISHING_JOB_SQL)
    expect(calls[0]).toMatch(/JOIN public\.portal_registry/i)
    expect(calls[0]).toMatch(/credit_consumptions/i)
    expect(calls[0]).toMatch(/credit_reservations/i)
    expect(calls[0]).toMatch(/JOIN LATERAL/)

    expect(payload.job.id).toBe(fx.jobId)
    expect(payload.job.listing_id).toBe(fx.propertyId)
    expect(payload.job.listing_short_ref).toBe('DXB-1001')
    expect(payload.job.aggregate).toBe('mixed')
    expect(payload.job.counts).toEqual({ succeeded: 1, in_review: 1, failed: 1, total: 3 })
    expect(payload.job.credits).toEqual({ total_charged: 5, total_reserved: 3 })
    expect(payload.destinations).toHaveLength(3)

    const byPlatform = Object.fromEntries(payload.destinations.map((d) => [d.portal.code, d]))
    expect(byPlatform.bayut).toMatchObject({
      status: 'succeeded',
      credit_charged: 5,
      retry_available: false,
      portal: expect.objectContaining({ display_name: 'Bayut' }),
    })
    expect(byPlatform.olx).toMatchObject({
      status: 'failed',
      error_class: 'PORTAL_DOWN',
      retry_available: true,
      portal: expect.objectContaining({ display_name: 'OLX' }),
    })
    expect(byPlatform.property_finder.status).toBe('in_review')
    expect(byPlatform.property_finder.credit_reserved).toBe(3)
    expect(byPlatform.property_finder.portal.all_country_codes).toEqual(
      expect.arrayContaining(['AE']),
    )
    expect(byPlatform.olx.timeline.length).toBeGreaterThanOrEqual(1)

    const app = buildApp()
    const res = await request(app)
      .get(`/api/publishing/jobs/${fx.jobId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.job.aggregate).toBe('mixed')
    expect(res.body.destinations).toHaveLength(3)
  })

  it('404 is leak-safe for another user and unknown ids', async () => {
    const owner = await agentSession('own')
    const stranger = await agentSession('str')
    const fx = await seedFixture(owner.userId)
    const app = buildApp()

    const other = await request(app)
      .get(`/api/publishing/jobs/${fx.jobId}`)
      .set('Authorization', `Bearer ${stranger.token}`)
    expect(other.status).toBe(404)
    expect(other.body).not.toMatchObject({ error: expect.stringMatching(/forbidden/i) })

    const missing = await request(app)
      .get(`/api/publishing/jobs/${randomUUID()}`)
      .set('Authorization', `Bearer ${owner.token}`)
    expect(missing.status).toBe(404)

    const retryOther = await request(app)
      .post(`/api/publishing/jobs/${fx.jobId}/destinations/${fx.olxId}/retry`)
      .set('Authorization', `Bearer ${stranger.token}`)
    expect(retryOther.status).toBe(404)
  })

  it('legacy distribution_jobs.id with no parent is a 1-destination job', async () => {
    const { userId, token } = await agentSession('leg')
    const destId = randomUUID()
    await query(
      `INSERT INTO public.distribution_jobs (id, agent_id, platform, status, data)
       VALUES ($1, $2, 'bayut', 'failed', '{}'::jsonb)`,
      [destId, userId],
    )
    await query(
      `INSERT INTO public.distribution_attempts
         (id, distribution_job_id, status, error_class, error_message, attempted_at)
       VALUES ($1, $2, 'failed', 'unknown_error', 'blip', CURRENT_TIMESTAMP)`,
      [randomUUID(), destId],
    )
    const app = buildApp()
    const res = await request(app)
      .get(`/api/publishing/jobs/${destId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.job.id).toBe(destId)
    expect(res.body.destinations).toHaveLength(1)
    expect(res.body.job.aggregate).toBe('all_failed')
    expect(res.body.destinations[0].error_class).toBe('UNKNOWN_ERROR')
    expect(res.body.destinations[0].retry_available).toBe(true)
  })

  it('retry creates a new attempt; non-retryable class is 409', async () => {
    const { userId, token } = await agentSession('rty')
    const fx = await seedFixture(userId)
    const app = buildApp()

    const before = await pool().query(
      `SELECT count(*)::int AS n FROM public.distribution_attempts WHERE distribution_job_id = $1`,
      [fx.olxId],
    )

    const retried = await request(app)
      .post(`/api/publishing/jobs/${fx.jobId}/destinations/${fx.olxId}/retry`)
      .set('Authorization', `Bearer ${token}`)
    expect(retried.status).toBe(200)
    expect(retried.body.id).toBe(fx.olxId)
    expect(retried.body.error_class).toBe('PORTAL_DOWN')

    const after = await pool().query(
      `SELECT count(*)::int AS n FROM public.distribution_attempts WHERE distribution_job_id = $1`,
      [fx.olxId],
    )
    expect(after.rows[0].n).toBe(before.rows[0].n + 1)

    const bumped = await pool().query(
      `SELECT retry_count FROM public.distribution_jobs WHERE id = $1`,
      [fx.olxId],
    )
    expect(Number(bumped.rows[0].retry_count)).toBe(1)

    const authFail = randomUUID()
    await query(
      `INSERT INTO public.distribution_jobs
         (id, agent_id, platform, status, publishing_job_id, data)
       VALUES ($1, $2, 'dubizzle', 'failed', $3, '{}'::jsonb)`,
      [authFail, userId, fx.jobId],
    )
    await query(
      `INSERT INTO public.distribution_attempts
         (id, distribution_job_id, status, error_class, error_message, attempted_at)
       VALUES ($1, $2, 'failed', 'auth_expired', 'token dead', CURRENT_TIMESTAMP)`,
      [randomUUID(), authFail],
    )
    const conflict = await request(app)
      .post(`/api/publishing/jobs/${fx.jobId}/destinations/${authFail}/retry`)
      .set('Authorization', `Bearer ${token}`)
    expect(conflict.status).toBe(409)
    expect(conflict.body.code).toBe('ERROR_CLASS_NOT_RETRYABLE')
    expect(conflict.body.error_class).toBe('AUTH_EXPIRED')
  })

  it('retry-all only retries requested transient classes', async () => {
    const { userId, token } = await agentSession('all')
    const fx = await seedFixture(userId)
    const authFail = randomUUID()
    await query(
      `INSERT INTO public.distribution_jobs
         (id, agent_id, platform, status, publishing_job_id, data)
       VALUES ($1, $2, 'dubizzle', 'failed', $3, '{}'::jsonb)`,
      [authFail, userId, fx.jobId],
    )
    await query(
      `INSERT INTO public.distribution_attempts
         (id, distribution_job_id, status, error_class, attempted_at)
       VALUES ($1, $2, 'failed', 'auth_expired', CURRENT_TIMESTAMP)`,
      [randomUUID(), authFail],
    )

    const olxBefore = await pool().query(
      `SELECT count(*)::int AS n FROM public.distribution_attempts WHERE distribution_job_id = $1`,
      [fx.olxId],
    )
    const authBefore = await pool().query(
      `SELECT count(*)::int AS n FROM public.distribution_attempts WHERE distribution_job_id = $1`,
      [authFail],
    )

    const app = buildApp()
    const res = await request(app)
      .post(`/api/publishing/jobs/${fx.jobId}/retry-all`)
      .set('Authorization', `Bearer ${token}`)
      .send({ error_classes_to_retry: ['PORTAL_DOWN', 'UNKNOWN_ERROR'] })
    expect(res.status).toBe(200)
    expect(res.body.job.id).toBe(fx.jobId)
    expect(res.body.destinations.length).toBeGreaterThanOrEqual(3)

    const olxAfter = await pool().query(
      `SELECT count(*)::int AS n FROM public.distribution_attempts WHERE distribution_job_id = $1`,
      [fx.olxId],
    )
    const authAfter = await pool().query(
      `SELECT count(*)::int AS n FROM public.distribution_attempts WHERE distribution_job_id = $1`,
      [authFail],
    )
    expect(olxAfter.rows[0].n).toBe(olxBefore.rows[0].n + 1)
    expect(authAfter.rows[0].n).toBe(authBefore.rows[0].n)
  })

  it('emitPublishingJobCompleted is callable and stamps completed_at', async () => {
    const { userId } = await agentSession('emt')
    const fx = await seedFixture(userId)
    const result = await emitPublishingJobCompleted(fx.jobId, { force: true })
    expect(result.skipped).toBe(false)
    expect(result.copy.subject).toMatch(/channels/i)
    const row = await pool().query(
      `SELECT completed_at, data->>'completed_aggregate' AS agg
         FROM public.publishing_jobs WHERE id = $1`,
      [fx.jobId],
    )
    expect(row.rows[0].completed_at).toBeTruthy()
    expect(row.rows[0].agg).toBe('mixed')
  })
})
