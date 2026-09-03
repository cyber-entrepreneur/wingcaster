import { randomUUID } from 'node:crypto'
import express from 'express'
import request from 'supertest'
import { expect, it, vi } from 'vitest'
import { finPostgresSuite } from '../../fin/testing/suite.js'
import { runReconciliation } from '../../fin/reconciliation/runner.js'
import { runBillingCycleWorkerTick } from './billing-cycle-worker.js'

const SECRET = 'pr-c-packages-admin-secret'
export const ADMIN_A = '00000000-0000-0000-0000-0000000000a1'
export const ADMIN_B = '00000000-0000-0000-0000-0000000000b2'

const F1 = '30200000-0000-4000-8000-000000000001'
const F2 = '30200000-0000-4000-8000-000000000002'
const F3 = '30200000-0000-4000-8000-000000000003'
const F4 = '30200000-0000-4000-8000-000000000004'
const F5 = '30200000-0000-4000-8000-000000000031'

async function makeApp(databaseUrl, { userId = ADMIN_A, role = 'platform_admin' } = {}) {
  process.env.JWT_SECRET = SECRET
  process.env.VITEST = '1'
  vi.resetModules()
  const { configure } = await import('../../db.js')
  configure({ databaseUrl, force: true })
  const { registerFinPackagesAdminRoutes } = await import('./admin-routes.js')
  const { signElevatedToken } = await import('../../auth.js')
  const app = express()
  app.use(express.json())
  const fakeAuth = (req, _res, next) => {
    req.user = {
      id: userId,
      token_version: 0,
      platform_role: role,
      email: `${userId}@example.test`,
    }
    next()
  }
  registerFinPackagesAdminRoutes(app, {
    authMiddleware: fakeAuth,
    requirePlatformAdmin: (req, res, next) => {
      if (req.user?.platform_role !== 'platform_admin') {
        return res.status(403).json({ error: 'Forbidden: platform admin required' })
      }
      next()
    },
  })
  return {
    app,
    elevate: () => signElevatedToken({ userId, tokenVersion: 0 }),
  }
}

function hdrs(token) {
  return {
    'X-Elevated-Token': token,
    'If-Match': '"1"',
    'Idempotency-Key': `pkg-${randomUUID()}`,
  }
}

finPostgresSuite('packages admin HTTP', {}, ({ url, pool }) => {
  it('unelevated POST → 401; non-admin → 403; invalid input → 400', async () => {
    const { app } = await makeApp(url())
    const unelevated = await request(app).post('/api/admin/fin/packages').send({
      code: 'x', display_name: 'X', tier: 'starter', target_audience: 'agent', billing_cadence: 'monthly',
    })
    expect(unelevated.status).toBe(401)

    const { app: agentApp, elevate } = await makeApp(url(), { role: 'agent' })
    const forbidden = await request(agentApp)
      .post('/api/admin/fin/packages')
      .set(hdrs(elevate()))
      .send({
        code: 'x', display_name: 'X', tier: 'starter', target_audience: 'agent', billing_cadence: 'monthly',
      })
    expect(forbidden.status).toBe(403)

    const { app: adminApp, elevate: adminTok } = await makeApp(url())
    const bad = await request(adminApp)
      .post('/api/admin/fin/packages')
      .set(hdrs(adminTok()))
      .send({ code: 'only-code' })
    expect(bad.status).toBe(400)
    expect(bad.body.code).toBe('INVALID_INPUT')
  })

  it('happy path: compose → two-person approve → publish → subscribe → cycle grant', async () => {
    const { app: appA, elevate: tokA } = await makeApp(url(), { userId: ADMIN_A })
    const { app: appB, elevate: tokB } = await makeApp(url(), { userId: ADMIN_B })
    const a = tokA()
    const b = tokB()
    const code = `pkg-${randomUUID().slice(0, 8)}`

    const created = await request(appA).post('/api/admin/fin/packages').set(hdrs(a)).send({
      code, display_name: 'Starter', tier: 'starter', target_audience: 'agent',
      currency: 'USD', billing_cadence: 'monthly',
    })
    expect(created.status).toBe(200)
    const packageId = created.body.id

    const draft = await request(appA).post(`/api/admin/fin/packages/${packageId}/versions`).set(hdrs(a)).send({
      properties_covered: 5, monthly_price_minor: 4900,
    })
    expect(draft.status).toBe(200)
    expect(draft.body.state).toBe('DRAFT')
    const vid = draft.body.id

    for (const featureId of [F1, F2, F3, F4, F5]) {
      const quota = await request(appA)
        .post(`/api/admin/fin/packages/${packageId}/versions/${vid}/quotas`)
        .set(hdrs(a))
        .send({ feature_id: featureId, credits_per_property: 10, rollover_policy: 'expire' })
      expect(quota.status).toBe(200)
    }
    for (const flag of ['crm.contacts', 'crm.tasks', 'listings.crud']) {
      const row = await request(appA)
        .post(`/api/admin/fin/packages/${packageId}/versions/${vid}/flags`)
        .set(hdrs(a))
        .send({ feature_code: flag, enabled: true })
      expect(row.status).toBe(200)
    }

    const submitted = await request(appA)
      .post(`/api/admin/fin/packages/${packageId}/versions/${vid}/submit-for-approval`)
      .set(hdrs(a))
      .send({})
    expect(submitted.status).toBe(200)
    expect(submitted.body.version.state).toBe('PENDING_APPROVAL')

    const self = await request(appA)
      .post(`/api/admin/fin/packages/${packageId}/versions/${vid}/approve`)
      .set(hdrs(a))
      .send({})
    expect(self.status).toBe(403)
    expect(self.body.code).toBe('APPROVAL_SELF_APPROVAL_FORBIDDEN')

    const approved = await request(appB)
      .post(`/api/admin/fin/packages/${packageId}/versions/${vid}/approve`)
      .set(hdrs(b))
      .send({})
    expect(approved.status).toBe(200)
    expect(approved.body.status).toBe('APPROVED')

    const published = await request(appA)
      .post(`/api/admin/fin/packages/${packageId}/versions/${vid}/publish`)
      .set(hdrs(a))
      .send({})
    expect(published.status).toBe(200)
    expect(published.body.state).toBe('PUBLISHED')

    const immutable = await request(appA)
      .patch(`/api/admin/fin/packages/${packageId}/versions/${vid}`)
      .set(hdrs(a))
      .send({ properties_covered: 99 })
    expect(immutable.status).toBe(409)
    expect(immutable.body.code).toBe('DRAFT_ONLY')

    const tenantId = randomUUID()
    const now = '2026-09-01T00:00:00.000Z'
    const sub = await request(appA).post('/api/admin/fin/subscriptions').set(hdrs(a)).send({
      tenant_id: tenantId,
      package_version_id: vid,
      properties_committed: 2,
      billing_cycle_start: now,
      now,
    })
    expect(sub.status).toBe(200)
    expect(sub.body.status).toBe('ACTIVE')

    const tick = await runBillingCycleWorkerTick({ pool: pool(), now })
    expect(tick.granted).toBeGreaterThanOrEqual(1)
    const grants = await pool().query(
      `SELECT amount, grant_ref FROM public.credit_grants
        WHERE tenant_id = $1 AND source = 'subscription_cycle'`,
      [tenantId],
    )
    expect(grants.rows).toHaveLength(1)
    expect(Number(grants.rows[0].amount)).toBe(2 * 10 * 5)

    const audits = await pool().query(
      `SELECT action FROM fin.financial_audit_events
        WHERE target_id = $1
        ORDER BY created_at`,
      [vid],
    )
    expect(audits.rows.map((r) => r.action)).toEqual(expect.arrayContaining([
      'PACKAGE_VERSION_CREATED',
      'PACKAGE_VERSION_SUBMITTED',
      'PACKAGE_VERSION_APPROVED',
      'PACKAGE_VERSION_PUBLISHED',
    ]))
  })

  it('reject path: submit → reject → DRAFT → edit + resubmit', async () => {
    const { app: appA, elevate: tokA } = await makeApp(url(), { userId: ADMIN_A })
    const { app: appB, elevate: tokB } = await makeApp(url(), { userId: ADMIN_B })
    const created = await request(appA).post('/api/admin/fin/packages').set(hdrs(tokA())).send({
      code: `rej-${randomUUID().slice(0, 8)}`, display_name: 'Reject', tier: 'starter',
      target_audience: 'agent', billing_cadence: 'monthly',
    })
    const pkg = created.body.id
    const draft = await request(appA).post(`/api/admin/fin/packages/${pkg}/versions`).set(hdrs(tokA())).send({
      properties_covered: 1, monthly_price_minor: 100,
    })
    const vid = draft.body.id
    await request(appA).post(`/api/admin/fin/packages/${pkg}/versions/${vid}/quotas`).set(hdrs(tokA())).send({
      feature_id: F1, credits_per_property: 3,
    })
    await request(appA).post(`/api/admin/fin/packages/${pkg}/versions/${vid}/submit-for-approval`).set(hdrs(tokA())).send({})
    const rejected = await request(appB)
      .post(`/api/admin/fin/packages/${pkg}/versions/${vid}/reject`)
      .set(hdrs(tokB()))
      .send({ reason: 'price too low' })
    expect(rejected.status).toBe(200)
    expect(rejected.body.version.state).toBe('DRAFT')

    const edited = await request(appA)
      .patch(`/api/admin/fin/packages/${pkg}/versions/${vid}`)
      .set(hdrs(tokA()))
      .send({ monthly_price_minor: 900 })
    expect(edited.status).toBe(200)
    expect(Number(edited.body.monthly_price_minor)).toBe(900)

    const resubmit = await request(appA)
      .post(`/api/admin/fin/packages/${pkg}/versions/${vid}/submit-for-approval`)
      .set(hdrs(tokA()))
      .send({})
    expect(resubmit.status).toBe(200)
    expect(resubmit.body.version.state).toBe('PENDING_APPROVAL')
  })

  it('already-resolved approval → 409; publish without approve → 409', async () => {
    const { app: appA, elevate: tokA } = await makeApp(url(), { userId: ADMIN_A })
    const { app: appB, elevate: tokB } = await makeApp(url(), { userId: ADMIN_B })
    const created = await request(appA).post('/api/admin/fin/packages').set(hdrs(tokA())).send({
      code: `res-${randomUUID().slice(0, 8)}`, display_name: 'Resolved', tier: 'growth',
      target_audience: 'agency', billing_cadence: 'monthly',
    })
    const pkg = created.body.id
    const draft = await request(appA).post(`/api/admin/fin/packages/${pkg}/versions`).set(hdrs(tokA())).send({})
    const vid = draft.body.id
    await request(appA).post(`/api/admin/fin/packages/${pkg}/versions/${vid}/submit-for-approval`).set(hdrs(tokA())).send({})
    const blocked = await request(appA)
      .post(`/api/admin/fin/packages/${pkg}/versions/${vid}/publish`)
      .set(hdrs(tokA()))
      .send({})
    expect(blocked.status).toBe(409)
    expect(blocked.body.code).toBe('PUBLISH_REQUIRES_APPROVAL')

    await request(appB).post(`/api/admin/fin/packages/${pkg}/versions/${vid}/approve`).set(hdrs(tokB())).send({})
    const again = await request(appB)
      .post(`/api/admin/fin/packages/${pkg}/versions/${vid}/approve`)
      .set(hdrs(tokB()))
      .send({})
    expect(again.status).toBe(409)
    expect(again.body.code).toBe('APPROVAL_ALREADY_RESOLVED')
  })

  it('deprecate v1 after publishing v2; R119 stays GREEN', async () => {
    const { app: appA, elevate: tokA } = await makeApp(url(), { userId: ADMIN_A })
    const { app: appB, elevate: tokB } = await makeApp(url(), { userId: ADMIN_B })
    async function publishOne(pkg, properties) {
      const draft = await request(appA).post(`/api/admin/fin/packages/${pkg}/versions`).set(hdrs(tokA())).send({
        properties_covered: properties, monthly_price_minor: 1000,
      })
      const vid = draft.body.id
      await request(appA).post(`/api/admin/fin/packages/${pkg}/versions/${vid}/submit-for-approval`).set(hdrs(tokA())).send({})
      await request(appB).post(`/api/admin/fin/packages/${pkg}/versions/${vid}/approve`).set(hdrs(tokB())).send({})
      const published = await request(appA)
        .post(`/api/admin/fin/packages/${pkg}/versions/${vid}/publish`)
        .set(hdrs(tokA()))
        .send({})
      return published.body
    }
    const created = await request(appA).post('/api/admin/fin/packages').set(hdrs(tokA())).send({
      code: `dep-${randomUUID().slice(0, 8)}`, display_name: 'Dep', tier: 'pro',
      target_audience: 'agent', billing_cadence: 'monthly',
    })
    const pkg = created.body.id
    const v1 = await publishOne(pkg, 1)
    const v2 = await publishOne(pkg, 2)
    expect(v2.state).toBe('PUBLISHED')
    const v1row = await pool().query(`SELECT effective_to FROM public.product_package_versions WHERE id = $1`, [v1.id])
    expect(new Date(v1row.rows[0].effective_to).toISOString()).toBe(new Date(v2.effective_from).toISOString())

    const noReason = await request(appA)
      .post(`/api/admin/fin/packages/${pkg}/versions/${v1.id}/deprecate`)
      .set(hdrs(tokA()))
      .send({})
    expect(noReason.status).toBe(400)

    const deprecated = await request(appA)
      .post(`/api/admin/fin/packages/${pkg}/versions/${v1.id}/deprecate`)
      .set(hdrs(tokA()))
      .send({ reason: 'superseded by v2' })
    expect(deprecated.status).toBe(200)
    expect(deprecated.body.state).toBe('DEPRECATED')

    const recon = await runReconciliation(pool(), { now: new Date().toISOString() })
    const r119 = recon.results.find((r) => r.check_code === 'R119')
    expect(r119.result).toBe('GREEN')
  })

  it('preview: 3 quotas totalling 500 credits/property', async () => {
    const { app, elevate } = await makeApp(url())
    const token = elevate()
    const created = await request(app).post('/api/admin/fin/packages').set(hdrs(token)).send({
      code: `prev-${randomUUID().slice(0, 8)}`, display_name: 'Preview', tier: 'starter',
      target_audience: 'agent', billing_cadence: 'monthly', monthly_price_minor: 0,
    })
    const pkg = created.body.id
    const draft = await request(app).post(`/api/admin/fin/packages/${pkg}/versions`).set(hdrs(token)).send({
      properties_covered: 10, monthly_price_minor: 100,
    })
    const vid = draft.body.id
    await request(app).post(`/api/admin/fin/packages/${pkg}/versions/${vid}/quotas`).set(hdrs(token)).send({
      feature_id: F1, credits_per_property: 100,
    })
    await request(app).post(`/api/admin/fin/packages/${pkg}/versions/${vid}/quotas`).set(hdrs(token)).send({
      feature_id: F2, credits_per_property: 150,
    })
    await request(app).post(`/api/admin/fin/packages/${pkg}/versions/${vid}/quotas`).set(hdrs(token)).send({
      feature_id: F3, credits_per_property: 250,
    })
    const at10 = await request(app).get(`/api/admin/fin/packages/${pkg}/versions/${vid}/preview?properties=10`)
    expect(at10.status).toBe(200)
    expect(at10.body.total_credits).toBe(5000)
    expect(at10.body.breakdown).toHaveLength(3)
    const at15 = await request(app).get(`/api/admin/fin/packages/${pkg}/versions/${vid}/preview?properties=15`)
    expect(at15.body.total_credits).toBe(7500)
  })

  it('feature registry economics PATCH is rejected; display_name with reason succeeds', async () => {
    const { app, elevate } = await makeApp(url())
    const token = elevate()
    const blocked = await request(app)
      .patch(`/api/admin/fin/metered-features/${F1}`)
      .set(hdrs(token))
      .send({ credits_per_unit: 1, reason: 'nope' })
    expect(blocked.status).toBe(400)
    expect(blocked.body.code).toBe('ECONOMICS_PATCH_FORBIDDEN')
    const ok = await request(app)
      .patch(`/api/admin/fin/metered-features/${F1}`)
      .set(hdrs(token))
      .send({ display_name: 'Instagram publish (admin)', reason: 'rename' })
    expect(ok.status).toBe(200)
    expect(ok.body.display_name).toContain('admin')
  })
})
