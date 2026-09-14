/**
 * Fast gates for SHR-SET-004 session routes (no Postgres).
 *
 * Elevation is the contract the Settings UI keys off: un-elevated
 * all-except-current / sign-out-everywhere must be 401 step_up_required.
 * Per-session revoke of the *current* row is 403 CANNOT_REVOKE_CURRENT
 * without a DB round-trip.
 */
import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ELEVATION_HEADER, requireElevated } from '../../auth.js'
import { registerSessionRoutes } from './session-routes.js'

const originalSecret = process.env.JWT_SECRET

function createApp({ user = { id: 'user-1', token_version: 0, session_id: 'sess-current' } } = {}) {
  const app = express()
  app.use(express.json())
  const auth = (req, _res, next) => {
    req.user = { ...user }
    next()
  }
  registerSessionRoutes(app, { auth })
  return app
}

beforeEach(() => {
  process.env.JWT_SECRET = 'session-routes-test-secret'
})

afterEach(() => {
  if (originalSecret === undefined) delete process.env.JWT_SECRET
  else process.env.JWT_SECRET = originalSecret
})

describe('session routes — elevation + current-session guard', () => {
  it('DELETE /api/auth/sessions/all-except-current refuses without an elevation token', async () => {
    const res = await request(createApp()).delete('/api/auth/sessions/all-except-current')
    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ code: 'step_up_required' })
  })

  it('POST /api/auth/sign-out-everywhere refuses without an elevation token', async () => {
    const res = await request(createApp()).post('/api/auth/sign-out-everywhere')
    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ code: 'step_up_required' })
  })

  it('DELETE /api/auth/sessions/:sessionId cannot revoke the current session', async () => {
    const res = await request(createApp()).delete('/api/auth/sessions/sess-current')
    expect(res.status).toBe(403)
    expect(res.body).toMatchObject({ code: 'CANNOT_REVOKE_CURRENT' })
  })

  it('wires requireElevated on the bulk routes', async () => {
    const fs = await import('node:fs/promises')
    const src = await fs.readFile(new URL('./session-routes.js', import.meta.url), 'utf8')
    expect(src).toMatch(/all-except-current[\s\S]{0,200}requireElevated\(\)/)
    expect(src).toMatch(/sign-out-everywhere[\s\S]{0,200}requireElevated\(\)/)
    expect(requireElevated).toEqual(expect.any(Function))
    expect(ELEVATION_HEADER).toBe('x-elevated-token')
  })
})
