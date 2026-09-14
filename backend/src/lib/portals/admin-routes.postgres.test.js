/**
 * BE-BLOCKER-35 — PA-POR admin HTTP + activation state-machine gates.
 */
import { randomUUID } from 'node:crypto'
import express from 'express'
import request from 'supertest'
import { beforeEach, expect, it, vi } from 'vitest'
import { finPostgresSuite } from '../../fin/testing/suite.js'

const SECRET = 'be-35-portal-admin-secret'
export const ADMIN_A = '00000000-0000-0000-0000-0000000000a1'
export const ADMIN_B = '00000000-0000-0000-0000-0000000000b2'

async function makeApp(databaseUrl, { userId = ADMIN_A, role = 'platform_admin' } = {}) {
  process.env.JWT_SECRET = SECRET
  process.env.VITEST = '1'
  vi.resetModules()
  const { configure } = await import('../../db.js')
  configure({ databaseUrl, force: true })
  const { registerPortalAdminRoutes } = await import('./admin-routes.js')
  const { signElevatedToken } = await import('../../auth.js')
  const app = express()
  app.use(express.json({ limit: '1mb' }))
  const fakeAuth = (req, _res, next) => {
    req.user = {
      id: userId,
      token_version: 0,
      platform_role: role,
      email: `${userId}@example.test`,
    }
    next()
  }
  registerPortalAdminRoutes(app, {
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
    'Idempotency-Key': `por-${randomUUID()}`,
  }
}

finPostgresSuite('portal admin HTTP (BE-BLOCKER-35)', { seed: true }, ({ url, pool }) => {
  beforeEach(async () => {
    await pool().query(`DELETE FROM public.portal_registry_pending_activations`)
    await pool().query(`TRUNCATE public.portal_activation_history`)
    await pool().query(`DELETE FROM public.portal_registry_versions`)
    await pool().query(
      `DELETE FROM public.portal_registry
        WHERE code NOT IN ('olx', 'property_finder', 'bayut', 'dubizzle')`,
    )
    await pool().query(
      `UPDATE public.portal_registry SET is_active = false, deprecated_at = NULL
        WHERE code IN ('olx', 'property_finder', 'bayut', 'dubizzle')`,
    )
  })

  it('lists portals with counts', async () => {
    const { app } = await makeApp(url())
    const res = await request(app).get('/api/admin/portals?active=all&status=all')
    expect(res.status).toBe(200)
    expect(res.body.portals.length).toBeGreaterThanOrEqual(4)
    expect(res.body.counts.total).toBeGreaterThanOrEqual(4)
    expect(res.body.portals[0]).toHaveProperty('adapter_status')
    expect(res.body.portals[0]).toHaveProperty('code')
  })

  it('activate → pending 202; approve blocked without adapter/validator', async () => {
    const { app: appA, elevate: tokA } = await makeApp(url(), { userId: ADMIN_A })
    const { app: appB, elevate: tokB } = await makeApp(url(), { userId: ADMIN_B })

    const code = `missing_adapter_${randomUUID().slice(0, 8)}`
    const created = await request(appA)
      .post('/api/admin/portals')
      .set(hdrs(tokA()))
      .send({
        code,
        display_name: 'Missing Adapter Portal',
        country_codes: ['AE'],
        adapter_class_name: 'portals/does_not_exist_xyz.js',
        validator_ref: 'portal-validators/does_not_exist_xyz.js',
      })
    expect(created.status).toBe(201)
    expect(created.body.is_active).toBe(false)

    const activate = await request(appA)
      .post(`/api/admin/portals/${code}/activate`)
      .set(hdrs(tokA()))
      .send({ submitter_notes: 'try activate' })
    expect(activate.status).toBe(400)
    expect(activate.body.code).toBe('ADAPTER_MISSING')

    const code2 = `noval_${randomUUID().slice(0, 8)}`
    const created2 = await request(appA)
      .post('/api/admin/portals')
      .set(hdrs(tokA()))
      .send({
        code: code2,
        display_name: 'No Validator',
        country_codes: ['AE'],
        adapter_class_name: 'portals/olx.js',
        validator_ref: 'portal-validators/definitely_missing_zzz.js',
      })
    expect(created2.status).toBe(201)

    const activate2 = await request(appA)
      .post(`/api/admin/portals/${code2}/activate`)
      .set(hdrs(tokA()))
      .send({ submitter_notes: 'need validator' })
    expect(activate2.status).toBe(400)
    expect(activate2.body.code).toBe('VALIDATOR_MISSING')

    const pending = await request(appA)
      .post('/api/admin/portals/olx/activate')
      .set(hdrs(tokA()))
      .send({ submitter_notes: 'BD ready', effective_from: '2026-09-12T00:00:00Z' })
    expect(pending.status).toBe(202)
    expect(pending.body.code).toBe('PENDING_APPROVAL')
    expect(pending.body.pending_activation_id).toBeTruthy()

    const own = await request(appA)
      .post('/api/admin/portals/olx/activate/approve')
      .set(hdrs(tokA()))
      .send({ approver_notes: 'self' })
    expect(own.status).toBe(403)
    expect(own.body.code).toBe('OWN_SUBMISSION')

    const approved = await request(appB)
      .post('/api/admin/portals/olx/activate/approve')
      .set(hdrs(tokB()))
      .send({ approver_notes: 'lgtm' })
    expect(approved.status).toBe(200)
    expect(approved.body.portal.is_active).toBe(true)
  })

  it('own-submission reject on activate/approve', async () => {
    const { app: appA, elevate: tokA } = await makeApp(url(), { userId: ADMIN_A })

    const pending = await request(appA)
      .post('/api/admin/portals/bayut/activate')
      .set(hdrs(tokA()))
      .send({ submitter_notes: 'mine' })
    expect(pending.status).toBe(202)

    const own = await request(appA)
      .post('/api/admin/portals/bayut/activate/approve')
      .set(hdrs(tokA()))
      .send({})
    expect(own.status).toBe(403)
    expect(own.body.code).toBe('OWN_SUBMISSION')

    const withdrawn = await request(appA)
      .post('/api/admin/portals/bayut/activate/withdraw')
      .set(hdrs(tokA()))
      .send({})
    expect(withdrawn.status).toBe(200)
    expect(withdrawn.body.pending.state).toBe('withdrawn')
  })

  it('history timeline after activation', async () => {
    const { app: appA, elevate: tokA } = await makeApp(url(), { userId: ADMIN_A })
    const { app: appB, elevate: tokB } = await makeApp(url(), { userId: ADMIN_B })

    const pending = await request(appA)
      .post('/api/admin/portals/dubizzle/activate')
      .set(hdrs(tokA()))
      .send({ submitter_notes: 'go' })
    expect(pending.status).toBe(202)

    const approved = await request(appB)
      .post('/api/admin/portals/dubizzle/activate/approve')
      .set(hdrs(tokB()))
      .send({ approver_notes: 'ok' })
    expect(approved.status).toBe(200)

    const history = await request(appA).get('/api/admin/portals/dubizzle/history')
    expect(history.status).toBe(200)
    expect(history.body.events.length).toBeGreaterThanOrEqual(2)
    const types = history.body.events.map((e) => e.event_type)
    expect(types).toEqual(expect.arrayContaining(['submitted', 'approved']))

    const csv = await request(appA).get('/api/admin/portals/dubizzle/history.csv')
    expect(csv.status).toBe(200)
    expect(csv.headers['content-type']).toMatch(/csv/)
    expect(csv.text).toContain('event_type')
  })

  it('GET single portal + CSV list', async () => {
    const { app } = await makeApp(url())
    const one = await request(app).get('/api/admin/portals/property_finder')
    expect(one.status).toBe(200)
    expect(one.body.code).toBe('property_finder')
    expect(one.body.adapter_status).toMatch(/live|stub/)

    const csv = await request(app).get('/api/admin/portals.csv?active=all')
    expect(csv.status).toBe(200)
    expect(csv.text).toContain('property_finder')
  })

  it('logo-upload returns 501 until object storage ships', async () => {
    const { app, elevate } = await makeApp(url())
    const res = await request(app)
      .post('/api/admin/portals/logo-upload')
      .set(hdrs(elevate()))
      .send({ code: 'olx', data_base64: 'aGVsbG8=' })
    expect(res.status).toBe(501)
    expect(res.body.code).toBe('LOGO_STORAGE_NOT_READY')
  })

  it('updatePortal emits distinct history event types', async () => {
    const { app, elevate } = await makeApp(url())
    const tok = elevate()
    const patched = await request(app)
      .patch('/api/admin/portals/olx')
      .set(hdrs(tok))
      .send({
        adapter_class_name: 'portals/olx-v2.js',
        country_codes: ['EG', 'LB', 'SA'],
        sla_hours: 12,
        validator_ref: 'portals/olx-v2',
      })
    expect(patched.status).toBe(200)
    const history = await request(app).get('/api/admin/portals/olx/history')
    expect(history.status).toBe(200)
    const types = history.body.events.map((e) => e.event_type)
    expect(types).toEqual(expect.arrayContaining([
      'adapter_upgraded',
      'country_coverage_changed',
      'sla_changed',
      'validator_ruleset_changed',
    ]))
  })

})
