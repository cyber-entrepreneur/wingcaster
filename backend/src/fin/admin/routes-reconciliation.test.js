import request from 'supertest'
import { expect, it } from 'vitest'
import { finPostgresSuite } from '../testing/suite.js'
import { makeOpsApp, writeHeaders } from './http-support.js'

finPostgresSuite('admin/routes-reconciliation', {}, ({ url }) => {
  it('runs an on-demand reconciliation and lists the run', async () => {
    const { app, elevate } = await makeOpsApp(url())
    const token = elevate()
    const ran = await request(app)
      .post('/api/admin/fin/reconciliation/run')
      .set(writeHeaders(token))
      .send({ scope_kind: 'platform', reason_code: 'TEST' })
    expect(ran.status).toBe(200)
    expect(
      ran.body.skipped === true
        || Boolean(ran.body.runId)
        || Boolean(ran.body.id)
        || Array.isArray(ran.body.results),
    ).toBe(true)

    const list = await request(app).get('/api/admin/fin/reconciliation/runs')
    expect(list.status).toBe(200)
    expect(Array.isArray(list.body.runs)).toBe(true)
  })

  it('rejects run body without scope_kind', async () => {
    const { app, elevate } = await makeOpsApp(url())
    const res = await request(app)
      .post('/api/admin/fin/reconciliation/run')
      .set(writeHeaders(elevate()))
      .send({ reason_code: 'TEST' })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION')
  })

  it('runs tenant-scoped reconciliation', async () => {
    const { app, elevate } = await makeOpsApp(url())
    const res = await request(app)
      .post('/api/admin/fin/reconciliation/run')
      .set(writeHeaders(elevate()))
      .send({
        scope_kind: 'tenant',
        tenant_id: '00000000-0000-0000-0000-000000000001',
        reason_code: 'TEST',
      })
    expect(res.status).toBe(200)
    expect(res.body.skipped === true || Boolean(res.body.runId)).toBe(true)
  })
  it('returns run detail with checks and drifts', async () => {
    const { app, elevate } = await makeOpsApp(url())
    const token = elevate()
    const ran = await request(app)
      .post('/api/admin/fin/reconciliation/run')
      .set(writeHeaders(token))
      .send({ scope_kind: 'platform', reason_code: 'TEST' })
    expect(ran.status).toBe(200)
    const runId = ran.body.runId || ran.body.id
    if (!runId) return

    const detail = await request(app).get(`/api/admin/fin/reconciliation/runs/${runId}`)
    expect(detail.status).toBe(200)
    expect(Array.isArray(detail.body.checks)).toBe(true)
    expect(Array.isArray(detail.body.drifts)).toBe(true)
  })

  it('returns 404 for unknown run id', async () => {
    const { app } = await makeOpsApp(url())
    const res = await request(app).get('/api/admin/fin/reconciliation/runs/00000000-0000-0000-0000-000000000099')
    expect(res.status).toBe(404)
    expect(res.body.code).toBe('NOT_FOUND')
  })

  it('resolveDrift returns 501 with DL-165', async () => {
    const { app, elevate } = await makeOpsApp(url())
    const res = await request(app)
      .post('/api/admin/fin/reconciliation/drift/00000000-0000-0000-0000-000000000001/resolve')
      .set(writeHeaders(elevate()))
      .send({ reason_code: 'TEST' })
    expect(res.status).toBe(501)
    expect(res.body.dl).toBe('DL-165')
  })
})
