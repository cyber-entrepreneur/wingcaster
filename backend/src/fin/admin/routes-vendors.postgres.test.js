import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { afterEach, expect, it, vi } from 'vitest'
import { createVendor } from '../vendors/registry.js'
import { ingestVendorUsageEvent } from '../vendors/usage-ingest.js'
import { closeMatchingStatement, seedVendorWorld, vendorEnv } from '../vendors/test-support.js'
import { finPostgresSuite } from '../testing/suite.js'
import { makeOpsApp, writeHeaders } from './http-support.js'

finPostgresSuite('admin/routes-vendors.postgres', {}, ({ url, world, pool }) => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('auth: 401 no-auth / 403 no-admin / 401 no-elevation on writes', async () => {
    const unauth = await makeOpsApp(url(), { authenticated: false })
    const noAuth = await request(unauth.app).get('/api/admin/fin/vendors')
    expect(noAuth.status).toBe(401)

    const nonAdmin = await makeOpsApp(url(), { role: 'agent' })
    const forbidden = await request(nonAdmin.app).get('/api/admin/fin/vendors')
    expect(forbidden.status).toBe(403)

    const { app } = await makeOpsApp(url())
    const unelevated = await request(app)
      .post(`/api/admin/fin/vendors/${randomUUID()}/rates`)
      .set({ 'If-Match': '"1"', 'Idempotency-Key': `v-${randomUUID()}` })
      .send({ reason_code: 'TEST', product_code: 'x', unit_cost_minor: 1, currency: 'USD' })
    expect(unelevated.status).toBe(401)
    expect(unelevated.body.code).toBe('step_up_required')
  })

  it('GET list: seeded vendors returned, MTD aggregation correct', async () => {
    const seeded = await seedVendorWorld(world(), { name: `mtd-${randomUUID()}` })
    await ingestVendorUsageEvent(vendorEnv(world(), {
      vendorId: seeded.vendorId,
      vendorProductCode: seeded.productCode,
      quantityUnits: 10,
      occurredAt: new Date().toISOString(),
      sourceEventId: randomUUID(),
    }))
    const { app } = await makeOpsApp(url())
    const res = await request(app).get('/api/admin/fin/vendors')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.vendors)).toBe(true)
    expect(res.body).toHaveProperty('next_cursor')
    expect(res.body).toHaveProperty('total_estimate')
    const row = res.body.vendors.find((v) => v.id === seeded.vendorId)
    expect(row).toBeTruthy()
    expect(row.mtd_units).toBe(10)
    expect(row.mtd_cost_micro_usd).toBe(10 * seeded.unitCostMinor)
    expect(row.active_rate_versions).toBe(1)
  })

  it('GET list empty-state: new vendor + zero usage → mtd_cost=0', async () => {
    const created = await createVendor(vendorEnv(world(), {
      name: `empty-${randomUUID()}`,
      currency: 'USD',
    }))
    const { app } = await makeOpsApp(url())
    const res = await request(app).get('/api/admin/fin/vendors')
    expect(res.status).toBe(200)
    const row = res.body.vendors.find((v) => v.id === created.id)
    expect(row).toBeTruthy()
    expect(row.mtd_cost_micro_usd).toBe(0)
    expect(row.mtd_units).toBe(0)
    expect(row.active_rate_versions).toBe(0)
  })

  it('GET list pagination: cursor round-trip works, limit=200 caps', async () => {
    await createVendor(vendorEnv(world(), { name: `pag-a-${randomUUID()}`, currency: 'USD' }))
    await createVendor(vendorEnv(world(), { name: `pag-b-${randomUUID()}`, currency: 'USD' }))
    await createVendor(vendorEnv(world(), { name: `pag-c-${randomUUID()}`, currency: 'USD' }))
    const { app } = await makeOpsApp(url())
    const first = await request(app).get('/api/admin/fin/vendors').query({ limit: 1 })
    expect(first.status).toBe(200)
    expect(first.body.vendors).toHaveLength(1)
    expect(first.body.next_cursor).toBeTruthy()
    const second = await request(app).get('/api/admin/fin/vendors').query({
      limit: 1,
      cursor: first.body.next_cursor,
    })
    expect(second.status).toBe(200)
    expect(second.body.vendors).toHaveLength(1)
    expect(second.body.vendors[0].id).not.toBe(first.body.vendors[0].id)

    const capped = await request(app).get('/api/admin/fin/vendors').query({ limit: 500 })
    expect(capped.status).toBe(200)
    expect(capped.body.vendors.length).toBeLessThanOrEqual(200)
  })

  it('POST rate: transaction wrapper — failing activateRateVersion rolls back upsert', async () => {
    const seeded = await seedVendorWorld(world(), { name: `tx-${randomUUID()}` })
    const productCode = `orphan.${randomUUID()}`
    const { app, elevate } = await makeOpsApp(url())
    const registry = await import('../vendors/registry.js')
    vi.spyOn(registry, 'activateRateVersion').mockRejectedValueOnce(
      new Error('injected activateRateVersion failure'),
    )
    const res = await request(app)
      .post(`/api/admin/fin/vendors/${seeded.vendorId}/rates`)
      .set(writeHeaders(elevate(), { idempotencyKey: `tx-${randomUUID()}` }))
      .send({
        reason_code: 'TEST',
        product_code: productCode,
        unit_cost_minor: 99,
        currency: 'USD',
        effective_from: '2026-11-01T00:00:00.000Z',
      })
    expect(res.status).toBeGreaterThanOrEqual(400)
    const products = await pool().query(
      `SELECT id FROM fin.vendor_products WHERE vendor_id = $1 AND product_code = $2`,
      [seeded.vendorId, productCode],
    )
    expect(products.rowCount).toBe(0)
  })

  it('POST rate above threshold: creates approval_requests with impact_summary', async () => {
    const seeded = await seedVendorWorld(world(), { name: `hi-${randomUUID()}` })
    const { app, elevate } = await makeOpsApp(url())
    const res = await request(app)
      .post(`/api/admin/fin/vendors/${seeded.vendorId}/rates`)
      .set(writeHeaders(elevate(), { idempotencyKey: `hi-${randomUUID()}` }))
      .send({
        reason_code: 'TEST',
        product_code: seeded.productCode,
        unit_cost_minor: 30,
        currency: 'USD',
        effective_from: '2026-11-01T00:00:00.000Z',
      })
    expect(res.status).toBe(202)
    expect(res.body.status).toBe('PENDING_APPROVAL')
    expect(res.body.impact_summary).toMatchObject({
      vendor_name: expect.any(String),
      rate_key: seeded.productCode,
    })
    expect(res.body.impact_summary.delta_pct).toBeGreaterThan(20)
    const approval = await pool().query(
      `SELECT payload, action_kind FROM fin.approval_requests WHERE id = $1`,
      [res.body.approval_request_id],
    )
    expect(approval.rowCount).toBe(1)
    expect(approval.rows[0].action_kind).toBe('VENDOR_RATE_CHANGE')
    expect(approval.rows[0].payload.workflow).toBe('WF-20')
    expect(approval.rows[0].payload.impact_summary.rate_key).toBe(seeded.productCode)
    expect(approval.rows[0].payload.impact_summary.change.to.unit_cost_minor).toBe(30)
    const stillActive = await pool().query(
      `SELECT status FROM fin.vendor_rate_versions WHERE id = $1`,
      [seeded.rateVersionId],
    )
    expect(stillActive.rows[0].status).toBe('ACTIVE')
  })

  it('POST rate below threshold: applies directly', async () => {
    const seeded = await seedVendorWorld(world(), { name: `lo-${randomUUID()}` })
    const { app, elevate } = await makeOpsApp(url())
    const res = await request(app)
      .post(`/api/admin/fin/vendors/${seeded.vendorId}/rates`)
      .set(writeHeaders(elevate(), { idempotencyKey: `lo-${randomUUID()}` }))
      .send({
        reason_code: 'TEST',
        product_code: seeded.productCode,
        unit_cost_minor: 18,
        currency: 'USD',
        effective_from: '2026-11-01T00:00:00.000Z',
      })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ACTIVE')
    const versions = await pool().query(
      `SELECT status, rates FROM fin.vendor_rate_versions
        WHERE rate_card_id = $1 ORDER BY version_n`,
      [seeded.rateCardId],
    )
    expect(versions.rows.some((row) => row.status === 'ACTIVE')).toBe(true)
    const active = versions.rows.find((row) => row.status === 'ACTIVE')
    expect(Number(active.rates[seeded.productCode].unit_cost_minor)).toBe(18)
  })

  it('Reconcile: acquires lock 1021, writes audit, releases lock', async () => {
    const seeded = await seedVendorWorld(world(), { name: `rec-${randomUUID()}` })
    const closed = await closeMatchingStatement(world(), seeded, {
      quantityUnits: 4,
      finalize: false,
    })
    const { app, elevate } = await makeOpsApp(url())
    const helpers = await import('../vendors/helpers.js')
    const lockSpy = vi.spyOn(helpers, 'lockVendorStatementRecon')
    const res = await request(app)
      .post(`/api/admin/fin/vendors/${seeded.vendorId}/statements/2026-08/reconcile`)
      .set(writeHeaders(elevate(), { idempotencyKey: `rec-${randomUUID()}` }))
      .send({ reason_code: 'TEST', evidence: { signed: true, note: 'ok' } })
    expect(res.status).toBe(200)
    expect(lockSpy).toHaveBeenCalled()
    expect(lockSpy.mock.calls[0][1]).toBe(closed.statementId)
    const audit = await pool().query(
      `SELECT action FROM fin.financial_audit_events
        WHERE target_id = $1 AND action IN (
          'VENDOR_STATEMENT_RECONCILED', 'VENDOR_STATEMENT_RECONCILE_EVIDENCE'
        )`,
      [closed.statementId],
    )
    expect(audit.rows.map((r) => r.action)).toEqual(expect.arrayContaining([
      'VENDOR_STATEMENT_RECONCILED',
      'VENDOR_STATEMENT_RECONCILE_EVIDENCE',
    ]))
    const again = await request(app)
      .post(`/api/admin/fin/vendors/${seeded.vendorId}/statements/2026-08/reconcile`)
      .set(writeHeaders(elevate(), { idempotencyKey: `rec2-${randomUUID()}` }))
      .send({ reason_code: 'TEST', evidence: { signed: true } })
    expect(again.status).toBe(200)
  })

  it('Env scoping: LIVE writes do not appear in TEST reads', async () => {
    const live = await createVendor(vendorEnv(world(), {
      name: `live-${randomUUID()}`,
      currency: 'USD',
      environment: 'LIVE',
    }))
    const { app: testApp } = await makeOpsApp(url(), { finEnvironment: 'TEST' })
    const res = await request(testApp).get('/api/admin/fin/vendors')
    expect(res.status).toBe(200)
    expect(res.body.vendors.find((v) => v.id === live.id)).toBeUndefined()
  })

  it('GET rates / statements / margin / statement detail are registered', async () => {
    const seeded = await seedVendorWorld(world(), { name: `read-${randomUUID()}` })
    await closeMatchingStatement(world(), seeded, { quantityUnits: 2, finalize: false })
    const { app } = await makeOpsApp(url())
    const rates = await request(app).get(`/api/admin/fin/vendors/${seeded.vendorId}/rates`)
    expect(rates.status).toBe(200)
    expect(Array.isArray(rates.body.rates)).toBe(true)
    expect(rates.body.rates.length).toBeGreaterThan(0)

    const statements = await request(app).get(`/api/admin/fin/vendors/${seeded.vendorId}/statements`)
    expect(statements.status).toBe(200)
    expect(Array.isArray(statements.body.statements)).toBe(true)

    const detail = await request(app).get(
      `/api/admin/fin/vendors/${seeded.vendorId}/statements/2026-08`,
    )
    expect(detail.status).toBe(200)
    expect(Array.isArray(detail.body.line_items)).toBe(true)
    expect(Array.isArray(detail.body.drift_indicators)).toBe(true)

    const margin = await request(app).get(`/api/admin/fin/vendors/${seeded.vendorId}/margin`)
    expect(margin.status).toBe(200)
    expect(margin.body.features).toEqual(expect.any(Array))
    expect(margin.body.features[0]).toMatchObject({ feature: seeded.productCode })

    const one = await request(app).get(`/api/admin/fin/vendors/${seeded.vendorId}`)
    expect(one.status).toBe(200)
    expect(one.body.id).toBe(seeded.vendorId)
    expect(Array.isArray(one.body.rate_schedule)).toBe(true)
  })
})
