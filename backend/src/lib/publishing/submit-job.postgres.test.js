/**
 * Real-Postgres coverage for AGT-PUB-005 submit create + portal picker.
 */
import { randomUUID } from 'node:crypto'
import express from 'express'
import request from 'supertest'
import { beforeEach, expect, it } from 'vitest'
import { finPostgresSuite } from '../../fin/testing/suite.js'
import { createAgentAccount } from '../../identity.js'
import { signToken } from '../../auth.js'
import { registerRoutes } from './jobs-routes.js'
import { listPortalsForSubmit } from './submit-job.js'

function buildApp() {
  const app = express()
  app.use(express.json())
  registerRoutes(app)
  return app
}

async function agentSession(suffix = '') {
  const userId = randomUUID()
  const now = new Date().toISOString()
  const email = `sub-${suffix}${userId.slice(0, 8)}@x.test`
  await createAgentAccount({
    user: {
      id: userId,
      email,
      name: 'Submitter',
      password_hash: 'x',
      role: 'agent',
      verified: true,
      verified_at: now,
    },
    agent: { id: userId, email, name: 'Submitter' },
  })
  const token = signToken({
    id: userId,
    email,
    name: 'Submitter',
    token_version: 0,
    verified_at: now,
  })
  return { userId, token }
}

async function seedProperty(pool, { agentId, title = 'Submit Listing' }) {
  const id = randomUUID()
  await pool.query(
    `INSERT INTO public.properties (id, agent_id, title, city, status, data)
     VALUES ($1, $2, $3, 'Dubai', 'active', '{}'::jsonb)`,
    [id, agentId, title],
  )
  return id
}

/**
 * Upsert a portal_registry row for submit tests.
 * Codes are unique; tests use ephemeral suffixes to avoid clobbering seeds.
 */
async function upsertPortal(pool, {
  code,
  displayName = code,
  countryCodes = ['AE'],
  isActive = true,
  deprecatedAt = null,
  adapter = 'portals/test-stub.js',
}) {
  const id = randomUUID()
  await pool.query(
    `INSERT INTO public.portal_registry (
       id, code, display_name, description, country_codes, primary_language,
       adapter_class_name, publisher_config, inbound_config, is_active, deprecated_at
     ) VALUES (
       $1, $2, $3, 'submit test portal', $4::text[], 'en',
       $5, '{}'::jsonb, '{}'::jsonb, $6, $7::timestamptz
     )
     ON CONFLICT (code) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       country_codes = EXCLUDED.country_codes,
       is_active = EXCLUDED.is_active,
       deprecated_at = EXCLUDED.deprecated_at,
       updated_at = CURRENT_TIMESTAMP`,
    [id, code, displayName, countryCodes, adapter, isActive, deprecatedAt],
  )
  return code
}

finPostgresSuite('publishing submit job (AGT-PUB-005)', { seed: false }, ({ pool }) => {
  const activeCode = `sub_active_${randomUUID().slice(0, 8)}`
  const inactiveCode = `sub_inactive_${randomUUID().slice(0, 8)}`
  const deprecatedCode = `sub_depr_${randomUUID().slice(0, 8)}`
  const emptyCoverageCode = `sub_empty_${randomUUID().slice(0, 8)}`

  beforeEach(async () => {
    await upsertPortal(pool(), { code: activeCode, countryCodes: ['AE'], isActive: true })
    await upsertPortal(pool(), { code: inactiveCode, countryCodes: ['AE'], isActive: false })
    await upsertPortal(pool(), {
      code: deprecatedCode,
      countryCodes: ['AE'],
      isActive: true,
      deprecatedAt: new Date().toISOString(),
    })
    await upsertPortal(pool(), {
      code: emptyCoverageCode,
      countryCodes: [],
      isActive: true,
    })
  })

  it('GET /api/portals returns active portals only (stubs excluded)', async () => {
    const portals = await listPortalsForSubmit()
    const codes = portals.map((p) => p.code)
    expect(codes).toContain(activeCode)
    expect(codes).not.toContain(inactiveCode)
    expect(codes).not.toContain(deprecatedCode)

    const app = buildApp()
    const { token } = await agentSession('picker')
    const res = await request(app)
      .get('/api/portals')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    const apiCodes = (res.body.portals || []).map((p) => p.code)
    expect(apiCodes).toContain(activeCode)
    expect(apiCodes).not.toContain(inactiveCode)
  })

  it('POST /api/publishing/jobs creates job + destinations + audit_log', async () => {
    const app = buildApp()
    const { userId, token } = await agentSession('happy')
    const propertyId = await seedProperty(pool(), { agentId: userId })

    const res = await request(app)
      .post('/api/publishing/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ property_id: propertyId, portals: [{ code: activeCode, country_code: 'AE' }] })

    expect(res.status).toBe(201)
    expect(res.body.jobId).toBeTruthy()
    expect(res.body.destinations?.length).toBeGreaterThanOrEqual(1)

    const jobs = await pool().query(
      `SELECT id, property_id, agent_id FROM public.publishing_jobs WHERE id = $1`,
      [res.body.jobId],
    )
    expect(jobs.rows).toHaveLength(1)
    expect(jobs.rows[0].property_id).toBe(propertyId)

    const dests = await pool().query(
      `SELECT id, platform, status FROM public.distribution_jobs WHERE publishing_job_id = $1`,
      [res.body.jobId],
    )
    expect(dests.rows).toHaveLength(1)
    expect(dests.rows[0].platform).toBe(activeCode)
    expect(dests.rows[0].status).toBe('pending_moderation')

    const audit = await pool().query(
      `SELECT type, action, entity_id, tenant_id, metadata
         FROM public.audit_log
        WHERE type = 'publishing_job' AND action = 'submit_created' AND entity_id = $1`,
      [res.body.jobId],
    )
    expect(audit.rows).toHaveLength(1)
    expect(audit.rows[0].tenant_id).toBe(`personal:${userId}`)
    expect(audit.rows[0].metadata).toMatchObject({
      property_id: propertyId,
      portal_codes: [activeCode],
      actor_user_id: userId,
    })
  })

  it('rejects cross-tenant property via assertOwnsProperty (404)', async () => {
    const app = buildApp()
    const owner = await agentSession('owner')
    const other = await agentSession('other')
    const propertyId = await seedProperty(pool(), { agentId: owner.userId })

    const res = await request(app)
      .post('/api/publishing/jobs')
      .set('Authorization', `Bearer ${other.token}`)
      .send({ property_id: propertyId, portals: [activeCode] })

    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/not found/i)
  })

  it('rejects deprecated portal', async () => {
    const app = buildApp()
    const { userId, token } = await agentSession('depr')
    const propertyId = await seedProperty(pool(), { agentId: userId })

    const res = await request(app)
      .post('/api/publishing/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ property_id: propertyId, portals: [deprecatedCode] })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('PORTAL_NOT_FOUND')
  })

  it('rejects inactive portal', async () => {
    const app = buildApp()
    const { userId, token } = await agentSession('inact')
    const propertyId = await seedProperty(pool(), { agentId: userId })

    const res = await request(app)
      .post('/api/publishing/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ property_id: propertyId, portals: [inactiveCode] })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('PORTAL_INACTIVE')
  })

  it('rejects empty country_codes with PORTAL_COVERAGE_UNDEFINED', async () => {
    const app = buildApp()
    const { userId, token } = await agentSession('empty')
    const propertyId = await seedProperty(pool(), { agentId: userId })

    const res = await request(app)
      .post('/api/publishing/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ property_id: propertyId, portals: [emptyCoverageCode] })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('PORTAL_COVERAGE_UNDEFINED')
  })

  it('short-window idempotency returns the same job id on double-tap', async () => {
    const app = buildApp()
    const { userId, token } = await agentSession('dedupe')
    const propertyId = await seedProperty(pool(), { agentId: userId })
    const body = {
      property_id: propertyId,
      portals: [{ code: activeCode, country_code: 'AE' }],
    }

    const first = await request(app)
      .post('/api/publishing/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
    expect(first.status).toBe(201)

    const second = await request(app)
      .post('/api/publishing/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
    expect(second.status).toBe(201)
    expect(second.body.jobId).toBe(first.body.jobId)

    const jobCount = await pool().query(
      `SELECT count(*)::int AS n FROM public.publishing_jobs WHERE property_id = $1`,
      [propertyId],
    )
    expect(jobCount.rows[0].n).toBe(1)

    const destCount = await pool().query(
      `SELECT count(*)::int AS n FROM public.distribution_jobs WHERE property_id = $1`,
      [propertyId],
    )
    expect(destCount.rows[0].n).toBe(1)
  })
})
