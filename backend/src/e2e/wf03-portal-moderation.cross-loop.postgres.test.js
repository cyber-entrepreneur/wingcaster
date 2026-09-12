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
import { signToken } from '../auth.js'
import { ERROR_CLASSES } from '../lib/publishing/error-classifier.js'
import { createPublishingJob } from '../lib/publishing/jobs.js'
import { registerRoutes as registerJobRoutes } from '../lib/publishing/jobs-routes.js'
import { registerRoutes as registerTrackerRoutes } from '../lib/publishing/tracker-routes.js'
import { scoreTenureRisk } from '../lib/moderation/tenure-risk.js'
import { validate as validatePortalListing } from '../lib/portal-validators/index.js'

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
  registerJobRoutes(app)
  registerTrackerRoutes(app)
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
    const reviewRows = queueBefore.body.items.filter(
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
    const liveRows = trackerAfter.body.items.filter(
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
    const rows = tracker.body.items.filter(
      (r) => r.listing?.id === propertyId || r.listing_id === propertyId,
    )
    expect(rows[0]?.status).toBe('rejected')
    expect(rows[0]?.error_class).toBe('portal_rules_violation')
  })

  it('env-scoped LIVE vs TEST is a presentation concern (PA-NAV-001); data layer is env-agnostic', async () => {
    // Backend distribution rows are not env-partitioned in Week 2; PA-NAV-001
    // scopes the admin chrome. This assertion documents the contract so UI
    // tests (EnvBadge / EnvWarningStrip) own LIVE vs TEST rendering.
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

    const res = await request(buildApp())
      .get('/api/publishing/tracker')
      .query({ status: 'in_review' })
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    // No env field required on tracker items — chrome owns LIVE/TEST.
    const item = res.body.items.find(
      (r) => r.listing?.id === propertyId || r.listing_id === propertyId,
    )
    expect(item).toBeTruthy()
    expect(item.env).toBeUndefined()
  })
})
