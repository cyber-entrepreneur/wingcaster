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
import { findOne, query } from '../../db.js'
import { createAgencyWithOwner } from '../../tenant-authorization.js'
import { registerAgencyInvitationRoutes } from './invitation-routes.js'
import { createAgencyInvitation } from './invitations.js'

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../../persistence/migrations')

function buildApp() {
  const app = express()
  app.use(express.json())
  registerAgencyInvitationRoutes(app)
  return app
}

async function agentAccount(label = 'Agent') {
  const userId = randomUUID()
  const now = new Date().toISOString()
  const email = `inv-${userId.slice(0, 8)}@x.test`
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
    agent: { id: userId, email, name: label, slug: `u-${userId.slice(0, 8)}` },
  })
  const token = signToken({
    id: userId,
    email,
    name: label,
    token_version: 0,
    verified_at: now,
  })
  return { userId, token, email, name: label }
}

async function ownerAgency({ name = 'Invite Agency', slug = null } = {}) {
  const owner = await agentAccount('Owner')
  const agencyId = randomUUID()
  await createAgencyWithOwner({
    agency: {
      id: agencyId,
      name,
      slug: slug || `agency-${agencyId.slice(0, 8)}`,
      logo: 'https://cdn.example.test/logo.png',
      description: 'A test agency',
    },
    ownerUserId: owner.userId,
  })
  return { ...owner, agencyId }
}

finPostgresSuite('agency invitations (BE-BLOCKER-07)', { seed: false }, ({ pool }) => {
  it('migration creates agency_invitations with code + agency_id indexes', async () => {
    const table = await pool().query(`SELECT to_regclass('public.agency_invitations') AS t`)
    expect(table.rows[0].t).toBeTruthy()

    const cols = await pool().query(
      `SELECT column_name, is_nullable, data_type
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'agency_invitations'
        ORDER BY ordinal_position`,
    )
    const byName = Object.fromEntries(cols.rows.map((r) => [r.column_name, r]))
    for (const col of [
      'id', 'agency_id', 'code', 'created_by', 'expires_at',
      'single_use', 'used_at', 'revoked_at', 'created_at', 'updated_at',
    ]) {
      expect(byName[col]).toBeTruthy()
    }
    expect(byName.expires_at.is_nullable).toBe('NO')
    expect(byName.used_at.is_nullable).toBe('YES')
    expect(byName.revoked_at.is_nullable).toBe('YES')

    const indexes = await pool().query(
      `SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'agency_invitations'
        ORDER BY indexname`,
    )
    const names = indexes.rows.map((r) => r.indexname)
    expect(names).toEqual(expect.arrayContaining([
      'uq_agency_invitations_code',
      'idx_agency_invitations_agency_id',
    ]))

    const sql = await readFile(join(migrationsDir, '325_agency_invitations.sql'), 'utf8')
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.agency_invitations/)
    await pool().query(sql)
    await pool().query(sql)
    const after = await pool().query(`SELECT to_regclass('public.agency_invitations') AS t`)
    expect(after.rows[0].t).toBeTruthy()
  })

  it('GET valid code returns agency payload with status=valid', async () => {
    const { agencyId, userId, token } = await ownerAgency({ name: 'Valid Co', slug: 'valid-co' })
    const app = buildApp()
    const created = await request(app)
      .post(`/api/agencies/${agencyId}/invitations`)
      .set('Authorization', `Bearer ${token}`)
      .send({ expires_in_days: 7, single_use: true })
    expect(created.status).toBe(201)
    expect(created.body.code).toBeTruthy()
    expect(created.body.created_by).toBe(userId)

    const got = await request(app).get(`/api/invitations/${created.body.code}`)
    expect(got.status).toBe(200)
    expect(got.body.status).toBe('valid')
    expect(got.body.single_use).toBe(true)
    expect(got.body.agency).toMatchObject({
      id: agencyId,
      name: 'Valid Co',
      slug: 'valid-co',
      logo: 'https://cdn.example.test/logo.png',
      description: 'A test agency',
    })
    expect(got.body.expires_at).toBeTruthy()
  })

  it('GET/accept expired → INVITATION_EXPIRED', async () => {
    const { agencyId, userId } = await ownerAgency({ name: 'Expired Co', slug: 'expired-co' })
    const invite = await createAgencyInvitation({
      agencyId,
      createdBy: userId,
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      singleUse: true,
    })
    const app = buildApp()

    const got = await request(app).get(`/api/invitations/${invite.code}`)
    expect(got.status).toBe(200)
    expect(got.body.status).toBe('expired')

    const applicant = await agentAccount('Applicant')
    const accept = await request(app)
      .post(`/api/invitations/${invite.code}/accept`)
      .set('Authorization', `Bearer ${applicant.token}`)
      .send({ message: 'please' })
    expect(accept.status).toBe(410)
    expect(accept.body.error).toBe('INVITATION_EXPIRED')
    expect(accept.body.expired_at).toBeTruthy()
    expect(accept.body.fallback_slug).toBe('expired-co')
    expect(accept.body.message).toMatch(/expired/i)
  })

  it('accept creates application + sets used_at for single_use', async () => {
    const { agencyId, token: ownerToken } = await ownerAgency({ name: 'Accept Co' })
    const app = buildApp()
    const created = await request(app)
      .post(`/api/agencies/${agencyId}/invitations`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ single_use: true })
    expect(created.status).toBe(201)

    const applicant = await agentAccount('Joiner')
    const accept = await request(app)
      .post(`/api/invitations/${created.body.code}/accept`)
      .set('Authorization', `Bearer ${applicant.token}`)
      .send({
        message: 'Happy to join',
        current_listings_count: 3,
        portfolio_url: 'https://portfolio.example.test',
        availability: 'full-time',
      })
    expect(accept.status).toBe(201)
    expect(accept.body.success).toBe(true)
    expect(accept.body.application).toMatchObject({
      agency_id: agencyId,
      applicant_user_id: applicant.userId,
      invitation_code: created.body.code,
      referral_source: 'direct_invitation',
      status: 'pending',
      message: 'Happy to join',
      current_listings_count: 3,
    })

    const stored = await findOne(
      'agency_applications',
      (row) => row.id === accept.body.application.id,
    )
    expect(stored).toBeTruthy()
    expect(stored.invitation_code).toBe(created.body.code)
    expect(stored.referral_source).toBe('direct_invitation')

    const inviteRows = await query(
      `SELECT used_at, single_use FROM public.agency_invitations WHERE code = $1`,
      [created.body.code],
    )
    expect(inviteRows[0].single_use).toBe(true)
    expect(inviteRows[0].used_at).toBeTruthy()
  })

  it('second accept on single_use fails', async () => {
    const { agencyId, token: ownerToken } = await ownerAgency({ name: 'Once Co' })
    const app = buildApp()
    const created = await request(app)
      .post(`/api/agencies/${agencyId}/invitations`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ single_use: true })

    const first = await agentAccount('First')
    const second = await agentAccount('Second')

    const ok = await request(app)
      .post(`/api/invitations/${created.body.code}/accept`)
      .set('Authorization', `Bearer ${first.token}`)
      .send({ message: 'first' })
    expect(ok.status).toBe(201)

    const reused = await request(app)
      .post(`/api/invitations/${created.body.code}/accept`)
      .set('Authorization', `Bearer ${second.token}`)
      .send({ message: 'second' })
    expect(reused.status).toBe(409)
    expect(reused.body.error).toBe('INVITATION_USED')

    const got = await request(app).get(`/api/invitations/${created.body.code}`)
    expect(got.status).toBe(200)
    expect(got.body.status).toBe('used')
  })

  it('revoked invitation rejected', async () => {
    const { agencyId, userId } = await ownerAgency({ name: 'Revoked Co' })
    const invite = await createAgencyInvitation({
      agencyId,
      createdBy: userId,
      expiresInDays: 14,
      singleUse: true,
    })
    await query(
      `UPDATE public.agency_invitations
          SET revoked_at = NOW(), updated_at = NOW()
        WHERE id = $1`,
      [invite.id],
    )

    const app = buildApp()
    const got = await request(app).get(`/api/invitations/${invite.code}`)
    expect(got.status).toBe(200)
    expect(got.body.status).toBe('revoked')

    const applicant = await agentAccount('TooLate')
    const accept = await request(app)
      .post(`/api/invitations/${invite.code}/accept`)
      .set('Authorization', `Bearer ${applicant.token}`)
      .send({ message: 'hi' })
    expect(accept.status).toBe(410)
    expect(accept.body.error).toBe('INVITATION_REVOKED')
  })

  it('unknown code → 404; create requires owner/admin auth', async () => {
    const app = buildApp()
    const missing = await request(app).get('/api/invitations/no-such-code')
    expect(missing.status).toBe(404)

    const { agencyId } = await ownerAgency({ name: 'Auth Co' })
    const stranger = await agentAccount('Stranger')
    const forbidden = await request(app)
      .post(`/api/agencies/${agencyId}/invitations`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .send({})
    expect(forbidden.status).toBe(403)

    const unauth = await request(app)
      .post(`/api/agencies/${agencyId}/invitations`)
      .send({})
    expect(unauth.status).toBe(401)

    const acceptUnauth = await request(app)
      .post('/api/invitations/whatever/accept')
      .send({})
    expect(acceptUnauth.status).toBe(401)
  })
})
