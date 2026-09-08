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
import { addAgencyMembership, createAgencyWithOwner } from '../../tenant-authorization.js'
import { patchAgencyOnboardingState, AGENCY_CHECKLIST_KEYS } from './agency-state.js'
import { registerAgencyOnboardingStateRoutes } from './agency-state-routes.js'

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../../persistence/migrations')

function buildApp() {
  const app = express()
  app.use(express.json())
  registerAgencyOnboardingStateRoutes(app)
  return app
}

async function agentAccount(label = 'Agent') {
  const userId = randomUUID()
  const now = new Date().toISOString()
  const email = `ag-${userId}@x.test`
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

async function ownerAgency(name = 'Onboard Agency') {
  const owner = await agentAccount('Owner')
  const agencyId = randomUUID()
  await createAgencyWithOwner({
    agency: { id: agencyId, name },
    ownerUserId: owner.userId,
  })
  return { ...owner, agencyId }
}

function url(agencyId) {
  return `/api/agency/${agencyId}/onboarding-state`
}

finPostgresSuite('agency onboarding state', { seed: false }, ({ pool }) => {
  it('migration creates agency_onboarding_state with agency_id PK', async () => {
    const table = await pool().query(`SELECT to_regclass('public.agency_onboarding_state') AS t`)
    expect(table.rows[0].t).toBeTruthy()
    const cols = await pool().query(
      `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'agency_onboarding_state'
        ORDER BY ordinal_position`,
    )
    const byName = Object.fromEntries(cols.rows.map((r) => [r.column_name, r]))
    expect(byName.agency_id).toBeTruthy()
    expect(byName.step).toBeTruthy()
    expect(byName.path).toBeTruthy()
    expect(byName.checklist.data_type).toBe('jsonb')
    expect(byName.dismissed_forever).toBeTruthy()
    expect(byName.updated_at).toBeTruthy()
    const pk = await pool().query(
      `SELECT a.attname
         FROM pg_index i
         JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = 'public.agency_onboarding_state'::regclass AND i.indisprimary`,
    )
    expect(pk.rows.map((r) => r.attname)).toEqual(['agency_id'])
    expect(AGENCY_CHECKLIST_KEYS).toEqual([
      'branding', 'invites', 'billing', 'portal', 'listing', 'roles', '2FA',
    ])
  })

  it('migration 322 is idempotent', async () => {
    const sql = await readFile(join(migrationsDir, '322_agency_onboarding_state.sql'), 'utf8')
    await pool().query(sql)
    await pool().query(sql)
    const table = await pool().query(`SELECT to_regclass('public.agency_onboarding_state') AS t`)
    expect(table.rows[0].t).toBeTruthy()
  })

  it('GET before write returns default state', async () => {
    const { token, agencyId } = await ownerAgency()
    const app = buildApp()
    const res = await request(app)
      .get(url(agencyId))
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      step: 'welcome',
      path: null,
      checklist: {},
      dismissed_forever: false,
    })
  })

  it('PATCH persists and GET returns stored state', async () => {
    const { token, agencyId } = await ownerAgency()
    const app = buildApp()
    const patched = await request(app)
      .patch(url(agencyId))
      .set('Authorization', `Bearer ${token}`)
      .send({
        step: 'branding',
        path: 'agency',
        checklist_delta: { branding: true, invites: { done: false } },
        dismissed_forever: false,
      })
    expect(patched.status).toBe(200)
    expect(patched.body).toMatchObject({
      step: 'branding',
      path: 'agency',
      checklist: { branding: true, invites: { done: false } },
      dismissed_forever: false,
    })

    const got = await request(app)
      .get(url(agencyId))
      .set('Authorization', `Bearer ${token}`)
    expect(got.status).toBe(200)
    expect(got.body).toEqual(patched.body)

    const row = await query(
      `SELECT step, path, checklist, dismissed_forever FROM public.agency_onboarding_state WHERE agency_id = $1`,
      [agencyId],
    )
    expect(row[0].step).toBe('branding')
    expect(row[0].checklist).toEqual({ branding: true, invites: { done: false } })
    expect(row).toHaveLength(1)
  })

  it('concurrent PATCHes merge checklist_delta safely', async () => {
    const { agencyId } = await ownerAgency()
    await patchAgencyOnboardingState(agencyId, { step: 'tour', checklist_delta: { branding: true } })

    await Promise.all([
      patchAgencyOnboardingState(agencyId, { checklist_delta: { invites: true } }),
      patchAgencyOnboardingState(agencyId, { checklist_delta: { billing: true } }),
      patchAgencyOnboardingState(agencyId, { checklist_delta: { '2FA': true } }),
      patchAgencyOnboardingState(agencyId, { step: 'done' }),
    ])

    const rows = await query(
      `SELECT step, checklist FROM public.agency_onboarding_state WHERE agency_id = $1`,
      [agencyId],
    )
    expect(rows[0].checklist).toMatchObject({
      branding: true,
      invites: true,
      billing: true,
      '2FA': true,
    })
    expect(rows[0].step).toBe('done')
  })

  it('rejects unauthenticated requests', async () => {
    const { agencyId } = await ownerAgency()
    const app = buildApp()
    const get = await request(app).get(url(agencyId))
    expect(get.status).toBe(401)
    const patch = await request(app).patch(url(agencyId)).send({ step: 'x' })
    expect(patch.status).toBe(401)
  })

  it('returns 404 when the agency is missing', async () => {
    const { token } = await agentAccount('Stranger')
    const app = buildApp()
    const missing = randomUUID()
    const get = await request(app)
      .get(url(missing))
      .set('Authorization', `Bearer ${token}`)
    expect(get.status).toBe(404)
    const patch = await request(app)
      .patch(url(missing))
      .set('Authorization', `Bearer ${token}`)
      .send({ step: 'welcome' })
    expect(patch.status).toBe(404)
  })

  it('403 for member, guest, and non-member; owner and admin may read/write', async () => {
    const { token: ownerToken, agencyId, userId: ownerId } = await ownerAgency()
    const member = await agentAccount('Member')
    const guest = await agentAccount('Guest')
    const admin = await agentAccount('Admin')
    const outsider = await agentAccount('Outsider')

    await addAgencyMembership({
      agencyId,
      userId: member.userId,
      role: 'member',
      affiliationMode: 'non_exclusive',
      invitedBy: ownerId,
    })
    await addAgencyMembership({
      agencyId,
      userId: guest.userId,
      role: 'guest',
      affiliationMode: 'non_exclusive',
      invitedBy: ownerId,
    })
    await addAgencyMembership({
      agencyId,
      userId: admin.userId,
      role: 'admin',
      affiliationMode: 'exclusive',
      invitedBy: ownerId,
    })

    const app = buildApp()
    const denied = [
      ['member', member.token],
      ['guest', guest.token],
      ['non-member', outsider.token],
    ]
    for (const [, token] of denied) {
      const get = await request(app).get(url(agencyId)).set('Authorization', `Bearer ${token}`)
      expect(get.status).toBe(403)
      const patch = await request(app)
        .patch(url(agencyId))
        .set('Authorization', `Bearer ${token}`)
        .send({ checklist_delta: { branding: true } })
      expect(patch.status).toBe(403)
    }

    const adminGet = await request(app)
      .get(url(agencyId))
      .set('Authorization', `Bearer ${admin.token}`)
    expect(adminGet.status).toBe(200)

    const adminPatch = await request(app)
      .patch(url(agencyId))
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ checklist_delta: { roles: true } })
    expect(adminPatch.status).toBe(200)
    expect(adminPatch.body.checklist).toMatchObject({ roles: true })

    const ownerGet = await request(app)
      .get(url(agencyId))
      .set('Authorization', `Bearer ${ownerToken}`)
    expect(ownerGet.status).toBe(200)
    expect(ownerGet.body.checklist).toMatchObject({ roles: true })
  })

  it('scopes state to the agency in the URL (cross-tenant isolation)', async () => {
    const a = await ownerAgency('Agency A')
    const b = await ownerAgency('Agency B')
    const app = buildApp()

    const writeA = await request(app)
      .patch(url(a.agencyId))
      .set('Authorization', `Bearer ${a.token}`)
      .send({ step: 'invites', checklist_delta: { invites: true } })
    expect(writeA.status).toBe(200)

    const crossGet = await request(app)
      .get(url(b.agencyId))
      .set('Authorization', `Bearer ${a.token}`)
    expect(crossGet.status).toBe(403)

    const crossPatch = await request(app)
      .patch(url(b.agencyId))
      .set('Authorization', `Bearer ${a.token}`)
      .send({ checklist_delta: { billing: true } })
    expect(crossPatch.status).toBe(403)

    const bGet = await request(app)
      .get(url(b.agencyId))
      .set('Authorization', `Bearer ${b.token}`)
    expect(bGet.status).toBe(200)
    expect(bGet.body).toEqual({
      step: 'welcome',
      path: null,
      checklist: {},
      dismissed_forever: false,
    })

    const aGet = await request(app)
      .get(url(a.agencyId))
      .set('Authorization', `Bearer ${a.token}`)
    expect(aGet.status).toBe(200)
    expect(aGet.body.checklist).toEqual({ invites: true })
    expect(aGet.body.step).toBe('invites')
  })
})
