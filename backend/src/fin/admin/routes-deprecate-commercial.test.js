/**
 * Real-Postgres — deprecate-commercial endpoint guards.
 */
import request from 'supertest'
import { expect, it } from 'vitest'
import { skipIfNoPostgres } from '../../testing/postgres.js'
import { makeOpsApp, writeHeaders } from './http-support.js'
import { withDeprecationTestDb } from '../cutover/deprecation/test-support.js'

skipIfNoPostgres()('admin/routes-deprecate-commercial', () => {
  it('POST /api/admin/fin/cutover/deprecate-commercial requires platform_admin + elevated + Idempotency-Key', async () => {
    await withDeprecationTestDb(async (_pool, databaseUrl) => {
      const { app: forbidden } = await makeOpsApp(databaseUrl, { role: 'agent' })
      const denied = await request(forbidden)
        .post('/api/admin/fin/cutover/deprecate-commercial')
        .send({ snapshot_note: 'snap-id@2026-08-17, verified restore by ops' })
      expect(denied.status).toBe(403)

      const { app, elevate } = await makeOpsApp(databaseUrl)
      const noKey = await request(app)
        .post('/api/admin/fin/cutover/deprecate-commercial')
        .set({
          'X-Elevated-Token': elevate(),
          'If-Match': '"1"',
        })
        .send({ snapshot_note: 'snap-id@2026-08-17, verified restore by ops' })
      expect(noKey.status).toBe(400)

      const noElevate = await request(app)
        .post('/api/admin/fin/cutover/deprecate-commercial')
        .set({ 'Idempotency-Key': 'deprecate-route-guard', 'If-Match': '"1"' })
        .send({ snapshot_note: 'snap-id@2026-08-17, verified restore by ops' })
      expect(noElevate.status).toBe(401)

      const shortNote = await request(app)
        .post('/api/admin/fin/cutover/deprecate-commercial')
        .set(writeHeaders(elevate()))
        .send({ snapshot_note: 'too short' })
      expect(shortNote.status).toBe(400)
      expect(shortNote.body.code).toBe('SNAPSHOT_NOTE_REQUIRED')
    })
  })

  it('GET /api/admin/fin/cutover/deprecation-readiness is platform_admin gated', async () => {
    await withDeprecationTestDb(async (_pool, databaseUrl) => {
      const { app: forbidden } = await makeOpsApp(databaseUrl, { role: 'agent' })
      const denied = await request(forbidden).get('/api/admin/fin/cutover/deprecation-readiness')
      expect(denied.status).toBe(403)

      const { app } = await makeOpsApp(databaseUrl)
      const res = await request(app).get('/api/admin/fin/cutover/deprecation-readiness')
      expect(res.status).toBe(200)
      expect(res.body).toEqual(expect.objectContaining({
        ready_for_drop: expect.any(Boolean),
        gates: expect.objectContaining({
          mode_fin_only: expect.any(Boolean),
          quiet_period_90d: expect.any(Boolean),
          r097_clean_90d: expect.any(Boolean),
          r099_fresh: expect.any(Boolean),
          commercial_tables_remaining: expect.any(Number),
          fks_outside_commercial: expect.any(Number),
        }),
      }))
    })
  })
})
