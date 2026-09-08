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
import { consume, grant, reserve } from '../credits/engine.js'
import { FEATURES } from '../credits/features.js'
import { registerRoutes } from './jobs-routes.js'
import { LOAD_PUBLISHING_JOB_SQL, loadPublishingJob } from './job-query.js'
import { emitPublishingJobCompleted } from './notify-job-completed.js'
import { recordDistributionAttempt } from './record-attempt.js'

const SECRET = 'publishing-jobs-pg-secret'
process.env.JWT_SECRET = SECRET

async function agentSession(label = 'pub') {
  const userId = randomUUID()
  const now = new Date().toISOString()
  const email = `${label}-${userId}@x.test`
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
    agent: { id: userId, email, name: label },
  })
  const token = signToken({
    id: userId,
    email,
    name: label,
    token_version: 0,
    verified_at: now,
  })
  return { userId, agentId: userId, token }
}

async function seedProperty(agentId) {
  const id = randomUUID()
  await query(
    `INSERT INTO public.properties (id, agent_id, title, status, canonical_id, data)
     VALUES ($1, $2, 'Hamra 2-bed', 'active', $3, '{"short_ref":"WC-HAMRA"}'::jsonb)`,
    [id, agentId, `can-${id.slice(0, 8)}`],
  )
  return id
}

async function seedJobWithDestinations({ agentId, propertyId, tenantId }) {
  const jobId = randomUUID()
  const destBayut = randomUUID()
  const destOlx = randomUUID()
  const destPf = randomUUID()
  const reqBayut = `req-bayut-${destBayut}`
  const reqOlx = `req-olx-${destOlx}`

  await query(
    `INSERT INTO public.publishing_jobs
       (id, property_id, agent_id, submitted_at, data)
     VALUES ($1, $2, $3, NOW() - interval '5 minutes', '{}'::jsonb)`,
    [jobId, propertyId, agentId],
  )

  await query(
    `INSERT INTO public.distribution_jobs
       (id, property_id, agent_id, publishing_job_id, platform, status, payload, retry_count, data)
     VALUES
       ($1, $4, $5, $6, 'bayut', 'published', '{"live_url":"https://bayut.example/listing/1"}'::jsonb, 0,
        jsonb_build_object('request_id', $7::text, 'correlation_id', 'corr-bayut')),
       ($2, $4, $5, $6, 'olx', 'failed', '{}'::jsonb, 1,
        jsonb_build_object('request_id', $8::text, 'correlation_id', 'corr-olx')),
       ($3, $4, $5, $6, 'property_finder', 'submitted', '{}'::jsonb, 0,
        jsonb_build_object('correlation_id', 'corr-pf'))`,
    [destBayut, destOlx, destPf, propertyId, agentId, jobId, reqBayut, reqOlx],
  )

  await recordDistributionAttempt({
    distributionJobId: destBayut,
    status: 'published',
    response: { live_url: 'https://bayut.example/listing/1' },
  })
  await recordDistributionAttempt({
    distributionJobId: destOlx,
    status: 'failed',
    error: { status: 503, message: 'Service Unavailable' },
  })
  await recordDistributionAttempt({
    distributionJobId: destPf,
    status: 'submitted',
    extra: { queued: true },
  })

  await consume({
    tenantId,
    feature: FEATURES.PUBLISHING_REALESTATE_BAYUT,
    requestId: reqBayut,
    callType: 'publish',
    creditsAmount: 10,
    relatedEntityType: 'distribution_job',
    relatedEntityId: destBayut,
  })
  await reserve({
    tenantId,
    feature: FEATURES.PUBLISHING_REALESTATE_OLX,
    requestId: reqOlx,
    creditsAmount: 5,
  })

  return { jobId, destBayut, destOlx, destPf, reqBayut, reqOlx }
}

finPostgresSuite('publishing job aggregation', { seed: false }, ({ pool }) => {
  it('LOAD_PUBLISHING_JOB_SQL joins portals, credits, and attempts (no per-destination loop)', () => {
    const sql = LOAD_PUBLISHING_JOB_SQL
    expect(sql).toMatch(/JOIN\s+public\.portal_registry/i)
    expect(sql).toMatch(/credit_consumptions/)
    expect(sql).toMatch(/credit_reservations/)
    expect(sql).toMatch(/LEFT JOIN LATERAL/)
    expect(sql).toMatch(/distribution_attempts/)
    expect(sql).not.toMatch(/for\s*\(/i)
  })

  it('migration 325 is idempotent and seeds push templates + publishing_jobs', async () => {
    const sql = await readFile(
      join(dirname(fileURLToPath(import.meta.url)), '../../persistence/migrations/325_publishing_jobs.sql'),
      'utf8',
    )
    await pool().query(sql)
    await pool().query(sql)

    const table = await pool().query(`SELECT to_regclass('public.publishing_jobs') AS t`)
    expect(table.rows[0].t).toBeTruthy()

    const col = await pool().query(`
      SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'distribution_jobs'
         AND column_name = 'publishing_job_id'
    `)
    expect(col.rows[0]?.column_name).toBe('publishing_job_id')

    const channel = await pool().query(`
      SELECT pg_get_constraintdef(oid) AS def
        FROM pg_constraint
       WHERE conrelid = 'public.platform_message_templates'::regclass
         AND conname = 'platform_msg_templates_channel_check'
    `)
    expect(channel.rows[0]?.def).toMatch(/push/)

    const templates = await pool().query(`
      SELECT code, channel, data->>'variant' AS variant
        FROM public.platform_message_templates
       WHERE code LIKE 'publishing_job.completed.%'
       ORDER BY code
    `)
    expect(templates.rows.map((r) => r.code)).toEqual([
      'publishing_job.completed.all_failed',
      'publishing_job.completed.all_succeeded',
      'publishing_job.completed.in_review_only',
      'publishing_job.completed.mixed',
      'publishing_job.completed.partial',
    ])
    expect(templates.rows.every((r) => r.channel === 'push')).toBe(true)
  })

  it('GET joins destinations+portal+credits in one statement; 404 is leak-safe; retry writes an attempt', async () => {
    const { agentId, token } = await agentSession('owner')
    const other = await agentSession('other')
    const propertyId = await seedProperty(agentId)
    const tenantId = randomUUID()
    await grant({
      tenantId,
      source: 'promo',
      amount: 1000,
      currency: 'USD',
      grantRef: { idempotency_key: `pub-seed:${tenantId}`, reason: 'test' },
    })
    const seeded = await seedJobWithDestinations({ agentId, propertyId, tenantId })

    const loaded = await loadPublishingJob({
      jobId: seeded.jobId,
      agentId,
      creditTenantId: tenantId,
    })
    expect(loaded).toBeTruthy()
    expect(loaded.statementCount).toBe(1)
    expect(loaded.payload.job.aggregate).toBe('mixed')
    expect(loaded.payload.job.listing_short_ref).toBe('WC-HAMRA')
    expect(loaded.payload.job.counts).toMatchObject({ succeeded: 1, failed: 1, in_review: 1, total: 3 })
    expect(loaded.payload.job.credits.total_charged).toBe(10)
    expect(loaded.payload.job.credits.total_reserved).toBe(5)

    const byCode = Object.fromEntries(loaded.payload.destinations.map((d) => [d.portal.code, d]))
    expect(byCode.bayut.status).toBe('succeeded')
    expect(byCode.bayut.credit_charged).toBe(10)
    expect(byCode.bayut.live_url).toContain('bayut.example')
    expect(byCode.olx.status).toBe('failed')
    expect(byCode.olx.error_class).toBe('PORTAL_DOWN')
    expect(byCode.olx.retry_available).toBe(true)
    expect(byCode.olx.credit_reserved).toBe(5)
    expect(byCode.property_finder.status).toBe('in_review')
    expect(byCode.olx.timeline.length).toBeGreaterThanOrEqual(1)

    const { authMiddleware } = await import('../../auth.js')
    const app = express()
    app.use(express.json())
    registerRoutes(app, { authMiddleware })

    const got = await request(app)
      .get(`/api/publishing/jobs/${seeded.jobId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(got.status).toBe(200)
    expect(got.body.job.aggregate).toBe('mixed')
    expect(got.body.destinations).toHaveLength(3)
    expect(got.body.destinations.every((d) => d.portal && d.portal.code)).toBe(true)

    const leak = await request(app)
      .get(`/api/publishing/jobs/${seeded.jobId}`)
      .set('Authorization', `Bearer ${other.token}`)
    expect(leak.status).toBe(404)
    expect(leak.body).toEqual({ error: 'Not found' })

    const missing = await request(app)
      .get(`/api/publishing/jobs/${randomUUID()}`)
      .set('Authorization', `Bearer ${token}`)
    expect(missing.status).toBe(404)
    expect(missing.body).toEqual(leak.body)

    const unauth = await request(app).get(`/api/publishing/jobs/${seeded.jobId}`)
    expect(unauth.status).toBe(401)

    const before = await pool().query(
      `SELECT COUNT(*)::int AS n FROM public.distribution_attempts WHERE distribution_job_id = $1`,
      [seeded.destOlx],
    )

    const retried = await request(app)
      .post(`/api/publishing/jobs/${seeded.jobId}/destinations/${seeded.destOlx}/retry`)
      .set('Authorization', `Bearer ${token}`)
    expect(retried.status).toBe(200)
    expect(retried.body.id).toBe(seeded.destOlx)

    const after = await pool().query(
      `SELECT COUNT(*)::int AS n FROM public.distribution_attempts WHERE distribution_job_id = $1`,
      [seeded.destOlx],
    )
    expect(after.rows[0].n).toBe(before.rows[0].n + 1)

    const blocked = await request(app)
      .post(`/api/publishing/jobs/${seeded.jobId}/destinations/${seeded.destBayut}/retry`)
      .set('Authorization', `Bearer ${token}`)
    expect(blocked.status).toBe(409)
    expect(blocked.body.code).toBe('NOT_RETRYABLE')

    const otherRetry = await request(app)
      .post(`/api/publishing/jobs/${seeded.jobId}/destinations/${seeded.destOlx}/retry`)
      .set('Authorization', `Bearer ${other.token}`)
    expect(otherRetry.status).toBe(404)
  })

  it('retry-all only retries requested transient classes; legacy singleton GET works', async () => {
    const { agentId, token } = await agentSession('retryall')
    const propertyId = await seedProperty(agentId)
    const tenantId = randomUUID()
    await grant({
      tenantId,
      source: 'promo',
      amount: 500,
      currency: 'USD',
      grantRef: { idempotency_key: `pub-ra:${tenantId}`, reason: 'test' },
    })
    const jobId = randomUUID()
    const destDown = randomUUID()
    const destAuth = randomUUID()
    await query(
      `INSERT INTO public.publishing_jobs (id, property_id, agent_id, submitted_at)
       VALUES ($1, $2, $3, NOW())`,
      [jobId, propertyId, agentId],
    )
    await query(
      `INSERT INTO public.distribution_jobs
         (id, property_id, agent_id, publishing_job_id, platform, status, data)
       VALUES
         ($1, $3, $4, $5, 'olx', 'failed', '{}'::jsonb),
         ($2, $3, $4, $5, 'bayut', 'failed', '{}'::jsonb)`,
      [destDown, destAuth, propertyId, agentId, jobId],
    )
    await recordDistributionAttempt({
      distributionJobId: destDown,
      status: 'failed',
      error: { status: 503, message: 'portal down' },
    })
    await recordDistributionAttempt({
      distributionJobId: destAuth,
      status: 'failed',
      error: { code: 190, message: 'Error validating access token' },
    })

    const { authMiddleware } = await import('../../auth.js')
    const app = express()
    app.use(express.json())
    registerRoutes(app, { authMiddleware })

    const downBefore = await pool().query(
      `SELECT COUNT(*)::int AS n FROM public.distribution_attempts WHERE distribution_job_id = $1`,
      [destDown],
    )
    const authBefore = await pool().query(
      `SELECT COUNT(*)::int AS n FROM public.distribution_attempts WHERE distribution_job_id = $1`,
      [destAuth],
    )

    const res = await request(app)
      .post(`/api/publishing/jobs/${jobId}/retry-all`)
      .set('Authorization', `Bearer ${token}`)
      .send({ error_classes_to_retry: ['PORTAL_DOWN', 'UNKNOWN_ERROR'] })
    expect(res.status).toBe(200)
    expect(res.body.job.id).toBe(jobId)

    const downAfter = await pool().query(
      `SELECT COUNT(*)::int AS n FROM public.distribution_attempts WHERE distribution_job_id = $1`,
      [destDown],
    )
    const authAfter = await pool().query(
      `SELECT COUNT(*)::int AS n FROM public.distribution_attempts WHERE distribution_job_id = $1`,
      [destAuth],
    )
    expect(downAfter.rows[0].n).toBe(downBefore.rows[0].n + 1)
    expect(authAfter.rows[0].n).toBe(authBefore.rows[0].n)

    const legacyId = randomUUID()
    await query(
      `INSERT INTO public.distribution_jobs
         (id, property_id, agent_id, platform, status, publishing_job_id, data)
       VALUES ($1, $2, $3, 'dubizzle', 'published', NULL, '{}'::jsonb)`,
      [legacyId, propertyId, agentId],
    )
    await recordDistributionAttempt({
      distributionJobId: legacyId,
      status: 'published',
      response: { ok: true },
    })
    const legacy = await request(app)
      .get(`/api/publishing/jobs/${legacyId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(legacy.status).toBe(200)
    expect(legacy.body.job.id).toBe(legacyId)
    expect(legacy.body.destinations).toHaveLength(1)
    expect(legacy.body.job.aggregate).toBe('all_succeeded')

    const notified = await emitPublishingJobCompleted(jobId, { userId: agentId, force: true })
    expect(notified.ok || notified.skipped).toBeTruthy()
    const inApp = await pool().query(
      `SELECT title, body FROM public.notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [agentId],
    )
    if (notified.ok) {
      expect(inApp.rows[0]?.body || inApp.rows[0]?.title).toBeTruthy()
    }
  })
})
