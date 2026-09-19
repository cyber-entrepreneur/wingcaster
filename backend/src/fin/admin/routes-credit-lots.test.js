import request from 'supertest'
import { randomUUID } from 'node:crypto'
import { expect, it } from 'vitest'
import { finPostgresSuite } from '../testing/suite.js'
import { commandEnv, seedPurchaseIntent } from '../testing/seed.js'
import { fundPurchase } from '../ledger/transactions.js'
import { makeOpsApp, writeHeaders } from './http-support.js'

finPostgresSuite('admin/routes-credit-lots', {}, ({ url, pool, world }) => {
  it('lists lots with status filter and returns lot detail', async () => {
    const w = world()
    const env = commandEnv(w)
    const intent = await seedPurchaseIntent(pool(), {
      environment: 'LIVE',
      tenantId: w.tenantA.tenantId,
      billingAccountId: w.tenantA.billingAccountId,
      holderId: w.tenantA.holderId,
      quotedUnits: 120,
      quotedMinor: 12,
    })
    const funded = await fundPurchase({
      ...env,
      purchaseIntentId: intent,
      paidUnits: 120,
      bonusUnits: 0,
      considerationMinor: 12,
    })
    const lotId = funded.lotIds[0]

    const { app } = await makeOpsApp(url())
    const list = await request(app)
      .get('/api/admin/fin/credits/lots')
      .query({ status: 'ACTIVE', tenant_id: w.tenantA.tenantId })
    expect(list.status).toBe(200)
    expect(list.body.lots.some((row) => row.id === lotId)).toBe(true)

    const detail = await request(app).get(`/api/admin/fin/credits/lots/${lotId}`)
    expect(detail.status).toBe(200)
    expect(detail.body.status).toBe('ACTIVE')
    expect(detail.body.granted_units).toBe('120')
  })

  it('retires an active lot via expireLot command', async () => {
    const w = world()
    const env = commandEnv(w)
    const intent = await seedPurchaseIntent(pool(), {
      environment: 'LIVE',
      tenantId: w.tenantA.tenantId,
      billingAccountId: w.tenantA.billingAccountId,
      holderId: w.tenantA.holderId,
      quotedUnits: 50,
      quotedMinor: 5,
    })
    const funded = await fundPurchase({
      ...env,
      purchaseIntentId: intent,
      paidUnits: 50,
      bonusUnits: 0,
      considerationMinor: 5,
    })
    const lotId = funded.lotIds[0]
    const { app, elevate } = await makeOpsApp(url())
    const retired = await request(app)
      .post(`/api/admin/fin/credits/lots/${lotId}/retire`)
      .set(writeHeaders(elevate(), { idempotencyKey: `retire-${randomUUID()}` }))
      .send({ reason_code: 'LOT_RETIRE' })
    expect(retired.status).toBe(200)
    expect(retired.body.lotId).toBe(lotId)

    const after = await request(app).get(`/api/admin/fin/credits/lots/${lotId}`)
    expect(after.status).toBe(200)
    expect(after.body.status).toBe('EXPIRED')
    expect(after.body.remaining_units).toBe('0')
  })

  it('returns 404 for unknown lot detail', async () => {
    const { app } = await makeOpsApp(url())
    const res = await request(app).get(`/api/admin/fin/credits/lots/${randomUUID()}`)
    expect(res.status).toBe(404)
    expect(res.body.code).toBe('NOT_FOUND')
  })

  it('rejects retire body with unknown fields', async () => {
    const { app, elevate } = await makeOpsApp(url())
    const res = await request(app)
      .post(`/api/admin/fin/credits/lots/${randomUUID()}/retire`)
      .set(writeHeaders(elevate()))
      .send({ reason_code: 'LOT_RETIRE', environment: 'LIVE' })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION')
  })
})
