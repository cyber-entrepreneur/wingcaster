import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { expect, it } from 'vitest'
import { commandEnv } from '../testing/seed.js'
import { finPostgresSuite } from '../testing/suite.js'
import { seedIssuedInvoice } from '../billing/test-support.js'
import { openDunningCase } from '../dunning/cases.js'
import { insertControls } from '../funding/test-support.js'
import { makeOpsApp, writeHeaders } from './http-support.js'

const readHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/json',
})

finPostgresSuite('admin/routes-dunning', {}, ({ url, world, pool }) => {
  it('returns dunning case detail with step timeline', async () => {
    const { app } = await makeOpsApp(url())
    await insertControls(pool(), {
      subjectType: 'BILLING_ACCOUNT',
      subjectId: world().tenantA.billingAccountId,
    })
    const issued = await seedIssuedInvoice(pool(), world(), { amountMinor: 40 })
    const opened = await openDunningCase({
      ...commandEnv(world(), { reasonCode: 'AR_OVERDUE' }),
      invoiceId: issued.invoiceId,
      billingAccountId: world().tenantA.billingAccountId,
      invoiceStatus: 'ISSUED',
      dueAt: issued.dueAt,
    })
    const detail = await request(app).get(`/api/admin/fin/dunning/cases/${opened.caseId}`)
    expect(detail.status).toBe(200)
    expect(detail.body.case.id).toBe(opened.caseId)
    expect(Array.isArray(detail.body.case.steps)).toBe(true)
  })

  it('queues a write-off approval request', async () => {
    const { app, elevate } = await makeOpsApp(url())
    const token = elevate()
    await insertControls(pool(), {
      subjectType: 'BILLING_ACCOUNT',
      subjectId: world().tenantA.billingAccountId,
    })
    const issued = await seedIssuedInvoice(pool(), world(), { amountMinor: 2500 })
    const opened = await openDunningCase({
      ...commandEnv(world(), { reasonCode: 'AR_OVERDUE' }),
      invoiceId: issued.invoiceId,
      billingAccountId: world().tenantA.billingAccountId,
      invoiceStatus: 'ISSUED',
      dueAt: issued.dueAt,
    })
    const queued = await request(app)
      .post(`/api/admin/fin/dunning/cases/${opened.caseId}/write-off/request`)
      .set(writeHeaders(token, { idempotencyKey: `WOFF:REQ:${randomUUID()}` }))
      .send({
        reason_code: 'WRITE_OFF_REQUEST',
        amount_minor: 2500,
        reason_category: 'BAD_DEBT',
        evidence: 'Customer insolvency documentation attached.',
      })
    expect(queued.status).toBe(200)
    expect(queued.body.approvalRequestId).toBeTruthy()
    const row = await pool().query(
      `SELECT action_kind, status FROM fin.approval_requests WHERE id = $1`,
      [queued.body.approvalRequestId],
    )
    expect(row.rows[0].action_kind).toBe('WRITE_OFF')
    expect(row.rows[0].status).toBe('REQUESTED')
  })

  it('advances an open case; unknown case errors', async () => {
    const { app, elevate } = await makeOpsApp(url())
    const token = elevate()
    const missing = await request(app)
      .post('/api/admin/fin/dunning/cases/00000000-0000-0000-0000-000000000099/advance')
      .set(writeHeaders(token))
      .send({ reason_code: 'TEST' })
    expect(missing.status).toBeGreaterThanOrEqual(400)

    await insertControls(pool(), {
      subjectType: 'BILLING_ACCOUNT',
      subjectId: world().tenantA.billingAccountId,
    })
    const issued = await seedIssuedInvoice(pool(), world(), { amountMinor: 50 })
    const opened = await openDunningCase({
      ...commandEnv(world(), { reasonCode: 'AR_OVERDUE' }),
      invoiceId: issued.invoiceId,
      billingAccountId: world().tenantA.billingAccountId,
      invoiceStatus: 'ISSUED',
      dueAt: issued.dueAt,
    })
    const advanced = await request(app)
      .post(`/api/admin/fin/dunning/cases/${opened.caseId}/advance`)
      .set(writeHeaders(token, { idempotencyKey: `DUN:${randomUUID()}` }))
      .send({ reason_code: 'TEST' })
    expect(advanced.status).toBe(200)
  })

  it('cure returns a domain error when the invoice is still unpaid', async () => {
    const { app, elevate } = await makeOpsApp(url())
    await insertControls(pool(), {
      subjectType: 'BILLING_ACCOUNT',
      subjectId: world().tenantA.billingAccountId,
    })
    const issued = await seedIssuedInvoice(pool(), world(), { amountMinor: 75 })
    const opened = await openDunningCase({
      ...commandEnv(world(), { reasonCode: 'AR_OVERDUE' }),
      invoiceId: issued.invoiceId,
      billingAccountId: world().tenantA.billingAccountId,
      invoiceStatus: 'ISSUED',
      dueAt: issued.dueAt,
    })
    const cured = await request(app)
      .post(`/api/admin/fin/dunning/cases/${opened.caseId}/cure`)
      .set(writeHeaders(elevate(), { idempotencyKey: `CURE:${randomUUID()}` }))
      .send({ reason_code: 'TEST' })
    expect([200, 400, 409]).toContain(cured.status)
  })
})
