/**
 * Real-Postgres coverage for Wave 8 Pro surface APIs (AGT-DSH-002 / AGT-LST-002).
 */
import { randomUUID } from 'node:crypto'
import express from 'express'
import request from 'supertest'
import { expect, it } from 'vitest'
import { finPostgresSuite } from '../fin/testing/suite.js'
import { createAgentAccount } from '../identity.js'
import { authMiddleware, signToken } from '../auth.js'
import { addAgencyMembership, agencyTenantId, createAgencyWithOwner, personalTenantId } from '../tenant-authorization.js'
import { registerWave8ProRoutes } from './wave8-pro-routes.js'

async function agentSession({ name = 'Pro Agent' } = {}) {
  const userId = randomUUID()
  const now = new Date().toISOString()
  const email = `pro-${userId.slice(0, 8)}@x.test`
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
  const tenantId = personalTenantId(userId)
  const token = signToken({
    id: userId,
    email,
    name,
    token_version: 0,
    verified_at: now,
    active_tenant_id: tenantId,
  })
  return { userId, token, tenantId, email, name, verifiedAt: now }
}

async function insertProperty(pool, { id = randomUUID(), agentId, price = 100000, status = 'active' } = {}) {
  await pool.query(
    `INSERT INTO public.properties (
       id, agent_id, title, location, city, neighborhood, status, price, marketplace_syndicated, data
     ) VALUES (
       $1, $2, 'Pro Listing', 'JVC', 'Dubai', 'JVC', $3, $4, true, '{}'::jsonb
     )`,
    [id, agentId, status, price],
  )
  return id
}

async function addAgencyPeer(pool, { owner, peerName = 'Peer' }) {
  const peer = await agentSession({ name: peerName })
  const agencyId = randomUUID()
  await createAgencyWithOwner({
    agency: {
      id: agencyId,
      name: `${owner.name || 'Pro'} Agency`,
      slug: `pro-${agencyId.slice(0, 8)}`,
    },
    ownerUserId: owner.userId,
  })
  const tenantId = agencyTenantId(agencyId)
  await addAgencyMembership({
    agencyId,
    userId: peer.userId,
    role: 'member',
    affiliationMode: 'non_exclusive',
    invitedBy: owner.userId,
  })
  await pool.query(
    `UPDATE public.users
        SET active_tenant_id = $2,
            data = COALESCE(data, '{}'::jsonb) || jsonb_build_object('active_tenant_id', $2::text)
      WHERE id = $1`,
    [owner.userId, tenantId],
  )
  const token = signToken({
    id: owner.userId,
    email: owner.email,
    name: owner.name,
    token_version: 0,
    verified_at: owner.verifiedAt,
    active_tenant_id: tenantId,
  })
  return { agencyId, tenantId, peer, token }
}

function makeApp() {
  const app = express()
  app.use(express.json())
  registerWave8ProRoutes(app, { authMiddleware })
  return app
}

async function auditRows(pool, { agentId, action }) {
  const { rows } = await pool.query(
    `SELECT type, action, entity_type, entity_id, tenant_id, metadata
       FROM public.audit_log
      WHERE agent_id = $1 AND type = 'property_bulk' AND action = $2
      ORDER BY created_at DESC`,
    [agentId, action],
  )
  return rows
}

finPostgresSuite('wave8 pro routes', { seed: false }, ({ pool }) => {
  it('dashboard-layout GET/PATCH round-trips on membership data', async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-wave8-pro'
    const agent = await agentSession({ name: 'Dash Agent' })
    const app = makeApp()

    const empty = await request(app)
      .get('/api/users/me/dashboard-layout')
      .set('Authorization', `Bearer ${agent.token}`)
      .expect(200)
    expect(empty.body.tenant_id).toBe(agent.tenantId)
    expect(empty.body.density).toBe('comfortable')
    expect(empty.body.layout).toEqual([])

    const patched = await request(app)
      .patch('/api/users/me/dashboard-layout')
      .set('Authorization', `Bearer ${agent.token}`)
      .send({
        layout: [{ i: 'kpi-active', x: 0, y: 0, w: 3, h: 2 }],
        density: 'compact',
      })
      .expect(200)
    expect(patched.body.density).toBe('compact')
    expect(patched.body.layout[0].i).toBe('kpi-active')

    const again = await request(app)
      .get('/api/users/me/dashboard-layout')
      .set('Authorization', `Bearer ${agent.token}`)
      .expect(200)
    expect(again.body.density).toBe('compact')
    expect(again.body.layout).toHaveLength(1)
  })

  it('list-prefs GET/PATCH merges listings column prefs', async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-wave8-pro'
    const agent = await agentSession({ name: 'Prefs Agent' })
    const app = makeApp()

    const empty = await request(app)
      .get('/api/users/me/list-prefs')
      .set('Authorization', `Bearer ${agent.token}`)
      .expect(200)
    expect(empty.body.tenant_id).toBe(agent.tenantId)
    expect(empty.body.listings).toEqual({})

    const patched = await request(app)
      .patch('/api/users/me/list-prefs')
      .set('Authorization', `Bearer ${agent.token}`)
      .send({
        listings: {
          columns: ['hrid', 'title', 'price'],
          widths: { title: 280 },
          density: 'spacious',
        },
      })
      .expect(200)
    expect(patched.body.listings.columns).toEqual(['hrid', 'title', 'price'])
    expect(patched.body.listings.widths.title).toBe(280)
    expect(patched.body.listings.density).toBe('spacious')

    const again = await request(app)
      .get('/api/users/me/list-prefs')
      .set('Authorization', `Bearer ${agent.token}`)
      .expect(200)
    expect(again.body.listings.columns).toEqual(['hrid', 'title', 'price'])
  })

  it('saved-views CRUD enforces owner and shared_with_tenant visibility', async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-wave8-pro'
    const owner = await agentSession({ name: 'View Owner' })
    const workspace = await addAgencyPeer(pool(), { owner, peerName: 'View Peer' })
    const peer = workspace.peer
    const app = makeApp()

    const created = await request(app)
      .post(`/api/tenants/${workspace.tenantId}/saved-views`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        name: 'Below market',
        filter: { status: ['published'] },
        shared_with_tenant: false,
      })
      .expect(201)
    expect(created.body.id).toMatch(/^sv_/)
    expect(created.body.owner_user_id).toBe(owner.userId)
    expect(created.body.shared_with_tenant).toBe(false)

    const peerPrivate = await request(app)
      .get(`/api/tenants/${workspace.tenantId}/saved-views`)
      .set('Authorization', `Bearer ${peer.token}`)
      .expect(200)
    expect(peerPrivate.body.views).toHaveLength(0)

    const shared = await request(app)
      .patch(`/api/tenants/${workspace.tenantId}/saved-views/${created.body.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ shared_with_tenant: true, name: 'Shared below market' })
      .expect(200)
    expect(shared.body.shared_with_tenant).toBe(true)

    const peerShared = await request(app)
      .get(`/api/tenants/${workspace.tenantId}/saved-views`)
      .set('Authorization', `Bearer ${peer.token}`)
      .expect(200)
    expect(peerShared.body.views).toHaveLength(1)
    expect(peerShared.body.views[0].name).toBe('Shared below market')

    const peerEdit = await request(app)
      .patch(`/api/tenants/${workspace.tenantId}/saved-views/${created.body.id}`)
      .set('Authorization', `Bearer ${peer.token}`)
      .send({ name: 'Hijacked' })
      .expect(403)
    expect(peerEdit.body.error).toMatch(/owner/i)

    const peerDelete = await request(app)
      .delete(`/api/tenants/${workspace.tenantId}/saved-views/${created.body.id}`)
      .set('Authorization', `Bearer ${peer.token}`)
      .expect(403)
    expect(peerDelete.body.error).toMatch(/owner/i)

    await request(app)
      .delete(`/api/tenants/${workspace.tenantId}/saved-views/${created.body.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200)

    const after = await request(app)
      .get(`/api/tenants/${workspace.tenantId}/saved-views`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200)
    expect(after.body.views).toHaveLength(0)
  })

  it('bulk endpoints mutate owned rows and write audit_log', async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-wave8-pro'
    const agent = await agentSession({ name: 'Bulk Agent' })
    const workspace = await addAgencyPeer(pool(), { owner: agent, peerName: 'Bulk Peer' })
    const peer = workspace.peer
    const app = makeApp()

    const archiveId = await insertProperty(pool(), { agentId: agent.userId, price: 200000 })
    const publishId = await insertProperty(pool(), { agentId: agent.userId, status: 'draft', price: 150000 })
    const priceId = await insertProperty(pool(), { agentId: agent.userId, price: 100000 })
    const ownerId = await insertProperty(pool(), { agentId: agent.userId, price: 120000 })
    const bazaarId = await insertProperty(pool(), { agentId: agent.userId, price: 90000 })
    const deleteId = await insertProperty(pool(), { agentId: agent.userId, price: 80000 })

    await request(app)
      .post('/api/properties/bulk/archive')
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ ids: [archiveId] })
      .expect(200)
    expect((await pool().query('SELECT status FROM public.properties WHERE id = $1', [archiveId])).rows[0].status)
      .toBe('archived')
    expect(await auditRows(pool(), { agentId: agent.userId, action: 'archive' })).toHaveLength(1)
    const archiveAudit = (await auditRows(pool(), { agentId: agent.userId, action: 'archive' }))[0]
    expect(archiveAudit.entity_id).toBe(archiveId)
    expect(archiveAudit.tenant_id).toBe(workspace.tenantId)
    expect(archiveAudit.metadata).toEqual(expect.objectContaining({
      batch_id: expect.any(String),
      actor_user_id: agent.userId,
      after: expect.objectContaining({ status: 'archived' }),
    }))
    expect(archiveAudit.metadata.tenant_id).toBeUndefined()

    await request(app)
      .post('/api/properties/bulk/publish')
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ ids: [publishId], channels: ['bayut'] })
      .expect(200)
    const published = (await pool().query(
      'SELECT status, marketplace_syndicated FROM public.properties WHERE id = $1',
      [publishId],
    )).rows[0]
    expect(published.status).toBe('active')
    expect(published.marketplace_syndicated).toBe(true)
    expect(await auditRows(pool(), { agentId: agent.userId, action: 'publish' })).toHaveLength(1)

    await request(app)
      .post('/api/properties/bulk/price-adjust')
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ ids: [priceId], mode: 'percent', value: 10 })
      .expect(200)
    expect(Number((await pool().query('SELECT price FROM public.properties WHERE id = $1', [priceId])).rows[0].price))
      .toBe(110000)
    expect(await auditRows(pool(), { agentId: agent.userId, action: 'price_adjust' })).toHaveLength(1)

    await request(app)
      .post('/api/properties/bulk/change-owner')
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ ids: [ownerId], owner_user_id: peer.userId })
      .expect(200)
    expect((await pool().query('SELECT agent_id FROM public.properties WHERE id = $1', [ownerId])).rows[0].agent_id)
      .toBe(peer.userId)
    expect(await auditRows(pool(), { agentId: agent.userId, action: 'change_owner' })).toHaveLength(1)

    await request(app)
      .post('/api/properties/bulk/toggle-bazaar')
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ ids: [bazaarId], enabled: false })
      .expect(200)
    expect((await pool().query(
      'SELECT marketplace_syndicated FROM public.properties WHERE id = $1',
      [bazaarId],
    )).rows[0].marketplace_syndicated).toBe(false)
    expect(await auditRows(pool(), { agentId: agent.userId, action: 'toggle_bazaar' })).toHaveLength(1)

    await request(app)
      .delete('/api/properties/bulk')
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ ids: [deleteId], confirmed_phrase: 'delete 1' })
      .expect(200)
    expect((await pool().query('SELECT id FROM public.properties WHERE id = $1', [deleteId])).rows).toHaveLength(0)
    expect(await auditRows(pool(), { agentId: agent.userId, action: 'delete' })).toHaveLength(1)
  })

  it('bulk change-owner rejects cross-tenant recipient with 403', async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-wave8-pro'
    const agent = await agentSession({ name: 'Owner Guard' })
    const outsider = await agentSession({ name: 'Outsider' })
    const propId = await insertProperty(pool(), { agentId: agent.userId })
    const app = makeApp()

    const res = await request(app)
      .post('/api/properties/bulk/change-owner')
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ ids: [propId], owner_user_id: outsider.userId })
      .expect(403)
    expect(res.body.error).toMatch(/not a member/i)
    expect((await pool().query('SELECT agent_id FROM public.properties WHERE id = $1', [propId])).rows[0].agent_id)
      .toBe(agent.userId)
    expect(await auditRows(pool(), { agentId: agent.userId, action: 'change_owner' })).toHaveLength(0)
  })

  it('bulk delete typed-confirm phrase-mismatch returns 400 with zero mutations and zero audit rows', async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-wave8-pro'
    const agent = await agentSession({ name: 'Delete Guard' })
    const propId = await insertProperty(pool(), { agentId: agent.userId })
    const app = makeApp()

    const res = await request(app)
      .delete('/api/properties/bulk')
      .set('Authorization', `Bearer ${agent.token}`)
      .send({ ids: [propId], confirmed_phrase: 'nope' })
      .expect(400)
    expect(res.body.error).toBe('Confirmation phrase mismatch')
    expect(res.body.expected).toBe('delete 1')
    expect((await pool().query('SELECT id FROM public.properties WHERE id = $1', [propId])).rows).toHaveLength(1)
    expect(await auditRows(pool(), { agentId: agent.userId, action: 'delete' })).toHaveLength(0)
  })
})
