import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { expect, it } from 'vitest'
import { finPostgresSuite } from '../../testing/suite.js'
import { createVendor } from '../../vendors/registry.js'
import { vendorEnv } from '../../vendors/test-support.js'
import { makeOpsApp, writeHeaders } from '../http-support.js'

finPostgresSuite('admin/vendors-routes', {}, ({ world, url }) => {
  it('rejects vendor rate body without product_code', async () => {
    const { app, elevate } = await makeOpsApp(url())
    const vendor = await createVendor(vendorEnv(world(), { name: `vendor-${randomUUID().slice(0, 8)}`, currency: 'USD' }))
    const res = await request(app)
      .post(`/api/admin/fin/vendors/${vendor.id}/rates`)
      .set(writeHeaders(elevate()))
      .send({ unit_cost_minor: 100, currency: 'USD' })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION')
  })

  it('applies a vendor rate for a new product code', async () => {
    const { app, elevate } = await makeOpsApp(url())
    const vendor = await createVendor(vendorEnv(world(), { name: `vendor-${randomUUID().slice(0, 8)}`, currency: 'USD' }))
    const res = await request(app)
      .post(`/api/admin/fin/vendors/${vendor.id}/rates`)
      .set(writeHeaders(elevate(), { idempotencyKey: `VENDOR-RATE:${randomUUID()}` }))
      .send({
        product_code: 'test.input_tokens',
        unit_cost_minor: 120,
        currency: 'USD',
        reason_code: 'TEST',
      })
    expect([200, 202]).toContain(res.status)
    expect(res.body.status === 'PENDING_APPROVAL' || res.body.command || res.body.rate_version_id).toBeTruthy()
  })
})
