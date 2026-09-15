/**
 * WF-03 Real-Postgres cross-loop (Wave 2 Agent 6).
 *
 * Lifecycle:
 *   create publishing_job
 *   → distribution_jobs fan-out (publish destinations)
 *   → distribution_attempts with each error_class + in_review
 *   → GET /api/publishing/jobs/:id aggregates (AGT-PUB-003 receipt contract)
 *   → PA queue data = tracker rows with status=in_review
 *   → PA approve (status → published) + portal_submission.status_changed push
 *   → GET /api/publishing/tracker reflects live outcome
 *
 * Skips when TEST_DATABASE_URL is unset (local without docker).
 */
import { randomUUID } from 'node:crypto'
import express from 'express'
import request from 'supertest'
import { beforeEach, expect, it, vi } from 'vitest'
import { finPostgresSuite } from '../fin/testing/suite.js'
import { createAgentAccount } from '../identity.js'
import { authMiddleware, signToken } from '../auth.js'
import { ERROR_CLASSES } from '../lib/publishing/error-classifier.js'
import { createPublishingJob } from '../lib/publishing/jobs.js'
import { registerRoutes as registerJobRoutes } from '../lib/publishing/jobs-routes.js'
import { registerRoutes as registerTrackerRoutes } from '../lib/publishing/tracker-routes.js'
import { scoreTenureRisk } from '../lib/moderation/tenure-risk.js'
import { validate as validatePortalListing } from '../lib/portal-validators/index.js'

/** Matches consumer-notification DISPATCH_MAX_RETRIES until publishing has its own policy. */
const PUBLISHING_MAX_RETRIES = 5

const dispatchMock = vi.hoisted(() => ({
  dispatchConsumerNotification: vi.fn(async ({ channel }) => ({
    ok: true,
    status: channel === 'in_app' ? 'delivered' : 'sent',
    channel,
  })),
}))

vi.mock('../lib/notifications/dispatch.js', () => dispatchMock)

const {
  emitPortalSubmissionStatusChanged,
  STATUS_TEMPLATE_CODES,
} = await import('../lib/publishing/notify-submission-status.js')

const RESOLUTION = {
  auth_expired: {
    api: 'AUTH_EXPIRED',
    retry: false,
    fix: (platform, listingId) => `/channels/${platform}/reconnect`,
  },
  portal_rules_violation: {
    api: 'PORTAL_RULES_VIOLATION',
    retry: false,
    fix: (platform, listingId) => `/publish/fix/${listingId}?portal=${platform}`,
  },
  portal_down: {
    api: 'PORTAL_DOWN',
    retry: true,
    fix: (_p, listingId) => `/publish/retry/${listingId}`,
  },
  quota_exceeded: {
    api: 'QUOTA_EXCEEDED',
    retry: false,
    fix: () => '/billing/top-up',
  },
  invalid_content: {
    api: 'INVALID_CONTENT',
    retry: false,
    fix: (platform, listingId) => `/publish/fix/${listingId}?portal=${platform}`,
  },
  unknown_error: {
    api: 'UNKNOWN_ERROR',
    retry: true,
    fix: (_p, listingId) => `/publish/retry/${listingId}`,
  },
}

function buildApp() {
  const app = express()
  app.use(express.json())
  // tracker-routes requires authMiddleware at construction; jobs-routes defaults
  // the same dep but pass explicitly so both stay symmetric in this harness.
  registerJobRoutes(app, { authMiddleware })
  registerTrackerRoutes(app, { authMiddleware })
  return app
}

async function agentSession(suffix = '') {
  const userId = randomUUID()
  const now = new Date().toISOString()
  const email = `wf03-${suffix}${userId.slice(0, 8)}@x.test`
  await createAgentAccount({
    user: {
      id: userId,
      email,
      name: 'WF03 Agent',
      password_hash: 'x',
      role: 'agent',
      verified: true,
      verified_at: now,
    },
    agent: { id: userId, email, name: 'WF03 Agent' },
  })
  const token = signToken({
    id: userId,
    email,
    name: 'WF03 Agent',
    token_version: 0,
    verified_at: now,
  })
  return { userId, token }
}

async function seedProperty(pool, { agentId, title = 'WF-03 Cross-loop Listing', address = '12 Marina Walk' }) {
  const id = randomUUID()
  await pool.query(
    `INSERT INTO public.properties (id, agent_id, title, location, city, status, data)
     VALUES ($1, $2, $3, $4, 'Dubai', 'active', $5::jsonb)`,
    [id, agentId, title, address, JSON.stringify({ address, photos: ['https://cdn.example/1.jpg'] })],
  )
  return id
}

async function seedDestination(pool, {
  id = randomUUID(),
  publishingJobId,
  propertyId,
  agentId,
  platform,
  status,
  data = {},
}) {
  await pool.query(
    `INSERT INTO public.distribution_jobs
       (id, property_id, agent_id, platform, status, publishing_job_id, data, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [id, propertyId, agentId, platform, status, publishingJobId, JSON.stringify(data)],
  )
  return id
}

async function seedAttempt(pool, {
  id = randomUUID(),
  distributionJobId,
  status,
  errorClass = null,
  errorMessage = null,
  attemptedAt = new Date().toISOString(),
}) {
  await pool.query(
    `INSERT INTO public.distribution_attempts
       (id, distribution_job_id, status, error_class, error_message, attempted_at, data)
     VALUES ($1, $2, $3, $4, $5, $6::timestamptz, '{}'::jsonb)`,
    [id, distributionJobId, status, errorClass, errorMessage, attemptedAt],
  )
  return id
}

finPostgresSuite('WF-03 cross-loop portal moderation (Wave 2 Agent 6)', { seed: false }, ({ pool }) => {
  beforeEach(() => {
    dispatchMock.dispatchConsumerNotification.mockClear()
  })

  it('full lifecycle: submit → aggregate → PA queue → approve → push → tracker', async () => {
    const { userId, token } = await agentSession('loop')
    const propertyId = await seedProperty(pool(), { agentId: userId })
    const jobId = randomUUID()

    await createPublishingJob({
      id: jobId,
      propertyId,
      agentId: userId,
      submittedAt: new Date().toISOString(),
    })

    // --- Publisher fan-out: one live, one in_review (PA queue), six failed classes ---
    const liveDest = await seedDestination(pool(), {
      publishingJobId: jobId,
      propertyId,
      agentId: userId,
      platform: 'bayut',
      status: 'published',
      data: { live_url: 'https://bayut.example/wf03-live' },
    })
    await seedAttempt(pool(), {
      distributionJobId: liveDest,
      status: 'published',
    })

    const reviewDest = await seedDestination(pool(), {
      publishingJobId: jobId,
      propertyId,
      agentId: userId,
      platform: 'property_finder',
      status: 'pending_moderation',
    })
    const reviewAttemptId = await seedAttempt(pool(), {
      distributionJobId: reviewDest,
      status: 'in_review',
    })

    const failedByClass = {}
    const platforms = ['olx', 'dubizzle', 'aqar', 'wasalt', 'aqarmap', '3akarat']
    for (let i = 0; i < ERROR_CLASSES.length; i += 1) {
      const errorClass = ERROR_CLASSES[i]
      const platform = platforms[i]
      const destId = await seedDestination(pool(), {
        publishingJobId: jobId,
        propertyId,
        agentId: userId,
        platform,
        status: 'failed',
      })
      await seedAttempt(pool(), {
        distributionJobId: destId,
        status: 'failed',
        errorClass,
        errorMessage: `${errorClass} from portal`,
      })
      failedByClass[errorClass] = { destId, platform }
    }

    // Tenure-risk stub for PA-MOD-002 gate (always unknown in v1).
    expect(scoreTenureRisk({ id: userId }, { id: reviewDest }).tier).toBe('unknown')

    // PA detail lint aggregate from BE-BLOCKER-17 validators.
    const lint = validatePortalListing(
      { title: 'WF-03', photos: ['https://cdn.example/1.jpg'] },
      { portalCode: 'property_finder', countryCode: 'AE' },
    )
    expect(lint.checks.length).toBeGreaterThan(0)

    const app = buildApp()

    // --- AGT-PUB-003 receipt aggregation ---
    const receipt = await request(app)
      .get(`/api/publishing/jobs/${jobId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(receipt.status).toBe(200)
    expect(receipt.body.job.aggregate).toBe('mixed')
    expect(receipt.body.job.counts).toEqual({
      succeeded: 1,
      in_review: 1,
      failed: 6,
      total: 8,
    })

    const byPortal = Object.fromEntries(
      receipt.body.destinations.map((d) => [d.portal.code, d]),
    )
    expect(byPortal.bayut.status).toBe('succeeded')
    expect(byPortal.bayut.live_url).toBe('https://bayut.example/wf03-live')
    expect(byPortal.property_finder.status).toBe('in_review')
    expect(byPortal.property_finder.moderation_queue_deep_link).toBe(
      `/listings/${propertyId}/submissions/${reviewDest}`,
    )

    for (const [dbClass, meta] of Object.entries(failedByClass)) {
      const dest = byPortal[meta.platform]
      const expected = RESOLUTION[dbClass]
      expect(dest.status).toBe('failed')
      expect(dest.error_class).toBe(expected.api)
      expect(dest.retry_available).toBe(expected.retry)
      expect(dest.fix_deep_link).toBe(expected.fix(meta.platform, propertyId))
    }

    // --- PA queue populates: tracker lists the in_review row ---
    const queueBefore = await request(app)
      .get('/api/publishing/tracker')
      .query({ status: 'in_review', limit: 50 })
      .set('Authorization', `Bearer ${token}`)
    expect(queueBefore.status).toBe(200)
    const reviewRows = queueBefore.body.rows.filter(
      (row) =>
        (row.listing?.id === propertyId || row.listing_id === propertyId)
        && (row.portal?.code === 'property_finder' || row.portal === 'property_finder'),
    )
    expect(reviewRows.length).toBeGreaterThanOrEqual(1)
    expect(reviewRows[0].status).toBe('in_review')

    // --- PA approves (simulates PA-MOD-002 decision) ---
    await pool().query(
      `UPDATE public.distribution_jobs
          SET status = 'published',
              published_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP,
              data = COALESCE(data, '{}'::jsonb) || jsonb_build_object(
                'live_url', 'https://www.propertyfinder.ae/en/listing/wf03',
                'pa_decision', 'approved',
                'pa_decided_at', CURRENT_TIMESTAMP
              )
        WHERE id = $1`,
      [reviewDest],
    )
    const liveAttemptId = await seedAttempt(pool(), {
      distributionJobId: reviewDest,
      status: 'published',
      attemptedAt: new Date().toISOString(),
    })

    // --- status_changed push hop ---
    const push = await emitPortalSubmissionStatusChanged({
      userId,
      portalName: 'Property Finder',
      listingAddress: '12 Marina Walk',
      slaDays: 3,
      distributionAttemptId: liveAttemptId,
      newStatus: 'live',
    })
    expect(push.ok).toBe(true)
    expect(push.template_code).toBe(STATUS_TEMPLATE_CODES.live)
    expect(dispatchMock.dispatchConsumerNotification).toHaveBeenCalled()
    const pushChannels = dispatchMock.dispatchConsumerNotification.mock.calls.map(
      (c) => c[0].channel,
    )
    expect(pushChannels).toEqual(expect.arrayContaining(['in_app', 'push']))

    // --- Tracker reflects live outcome (AGT-PUB-006) ---
    const trackerAfter = await request(app)
      .get('/api/publishing/tracker')
      .query({ status: 'live', portal: 'property_finder', limit: 50 })
      .set('Authorization', `Bearer ${token}`)
    expect(trackerAfter.status).toBe(200)
    const liveRows = trackerAfter.body.rows.filter(
      (row) => row.listing?.id === propertyId || row.listing_id === propertyId,
    )
    expect(liveRows.length).toBeGreaterThanOrEqual(1)
    expect(liveRows.some((r) => r.status === 'live')).toBe(true)

    // Receipt re-aggregates: in_review flipped to succeeded.
    const receiptAfter = await request(app)
      .get(`/api/publishing/jobs/${jobId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(receiptAfter.status).toBe(200)
    expect(receiptAfter.body.job.counts.succeeded).toBe(2)
    expect(receiptAfter.body.job.counts.in_review).toBe(0)
    expect(receiptAfter.body.job.counts.failed).toBe(6)

    // Review attempt id still addressable for deep links / audit.
    expect(reviewAttemptId).toBeTruthy()
  })

  it('PA reject path emits rejected push and tracker shows rejected', async () => {
    const { userId, token } = await agentSession('rej')
    const propertyId = await seedProperty(pool(), {
      agentId: userId,
      title: 'Reject Path Listing',
      address: 'Reject Ave 1',
    })
    const jobId = randomUUID()
    await createPublishingJob({
      id: jobId,
      propertyId,
      agentId: userId,
      submittedAt: new Date().toISOString(),
    })
    const destId = await seedDestination(pool(), {
      publishingJobId: jobId,
      propertyId,
      agentId: userId,
      platform: 'bayut',
      status: 'pending_moderation',
    })
    await seedAttempt(pool(), { distributionJobId: destId, status: 'in_review' })

    await pool().query(
      `UPDATE public.distribution_jobs
          SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [destId],
    )
    const attemptId = await seedAttempt(pool(), {
      distributionJobId: destId,
      status: 'rejected',
      errorClass: 'portal_rules_violation',
      errorMessage: 'Missing Trakheesi',
    })

    const push = await emitPortalSubmissionStatusChanged({
      userId,
      portalName: 'Bayut',
      listingAddress: 'Reject Ave 1',
      distributionAttemptId: attemptId,
      newStatus: 'rejected',
    })
    expect(push.ok).toBe(true)
    expect(push.template_code).toBe(STATUS_TEMPLATE_CODES.rejected)

    const tracker = await request(buildApp())
      .get('/api/publishing/tracker')
      .query({ status: 'rejected', limit: 20 })
      .set('Authorization', `Bearer ${token}`)
    expect(tracker.status).toBe(200)
    const rows = tracker.body.rows.filter(
      (r) => r.listing?.id === propertyId || r.listing_id === propertyId,
    )
    expect(rows[0]?.status).toBe('rejected')
    expect(rows[0]?.error_class).toBe('portal_rules_violation')
  })

  it('env-scoped LIVE vs TEST: header does not partition tracker rows (PA-NAV-001 chrome owns env)', async () => {
    // Backend distribution rows are not env-partitioned in Week 2; PA-NAV-001
    // scopes the admin chrome. Positive check: the same in_review row is
    // returned under both X-Wingcaster-Env values (no silent filter), and
    // items still omit `env` (chrome owns LIVE/TEST rendering).
    const { userId, token } = await agentSession('env')
    const propertyId = await seedProperty(pool(), { agentId: userId, title: 'Env Scope Listing' })
    const destId = await seedDestination(pool(), {
      publishingJobId: null,
      propertyId,
      agentId: userId,
      platform: 'bayut',
      status: 'pending_moderation',
    })
    await seedAttempt(pool(), { distributionJobId: destId, status: 'in_review' })

    const app = buildApp()
    const liveRes = await request(app)
      .get('/api/publishing/tracker')
      .query({ status: 'in_review' })
      .set('Authorization', `Bearer ${token}`)
      .set('X-Wingcaster-Env', 'live')
    expect(liveRes.status).toBe(200)
    const liveItem = liveRes.body.rows.find(
      (r) => r.listing?.id === propertyId || r.listing_id === propertyId,
    )
    expect(liveItem).toBeTruthy()
    expect(liveItem.env).toBeUndefined()

    const testRes = await request(app)
      .get('/api/publishing/tracker')
      .query({ status: 'in_review' })
      .set('Authorization', `Bearer ${token}`)
      .set('X-Wingcaster-Env', 'test')
    expect(testRes.status).toBe(200)
    const testItem = testRes.body.rows.find(
      (r) => r.listing?.id === propertyId || r.listing_id === propertyId,
    )
    expect(testItem).toBeTruthy()
    expect(testItem.env).toBeUndefined()
    // Same row under both headers — proves no env filter was applied.
    expect(testItem.id || testItem.attempt_id).toEqual(liveItem.id || liveItem.attempt_id)
  })

  it('retry-success branch: retryable fail → retry → publish succeeds → aggregate recovers', async () => {
    const { userId, token } = await agentSession('retry')
    const propertyId = await seedProperty(pool(), {
      agentId: userId,
      title: 'Retry Success Listing',
      address: 'Retry Lane 1',
    })
    const jobId = randomUUID()
    await createPublishingJob({
      id: jobId,
      propertyId,
      agentId: userId,
      submittedAt: new Date().toISOString(),
    })

    const liveDest = await seedDestination(pool(), {
      publishingJobId: jobId,
      propertyId,
      agentId: userId,
      platform: 'bayut',
      status: 'published',
      data: { live_url: 'https://bayut.example/retry-live' },
    })
    await seedAttempt(pool(), { distributionJobId: liveDest, status: 'published' })

    const failDest = await seedDestination(pool(), {
      publishingJobId: jobId,
      propertyId,
      agentId: userId,
      platform: 'olx',
      status: 'failed',
    })
    await seedAttempt(pool(), {
      distributionJobId: failDest,
      status: 'failed',
      errorClass: 'portal_down',
      errorMessage: 'portal_down from portal',
    })

    const app = buildApp()
    const before = await request(app)
      .get(`/api/publishing/jobs/${jobId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(before.status).toBe(200)
    expect(before.body.job.aggregate).toBe('mixed')
    expect(before.body.job.counts).toEqual({
      succeeded: 1,
      in_review: 0,
      failed: 1,
      total: 2,
    })

    const retry = await request(app)
      .post(`/api/publishing/jobs/${jobId}/destinations/${failDest}/retry`)
      .set('Authorization', `Bearer ${token}`)
    expect(retry.status).toBe(200)

    const pending = await pool().query(
      `SELECT status, retry_count FROM public.distribution_jobs WHERE id = $1`,
      [failDest],
    )
    expect(pending.rows[0].status).toBe('pending_retry')
    expect(Number(pending.rows[0].retry_count)).toBeGreaterThanOrEqual(1)

    // Simulate publisher succeeding on the retry cycle.
    await pool().query(
      `UPDATE public.distribution_jobs
          SET status = 'published',
              published_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP,
              error_message = NULL,
              data = COALESCE(data, '{}'::jsonb) || jsonb_build_object(
                'live_url', 'https://olx.example/retry-recovered'
              )
        WHERE id = $1`,
      [failDest],
    )
    await seedAttempt(pool(), {
      distributionJobId: failDest,
      status: 'published',
      attemptedAt: new Date().toISOString(),
    })

    const after = await request(app)
      .get(`/api/publishing/jobs/${jobId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(after.status).toBe(200)
    expect(['all_succeeded', 'mixed']).toContain(after.body.job.aggregate)
    expect(after.body.job.counts.succeeded).toBe(2)
    expect(after.body.job.counts.failed).toBe(0)
    expect(after.body.job.aggregate).toBe('all_succeeded')
  })

  it('dead-letter branch: all retryable fails → N retries exhausted → terminal status', async () => {
    // TODO(BE): https://github.com/cyber-entrepreneur/wingcaster/issues/176
    // Ideal terminal status is distribution_jobs.status='dead_letter'. Today
    // retry only flips to pending_retry; there is no max-retry → dead_letter
    // path. This test drives exhaustion end-to-end and asserts the observable
    // terminal state (failed + retry_count >= MAX). Promote the assertion to
    // dead_letter when #176 lands.
    const { userId, token } = await agentSession('dl')
    const propertyId = await seedProperty(pool(), {
      agentId: userId,
      title: 'Dead Letter Listing',
      address: 'DLQ Road 9',
    })
    const jobId = randomUUID()
    await createPublishingJob({
      id: jobId,
      propertyId,
      agentId: userId,
      submittedAt: new Date().toISOString(),
    })

    const platforms = ['bayut', 'olx']
    const destIds = []
    for (const platform of platforms) {
      const destId = await seedDestination(pool(), {
        publishingJobId: jobId,
        propertyId,
        agentId: userId,
        platform,
        status: 'failed',
      })
      await seedAttempt(pool(), {
        distributionJobId: destId,
        status: 'failed',
        errorClass: 'portal_down',
        errorMessage: 'portal_down from portal',
      })
      destIds.push(destId)
    }

    const app = buildApp()
    for (let cycle = 0; cycle < PUBLISHING_MAX_RETRIES; cycle += 1) {
      const res = await request(app)
        .post(`/api/publishing/jobs/${jobId}/retry-all`)
        .set('Authorization', `Bearer ${token}`)
        .send({ error_classes_to_retry: ['PORTAL_DOWN'] })
      expect(res.status).toBe(200)
      expect(res.body.retried_destination_ids.sort()).toEqual([...destIds].sort())

      for (const destId of destIds) {
        await pool().query(
          `UPDATE public.distribution_jobs
              SET status = 'failed',
                  updated_at = CURRENT_TIMESTAMP,
                  error_message = $2
            WHERE id = $1`,
          [destId, `portal_down after retry ${cycle + 1}`],
        )
        await seedAttempt(pool(), {
          distributionJobId: destId,
          status: 'failed',
          errorClass: 'portal_down',
          errorMessage: `portal_down after retry ${cycle + 1}`,
        })
      }
    }

    const rows = await pool().query(
      `SELECT id, status, retry_count FROM public.distribution_jobs
        WHERE id = ANY($1::text[])`,
      [destIds],
    )
    expect(rows.rows).toHaveLength(2)
    for (const row of rows.rows) {
      expect(Number(row.retry_count)).toBeGreaterThanOrEqual(PUBLISHING_MAX_RETRIES)
      // Prefer dead_letter when implemented; until then exhausted = failed.
      expect(['failed', 'dead_letter']).toContain(row.status)
    }

    const receipt = await request(app)
      .get(`/api/publishing/jobs/${jobId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(receipt.status).toBe(200)
    expect(receipt.body.job.aggregate).toBe('all_failed')
    expect(receipt.body.job.counts.failed).toBe(2)
  })

  // TODO(BE): https://github.com/cyber-entrepreneur/wingcaster/issues/175
  // stuck-job SLA reaper — surface the gap, don't hide it. No publishing /
  // tracker SLA worker under backend/src/workers/ today. it.fails keeps CI
  // green while documenting the expected expired transition.
  it.fails('deadlock-non-happen: stuck mid-lifecycle job expires via SLA reaper', async () => {
    const { userId, token } = await agentSession('stuck')
    const propertyId = await seedProperty(pool(), {
      agentId: userId,
      title: 'Stuck SLA Listing',
      address: 'Paused Court 3',
    })
    const jobId = randomUUID()
    await createPublishingJob({
      id: jobId,
      propertyId,
      agentId: userId,
      submittedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    })
    const destId = await seedDestination(pool(), {
      publishingJobId: jobId,
      propertyId,
      agentId: userId,
      platform: 'property_finder',
      status: 'pending_moderation',
    })
    await seedAttempt(pool(), {
      distributionJobId: destId,
      status: 'in_review',
      attemptedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    })
    // Age the job past any reasonable SLA window.
    await pool().query(
      `UPDATE public.distribution_jobs
          SET created_at = CURRENT_TIMESTAMP - INTERVAL '48 hours',
              updated_at = CURRENT_TIMESTAMP - INTERVAL '48 hours'
        WHERE id = $1`,
      [destId],
    )

    let tick = null
    try {
      ;({ tick } = await import('../workers/publishing-stuck-job-reaper.js'))
    } catch {
      expect.fail(
        'TODO(BE): stuck-job SLA reaper — https://github.com/cyber-entrepreneur/wingcaster/issues/175',
      )
    }
    expect(typeof tick).toBe('function')
    await tick()

    const row = await pool().query(
      `SELECT status FROM public.distribution_jobs WHERE id = $1`,
      [destId],
    )
    expect(row.rows[0].status).toBe('expired')

    const tracker = await request(buildApp())
      .get('/api/publishing/tracker')
      .query({ status: 'expired', limit: 20 })
      .set('Authorization', `Bearer ${token}`)
    expect(tracker.status).toBe(200)
    const expiredRows = tracker.body.rows.filter(
      (r) => r.listing?.id === propertyId || r.listing_id === propertyId,
    )
    expect(expiredRows.some((r) => r.status === 'expired')).toBe(true)
  })
})
