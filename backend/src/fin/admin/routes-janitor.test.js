import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { expect, it } from 'vitest'
import { finPostgresSuite } from '../testing/suite.js'
import { makeOpsApp, writeHeaders } from './http-support.js'

finPostgresSuite('admin/routes-janitor', {}, ({ url }) => {
  it('returns janitor status and runs an elevated tick', async () => {
    const { app, elevate } = await makeOpsApp(url())
    const status = await request(app).get('/api/admin/fin/credits/janitor/status')
    expect(status.status).toBe(200)
    expect(status.body.status.worker).toBe('CREDITS_JANITOR')
    expect(typeof status.body.status.backlog_count).toBe('number')

    const run = await request(app)
      .post('/api/admin/fin/credits/janitor/run')
      .set(writeHeaders(elevate(), { idempotencyKey: `JANITOR:${randomUUID()}` }))
      .send({})
    expect(run.status).toBe(200)
    expect(typeof run.body.processed).toBe('number')

    const after = await request(app).get('/api/admin/fin/credits/janitor/status')
    expect(after.status).toBe(200)
    expect(after.body.status.last_run_at).toBeTruthy()
  })

  it('rejects unknown fields on janitor run body', async () => {
    const { app, elevate } = await makeOpsApp(url())
    const res = await request(app)
      .post('/api/admin/fin/credits/janitor/run')
      .set(writeHeaders(elevate()))
      .send({ environment: 'LIVE' })
    expect(res.status).toBe(400)
  })
})
