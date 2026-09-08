/**
 * Real-Postgres coverage for BE-BLOCKER-08:
 * agencies.accepting_applications column + owner toggle + public read.
 */
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import request from 'supertest'
import { beforeAll, expect, it } from 'vitest'
import { finPostgresSuite } from './fin/testing/suite.js'
import { createAgentAccount } from './identity.js'
import { signToken } from './auth.js'
import { createAgencyWithOwner } from './tenant-authorization.js'
import { findOne, update } from './db.js'

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'persistence/migrations')

async function agentAccount(label = 'Agent') {
  const userId = randomUUID()
  const now = new Date().toISOString()
  const email = `acc-${userId}@x.test`
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

async function ownerAgency({ name = 'Accepting Agency', slug } = {}) {
  const owner = await agentAccount('Owner')
  const agencyId = randomUUID()
  const agencySlug = slug || `agency-${agencyId.slice(0, 8)}`
  await createAgencyWithOwner({
    agency: { id: agencyId, name, slug: agencySlug, description: 'Join us', logo: 'https://example.test/logo.png' },
    ownerUserId: owner.userId,
  })
  return { ...owner, agencyId, agencySlug }
}

finPostgresSuite('agencies accepting_applications (BE-BLOCKER-08)', { seed: false }, ({ pool }) => {
  let app

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'be-blocker-08-test-secret'
    ;({ app } = await import('./server.js'))
  })

  it('column exists with NOT NULL DEFAULT true', async () => {
    const cols = await pool().query(
      `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'agencies'
          AND column_name = 'accepting_applications'`,
    )
    expect(cols.rows).toHaveLength(1)
    expect(cols.rows[0].data_type).toBe('boolean')
    expect(cols.rows[0].is_nullable).toBe('NO')
    expect(String(cols.rows[0].column_default)).toMatch(/true/)

    const { agencyId } = await ownerAgency({ name: 'Default True Agency' })
    const row = await pool().query(
      `SELECT accepting_applications FROM public.agencies WHERE id = $1`,
      [agencyId],
    )
    expect(row.rows[0].accepting_applications).toBe(true)

    const viaDal = await findOne('agencies', (a) => a.id === agencyId)
    expect(viaDal.accepting_applications).toBe(true)
  })

  it('migration 326 is idempotent', async () => {
    const sql = await readFile(join(migrationsDir, '326_agencies_accepting_applications.sql'), 'utf8')
    await pool().query(sql)
    await pool().query(sql)
    const cols = await pool().query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'agencies'
          AND column_name = 'accepting_applications'`,
    )
    expect(cols.rows).toHaveLength(1)
  })

  it('PUT by owner toggles accepting_applications false then true', async () => {
    const { token, agencyId } = await ownerAgency({ name: 'Toggle Agency' })

    const off = await request(app)
      .put(`/api/agencies/${agencyId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ accepting_applications: false })
    expect(off.status).toBe(200)
    expect(off.body.accepting_applications).toBe(false)

    const dbOff = await pool().query(
      `SELECT accepting_applications FROM public.agencies WHERE id = $1`,
      [agencyId],
    )
    expect(dbOff.rows[0].accepting_applications).toBe(false)

    const on = await request(app)
      .put(`/api/agencies/${agencyId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ accepting_applications: true })
    expect(on.status).toBe(200)
    expect(on.body.accepting_applications).toBe(true)

    const patchOff = await request(app)
      .patch(`/api/agencies/${agencyId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ accepting_applications: false })
    expect(patchOff.status).toBe(200)
    expect(patchOff.body.accepting_applications).toBe(false)
  })

  it('non-member PUT is forbidden', async () => {
    const { agencyId } = await ownerAgency({ name: 'Forbidden Agency' })
    const stranger = await agentAccount('Stranger')

    const res = await request(app)
      .put(`/api/agencies/${agencyId}`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .send({ accepting_applications: false })
    expect(res.status).toBe(403)

    const row = await pool().query(
      `SELECT accepting_applications FROM public.agencies WHERE id = $1`,
      [agencyId],
    )
    expect(row.rows[0].accepting_applications).toBe(true)
  })

  it('public GET reflects accepting_applications by id and slug', async () => {
    const { agencyId, agencySlug } = await ownerAgency({ name: 'Public Flag Agency' })

    const openById = await request(app).get(`/api/agencies/${agencyId}/public`)
    expect(openById.status).toBe(200)
    expect(openById.body).toMatchObject({
      id: agencyId,
      name: 'Public Flag Agency',
      slug: agencySlug,
      accepting_applications: true,
      member_count: 1,
    })
    expect(openById.body).toHaveProperty('listings_count')
    expect(openById.body).toHaveProperty('logo')
    expect(openById.body).toHaveProperty('description')

    await update('agencies', (a) => a.id === agencyId, (a) => ({ ...a, accepting_applications: false }))

    const closedBySlug = await request(app).get(`/api/agencies/${agencySlug}/public`)
    expect(closedBySlug.status).toBe(200)
    expect(closedBySlug.body.accepting_applications).toBe(false)

    const legacyPublic = await request(app).get(`/api/public/agencies/${agencyId}`)
    expect(legacyPublic.status).toBe(200)
    expect(legacyPublic.body.accepting_applications).toBe(false)
  })

  it('apply soft-gates with AGENCY_NOT_ACCEPTING when flag is false', async () => {
    const { agencyId } = await ownerAgency({ name: 'Closed Apply Agency' })
    await update('agencies', (a) => a.id === agencyId, (a) => ({ ...a, accepting_applications: false }))

    const res = await request(app).post('/api/agencies/apply').send({
      agency_id: agencyId,
      agent_email: 'applicant@x.test',
      agent_name: 'Applicant',
      agent_phone: '+15550001111',
      message: 'Please let me join',
    })
    expect(res.status).toBe(409)
    expect(res.body.code || res.body.error).toBe('AGENCY_NOT_ACCEPTING')
  })
})
