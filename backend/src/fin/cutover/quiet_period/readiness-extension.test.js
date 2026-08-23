/**
 * Real-Postgres — readiness quiet_period extension + log/list endpoints.
 */
import request from 'supertest'
import { expect, it } from 'vitest'
import { finPostgresSuite } from '../../testing/suite.js'
import { makeOpsApp, writeHeaders } from '../../admin/http-support.js'
import { logQuietPeriodEvent } from './logger.js'

finPostgresSuite('quiet_period/readiness-extension', {}, ({ url, pool }) => {
  it('GET /cutover/readiness returns quiet_period, R097–R099, ready_for_stage_13f', async () => {
    const { app: forbidden } = await makeOpsApp(url(), { role: 'agent' })
    expect((await request(forbidden).get('/api/admin/fin/cutover/readiness')).status).toBe(403)

    const { app } = await makeOpsApp(url())
    const res = await request(app).get('/api/admin/fin/cutover/readiness')
    expect(res.status).toBe(200)
    expect(res.body.quiet_period).toEqual(expect.objectContaining({
      activated_at: null,
      days_elapsed: null,
      days_required: 90,
      commercial_write_attempts_24h: 0,
      commercial_write_attempts_total: 0,
      last_parity_report_status: null,
      last_parity_report_at: null,
    }))
    expect(res.body.R097).toBe('GREEN')
    expect(res.body.R098).toBe('GREEN')
    expect(res.body.R099).toBe('GREEN')
    expect(res.body.ready_for_stage_13f).toBe(false)
  })

  it('POST /cutover/quiet-period/log is platform_admin + elevated; GET lists by kind', async () => {
    const { app: forbidden } = await makeOpsApp(url(), { role: 'agent' })
    expect((await request(forbidden)
      .post('/api/admin/fin/cutover/quiet-period/log')
      .send({ kind: 'OTHER', message: 'nope' })).status).toBe(403)

    const { app, elevate } = await makeOpsApp(url())
    const unelevated = await request(app)
      .post('/api/admin/fin/cutover/quiet-period/log')
      .send({ kind: 'OTHER', message: 'nope' })
    expect(unelevated.status).toBe(401)

    const created = await request(app)
      .post('/api/admin/fin/cutover/quiet-period/log')
      .set(writeHeaders(elevate()))
      .send({
        kind: 'ATTESTATION_STALE_WARNING',
        source_file: 'ops',
        message: 'attestation expires in 6 days',
        payload: { days_left: 6 },
      })
    expect(created.status).toBe(201)
    expect(created.body.ok).toBe(true)

    await logQuietPeriodEvent(null, {
      kind: 'COMMERCIAL_WRITE_ATTEMPT',
      environment: 'LIVE',
      sourceFile: 'billing/events.js',
      message: 'permission denied',
    })

    const listed = await request(app).get('/api/admin/fin/cutover/quiet-period/events')
    expect(listed.status).toBe(200)
    expect(listed.body.events.length).toBeGreaterThanOrEqual(2)
    expect(listed.body.by_kind).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'ATTESTATION_STALE_WARNING' }),
      expect.objectContaining({ kind: 'COMMERCIAL_WRITE_ATTEMPT' }),
    ]))
  })
})
