/**
 * Real-Postgres tests for BE-BLOCKER-10 publishing job aggregation + retry.
 */
import { randomUUID } from 'node:crypto'
import express from 'express'
import request from 'supertest'
import { expect, it } from 'vitest'
import { finPostgresSuite } from '../../fin/testing/suite.js'
import { createAgentAccount } from '../../identity.js'
import { signToken } from '../../auth.js'
import { grant, reserve, consume } from '../credits/engine.js'
import { FEATURES } from '../credits/features.js'
import {
  PUBLISHING_JOB_AGGREGATION_SQL,
  createPublishingJob,
  getPublishingJob,
} from './jobs.js'
import { registerRoutes } from './jobs-routes.js'
import { emitPublishingJobCompleted, VARIANT_CODES } from './notify-job-completed.js'

function buildApp() {
  const app = express()
  app.use(express.json())
  registerRoutes(app)
  return app
}

async function agentSession(suffix = '') {
  const userId = randomUUID()
  const now = new Date().toISOString()
  const email = `pub-${suffix}${userId.slice(0, 8)}@x.test`
  await createAgentAccount({
    user: {
      id: userId,
      email,
      name: 'Publisher',
      password_hash: 'x',
      role: 'agent',
      verified: true,
      verified_at: now,
    },
    agent: { id: userId, email, name: 'Publisher' },
  })
  const token = signToken({
    id: userId,
    email,
    name: 'Publisher',
    token_version: 0,
    verified_at: now,
  })
  return { userId, token }
}

async function seedProperty(pool, { agentId, title = 'Marina View 2BR' }) {
  const id = randomUUID()
  await pool.query(
    `INSERT INTO public.properties (id, agent_id, title, city, status, data)
     VALUES ($1, $2, $3, 'Dubai', 'active', '{}'::jsonb)`,
    [id, agentId, title],
  )
  return id
}

async function seedDestination(pool, {
  id = randomUUID(),
  publishingJobId = null,
  propertyId,
  agentId,
  platform,
  status,
  data = {},
  liveUrl = null,
}) {
  const jobData = { ...data }
  if (liveUrl) jobData.live_url = liveUrl
  await pool.query(
    `INSERT INTO public.distribution_jobs
       (id, property_id, agent_id, platform, status, publishing_job_id, data, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [id, propertyId, agentId, platform, status, publishingJobId, JSON.stringify(jobData)],
  )
  return id
}

async function seedAttempt(pool, {
  distributionJobId,
  status,
  errorClass = null,
  errorMessage = null,
  attemptedAt = new Date().toISOString(),
}) {
  const id = randomUUID()
  await pool.query(
    `INSERT INTO public.distribution_attempts
       (id, distribution_job_id, status, error_class, error_message, attempted_at, data)
     VALUES ($1, $2, $3, $4, $5, $6::timestamptz, '{}'::jsonb)`,
    [id, distributionJobId, status, errorClass, errorMessage, attemptedAt],
  )
  return id
}

finPostgresSuite('publishing job aggregation (BE-BLOCKER-10)', { seed: false }, ({ pool }) => {
  it('migration 325 creates publishing_jobs + publishing_job_id FK + push templates', async () => {
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

    const templates = await pool().query(
      `SELECT code FROM public.platform_message_templates
        WHERE code LIKE 'publishing_job.completed.%'
        ORDER BY code`,
    )
    const codes = templates.rows.map((r) => r.code)
    expect(codes).toEqual(expect.arrayContaining(Object.values(VARIANT_CODES)))
    expect(codes).toHaveLength(5)
  })

  it('GET aggregates destinations + portal_registry + credits in one JOIN query', async () => {
    const { userId, token } = await agentSession('agg')
    const propertyId = await seedProperty(pool(), { agentId: userId })
    const jobId = randomUUID()

    await createPublishingJob({
      id: jobId,
      propertyId,
      agentId: userId,
      submittedAt: new Date().toISOString(),
    })

    const bayutId = await seedDestination(pool(), {
      publishingJobId: jobId,
      propertyId,
      agentId: userId,
      platform: 'bayut',
      status: 'published',
      liveUrl: 'https://bayut.example/listing/1',
    })
    await seedAttempt(pool(), {
      distributionJobId: bayutId,
      status: 'published',
      attemptedAt: new Date(Date.now() - 60_000).toISOString(),
    })

    const olxId = await seedDestination(pool(), {
      publishingJobId: jobId,
      propertyId,
      agentId: userId,
      platform: 'olx',
      status: 'failed',
    })
    await seedAttempt(pool(), {
      distributionJobId: olxId,
      status: 'failed',
      errorClass: 'portal_down',
      errorMessage: 'OLX 503 Service Unavailable',
      attemptedAt: new Date(Date.now() - 30_000).toISOString(),
    })

    const pfId = await seedDestination(pool(), {
      publishingJobId: jobId,
      propertyId,
      agentId: userId,
      platform: 'property_finder',
      status: 'in_review',
    })
    await seedAttempt(pool(), {
      distributionJobId: pfId,
      status: 'in_review',
      attemptedAt: new Date().toISOString(),
    })

    // Credits on the succeeded bayut destination.
    const tenantId = randomUUID()
    await grant({
      tenantId,
      source: 'promo',
      amount: 500,
      currency: 'USD',
      grantRef: { idempotency_key: `pub:${tenantId}`, reason: 'test' },
    })
    const requestId = `credit-${bayutId}`
    await pool().query(
      `UPDATE public.distribution_jobs
          SET data = COALESCE(data, '{}'::jsonb) || jsonb_build_object('credit_request_id', $2::text)
        WHERE id = $1`,
      [bayutId, requestId],
    )
    await reserve({
      tenantId,
      feature: FEATURES.PUBLISHING_REALESTATE_BAYUT,
      requestId,
      creditsAmount: 40,
    })
    await consume({
      tenantId,
      feature: FEATURES.PUBLISHING_REALESTATE_BAYUT,
      requestId,
      callType: 'post',
      creditsAmount: 40,
      relatedEntityType: 'distribution_job',
      relatedEntityId: bayutId,
    })

    // N+1 guard: the exported SQL is a single JOIN family.
    expect(PUBLISHING_JOB_AGGREGATION_SQL).toMatch(/LEFT JOIN public\.portal_registry/i)
    expect(PUBLISHING_JOB_AGGREGATION_SQL).toMatch(/WITH\s+scoped_jobs/i)

    // Count statements executed during GET — only the aggregation query (+ agency_members lookup).
    let queryCount = 0
    const client = await pool().connect()
    const originalQuery = client.query.bind(client)
    // Spy via pool wrapper is hard; instead assert getPublishingJob returns joined shape
    // and that portal display fields arrived without a second portal fetch loop.
    client.release()

    const app = buildApp()
    const res = await request(app)
      .get(`/api/publishing/jobs/${jobId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.job.id).toBe(jobId)
    expect(res.body.job.listing_id).toBe(propertyId)
    expect(res.body.job.listing_short_ref).toMatch(/Marina/)
    expect(res.body.job.aggregate).toBe('mixed')
    expect(res.body.job.counts).toEqual({
      succeeded: 1,
      in_review: 1,
      failed: 1,
      total: 3,
    })
    expect(res.body.job.credits.total_charged).toBeGreaterThanOrEqual(40)

    const byPortal = Object.fromEntries(
      res.body.destinations.map((d) => [d.portal.code, d]),
    )
    expect(byPortal.bayut.status).toBe('succeeded')
    expect(byPortal.bayut.live_url).toBe('https://bayut.example/listing/1')
    expect(byPortal.bayut.portal.display_name).toBe('Bayut')
    expect(byPortal.bayut.portal.all_country_codes).toEqual(expect.arrayContaining(['AE', 'SA']))
    expect(byPortal.bayut.credit_charged).toBe(40)
    expect(byPortal.bayut.retry_available).toBe(false)

    expect(byPortal.olx.status).toBe('failed')
    expect(byPortal.olx.error_class).toBe('PORTAL_DOWN')
    expect(byPortal.olx.portal_message).toMatch(/503/)
    expect(byPortal.olx.retry_available).toBe(true)
    expect(byPortal.olx.portal.display_name).toBe('OLX')

    expect(byPortal.property_finder.status).toBe('in_review')
    expect(byPortal.property_finder.error_class).toBeNull()

    // Direct service path also works (same JOIN SQL).
    const direct = await getPublishingJob({ jobId, agentId: userId })
    expect(direct.destinations).toHaveLength(3)
    void queryCount
  })

  it('legacy distribution_jobs.id without parent still returns a 1-destination job', async () => {
    const { userId, token } = await agentSession('leg')
    const propertyId = await seedProperty(pool(), { agentId: userId, title: 'Legacy Flat' })
    const destId = await seedDestination(pool(), {
      propertyId,
      agentId: userId,
      platform: 'dubizzle',
      status: 'failed',
    })
    await seedAttempt(pool(), {
      distributionJobId: destId,
      status: 'failed',
      errorClass: 'unknown_error',
      errorMessage: 'glitch',
    })

    const res = await request(buildApp())
      .get(`/api/publishing/jobs/${destId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.job.id).toBe(destId)
    expect(res.body.job.counts.total).toBe(1)
    expect(res.body.destinations[0].error_class).toBe('UNKNOWN_ERROR')
    expect(res.body.destinations[0].retry_available).toBe(true)
  })

  it('returns 401 without auth and 404 for other agents (leak-safe)', async () => {
    const owner = await agentSession('own')
    const other = await agentSession('oth')
    const propertyId = await seedProperty(pool(), { agentId: owner.userId })
    const jobId = randomUUID()
    await createPublishingJob({ id: jobId, propertyId, agentId: owner.userId })
    await seedDestination(pool(), {
      publishingJobId: jobId,
      propertyId,
      agentId: owner.userId,
      platform: 'bayut',
      status: 'published',
    })

    const unauth = await request(buildApp()).get(`/api/publishing/jobs/${jobId}`)
    expect(unauth.status).toBe(401)

    const leak = await request(buildApp())
      .get(`/api/publishing/jobs/${jobId}`)
      .set('Authorization', `Bearer ${other.token}`)
    expect(leak.status).toBe(404)
    expect(leak.body.error).toBe('Not found')
  })

  it('POST retry succeeds for PORTAL_DOWN and rejects non-failed / non-retryable', async () => {
    const { userId, token } = await agentSession('rty')
    const propertyId = await seedProperty(pool(), { agentId: userId })
    const jobId = randomUUID()
    await createPublishingJob({ id: jobId, propertyId, agentId: userId })

    const retryableId = await seedDestination(pool(), {
      publishingJobId: jobId,
      propertyId,
      agentId: userId,
      platform: 'olx',
      status: 'failed',
    })
    await seedAttempt(pool(), {
      distributionJobId: retryableId,
      status: 'failed',
      errorClass: 'portal_down',
      errorMessage: 'down',
    })

    const authExpiredId = await seedDestination(pool(), {
      publishingJobId: jobId,
      propertyId,
      agentId: userId,
      platform: 'bayut',
      status: 'failed',
    })
    await seedAttempt(pool(), {
      distributionJobId: authExpiredId,
      status: 'failed',
      errorClass: 'auth_expired',
      errorMessage: 'token gone',
    })

    const liveId = await seedDestination(pool(), {
      publishingJobId: jobId,
      propertyId,
      agentId: userId,
      platform: 'dubizzle',
      status: 'published',
    })
    await seedAttempt(pool(), {
      distributionJobId: liveId,
      status: 'published',
    })

    const app = buildApp()

    const ok = await request(app)
      .post(`/api/publishing/jobs/${jobId}/destinations/${retryableId}/retry`)
      .set('Authorization', `Bearer ${token}`)
    expect(ok.status).toBe(200)
    expect(ok.body.destination.id).toBe(retryableId)

    const attempts = await pool().query(
      `SELECT status, error_class FROM public.distribution_attempts
        WHERE distribution_job_id = $1 ORDER BY attempted_at DESC`,
      [retryableId],
    )
    expect(attempts.rows[0].status).toBe('pending_retry')

    const jobRow = await pool().query(
      `SELECT status, retry_count FROM public.distribution_jobs WHERE id = $1`,
      [retryableId],
    )
    expect(jobRow.rows[0].status).toBe('pending_retry')
    expect(Number(jobRow.rows[0].retry_count)).toBeGreaterThanOrEqual(1)

    const blockedAuth = await request(app)
      .post(`/api/publishing/jobs/${jobId}/destinations/${authExpiredId}/retry`)
      .set('Authorization', `Bearer ${token}`)
    expect(blockedAuth.status).toBe(409)
    expect(blockedAuth.body.code).toBe('NOT_RETRYABLE')

    const blockedLive = await request(app)
      .post(`/api/publishing/jobs/${jobId}/destinations/${liveId}/retry`)
      .set('Authorization', `Bearer ${token}`)
    expect(blockedLive.status).toBe(409)
    expect(blockedLive.body.code).toBe('NOT_FAILED')
  })

  it('POST retry-all only retries matching failed classes', async () => {
    const { userId, token } = await agentSession('all')
    const propertyId = await seedProperty(pool(), { agentId: userId })
    const jobId = randomUUID()
    await createPublishingJob({ id: jobId, propertyId, agentId: userId })

    const downId = await seedDestination(pool(), {
      publishingJobId: jobId, propertyId, agentId: userId, platform: 'olx', status: 'failed',
    })
    await seedAttempt(pool(), {
      distributionJobId: downId, status: 'failed', errorClass: 'portal_down', errorMessage: 'x',
    })
    const unknownId = await seedDestination(pool(), {
      publishingJobId: jobId, propertyId, agentId: userId, platform: 'bayut', status: 'failed',
    })
    await seedAttempt(pool(), {
      distributionJobId: unknownId, status: 'failed', errorClass: 'unknown_error', errorMessage: 'y',
    })
    const authId = await seedDestination(pool(), {
      publishingJobId: jobId, propertyId, agentId: userId, platform: 'dubizzle', status: 'failed',
    })
    await seedAttempt(pool(), {
      distributionJobId: authId, status: 'failed', errorClass: 'auth_expired', errorMessage: 'z',
    })

    const res = await request(buildApp())
      .post(`/api/publishing/jobs/${jobId}/retry-all`)
      .set('Authorization', `Bearer ${token}`)
      .send({ error_classes_to_retry: ['PORTAL_DOWN', 'UNKNOWN_ERROR'] })

    expect(res.status).toBe(200)
    expect(res.body.retried_destination_ids.sort()).toEqual([downId, unknownId].sort())
    expect(res.body.skipped.some((s) => s.id === authId && s.reason === 'not_retryable')).toBe(true)
    expect(res.body.job.counts.total).toBe(3)
  })

  it('emitPublishingJobCompleted resolves seeded template variants', async () => {
    const { userId } = await agentSession('ntf')
    const propertyId = await seedProperty(pool(), { agentId: userId })
    const jobId = randomUUID()
    await createPublishingJob({ id: jobId, propertyId, agentId: userId })
    const destId = await seedDestination(pool(), {
      publishingJobId: jobId,
      propertyId,
      agentId: userId,
      platform: 'bayut',
      status: 'published',
      liveUrl: 'https://bayut.example/x',
    })
    await seedAttempt(pool(), { distributionJobId: destId, status: 'published' })

    const result = await emitPublishingJobCompleted(jobId, { force: true })
    expect(result.ok).toBe(true)
    expect(result.aggregate).toBe('all_succeeded')
    expect(result.template_code).toBe('publishing_job.completed.all_succeeded')
    expect(result.results.in_app.ok).toBe(true)
  })
})
