/**
 * Real-Postgres coverage for BE-BLOCKER-36 contact_relationships CRUD.
 */
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import request from 'supertest'
import { expect, it, vi } from 'vitest'
import { finPostgresSuite } from '../../fin/testing/suite.js'
import { createAgentAccount } from '../../identity.js'
import { authMiddleware, signToken } from '../../auth.js'
import { query } from '../../db.js'
import { personalTenantId } from '../../tenant-authorization.js'
import {
  effectiveRelationshipStatus,
  issueConsentToken,
  publicNoAuth,
  redactRelationship,
  registerRoutes,
  RELATIONSHIP_CONSENT_PURPOSE,
} from './relationships-routes.js'
import { signPurposeToken, verifyRelationshipConsentToken } from '../signed-token.js'

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../../persistence/migrations')

async function agentSession({ name = 'Rel Agent' } = {}) {
  const userId = randomUUID()
  const now = new Date().toISOString()
  const email = `rel-${userId.slice(0, 8)}@x.test`
  await createAgentAccount({
    user: {
      id: userId,
      email,
      name,
      password_hash: 'x',
      role: 'agent',
      verified: true,
      verified_at: now,
    },
    agent: { id: userId, email, name },
  })
  const token = signToken({
    id: userId,
    email,
    name,
    token_version: 0,
    verified_at: now,
    active_tenant_id: personalTenantId(userId),
  })
  return { userId, token, tenantId: personalTenantId(userId), email }
}

async function seedContact(pool, {
  agentId,
  email = `c-${randomUUID().slice(0, 8)}@ex.test`,
  phone = null,
  name = 'Sara Contact',
  crossTenantVisibility = true,
} = {}) {
  const id = randomUUID()
  const now = new Date().toISOString()
  await pool.query(
    `INSERT INTO public.contacts (
       id, email, phone, name, assigned_agent_id, status,
       cross_tenant_visibility, created_at, updated_at, data
     ) VALUES (
       $1, $2, $3, $4, $5, 'lead',
       $6, $7::timestamptz, $7::timestamptz, '{}'::jsonb
     )`,
    [id, email, phone, name, agentId, crossTenantVisibility, now],
  )
  return { id, email, phone, name }
}

function makeApp({ sendEmail } = {}) {
  const app = express()
  app.use(express.json())
  registerRoutes(app, {
    auth: authMiddleware,
    sendEmail: sendEmail || vi.fn(async () => ({ id: 'mail-1' })),
  })
  return app
}

finPostgresSuite('contact relationships routes (BE-BLOCKER-36)', { seed: false }, ({ pool }) => {
  it('migration 339 adds rejected status, exclusive index, visibility column', async () => {
    const sql = await readFile(join(migrationsDir, '339_contact_relationships_crud.sql'), 'utf8')
    await pool().query(sql)
    await pool().query(sql)

    const check = await pool().query(`
      SELECT pg_get_constraintdef(oid) AS def
        FROM pg_constraint
       WHERE conname = 'contact_relationships_status_check'
    `)
    expect(check.rows[0]?.def).toMatch(/rejected/)

    const idx = await pool().query(`
      SELECT indexname FROM pg_indexes
       WHERE tablename = 'contact_relationships'
         AND indexname = 'uq_active_exclusive_buyer_rep'
    `)
    expect(idx.rows).toHaveLength(1)

    const col = await pool().query(`
      SELECT column_name, data_type
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'contacts'
         AND column_name = 'cross_tenant_visibility'
    `)
    expect(col.rows[0]?.data_type).toBe('boolean')
  })

  it('publicNoAuth marker is explicit PUBLIC_NO_AUTH', () => {
    expect(publicNoAuth.marker).toBe('PUBLIC_NO_AUTH')
  })

  it('redactRelationship strips PII and price ranges', () => {
    const redacted = redactRelationship({
      id: 'rel-1',
      agent_user_id: 'usr-secret',
      tenant_id: 'agency:secret',
      relationship_type: 'representation',
      party_type: 'buyer',
      exclusivity: 'exclusive',
      status: 'active',
      starts_at: '2026-06-01T00:00:00Z',
      ends_at: '2027-06-01T00:00:00Z',
      consent_record: { evidence: { filename: 'mou.pdf' }, method: 'signed_document' },
      scope: {
        areas: ['dubai-marina', 'jbr'],
        property_types: ['apartment'],
        price_range: { currency: 'AED', min: 1_200_000, max: 2_400_000 },
      },
    })
    expect(redacted.id).toBe('redacted')
    expect(redacted.agent_user_id).toBeUndefined()
    expect(redacted.tenant_id).toBeUndefined()
    expect(redacted.consent_record).toBeUndefined()
    expect(JSON.stringify(redacted)).not.toMatch(/mou\.pdf|usr-secret|1_200_000|1200000/)
    expect(redacted.scope_summary.areas_region).toBe('dubai')
    expect(redacted.scope_summary.property_types).toEqual(['apartment'])
    expect(redacted.starts_month).toBe('2026-06')
  })

  it('mine vs other masking + create → consent token + pending-only patch/delete', async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-relationships'
    const sent = []
    const sendEmail = vi.fn(async (args) => {
      sent.push(args)
      return { id: 'mail-1' }
    })
    const app = makeApp({ sendEmail })

    const agentA = await agentSession({ name: 'Agent A' })
    const agentB = await agentSession({ name: 'Agent B' })
    const sharedEmail = `shared-${randomUUID().slice(0, 8)}@ex.test`
    const contactA = await seedContact(pool(), { agentId: agentA.userId, email: sharedEmail })
    const contactB = await seedContact(pool(), { agentId: agentB.userId, email: sharedEmail })

    // Agent B has an active exclusive (other tenant) on their contact with same email.
    await pool().query(
      `INSERT INTO public.contact_relationships (
         id, tenant_id, contact_id, agent_user_id, party_type, relationship_type,
         exclusivity, scope, status, consent_record, starts_at, ends_at, data
       ) VALUES (
         $1, $2, $3, $4, 'buyer', 'representation',
         'exclusive', '{"areas":["dubai-marina"],"property_types":["apartment"],"price_range":{"min":100}}'::jsonb,
         'active', '{"evidence":{"filename":"secret.pdf"}}'::jsonb,
         '2026-06-01T00:00:00Z', '2027-06-01T00:00:00Z', '{}'::jsonb
       )`,
      [randomUUID(), agentB.tenantId, contactB.id, agentB.userId],
    )

    const created = await request(app)
      .post(`/api/contacts/${contactA.id}/relationships`)
      .set('Authorization', `Bearer ${agentA.token}`)
      .set('x-active-tenant-id', agentA.tenantId)
      .send({
        party_type: 'seller',
        relationship_type: 'mandate',
        exclusivity: 'non_exclusive',
        scope: { areas: ['jbr'], property_types: ['villa'] },
        starts_at: '2026-09-10T00:00:00.000Z',
        ends_at: '2026-12-10T00:00:00.000Z',
      })
      .expect(201)

    expect(created.body.status).toBe('pending')
    expect(created.body.agent_user_id).toBe(agentA.userId)
    expect(created.body.tenant_id).toBe(agentA.tenantId)
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sent[0].to).toBe(sharedEmail.toLowerCase())
    expect(sent[0].body).toMatch(/token=/)

    const mine = await request(app)
      .get(`/api/contacts/${contactA.id}/relationships/mine`)
      .set('Authorization', `Bearer ${agentA.token}`)
      .set('x-active-tenant-id', agentA.tenantId)
      .expect(200)
    expect(mine.body.relationships).toHaveLength(1)
    expect(mine.body.relationships[0].id).toBe(created.body.id)

    const other = await request(app)
      .get(`/api/contacts/${contactA.id}/relationships/other`)
      .set('Authorization', `Bearer ${agentA.token}`)
      .set('x-active-tenant-id', agentA.tenantId)
      .expect(200)
    expect(other.body.disabled).toBe(false)
    expect(other.body.relationships.length).toBeGreaterThanOrEqual(1)
    const redacted = other.body.relationships[0]
    expect(redacted.id).toBe('redacted')
    expect(redacted.party_type).toBe('buyer')
    expect(JSON.stringify(redacted)).not.toMatch(/secret\.pdf|Agent B|agency:|usr-|@x\.test|price_range|100/)

    // Patch pending ok
    const patched = await request(app)
      .patch(`/api/contacts/${contactA.id}/relationships/${created.body.id}`)
      .set('Authorization', `Bearer ${agentA.token}`)
      .set('x-active-tenant-id', agentA.tenantId)
      .send({ ends_at: '2027-01-10T00:00:00.000Z' })
      .expect(200)
    expect(patched.body.ends_at).toBe('2027-01-10T00:00:00.000Z')

    // Confirm then patch must fail
    await pool().query(
      `UPDATE public.contact_relationships SET status = 'confirmed' WHERE id = $1`,
      [created.body.id],
    )
    await request(app)
      .patch(`/api/contacts/${contactA.id}/relationships/${created.body.id}`)
      .set('Authorization', `Bearer ${agentA.token}`)
      .set('x-active-tenant-id', agentA.tenantId)
      .send({ ends_at: '2027-02-10T00:00:00.000Z' })
      .expect(409)

    await request(app)
      .delete(`/api/contacts/${contactA.id}/relationships/${created.body.id}`)
      .set('Authorization', `Bearer ${agentA.token}`)
      .set('x-active-tenant-id', agentA.tenantId)
      .expect(409)

    // Fresh pending delete succeeds
    const pending2 = await request(app)
      .post(`/api/contacts/${contactA.id}/relationships`)
      .set('Authorization', `Bearer ${agentA.token}`)
      .set('x-active-tenant-id', agentA.tenantId)
      .send({
        party_type: 'landlord',
        relationship_type: 'affinity',
        exclusivity: 'non_exclusive',
        scope: {},
      })
      .expect(201)

    await request(app)
      .delete(`/api/contacts/${contactA.id}/relationships/${pending2.body.id}`)
      .set('Authorization', `Bearer ${agentA.token}`)
      .set('x-active-tenant-id', agentA.tenantId)
      .expect(204)
  })

  it('accept atomic consent_record + confirmed; reject invalidates token; resend regenerates', async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-relationships'
    const sent = []
    const sendEmail = vi.fn(async (args) => {
      sent.push(args)
      return { id: 'mail-1' }
    })
    const app = makeApp({ sendEmail })
    const agent = await agentSession()
    const contact = await seedContact(pool(), { agentId: agent.userId })

    const created = await request(app)
      .post(`/api/contacts/${contact.id}/relationships`)
      .set('Authorization', `Bearer ${agent.token}`)
      .set('x-active-tenant-id', agent.tenantId)
      .send({
        party_type: 'buyer',
        relationship_type: 'representation',
        exclusivity: 'non_exclusive',
        scope: { areas: ['marina'] },
        starts_at: '2026-01-01T00:00:00.000Z',
      })
      .expect(201)

    const match = String(sent[0].body).match(/token=([^\s]+)/)
    expect(match).toBeTruthy()
    const token = decodeURIComponent(match[1])
    const verified = verifyRelationshipConsentToken(token)
    expect(verified.ok).toBe(true)
    expect(verified.payload.purpose).toBe(RELATIONSHIP_CONSENT_PURPOSE)

    const landing = await request(app)
      .get(`/public/relationships/consent`)
      .query({ token })
      .expect(200)
    expect(landing.body.relationship_type).toBe('representation')
    expect(landing.body.party_type).toBe('buyer')
    expect(landing.body.agent_user_id).toBeUndefined()

    const accepted = await request(app)
      .post(`/public/relationships/consent/accept`)
      .send({ token })
      .expect(200)
    expect(accepted.body.success).toBe(true)
    // starts_at in the past → lazy active
    expect(['confirmed', 'active']).toContain(accepted.body.relationship.status)
    expect(accepted.body.relationship.consent_record.decision).toBe('accepted')
    expect(accepted.body.relationship.consent_record.confirmed_at).toBeTruthy()

    const row = await query(
      `SELECT status, consent_record, data FROM public.contact_relationships WHERE id = $1`,
      [created.body.id],
    )
    expect(row[0].status).toBe('confirmed')
    expect(row[0].consent_record.decision).toBe('accepted')
    expect(row[0].data.consent_token_jti).toBeUndefined()

    // Second use fails (single-use)
    await request(app)
      .post(`/public/relationships/consent/accept`)
      .send({ token })
      .expect(401)

    // Reject flow on a fresh pending
    sent.length = 0
    const pending = await request(app)
      .post(`/api/contacts/${contact.id}/relationships`)
      .set('Authorization', `Bearer ${agent.token}`)
      .set('x-active-tenant-id', agent.tenantId)
      .send({
        party_type: 'tenant',
        relationship_type: 'affinity',
        exclusivity: 'non_exclusive',
        scope: {},
      })
      .expect(201)
    const token2 = decodeURIComponent(String(sent[0].body).match(/token=([^\s]+)/)[1])

    await request(app)
      .post(`/public/relationships/consent/reject`)
      .send({ token: token2 })
      .expect(200)

    const rejected = await query(
      `SELECT status, consent_record, data FROM public.contact_relationships WHERE id = $1`,
      [pending.body.id],
    )
    expect(rejected[0].status).toBe('rejected')
    expect(rejected[0].consent_record.decision).toBe('rejected')
    expect(rejected[0].data.consent_token_jti).toBeUndefined()

    await request(app)
      .get(`/public/relationships/consent`)
      .query({ token: token2 })
      .expect(401)

    // Resend regenerates usable token
    sent.length = 0
    const pending3 = await request(app)
      .post(`/api/contacts/${contact.id}/relationships`)
      .set('Authorization', `Bearer ${agent.token}`)
      .set('x-active-tenant-id', agent.tenantId)
      .send({
        party_type: 'landlord',
        relationship_type: 'mandate',
        exclusivity: 'non_exclusive',
        scope: {},
      })
      .expect(201)
    const oldToken = decodeURIComponent(String(sent[0].body).match(/token=([^\s]+)/)[1])
    sent.length = 0

    const resent = await request(app)
      .post(`/api/contacts/${contact.id}/relationships/${pending3.body.id}/resend-consent-link`)
      .set('Authorization', `Bearer ${agent.token}`)
      .set('x-active-tenant-id', agent.tenantId)
      .expect(200)
    expect(resent.body.sent_at).toBeTruthy()
    expect(resent.body.expires_at).toBeTruthy()

    const newToken = decodeURIComponent(String(sent[0].body).match(/token=([^\s]+)/)[1])
    expect(newToken).not.toBe(oldToken)

    await request(app)
      .get(`/public/relationships/consent`)
      .query({ token: oldToken })
      .expect(401)

    await request(app)
      .post(`/public/relationships/consent/accept`)
      .send({ token: newToken })
      .expect(200)
  })

  it('cross-tenant visibility disabled returns empty/disabled signal; missing email → 422', async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-relationships'
    const app = makeApp()
    const agent = await agentSession()
    const contact = await seedContact(pool(), {
      agentId: agent.userId,
      crossTenantVisibility: false,
      email: `vis-${randomUUID().slice(0, 8)}@ex.test`,
    })

    const other = await request(app)
      .get(`/api/contacts/${contact.id}/relationships/other`)
      .set('Authorization', `Bearer ${agent.token}`)
      .set('x-active-tenant-id', agent.tenantId)
      .expect(403)
    expect(other.body.error).toBe('CROSS_TENANT_VISIBILITY_DISABLED')
    expect(other.body.disabled).toBe(true)
    expect(other.body.relationships).toEqual([])

    const noEmail = await seedContact(pool(), {
      agentId: agent.userId,
      email: null,
    })
    // contacts.email can be null — force empty
    await pool().query(`UPDATE public.contacts SET email = NULL WHERE id = $1`, [noEmail.id])

    await request(app)
      .post(`/api/contacts/${noEmail.id}/relationships`)
      .set('Authorization', `Bearer ${agent.token}`)
      .set('x-active-tenant-id', agent.tenantId)
      .send({
        party_type: 'buyer',
        relationship_type: 'representation',
        exclusivity: 'non_exclusive',
        scope: {},
      })
      .expect(422)
  })

  it('exclusive conflict on confirm returns EXCLUSIVE_CONFLICT', async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-relationships'
    const sent = []
    const sendEmail = vi.fn(async (args) => {
      sent.push(args)
      return { id: 'mail-1' }
    })
    const app = makeApp({ sendEmail })
    const agent = await agentSession()
    const contact = await seedContact(pool(), { agentId: agent.userId })

    await pool().query(
      `INSERT INTO public.contact_relationships (
         id, tenant_id, contact_id, agent_user_id, party_type, relationship_type,
         exclusivity, scope, status, consent_record, starts_at, data
       ) VALUES (
         $1, $2, $3, $4, 'buyer', 'representation',
         'exclusive', '{}'::jsonb, 'active', '{}'::jsonb, NOW(), '{}'::jsonb
       )`,
      [randomUUID(), agent.tenantId, contact.id, agent.userId],
    )

    // Pending exclusive is allowed (unique index only covers confirmed/active)
    const pending = await request(app)
      .post(`/api/contacts/${contact.id}/relationships`)
      .set('Authorization', `Bearer ${agent.token}`)
      .set('x-active-tenant-id', agent.tenantId)
      .send({
        party_type: 'buyer',
        relationship_type: 'mandate',
        exclusivity: 'exclusive',
        scope: {},
      })
      .expect(201)

    const token = decodeURIComponent(String(sent[0].body).match(/token=([^\s]+)/)[1])
    const conflict = await request(app)
      .post(`/public/relationships/consent/accept`)
      .send({ token })
      .expect(409)
    expect(conflict.body.error).toBe('EXCLUSIVE_CONFLICT')

    // Still pending — token not consumed on conflict
    const still = await query(
      `SELECT status, data->>'consent_token_jti' AS jti FROM public.contact_relationships WHERE id = $1`,
      [pending.body.id],
    )
    expect(still[0].status).toBe('pending')
    expect(still[0].jti).toBeTruthy()
  })

  it('effectiveRelationshipStatus lazy transitions', () => {
    expect(effectiveRelationshipStatus({
      status: 'confirmed',
      starts_at: '2020-01-01T00:00:00Z',
    })).toBe('active')
    expect(effectiveRelationshipStatus({
      status: 'active',
      ends_at: '2020-01-01T00:00:00Z',
    })).toBe('expired')
    expect(effectiveRelationshipStatus({
      status: 'confirmed',
      starts_at: '2099-01-01T00:00:00Z',
    })).toBe('confirmed')
  })

  it('wrong purpose token is rejected', async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-relationships'
    const app = makeApp()
    const wrong = signPurposeToken({
      purpose: 'scheduled_deletion_view',
      ttlSeconds: 3600,
      claims: { relationship_id: randomUUID(), contact_id: randomUUID(), jti: randomUUID() },
    })
    await request(app)
      .get('/public/relationships/consent')
      .query({ token: wrong })
      .expect(401)

    const crafted = issueConsentToken({
      relationshipId: randomUUID(),
      contactId: randomUUID(),
    })
    await request(app)
      .get('/public/relationships/consent')
      .query({ token: crafted.token })
      .expect(404)
  })
})
