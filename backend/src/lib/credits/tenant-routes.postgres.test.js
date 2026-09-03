import { randomUUID } from 'node:crypto'
import express from 'express'
import request from 'supertest'
import { expect, it } from 'vitest'
import { finPostgresSuite } from '../../fin/testing/suite.js'
import { createAgentAccount } from '../../identity.js'
import { signToken, signElevatedToken } from '../../auth.js'
import { registerTenantBillingRoutes } from './tenant-routes.js'
import { creditTenantIdForScope } from './tenant-context.js'
import { seedPublishedPackage, withTx } from '../packages/test-support.js'

function buildApp() {
  const app = express()
  app.use(express.json())
  registerTenantBillingRoutes(app)
  return app
}

async function agentSession() {
  const userId = randomUUID()
  const now = new Date().toISOString()
  await createAgentAccount({
    user: {
      id: userId, email: `t-${userId}@x.test`, name: 'Tenant',
      password_hash: 'x', role: 'agent', verified: true, verified_at: now,
    },
    agent: { id: userId, email: `t-${userId}@x.test`, name: 'Tenant' },
  })
  const token = signToken({
    id: userId, email: `t-${userId}@x.test`, name: 'Tenant',
    token_version: 0, verified_at: now,
  })
  return { userId, token, tenantId: creditTenantIdForScope('personal', userId) }
}

finPostgresSuite('tenant billing routes', {}, ({ pool }) => {
  it('returns balance, quotas, subscription, empty invoices and credit notes', async () => {
    const { token } = await agentSession()
    const app = buildApp()
    const balance = await request(app).get('/api/tenant/credits/balance').set('Authorization', `Bearer ${token}`)
    expect(balance.status).toBe(200)
    expect(balance.body.hard_block).toBe(true)
    expect(Array.isArray(balance.body.quotas)).toBe(true)

    const sub = await request(app).get('/api/tenant/subscription').set('Authorization', `Bearer ${token}`)
    expect(sub.status).toBe(200)
    expect(sub.body.subscription.package_code).toBe('free-agent')

    const invoices = await request(app).get('/api/tenant/invoices').set('Authorization', `Bearer ${token}`)
    expect(invoices.status).toBe(200)
    expect(invoices.body.invoices).toEqual([])

    const notes = await request(app).get('/api/tenant/credit-notes').set('Authorization', `Bearer ${token}`)
    expect(notes.status).toBe(200)
    expect(notes.body.credit_notes).toEqual([])
  })

  it('top-up stub emits topup.requested and does not grant credits', async () => {
    const { token, tenantId } = await agentSession()
    const app = buildApp()
    const before = await pool().query(
      `SELECT credits_remaining FROM public.credit_wallets WHERE tenant_id = $1`,
      [tenantId],
    )
    const res = await request(app)
      .post('/api/tenant/credits/top-up')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount_usd: 20, idempotency_key: randomUUID() })
    expect(res.status).toBe(202)
    const after = await pool().query(
      `SELECT credits_remaining FROM public.credit_wallets WHERE tenant_id = $1`,
      [tenantId],
    )
    expect(Number(after.rows[0].credits_remaining)).toBe(Number(before.rows[0].credits_remaining))
    const outbox = await pool().query(
      `SELECT topic FROM fin.outbox_events WHERE topic = 'topup.requested' ORDER BY created_at DESC LIMIT 1`,
    )
    expect(outbox.rows[0].topic).toBe('topup.requested')
  })

  it('change-plan preview then changePlan with elevation', async () => {
    const { token, tenantId, userId } = await agentSession()
    const growth = await withTx(pool(), (client) => seedPublishedPackage(client, {
      code: `growth-${randomUUID().slice(0, 8)}`,
      tier: 'growth',
      quotas: [{ code: 'publishing.social.instagram', creditsPerProperty: 40 }],
    }))
    const sub = await pool().query(
      `SELECT id FROM public.tenant_subscriptions WHERE tenant_id = $1`,
      [tenantId],
    )
    const app = buildApp()
    const preview = await request(app)
      .post('/api/tenant/subscription/preview-change')
      .set('Authorization', `Bearer ${token}`)
      .send({
        subscription_id: sub.rows[0].id,
        new_package_version_id: growth.versionId,
      })
    expect(preview.status).toBe(200)
    expect(preview.body).toHaveProperty('net')

    const elevated = signElevatedToken({ userId, tokenVersion: 0 })
    const changed = await request(app)
      .post('/api/tenant/subscription/change-plan')
      .set('Authorization', `Bearer ${token}`)
      .set('x-elevated-token', elevated)
      .send({
        subscription_id: sub.rows[0].id,
        new_package_version_id: growth.versionId,
        prorate: true,
      })
    expect(changed.status).toBe(200)
    expect(changed.body.previous.status).toBe('ENDED')
    expect(changed.body.subscription.status).toBe('ACTIVE')
  })

  it('lists published plans', async () => {
    const { token } = await agentSession()
    const app = buildApp()
    const res = await request(app).get('/api/tenant/plans').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.plans.some((p) => p.code === 'free-agent')).toBe(true)
  })
})
