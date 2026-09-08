/**
 * Real-Postgres coverage for BE-BLOCKER-06:
 *   - migration 324 creates public.agency_applications
 *   - POST /api/agencies/:slug/applications writes uplift columns
 *   - duplicate pending → 409 ALREADY_APPLIED
 *   - approve / reject against promoted table
 *   - DAL insert no longer lands in legacy_collections
 */
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import request from 'supertest'
import { expect, it } from 'vitest'
import { finPostgresSuite } from './fin/testing/suite.js'
import { createAgentAccount } from './identity.js'
import { signToken } from './auth.js'
import { insert, query } from './db.js'
import { isKnownCollection, resolveTable } from './persistence/table-mapper.js'
import { createAgencyWithOwner } from './tenant-authorization.js'
import {
  expectedResponseBy,
  registerAgencyApplicationRoutes,
} from './lib/agencies/applications-routes.js'

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'persistence/migrations')

function buildApp() {
  const app = express()
  app.use(express.json())
  registerAgencyApplicationRoutes(app)
  return app
}

async function agentAccount(label = 'Agent') {
  const userId = randomUUID()
  const now = new Date().toISOString()
  const email = `${label.toLowerCase().replace(/\s+/g, '-')}-${userId.slice(0, 8)}@x.test`
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
  return { userId, token, email }
}

async function ownerAgency({ name = 'Apply Agency', slug = 'apply-agency' } = {}) {
  const owner = await agentAccount('Owner')
  const agencyId = randomUUID()
  await createAgencyWithOwner({
    agency: { id: agencyId, name, slug },
    ownerUserId: owner.userId,
  })
  return { ...owner, agencyId, slug, name }
}

const applyBody = {
  message: 'I would like to join your team.',
  current_listings_count: 3,
  portfolio_url: 'https://example.com/portfolio',
  availability: 'within_2_weeks',
  referral_source: 'agency_profile',
  consents: { terms: true, profile_share: true },
}

finPostgresSuite('agency applications uplift', { seed: false }, ({ pool }) => {
  it('migration creates agency_applications with uplift columns', async () => {
    const table = await pool().query(`SELECT to_regclass('public.agency_applications') AS t`)
    expect(table.rows[0].t).toBeTruthy()

    const cols = await pool().query(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'agency_applications'`,
    )
    const names = new Set(cols.rows.map((r) => r.column_name))
    for (const required of [
      'id', 'agency_id', 'applicant_user_id', 'agent_email', 'agent_name', 'agent_phone',
      'message', 'current_listings_count', 'portfolio_url', 'availability', 'referral_source',
      'profile_share_consent', 'invitation_code', 'expected_response_by', 'status',
      'approved_at', 'approved_by', 'approved_role', 'affiliation_mode',
      'rejected_at', 'rejected_by', 'created_at', 'updated_at', 'data',
    ]) {
      expect(names.has(required), `missing column ${required}`).toBe(true)
    }

    expect(isKnownCollection('agency_applications')).toBe(true)
    expect(resolveTable('agency_applications').table).toBe('agency_applications')
  })

  it('migration 324 is idempotent and backfills from legacy_collections', async () => {
    const { agencyId } = await ownerAgency({ name: 'Legacy Backfill Co', slug: 'legacy-backfill' })
    const legacyId = randomUUID()
    const now = new Date().toISOString()
    await pool().query(
      `INSERT INTO public.legacy_collections (collection, id, data, created_at, updated_at)
       VALUES ('agency_applications', $1, $2::jsonb, $3::timestamptz, $3::timestamptz)
       ON CONFLICT DO NOTHING`,
      [
        legacyId,
        JSON.stringify({
          id: legacyId,
          agency_id: agencyId,
          agent_email: 'legacy@x.test',
          agent_name: 'Legacy Agent',
          message: 'from legacy',
          status: 'pending',
          created_at: now,
        }),
        now,
      ],
    )

    const sql = await readFile(join(migrationsDir, '324_agency_applications_uplift.sql'), 'utf8')
    await pool().query(sql)
    await pool().query(sql)

    const promoted = await pool().query(
      `SELECT id, agency_id, agent_email, status FROM public.agency_applications WHERE id = $1`,
      [legacyId],
    )
    expect(promoted.rows).toHaveLength(1)
    expect(promoted.rows[0].agent_email).toBe('legacy@x.test')

    const leftover = await pool().query(
      `SELECT id FROM public.legacy_collections
        WHERE collection = 'agency_applications' AND id = $1`,
      [legacyId],
    )
    expect(leftover.rows).toHaveLength(0)
  })

  it('POST by slug creates row with uplift fields and expected_response_by', async () => {
    const agency = await ownerAgency({ name: 'Slug Apply Co', slug: 'slug-apply' })
    const applicant = await agentAccount('Applicant')
    const app = buildApp()
    const before = Date.now()
    const res = await request(app)
      .post(`/api/agencies/${agency.slug}/applications`)
      .set('Authorization', `Bearer ${applicant.token}`)
      .send(applyBody)

    expect(res.status).toBe(201)
    expect(res.body.redirect_to).toMatch(/^\/applications\//)
    expect(res.body.application).toMatchObject({
      agency_id: agency.agencyId,
      agency_name: agency.name,
      status: 'pending',
    })
    expect(res.body.application.expected_response_by).toBeTruthy()

    const expected = new Date(expectedResponseBy(new Date(res.body.application.created_at))).getTime()
    const actual = new Date(res.body.application.expected_response_by).getTime()
    expect(Math.abs(actual - expected)).toBeLessThan(2000)
    expect(actual).toBeGreaterThan(before)

    const row = await pool().query(
      `SELECT agency_id, applicant_user_id, agent_email, message, current_listings_count,
              portfolio_url, availability, referral_source, profile_share_consent,
              expected_response_by, status
         FROM public.agency_applications WHERE id = $1`,
      [res.body.application.id],
    )
    expect(row.rows).toHaveLength(1)
    expect(row.rows[0]).toMatchObject({
      agency_id: agency.agencyId,
      applicant_user_id: applicant.userId,
      agent_email: applicant.email,
      message: applyBody.message,
      current_listings_count: 3,
      portfolio_url: applyBody.portfolio_url,
      availability: 'within_2_weeks',
      referral_source: 'agency_profile',
      profile_share_consent: true,
      status: 'pending',
    })
  })

  it('duplicate pending application returns 409 ALREADY_APPLIED', async () => {
    const agency = await ownerAgency({ name: 'Dup Agency', slug: 'dup-agency' })
    const applicant = await agentAccount('DupApplicant')
    const app = buildApp()

    const first = await request(app)
      .post(`/api/agencies/${agency.slug}/applications`)
      .set('Authorization', `Bearer ${applicant.token}`)
      .send(applyBody)
    expect(first.status).toBe(201)

    const second = await request(app)
      .post(`/api/agencies/${agency.agencyId}/applications`)
      .set('Authorization', `Bearer ${applicant.token}`)
      .send({ ...applyBody, message: 'Trying again' })
    expect(second.status).toBe(409)
    expect(second.body.code).toBe('ALREADY_APPLIED')
  })

  it('legacy approve and reject still work against promoted table', async () => {
    const agency = await ownerAgency({ name: 'Review Agency', slug: 'review-agency' })
    const applicant = await agentAccount('ReviewApplicant')
    const rejectedApplicant = await agentAccount('RejectApplicant')
    const app = buildApp()

    const created = await request(app)
      .post(`/api/agencies/${agency.slug}/applications`)
      .set('Authorization', `Bearer ${applicant.token}`)
      .send(applyBody)
    expect(created.status).toBe(201)

    const list = await request(app)
      .get(`/api/agencies/${agency.agencyId}/applications`)
      .set('Authorization', `Bearer ${agency.token}`)
    expect(list.status).toBe(200)
    expect(list.body.some((row) => row.id === created.body.application.id)).toBe(true)

    const approved = await request(app)
      .post(`/api/agencies/${agency.agencyId}/applications/${created.body.application.id}/approve`)
      .set('Authorization', `Bearer ${agency.token}`)
      .send({ role: 'member', affiliation_mode: 'non_exclusive' })
    expect(approved.status).toBe(200)
    expect(approved.body.success).toBe(true)

    const approvedRow = await pool().query(
      `SELECT status, approved_by, approved_role, affiliation_mode
         FROM public.agency_applications WHERE id = $1`,
      [created.body.application.id],
    )
    expect(approvedRow.rows[0]).toMatchObject({
      status: 'approved',
      approved_by: agency.userId,
      approved_role: 'member',
      affiliation_mode: 'non_exclusive',
    })

    const toReject = await request(app)
      .post(`/api/agencies/${agency.slug}/applications`)
      .set('Authorization', `Bearer ${rejectedApplicant.token}`)
      .send(applyBody)
    expect(toReject.status).toBe(201)

    const rejected = await request(app)
      .post(`/api/agencies/${agency.agencyId}/applications/${toReject.body.application.id}/reject`)
      .set('Authorization', `Bearer ${agency.token}`)
    expect(rejected.status).toBe(200)

    const rejectedRow = await pool().query(
      `SELECT status, rejected_by FROM public.agency_applications WHERE id = $1`,
      [toReject.body.application.id],
    )
    expect(rejectedRow.rows[0].status).toBe('rejected')
    expect(rejectedRow.rows[0].rejected_by).toBe(agency.userId)
  })

  it('mapper insert writes public.agency_applications not legacy_collections', async () => {
    const agency = await ownerAgency({ name: 'Mapper Agency', slug: 'mapper-agency' })
    const id = randomUUID()
    const now = new Date().toISOString()
    await insert('agency_applications', {
      id,
      agency_id: agency.agencyId,
      applicant_user_id: agency.userId,
      agent_email: agency.email,
      agent_name: 'Owner',
      message: 'direct insert',
      profile_share_consent: true,
      status: 'pending',
      created_at: now,
      updated_at: now,
    })

    const real = await query(
      `SELECT id FROM public.agency_applications WHERE id = $1`,
      [id],
    )
    expect(real).toHaveLength(1)

    const legacy = await query(
      `SELECT id FROM public.legacy_collections
        WHERE collection = 'agency_applications' AND id = $1`,
      [id],
    )
    expect(legacy).toHaveLength(0)
  })

  it('legacy POST /api/agencies/apply returns 410', async () => {
    const app = buildApp()
    const res = await request(app)
      .post('/api/agencies/apply')
      .send({ agency_id: 'x', agent_email: 'a@b.com' })
    expect(res.status).toBe(410)
    expect(res.body.code).toBe('ROUTE_MOVED')
  })
})
