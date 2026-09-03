import { randomUUID } from 'node:crypto'
import express from 'express'
import request from 'supertest'
import { expect, it } from 'vitest'
import { finPostgresSuite } from '../../fin/testing/suite.js'

process.env.JWT_SECRET = 'credit-admin-routes-test-secret'
process.env.VITEST = '1'

const { createAgentAccount, updatePlatformRole } = await import('../../identity.js')
const { signToken, signElevatedToken } = await import('../../auth.js')
const { registerCreditAdminRoutes } = await import('./admin-routes.js')

async function platformAdminSession() {
  const userId = randomUUID()
  const now = new Date().toISOString()
  await createAgentAccount({
    user: {
      id: userId,
      email: `pa-${userId}@x.test`,
      name: 'Platform Admin',
      password_hash: 'x',
      role: 'agent',
      verified: true,
      verified_at: now,
    },
    agent: { id: userId, email: `pa-${userId}@x.test`, name: 'Platform Admin' },
  })
  await updatePlatformRole(userId, 'platform_admin')
  const token = signToken({
    id: userId,
    email: `pa-${userId}@x.test`,
    name: 'Platform Admin',
    token_version: 1,
    verified_at: now,
  })
  const elevated = signElevatedToken({ userId, tokenVersion: 1 })
  return { userId, token, elevated }
}

function buildApp() {
  const app = express()
  app.use(express.json())
  registerCreditAdminRoutes(app)
  return app
}

finPostgresSuite('credit admin routes', {}, () => {
  it('POST /api/admin/credits/grants requires step-up re-auth', async () => {
    const { token, elevated } = await platformAdminSession()
    const targetId = randomUUID()
    const app = buildApp()
    const body = {
      scope: 'agent',
      scope_id: targetId,
      amount: 5,
      source: 'promo',
      reason: 'test grant',
    }

    const denied = await request(app)
      .post('/api/admin/credits/grants')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
    expect(denied.status).toBe(401)
    expect(denied.body.code).toBe('step_up_required')

    const ok = await request(app)
      .post('/api/admin/credits/grants')
      .set('Authorization', `Bearer ${token}`)
      .set('x-elevated-token', elevated)
      .send(body)
    expect(ok.status).toBe(201)
    expect(ok.body.success).toBe(true)
  })
})
