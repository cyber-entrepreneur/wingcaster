/**
 * BE-BLOCKER-32 — undo-reject grace, recall authz, is_own_submission,
 * env scoping, feature-registry, diff, import-from-live.
 */
import { randomUUID } from 'node:crypto'
import express from 'express'
import request from 'supertest'
import { expect, it, vi } from 'vitest'
import { finPostgresSuite } from '../../fin/testing/suite.js'

const SECRET = 'be-32-pa-pkg-bundle-secret'
export const ADMIN_A = '00000000-0000-0000-0000-0000000000a1'
export const ADMIN_B = '00000000-0000-0000-0000-0000000000b2'
const F1 = '30200000-0000-4000-8000-000000000001'

async function makeApp(databaseUrl, {
  userId = ADMIN_A,
  role = 'platform_admin',
  environment = 'live',
} = {}) {
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
      env: environment,
      fin_environment: environment === 'test' ? 'TEST' : 'LIVE',
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

function hdrs(token, env = 'live') {
  return {
    'X-Elevated-Token': token,
    'If-Match': '"1"',
    'Idempotency-Key': `pkg-${randomUUID()}`,
    'X-Wingcaster-Env': env,
  }
}

async function createSubmittedVersion(app, token, {
  code = `be32-${randomUUID().slice(0, 8)}`,
  env = 'live',
} = {}) {
  const created = await request(app).post('/api/admin/fin/packages').set(hdrs(token, env)).send({
    code, display_name: code, tier: 'starter', target_audience: 'agent', billing_cadence: 'monthly',
  })
  expect(created.status).toBe(200)
  const packageId = created.body.id
  const draft = await request(app)
    .post(`/api/admin/fin/packages/${packageId}/versions`)
    .set(hdrs(token, env))
    .send({ properties_covered: 5, monthly_price_minor: 4900 })
  const vid = draft.body.id
  await request(app)
    .post(`/api/admin/fin/packages/${packageId}/versions/${vid}/quotas`)
    .set(hdrs(token, env))
    .send({ feature_id: F1, credits_per_property: 10 })
  const submitted = await request(app)
    .post(`/api/admin/fin/packages/${packageId}/versions/${vid}/submit-for-approval`)
    .set(hdrs(token, env))
    .send({})
  expect(submitted.status).toBe(200)
  return { packageId, vid, code }
}

finPostgresSuite('BE-BLOCKER-32 PA-PKG bundle', {}, ({ url }) => {
  it('env-scoped catalog: LIVE and TEST never co-mingle', async () => {
    const { app: liveApp, elevate: liveTok } = await makeApp(url(), { environment: 'live' })
    const { app: testApp } = await makeApp(url(), { environment: 'test' })
    const code = `env-${randomUUID().slice(0, 8)}`
    const liveCreate = await request(liveApp).post('/api/admin/fin/packages').set(hdrs(liveTok(), 'live')).send({
      code, display_name: 'Live Only', tier: 'starter', target_audience: 'agent', billing_cadence: 'monthly',
    })
    expect(liveCreate.status).toBe(200)
    expect(liveCreate.body.environment).toBe('LIVE')
    const liveList = await request(liveApp).get('/api/admin/fin/packages').set({ 'X-Wingcaster-Env': 'live' })
    expect(liveList.body.packages.some((p) => p.code === code)).toBe(true)
    const testList = await request(testApp).get('/api/admin/fin/packages').set({ 'X-Wingcaster-Env': 'test' })
    expect(testList.body.packages.some((p) => p.code === code)).toBe(false)
    const alias = await request(liveApp).get('/api/admin/packages').set({ 'X-Wingcaster-Env': 'live' })
    expect(alias.body.packages.some((p) => p.code === code)).toBe(true)
  })

  it('feature-registry live fetch is env-agnostic', async () => {
    const { app } = await makeApp(url(), { environment: 'test' })
    const viaAlias = await request(app).get('/api/admin/feature-registry').set({ 'X-Wingcaster-Env': 'test' })
    expect(viaAlias.status).toBe(200)
    expect(viaAlias.body.env_agnostic).toBe(true)
    expect(viaAlias.body.features.length).toBeGreaterThan(0)
  })

  it('pending-approvals include is_own_submission for viewer', async () => {
    const { app: appA, elevate: tokA } = await makeApp(url(), { userId: ADMIN_A })
    const { app: appB } = await makeApp(url(), { userId: ADMIN_B })
    const { packageId, vid } = await createSubmittedVersion(appA, tokA())
    const asSubmitter = await request(appA).get('/api/admin/fin/packages/pending-approvals')
    expect(asSubmitter.body.approvals.find((a) => a.id === vid)?.is_own_submission).toBe(true)
    const asPeer = await request(appB).get('/api/admin/fin/packages/pending-approvals')
    expect(asPeer.body.approvals.find((a) => a.id === vid)?.is_own_submission).toBe(false)
    const detail = await request(appA).get(`/api/admin/fin/packages/${packageId}/versions/${vid}`)
    expect(detail.body.is_own_submission).toBe(true)
  })

  it('undo-reject succeeds within 5s and hard-commits after grace', async () => {
    const { app: appA, elevate: tokA } = await makeApp(url(), { userId: ADMIN_A })
    const { app: appB, elevate: tokB } = await makeApp(url(), { userId: ADMIN_B })
    const { packageId, vid } = await createSubmittedVersion(appA, tokA(), { code: `undo-${randomUUID().slice(0, 8)}` })
    const rejectAt = new Date('2026-09-12T12:00:00.000Z')
    const rejected = await request(appB)
      .post(`/api/admin/fin/packages/${packageId}/versions/${vid}/reject`)
      .set(hdrs(tokB()))
      .send({ reason: 'too expensive', now: rejectAt.toISOString() })
    expect(rejected.status).toBe(200)
    expect(rejected.body.undo_reject_grace_ms).toBe(5000)
    const undoOk = await request(appB)
      .post(`/api/admin/fin/packages/${packageId}/versions/${vid}/undo-reject`)
      .set(hdrs(tokB()))
      .send({ now: new Date(rejectAt.getTime() + 2500).toISOString() })
    expect(undoOk.status).toBe(200)
    expect(undoOk.body.version.state).toBe('PENDING_APPROVAL')
    await request(appB)
      .post(`/api/admin/fin/packages/${packageId}/versions/${vid}/reject`)
      .set(hdrs(tokB()))
      .send({ reason: 'still too expensive', now: rejectAt.toISOString() })
    const undoExpired = await request(appB)
      .post(`/api/admin/fin/packages/${packageId}/versions/${vid}/undo-reject`)
      .set(hdrs(tokB()))
      .send({ now: new Date(rejectAt.getTime() + 5001).toISOString() })
    expect(undoExpired.status).toBe(409)
    expect(undoExpired.body.code).toBe('UNDO_REJECT_EXPIRED')
  })

  it('recall is submitter-only; peers get 403', async () => {
    const { app: appA, elevate: tokA } = await makeApp(url(), { userId: ADMIN_A })
    const { app: appB, elevate: tokB } = await makeApp(url(), { userId: ADMIN_B })
    const { packageId, vid } = await createSubmittedVersion(appA, tokA(), { code: `rec-${randomUUID().slice(0, 8)}` })
    const peerBlocked = await request(appB)
      .post(`/api/admin/fin/packages/${packageId}/versions/${vid}/recall`)
      .set(hdrs(tokB()))
      .send({})
    expect(peerBlocked.status).toBe(403)
    expect(peerBlocked.body.code).toBe('RECALL_FORBIDDEN')
    const recalled = await request(appA)
      .post(`/api/admin/fin/packages/${packageId}/versions/${vid}/recall`)
      .set(hdrs(tokA()))
      .send({})
    expect(recalled.status).toBe(200)
    expect(recalled.body.version.state).toBe('DRAFT')
  })

  it('arbitrary-version diff returns field/quota changes', async () => {
    const { app, elevate } = await makeApp(url())
    const token = elevate()
    const created = await request(app).post('/api/admin/fin/packages').set(hdrs(token)).send({
      code: `diff-${randomUUID().slice(0, 8)}`, display_name: 'Diff Pack',
      tier: 'starter', target_audience: 'agent', billing_cadence: 'monthly',
    })
    const packageId = created.body.id
    const v1 = await request(app).post(`/api/admin/fin/packages/${packageId}/versions`).set(hdrs(token))
      .send({ properties_covered: 5, monthly_price_minor: 1000 })
    const v2 = await request(app).post(`/api/admin/fin/packages/${packageId}/versions`).set(hdrs(token))
      .send({ properties_covered: 10, monthly_price_minor: 2000 })
    await request(app).post(`/api/admin/fin/packages/${packageId}/versions/${v2.body.id}/quotas`).set(hdrs(token))
      .send({ feature_id: F1, credits_per_property: 25 })
    const diff = await request(app)
      .get(`/api/admin/fin/packages/${packageId}/versions/${v1.body.id}/diff/${v2.body.id}`)
    expect(diff.status).toBe(200)
    expect(diff.body.a_version).toBe(1)
    expect(diff.body.b_version).toBe(2)
    expect(diff.body.changes.fields.some((f) => f.field === 'properties_covered')).toBe(true)
    expect(diff.body.summary.properties_covered_delta).toBe(5)
  })

  it('import-from-live seeds TEST drafts from LIVE published packages', async () => {
    const { app: liveApp, elevate: liveTok } = await makeApp(url(), { userId: ADMIN_A, environment: 'live' })
    const { app: testApp, elevate: testTok } = await makeApp(url(), { userId: ADMIN_A, environment: 'test' })
    const code = `imp-${randomUUID().slice(0, 8)}`
    const { packageId, vid } = await createSubmittedVersion(liveApp, liveTok(), { code, env: 'live' })
    const { app: liveAppB, elevate: liveTokB } = await makeApp(url(), { userId: ADMIN_B, environment: 'live' })
    await request(liveAppB).post(`/api/admin/fin/packages/${packageId}/versions/${vid}/approve`)
      .set(hdrs(liveTokB(), 'live')).send({})
    const published = await request(liveApp).post(`/api/admin/fin/packages/${packageId}/versions/${vid}/publish`)
      .set(hdrs(liveTok(), 'live')).send({})
    expect(published.status).toBe(200)
    expect(published.body.marketing_revalidation?.event_id).toBeTruthy()
    const blocked = await request(liveApp).post('/api/admin/fin/packages/import-from-live')
      .set(hdrs(liveTok(), 'live')).send({})
    expect(blocked.status).toBe(400)
    expect(blocked.body.code).toBe('IMPORT_LIVE_ONLY_FROM_TEST')
    const imported = await request(testApp).post('/api/admin/packages/import-from-live')
      .set(hdrs(testTok(), 'test')).send({})
    expect(imported.status).toBe(200)
    expect(imported.body.copied_count).toBeGreaterThanOrEqual(1)
    expect(imported.body.packages_created.some((p) => p.code === code)).toBe(true)
    const poll = await request(liveApp)
      .get(`/api/admin/fin/packages/revalidation-events/${published.body.marketing_revalidation.event_id}`)
    expect(poll.status).toBe(200)
    expect(poll.body.event.status).toBe('skipped')
  })
})
