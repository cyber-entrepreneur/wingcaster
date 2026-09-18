import request from 'supertest'
import { expect, it } from 'vitest'
import { finPostgresSuite } from '../testing/suite.js'
import { encodeExceptionId } from './exception-items.js'
import { makeOpsApp, writeHeaders } from './http-support.js'

finPostgresSuite('admin/routes-exceptions', {}, ({ url }) => {
  it('lists exception items and returns 404 for unknown detail id', async () => {
    const { app } = await makeOpsApp(url())
    const items = await request(app).get('/api/admin/fin/exceptions/items')
    expect(items.status).toBe(200)
    expect(Array.isArray(items.body.items)).toBe(true)

    const missing = await request(app).get('/api/admin/fin/exceptions/not-a-valid-id')
    expect(missing.status).toBe(404)
    expect(missing.body.code).toBe('NOT_FOUND')
  })

  it('records notes and wont-fix justifications for a valid exception id shape', async () => {
    const { app, elevate } = await makeOpsApp(url())
    const items = await request(app).get('/api/admin/fin/exceptions/items?limit=1')
    expect(items.status).toBe(200)
    const first = items.body.items[0]
    if (!first) return

    const token = elevate()
    const note = await request(app)
      .post(`/api/admin/fin/exceptions/${encodeURIComponent(first.id)}/notes`)
      .set(writeHeaders(token))
      .send({ body: 'Operator note from test' })
    expect(note.status).toBe(201)
    expect(note.body.note.body).toBe('Operator note from test')

    const detail = await request(app).get(`/api/admin/fin/exceptions/${encodeURIComponent(first.id)}`)
    expect(detail.status).toBe(200)
    expect(detail.body.id).toBe(first.id)
    expect(Array.isArray(detail.body.notes)).toBe(true)

    const wontFix = await request(app)
      .post(`/api/admin/fin/exceptions/${encodeURIComponent(first.id)}/wont-fix`)
      .set(writeHeaders(token))
      .send({ justification: 'Acceptable variance for test fixture' })
    expect(wontFix.status).toBe(200)
    expect(wontFix.body.recorded).toBe(true)
  })

  it('rejects invalid note payloads with 400', async () => {
    const { app, elevate } = await makeOpsApp(url())
    const fakeId = encodeExceptionId('USAGE_DLQ', '00000000-0000-0000-0000-000000000001')
    const res = await request(app)
      .post(`/api/admin/fin/exceptions/${encodeURIComponent(fakeId)}/notes`)
      .set(writeHeaders(elevate()))
      .send({ body: '' })
    expect(res.status).toBe(400)
  })

  it('resolve returns 501 for deferred exception types', async () => {
    const { app, elevate } = await makeOpsApp(url())
    const fakeId = encodeExceptionId('USAGE_DLQ', '00000000-0000-0000-0000-000000000001')
    const res = await request(app)
      .post(`/api/admin/fin/exceptions/${encodeURIComponent(fakeId)}/resolve`)
      .set(writeHeaders(elevate()))
      .send({ reason_code: 'TEST' })
    expect(res.status).toBe(501)
    expect(res.body.dl).toBe('DL-165')
  })
})
