import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import request from 'supertest'
import { expect, it } from 'vitest'
import { finPostgresSuite } from '../../fin/testing/suite.js'
import { createAgentAccount } from '../../identity.js'
import { authMiddleware, signToken } from '../../auth.js'
import { query } from '../../db.js'
import { consume, grant } from '../credits/engine.js'
import { creditTenantIdForScope } from '../credits/tenant-context.js'
import { FEATURES } from '../credits/features.js'
import {
  listTrackerAttempts,
  parseTrackerQuery,
  resolveTrackerScope,
  summarizeTrackerAttempts,
} from './tracker.js'
import { registerRoutes } from './tracker-routes.js'

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../../persistence/migrations')

async function agentSession() {
  const userId = randomUUID()
  const now = new Date().toISOString()
  const email = `tr-${userId}@x.test`
  await createAgentAccount({
    user: {
      id: userId,
      email,
      name: 'Tracker Agent',
      password_hash: 'x',
      role: 'agent',
      verified: true,
      verified_at: now,
    },
    agent: { id: userId, email, name: 'Tracker Agent' },
  })
  const token = signToken({
    id: userId,
    email,
    name: 'Tracker Agent',
    token_version: 0,
    verified_at: now,
  })
  return { userId, token, tenantId: creditTenantIdForScope('personal', userId) }
}

async function insertProperty(pool, { id, agentId, address = '12 Marina Walk' }) {
  await pool.query(
    `INSERT INTO public.properties (id, agent_id, title, location, city, neighborhood, status, data)
     VALUES ($1, $2, 'Marina Apt', $3, 'Dubai', 'Marina', 'active', $4::jsonb)`,
    [id, agentId, address, JSON.stringify({ address, photos: [`https://cdn.example/${id}.jpg`] })],
  )
  await pool.query(
    `INSERT INTO public.property_media (id, property_id, type, url, order_index, is_hero)
     VALUES ($1, $2, 'image', $3, 0, true)`,
    [randomUUID(), id, `https://cdn.example/${id}.jpg`],
  )
}

async function insertAttempt(pool, {
  id = randomUUID(),
  agentId,
  agencyId = null,
  propertyId,
  platform = 'bayut',
  jobStatus,
  attemptStatus,
  errorClass = null,
  errorMessage = null,
  submittedAt,
  liveUrl = null,
}) {
  const jobId = randomUUID()
  const publishedAt = attemptStatus === 'published' || jobStatus === 'published' ? submittedAt : null
  await pool.query(
    `INSERT INTO public.distribution_jobs (
       id, property_id, agent_id, agency_id, platform, status,
       published_at, created_at, updated_at, payload, data
     ) VALUES (
       $1, $2, $3, $4, $5, $6,
       $7::timestamptz, $8::timestamptz, $8::timestamptz, '{}'::jsonb, $9::jsonb
     )`,
    [
      jobId, propertyId, agentId, agencyId, platform, jobStatus,
      publishedAt, submittedAt, JSON.stringify(liveUrl ? { portal_live_url: liveUrl } : {}),
    ],
  )
  await pool.query(
    `INSERT INTO public.distribution_attempts (
       id, distribution_job_id, status, error_class, error_message,
       attempted_at, created_at, updated_at, response, data
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6::timestamptz, $6::timestamptz, $6::timestamptz, '{}'::jsonb, '{}'::jsonb
     )`,
    [id, jobId, attemptStatus, errorClass, errorMessage, submittedAt],
  )
  return { id, jobId }
}

const PORTALS = ['bayut', 'olx', 'property_finder', 'dubizzle']
const ATTEMPT_SPECS = [
  { jobStatus: 'published', attemptStatus: 'published' },
  { jobStatus: 'pending', attemptStatus: 'pending' },
  { jobStatus: 'pending_moderation', attemptStatus: 'in_review' },
  { jobStatus: 'rejected', attemptStatus: 'rejected', errorClass: 'portal_rules_violation', errorMessage: 'rules' },
  { jobStatus: 'expired', attemptStatus: 'expired' },
  { jobStatus: 'failed', attemptStatus: 'failed', errorClass: 'auth_expired', errorMessage: 'token expired' },
]

finPostgresSuite('publishing tracker routes (BE-BLOCKER-11)', { seed: false }, ({ pool }) => {
  it('migration 326 creates the required indexes idempotently', async () => {
    const sql = await readFile(join(migrationsDir, '326_publishing_tracker_indexes.sql'), 'utf8')
    await pool().query(sql)
    await pool().query(sql)
    const { rows } = await pool().query(`
      SELECT indexname FROM pg_indexes
       WHERE tablename IN ('distribution_jobs', 'distribution_attempts')
         AND indexname LIKE 'idx_distribution_%'
       ORDER BY indexname
    `)
    const names = rows.map((r) => r.indexname)
    expect(names).toEqual(expect.arrayContaining([
      'idx_distribution_jobs_agent_submitted_at',
      'idx_distribution_jobs_agency_submitted_at',
      'idx_distribution_jobs_platform_status',
      'idx_distribution_attempts_job_attempted_at',
    ]))
  })

  it('lists with tenant isolation, cursor pages, filters, summary KPI, and one SQL', async () => {
    const a = await agentSession()
    const b = await agentSession()
    const listingA = randomUUID()
    const listingB = randomUUID()
    await insertProperty(pool(), { id: listingA, agentId: a.userId })
    await insertProperty(pool(), { id: listingB, agentId: b.userId })

    const september = []
    for (let i = 0; i < 26; i += 1) {
      const spec = ATTEMPT_SPECS[i % ATTEMPT_SPECS.length]
      const portal = PORTALS[i % PORTALS.length]
      const inAugust = i < 6
      const day = String((i % 27) + 1).padStart(2, '0')
      const submittedAt = inAugust
        ? `2026-08-${day}T12:00:00.000Z`
        : `2026-09-${String((i % 20) + 1).padStart(2, '0')}T${String(10 + (i % 8)).padStart(2, '0')}:00:00.000Z`
      const row = await insertAttempt(pool(), {
        id: `att-a-${String(i).padStart(2, '0')}`,
        agentId: a.userId,
        propertyId: listingA,
        platform: portal,
        ...spec,
        submittedAt,
        liveUrl: spec.attemptStatus === 'published' ? `https://bayut.example/att-a-${i}` : null,
      })
      if (!inAugust) september.push(row)
    }

    for (let n = 0; n < 3; n += 1) {
      await insertAttempt(pool(), {
        id: `att-a-bayut-fail-${n}`,
        agentId: a.userId,
        propertyId: listingA,
        platform: 'bayut',
        jobStatus: 'failed',
        attemptStatus: 'failed',
        errorClass: 'auth_expired',
        errorMessage: 'token expired',
        submittedAt: `2026-09-1${n}T16:00:00.000Z`,
      })
    }

    for (let i = 0; i < 5; i += 1) {
      await insertAttempt(pool(), {
        id: `att-b-${i}`,
        agentId: b.userId,
        propertyId: listingB,
        platform: 'bayut',
        jobStatus: 'published',
        attemptStatus: 'published',
        submittedAt: `2026-09-0${i + 1}T08:00:00.000Z`,
        liveUrl: `https://bayut.example/b-${i}`,
      })
    }

    await grant({
      tenantId: a.tenantId,
      source: 'promo',
      amount: 5_000,
      grantRef: { idempotency_key: `tracker-seed-${a.userId}` },
    })
    for (const row of september.slice(0, 3)) {
      await consume({
        tenantId: a.tenantId,
        feature: FEATURES.PUBLISHING_REALESTATE_BAYUT,
        requestId: randomUUID(),
        creditsAmount: 100,
        relatedEntityType: 'distribution_attempt',
        relatedEntityId: row.id,
      })
    }

    const app = express()
    app.use(express.json())
    let queryCalls = 0
    const countingQuery = async (sql, params) => {
      queryCalls += 1
      return query(sql, params)
    }
    registerRoutes(app, { authMiddleware, query: countingQuery })

    const unauth = await request(app).get('/api/publishing/tracker')
    expect(unauth.status).toBe(401)

    queryCalls = 0
    const listA = await request(app)
      .get('/api/publishing/tracker')
      .query({ limit: 10, sort: 'submitted_at:desc' })
      .set('Authorization', `Bearer ${a.token}`)
    expect(listA.status, JSON.stringify(listA.body)).toBe(200)
    expect(listA.body.rows).toHaveLength(10)
    expect(listA.body.has_more).toBe(true)
    expect(listA.body.next_cursor).toBeTruthy()
    expect(listA.body.total).toBe(29)
    expect(listA.body.rows.every((row) => !String(row.distribution_attempt_id).startsWith('att-b-'))).toBe(true)
    expect(queryCalls).toBe(1)

    const idsPage1 = listA.body.rows.map((r) => r.distribution_attempt_id)
    queryCalls = 0
    const listA2 = await request(app)
      .get('/api/publishing/tracker')
      .query({ limit: 10, after: listA.body.next_cursor })
      .set('Authorization', `Bearer ${a.token}`)
    expect(listA2.status).toBe(200)
    const idsPage2 = listA2.body.rows.map((r) => r.distribution_attempt_id)
    expect(idsPage1.some((id) => idsPage2.includes(id))).toBe(false)
    expect(listA2.body.total).toBe(29)
    expect(queryCalls).toBe(1)

    const other = await request(app)
      .get('/api/publishing/tracker')
      .set('Authorization', `Bearer ${b.token}`)
    expect(other.status).toBe(200)
    expect(other.body.total).toBe(5)
    expect(other.body.rows.every((row) => String(row.distribution_attempt_id).startsWith('att-b-'))).toBe(true)

    const filtered = await request(app)
      .get('/api/publishing/tracker')
      .query({
        portal: 'bayut',
        status: 'failed',
        listing_id: listingA,
        from: '2026-09-01T00:00:00.000Z',
        to: '2026-09-30T23:59:59.999Z',
        limit: 50,
      })
      .set('Authorization', `Bearer ${a.token}`)
    expect(filtered.status, JSON.stringify(filtered.body)).toBe(200)
    expect(filtered.body.rows.length).toBeGreaterThan(0)
    for (const row of filtered.body.rows) {
      expect(row.portal.code).toBe('bayut')
      expect(row.status).toBe('failed')
      expect(row.listing.id).toBe(listingA)
      expect(row.error_class).toBe('auth_expired')
    }

    queryCalls = 0
    const summary = await request(app)
      .get('/api/publishing/tracker/summary')
      .query({
        portal: 'bayut',
        status: 'failed',
        listing_id: listingA,
        from: '2026-09-01T00:00:00.000Z',
        to: '2026-09-30T23:59:59.999Z',
      })
      .set('Authorization', `Bearer ${a.token}`)
    expect(summary.status, JSON.stringify(summary.body)).toBe(200)
    expect(summary.body.total_submissions).toBe(filtered.body.total)
    expect(summary.body.success_rate).toBe(0)
    expect(summary.body.top_failure_class).toMatchObject({
      class: 'auth_expired',
      display_label: 'Auth expired',
      count: filtered.body.total,
    })
    expect(queryCalls).toBe(1)

    const month = await request(app)
      .get('/api/publishing/tracker/summary')
      .set('Authorization', `Bearer ${a.token}`)
    expect(month.status).toBe(200)
    expect(month.body.scope.from).toMatch(/^2026-09-01/)
    expect(month.body.scope.to).toMatch(/^2026-09-/)
    expect(month.body.total_submissions).toBe(23)
    expect(month.body.credits_spent).toBe(300)
    expect(month.body.success_rate).toBeGreaterThan(0)
    expect(month.body.top_failure_class.class).toBeTruthy()
    expect(month.body.top_failure_class.display_label).toBeTruthy()

    const sample = [...listA.body.rows, ...listA2.body.rows]
    const liveRow = sample.find((row) => row.status === 'live')
    expect(liveRow).toBeTruthy()
    expect(liveRow.listing.address_line).toBeTruthy()
    expect(liveRow.listing.thumbnail_url).toMatch(/^https:\/\//)
    expect(liveRow.portal.display_name).toBeTruthy()
    expect(liveRow.portal.channel_token_key).toMatch(/publishing\.realestate\./)

    const helperScope = resolveTrackerScope({
      user: { id: a.userId, agent_id: a.userId },
      agent: { id: a.userId, agency_id: null },
      get: () => null,
      headers: {},
    })
    let helperQueries = 0
    const wrap = async (sql, params) => {
      helperQueries += 1
      return query(sql, params)
    }
    const helperList = await listTrackerAttempts(wrap, {
      scope: helperScope,
      filters: parseTrackerQuery({ limit: 5 }),
    })
    expect(helperQueries).toBe(1)
    expect(helperList.rows).toHaveLength(5)

    helperQueries = 0
    await summarizeTrackerAttempts(wrap, {
      scope: helperScope,
      filters: parseTrackerQuery({}, { defaultMonth: true }),
    })
    expect(helperQueries).toBe(1)
  })
})
