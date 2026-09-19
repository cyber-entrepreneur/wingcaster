import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { expect, it } from 'vitest'
import { finPostgresSuite } from '../testing/suite.js'
import { makeOpsApp, writeHeaders } from './http-support.js'

async function ensureWorkerStatusTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.credit_worker_status (
      worker_name TEXT PRIMARY KEY CHECK (worker_name IN ('CREDITS_JANITOR', 'CREDITS_FIN_MIRROR')),
      last_run_at TIMESTAMPTZ,
      last_processed_count INTEGER NOT NULL DEFAULT 0,
      last_skip_reason TEXT,
      last_skipped_rows INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

finPostgresSuite('admin/routes-fin-mirror', {}, ({ url, pool }) => {
  it('returns fin mirror status and runs an elevated tick', async () => {
    await ensureWorkerStatusTable(pool())
    const { app, elevate } = await makeOpsApp(url())
    const status = await request(app).get('/api/admin/fin/credits/fin-mirror/status')
    expect(status.status).toBe(200)
    expect(status.body.status.worker).toBe('CREDITS_FIN_MIRROR')
    expect(typeof status.body.status.backlog_count).toBe('number')

    const run = await request(app)
      .post('/api/admin/fin/credits/fin-mirror/run')
      .set(writeHeaders(elevate(), { idempotencyKey: `MIRROR:${randomUUID()}` }))
      .send({})
    expect(run.status).toBe(200)
    expect(typeof run.body.processed).toBe('number')

    const after = await request(app).get('/api/admin/fin/credits/fin-mirror/status')
    expect(after.status).toBe(200)
    expect(after.body.status.last_run_at).toBeTruthy()
  })

  it('rejects unknown fields on fin mirror run body', async () => {
    const { app, elevate } = await makeOpsApp(url())
    const res = await request(app)
      .post('/api/admin/fin/credits/fin-mirror/run')
      .set(writeHeaders(elevate()))
      .send({ environment: 'LIVE' })
    expect(res.status).toBe(400)
  })
})
