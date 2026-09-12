/**
 * Real-Postgres coverage for BE-BLOCKER-29 capability packs.
 */
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
import { registerAgencyCapabilityPackRoutes } from './capability-pack-routes.js'
import { FINANCE_GRANT_ACTION_KIND } from './capability-packs.js'
import { isKnownCollection, resolveTable } from '../../persistence/table-mapper.js'

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../../persistence/migrations')

function buildApp() {
  const app = express()
  app.use(express.json())
  registerAgencyCapabilityPackRoutes(app)
  return app
}

async function agentAccount(label = 'Agent') {
  const userId = randomUUID()
  const now = new Date().toISOString()
  const email = `cap-${userId.slice(0, 8)}@x.test`
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

async function ownerAgency({ name = 'Cap Pack Agency', slug = null } = {}) {
  const owner = await agentAccount('Owner')
  const agencyId = randomUUID()
  await createAgencyWithOwner({
    agency: {
      id: agencyId,
      name,
      slug: slug || `agency-${agencyId.slice(0, 8)}`,
      logo: 'https://cdn.example.test/logo.png',
    },
    ownerUserId: owner.userId,
  })
  return { ...owner, agencyId }
}

async function twoOwnerAgency() {
  const primary = await ownerAgency({ name: 'Two Owner Agency' })
  const second = await agentAccount('Second Owner')
  await addAgencyMembership({
    agencyId: primary.agencyId,
    userId: second.userId,
    role: 'admin',
    affiliationMode: 'exclusive',
    invitedBy: primary.userId,
  })
  await query(
    `UPDATE public.tenant_memberships
        SET role = 'owner', updated_at = NOW()
      WHERE tenant_id = $1 AND user_id = $2`,
    [`agency:${primary.agencyId}`, second.userId],
  )
  await query(
    `UPDATE public.agency_members
        SET role = 'owner', updated_at = NOW()
      WHERE agency_id = $1 AND user_id = $2`,
    [primary.agencyId, second.userId],
  )
  return { ...primary, secondOwner: second }
}

finPostgresSuite('agency capability packs (BE-BLOCKER-29)', { seed: false }, ({ pool }) => {
  it('migration 342 adds capability_packs + seeds 4 pack definitions + finance action_kind', async () => {
    const col = await pool().query(
      `SELECT column_name, is_nullable, data_type
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'tenant_memberships'
          AND column_name = 'capability_packs'`,
    )
    expect(col.rows[0]).toBeTruthy()
    expect(col.rows[0].is_nullable).toBe('NO')
    expect(col.rows[0].data_type).toBe('jsonb')

    const table = await pool().query(`SELECT to_regclass('public.capability_pack_definitions') AS t`)
    expect(table.rows[0].t).toBeTruthy()

    const packs = await pool().query(
      `SELECT slug, is_seeded, is_custom, editable
         FROM public.capability_pack_definitions
        ORDER BY sort_order`,
    )
    expect(packs.rows.map((r) => r.slug)).toEqual(['finance', 'marketer', 'read_only', 'custom'])
    expect(packs.rows.find((r) => r.slug === 'custom')).toMatchObject({
      is_seeded: true, is_custom: true, editable: true,
    })

    const financeCaps = await pool().query(
      `SELECT capabilities FROM public.capability_pack_definitions WHERE slug = 'finance'`,
    )
    expect(financeCaps.rows[0].capabilities.some((c) => c.is_financial === true)).toBe(true)

    const sql = await readFile(join(migrationsDir, '342_capability_packs.sql'), 'utf8')
    expect(sql).toContain('CAPABILITY_PACK_FINANCE_GRANT')

    const check = await pool().query(
      `SELECT pg_get_constraintdef(oid) AS def
         FROM pg_constraint
        WHERE conname = 'chk_approval_requests_action_kind'`,
    )
    expect(check.rows[0].def).toContain('CAPABILITY_PACK_FINANCE_GRANT')
    expect(isKnownCollection('capability_pack_definitions')).toBe(true)
    expect(resolveTable('tenant_memberships').columns).toContain('capability_packs')
  })

  it('GET list + get pack definitions (4 seeded)', async () => {
    const { token, agencyId } = await ownerAgency({ name: 'List Packs Agency' })
    const app = buildApp()

    const list = await request(app)
      .get('/api/agency/capability-packs')
      .set('Authorization', `Bearer ${token}`)
    expect(list.status).toBe(200)
    expect(list.body.agency_id).toBe(agencyId)
    expect(list.body.packs).toHaveLength(4)
    expect(list.body.packs.map((p) => p.id)).toEqual([
      'finance', 'marketer', 'read_only', 'custom',
    ])

    const detail = await request(app)
      .get('/api/agency/capability-packs/finance')
      .set('Authorization', `Bearer ${token}`)
    expect(detail.status).toBe(200)
    expect(detail.body.id).toBe('finance')
    expect(detail.body.domains.some((d) => d.key === 'billing')).toBe(true)
  })

  it('assigns Marketer / Read-only immediately (200)', async () => {
    const owner = await ownerAgency({ name: 'Assign NonFinance Agency' })
    const member = await agentAccount('Member')
    await addAgencyMembership({
      agencyId: owner.agencyId,
      userId: member.userId,
      role: 'member',
      affiliationMode: 'non_exclusive',
      invitedBy: owner.userId,
    })
    const app = buildApp()

    const marketer = await request(app)
      .patch(`/api/agency/members/${member.userId}/capability-packs`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ packs: ['marketer'] })
    expect(marketer.status).toBe(200)
    expect(marketer.body.packs).toEqual(['marketer'])

    const readOnly = await request(app)
      .patch(`/api/agency/members/${member.userId}/capability-packs`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ packs: ['read_only'] })
    expect(readOnly.status).toBe(200)
    expect(readOnly.body.packs).toEqual(['read_only'])
  })

  it('assigns Finance → 202 + approval_request row when second owner exists', async () => {
    const owner = await twoOwnerAgency()
    const member = await agentAccount('Finance Target')
    await addAgencyMembership({
      agencyId: owner.agencyId,
      userId: member.userId,
      role: 'member',
      affiliationMode: 'non_exclusive',
      invitedBy: owner.userId,
    })
    const app = buildApp()

    const res = await request(app)
      .patch(`/api/agency/members/${member.userId}/capability-packs`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ packs: ['finance'] })
    expect(res.status).toBe(202)
    expect(res.body.approval_request_id).toBeTruthy()

    const approval = await pool().query(
      `SELECT action_kind, status, payload FROM fin.approval_requests WHERE id = $1`,
      [res.body.approval_request_id],
    )
    expect(approval.rows[0].action_kind).toBe(FINANCE_GRANT_ACTION_KIND)
    expect(approval.rows[0].status).toBe('REQUESTED')
    expect(approval.rows[0].payload.target_user_id).toBe(member.userId)
  })

  it('Finance assign with single owner → 409 SECOND_OWNER_REQUIRED', async () => {
    const owner = await ownerAgency({ name: 'Single Owner Finance' })
    const member = await agentAccount('Solo Finance Target')
    await addAgencyMembership({
      agencyId: owner.agencyId,
      userId: member.userId,
      role: 'member',
      affiliationMode: 'non_exclusive',
      invitedBy: owner.userId,
    })
    const app = buildApp()
    const res = await request(app)
      .patch(`/api/agency/members/${member.userId}/capability-packs`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ packs: ['finance'] })
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('SECOND_OWNER_REQUIRED')
  })

  it('POST create definition → 405', async () => {
    const { token } = await ownerAgency({ name: 'No Create Agency' })
    const app = buildApp()
    const a = await request(app)
      .post('/api/agency/capability-pack-definitions')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Extra Custom' })
    expect(a.status).toBe(405)
    expect(a.body.code).toBe('CAPABILITY_PACK_CREATE_DISABLED')
  })

  it('authz: non-member / guest denied', async () => {
    const owner = await ownerAgency({ name: 'Authz Agency' })
    const stranger = await agentAccount('Stranger')
    const guest = await agentAccount('Guest')
    await addAgencyMembership({
      agencyId: owner.agencyId,
      userId: guest.userId,
      role: 'guest',
      affiliationMode: 'non_exclusive',
      invitedBy: owner.userId,
    })
    const app = buildApp()

    expect((await request(app).get('/api/agency/capability-packs').set('Authorization', `Bearer ${stranger.token}`)).status).toBe(403)
    expect((await request(app).get('/api/agency/capability-packs').set('Authorization', `Bearer ${guest.token}`)).status).toBe(403)
    expect((await request(app).patch(`/api/agency/members/${owner.userId}/capability-packs`).set('Authorization', `Bearer ${guest.token}`).send({ packs: ['marketer'] })).status).toBe(403)
  })
})
