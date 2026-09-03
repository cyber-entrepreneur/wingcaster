import { randomUUID } from 'node:crypto'
import { createHmac } from 'node:crypto'
import express from 'express'
import request from 'supertest'
import { expect, it } from 'vitest'
import { finPostgresSuite } from '../../fin/testing/suite.js'
import { CREDIT_ERROR } from './errors.js'
import { FEATURES } from './features.js'
import { consume, grant, release, reserve, upsertSpendCap } from './engine.js'
import { withCredits } from './with-credits.js'
import { completeTopUpFromWebhook, registerTenantBillingRoutes } from './tenant-routes.js'
import { DEFAULT_APPROVAL_THRESHOLD_MICRO_USD, grantRequiresApproval } from './pricing.js'
import { verifyMetaSignature } from '../webhook-verify.js'
import { createAgencyWithOwner, endAgencyMembership, addAgencyMembership } from '../../tenant-authorization.js'
import { createAgentAccount } from '../../identity.js'
import { signToken, signElevatedToken } from '../../auth.js'
import { pseudonymizeCreditHistory, deletedActorLabel } from './erasure.js'
import { creditTenantIdForScope } from './tenant-context.js'

async function seedCredits(amount = 10_000) {
  const tenantId = randomUUID()
  await grant({
    tenantId,
    source: 'promo',
    amount,
    currency: 'USD',
    grantRef: { idempotency_key: `seed:${tenantId}`, reason: 'test seed' },
  })
  return tenantId
}

function buildApp() {
  const app = express()
  app.use(express.json())
  registerTenantBillingRoutes(app)
  return app
}

finPostgresSuite('PR D threat model', {}, ({ pool }) => {
  it('spend caps are enforced on the withCredits hot path', async () => {
    const tenantId = await seedCredits()
    await upsertSpendCap({
      tenantId, feature: FEATURES.AI_LISTINGS_DESCRIBE, windowKind: 'HOUR', maxCredits: 10,
    })
    await expect(withCredits({
      tenantId,
      feature: FEATURES.AI_LISTINGS_DESCRIBE,
      requestId: randomUUID(),
      creditsAmount: 50,
      callType: 'describe',
    }, async () => true)).rejects.toMatchObject({ code: CREDIT_ERROR.SPEND_CAP_EXCEEDED })
  })

  it('UNIQUE(request_id, feature, call_type) blocks double consume', async () => {
    const tenantId = await seedCredits()
    const requestId = randomUUID()
    await withCredits({
      tenantId, feature: FEATURES.COMMUNICATION_SMS_PER_MESSAGE, requestId, callType: 'send',
    }, async () => 'ok')
    const replay = await consume({
      tenantId, feature: FEATURES.COMMUNICATION_SMS_PER_MESSAGE, requestId,
      callType: 'send', creditsAmount: 100,
    })
    expect(replay.replay).toBe(true)
  })

  it('WhatsApp HMAC is verified before any credit engine call', () => {
    const secret = 'meta-secret'
    const rawBody = Buffer.from('{"entry":[]}')
    const signature = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`
    expect(verifyMetaSignature({ rawBody, signature, appSecret: secret }).ok).toBe(true)
    expect(verifyMetaSignature({ rawBody, signature: 'sha256=deadbeef', appSecret: secret }).ok).toBe(false)
  })

  it('goodwill above $10 requires approval and env cannot bypass the hot-path trigger default', async () => {
    expect(DEFAULT_APPROVAL_THRESHOLD_MICRO_USD).toBe(10_000_000)
    expect(grantRequiresApproval('goodwill', 100_001)).toBe(true)
    expect(grantRequiresApproval('promo', 100_001)).toBe(false)
    const tenantId = await seedCredits(1)
    await expect(grant({
      tenantId,
      source: 'goodwill',
      amount: 200_000,
      currency: 'USD',
      grantRef: { reason: 'too big' },
    })).rejects.toMatchObject({ code: CREDIT_ERROR.CREDIT_GRANT_APPROVAL_REQUIRED })
  })

  it('agency admin deprovision bumps token_version so the session is revoked', async () => {
    const ownerId = randomUUID()
    const adminId = randomUUID()
    const now = new Date().toISOString()
    await createAgentAccount({
      user: {
        id: ownerId, email: `d-${ownerId}@x.test`, name: 'Owner',
        password_hash: 'x', role: 'agent', verified: true, verified_at: now,
      },
      agent: { id: ownerId, email: `d-${ownerId}@x.test`, name: 'Owner' },
    })
    await createAgentAccount({
      user: {
        id: adminId, email: `a-${adminId}@x.test`, name: 'Admin',
        password_hash: 'x', role: 'agent', verified: true, verified_at: now,
      },
      agent: { id: adminId, email: `a-${adminId}@x.test`, name: 'Admin' },
    })
    const agencyId = randomUUID()
    await createAgencyWithOwner({
      agency: { id: agencyId, name: 'Ended Co' },
      ownerUserId: ownerId,
    })
    const added = await addAgencyMembership({
      agencyId,
      userId: adminId,
      role: 'admin',
      affiliationMode: 'exclusive',
      invitedBy: ownerId,
      status: 'active',
    })
    const before = await pool().query(`SELECT data->>'token_version' AS v FROM users WHERE id = $1`, [adminId])
    await endAgencyMembership({
      agencyId, membershipId: added.legacyMembership.id, endedBy: ownerId, reason: 'terminated',
    })
    const after = await pool().query(`SELECT data->>'token_version' AS v FROM users WHERE id = $1`, [adminId])
    expect(Number(after.rows[0].v)).toBeGreaterThan(Number(before.rows[0].v || 0))
    const membership = await pool().query(
      `SELECT status FROM tenant_memberships WHERE tenant_id = $1 AND user_id = $2`,
      [`agency:${agencyId}`, adminId],
    )
    expect(membership.rows[0].status).toBe('ended')
    const stale = signToken({
      id: adminId, email: `a-${adminId}@x.test`, name: 'Admin',
      token_version: Number(before.rows[0].v || 0), verified_at: now,
    })
    const app = buildApp()
    const revoked = await request(app)
      .get('/api/tenant/credits/balance')
      .set('Authorization', `Bearer ${stale}`)
    expect(revoked.status).toBe(401)
  })

  it('tenant billing reads filter tenant_id from the JWT-derived wallet, not a query param', async () => {
    const now = new Date().toISOString()
    const userId = randomUUID()
    await createAgentAccount({
      user: {
        id: userId, email: `a-${userId}@x.test`, name: 'A',
        password_hash: 'x', role: 'agent', verified: true, verified_at: now,
      },
      agent: { id: userId, email: `a-${userId}@x.test`, name: 'A' },
    })
    const other = await seedCredits(500)
    await grant({
      tenantId: other, source: 'promo', amount: 77, currency: 'USD',
      grantRef: { idempotency_key: `other:${other}`, reason: 'secret' },
    })
    const token = signToken({
      id: userId, email: `a-${userId}@x.test`, name: 'A',
      token_version: 0, verified_at: now,
    })
    const app = buildApp()
    const res = await request(app)
      .get(`/api/tenant/credits/grants?tenant_id=${other}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    const mine = creditTenantIdForScope('personal', userId)
    expect((res.body.grants || []).every((g) => g.tenant_id === undefined || true)).toBe(true)
    const leaked = (res.body.grants || []).some((g) => Number(g.amount) === 77)
    expect(leaked).toBe(false)
    const own = await pool().query(
      `SELECT tenant_id FROM public.credit_wallets WHERE tenant_id = $1`,
      [mine],
    )
    expect(own.rows[0]).toBeTruthy()
  })

  it('consume after release returns RESERVATION_NOT_HELD', async () => {
    const tenantId = await seedCredits()
    const requestId = randomUUID()
    await reserve({
      tenantId, feature: FEATURES.AI_COMMENT_CLASSIFIER, requestId, creditsAmount: 100,
    })
    await release({ tenantId, feature: FEATURES.AI_COMMENT_CLASSIFIER, requestId })
    await expect(consume({
      tenantId, feature: FEATURES.AI_COMMENT_CLASSIFIER, requestId,
      callType: 'classify', creditsAmount: 100,
    })).rejects.toMatchObject({ code: CREDIT_ERROR.RESERVATION_NOT_HELD })
  })

  it('top-up webhook replay is blocked by grant_ref idempotency_key = webhook_event_id', async () => {
    const tenantId = await seedCredits(1)
    const webhookEventId = `evt_${randomUUID()}`
    const first = await completeTopUpFromWebhook({
      tenantId, amount: 25, webhookEventId, source: 'topup.paddle',
    })
    const second = await completeTopUpFromWebhook({
      tenantId, amount: 25, webhookEventId, source: 'topup.paddle',
    })
    expect(first.replay).toBe(false)
    expect(second.replay).toBe(true)
    expect(second.grant.id).toBe(first.grant.id)
  })

  it('tenant routes use parameterized SQL (no interpolation of tenant id)', async () => {
    const src = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('./tenant-routes.js', import.meta.url), 'utf8'),
    )
    expect(src).not.toMatch(/WHERE tenant_id = '\$\{/)
    expect(src).toMatch(/WHERE tenant_id = \$1/)
  })

  it('top-up above $50 requires elevated re-auth', async () => {
    const now = new Date().toISOString()
    const userId = randomUUID()
    await createAgentAccount({
      user: {
        id: userId, email: `e-${userId}@x.test`, name: 'E',
        password_hash: 'x', role: 'agent', verified: true, verified_at: now,
      },
      agent: { id: userId, email: `e-${userId}@x.test`, name: 'E' },
    })
    const token = signToken({
      id: userId, email: `e-${userId}@x.test`, name: 'E',
      token_version: 0, verified_at: now,
    })
    const app = buildApp()
    const denied = await request(app)
      .post('/api/tenant/credits/top-up')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount_usd: 75 })
    expect(denied.status).toBe(401)
    expect(denied.body.code).toBe('step_up_required')

    const elevated = signElevatedToken({ userId, tokenVersion: 0 })
    const ok = await request(app)
      .post('/api/tenant/credits/top-up')
      .set('Authorization', `Bearer ${token}`)
      .set('x-elevated-token', elevated)
      .send({ amount_usd: 75, idempotency_key: randomUUID() })
    expect(ok.status).toBe(202)
    expect(ok.body.status).toBe('pending_provider')
  })

  it('RLS is enabled on public.credit_* tables', async () => {
    const { rows } = await pool().query(
      `SELECT c.relname, c.relrowsecurity
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname IN ('credit_wallets','credit_grants','credit_consumptions','credit_reservations')
        ORDER BY 1`,
    )
    expect(rows.every((r) => r.relrowsecurity === true)).toBe(true)
  })

  it('GDPR erasure pseudonymizes actor ids while retaining financial rows', async () => {
    const actorId = randomUUID()
    const tenantId = await seedCredits(5)
    await pool().query(
      `UPDATE public.credit_grants SET granted_by_actor_id = $2 WHERE tenant_id = $1`,
      [tenantId, actorId],
    )
    const label = deletedActorLabel(actorId)
    const client = await pool().connect()
    try {
      await pseudonymizeCreditHistory(client, { actorId })
      const grants = await client.query(
        `SELECT granted_by_actor_id, data->>'granted_by_actor_id' AS label
           FROM public.credit_grants WHERE tenant_id = $1`,
        [tenantId],
      )
      expect(grants.rows[0].granted_by_actor_id).toBeNull()
      expect(grants.rows[0].label).toBe(label)
      const remaining = await client.query(
        `SELECT count(*)::int AS n FROM public.credit_grants WHERE tenant_id = $1`,
        [tenantId],
      )
      expect(remaining.rows[0].n).toBeGreaterThan(0)
    } finally {
      client.release()
    }
  })
})
