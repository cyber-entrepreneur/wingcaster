import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getApprovalAuditTrail: vi.fn(),
}))

vi.mock('./reads.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getApprovalAuditTrail: mocks.getApprovalAuditTrail,
}))

import { registerFinOpsAdminRoutes } from './routes.js'

const APPROVAL_ID = '00000000-0000-0000-0000-000000000123'

function makeApp({ role = 'platform_admin', environment = 'LIVE' } = {}) {
  const app = express()
  app.use(express.json())
  const authMiddleware = (req, _res, next) => {
    req.user = {
      id: '00000000-0000-0000-0000-000000000321',
      platform_role: role,
      fin_environment: environment,
      email: 'admin@example.test',
    }
    next()
  }
  registerFinOpsAdminRoutes(app, {
    authMiddleware,
    requirePlatformAdmin: (req, res, next) => {
      if (req.user?.platform_role !== 'platform_admin') {
        return res.status(403).json({ code: 'PLATFORM_ADMIN_REQUIRED' })
      }
      next()
    },
  })
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getApprovalAuditTrail.mockResolvedValue({
    request: {
      id: APPROVAL_ID,
      action_kind: 'PACKAGE_PUBLISH',
      status: 'REQUESTED',
      payload_hash: 'abc123',
      payload: {},
    },
    events: [],
  })
})

describe('PA-APR-004 approval audit route', () => {
  it('returns the environment-scoped approval audit trail', async () => {
    const res = await request(makeApp()).get(
      `/api/admin/fin/approvals/${APPROVAL_ID}/audit-trail`,
    )

    expect(res.status).toBe(200)
    expect(res.body.request.id).toBe(APPROVAL_ID)
    expect(mocks.getApprovalAuditTrail).toHaveBeenCalledWith({
      environment: 'LIVE',
      id: APPROVAL_ID,
    })
  })

  it('strictly validates the approval id', async () => {
    const res = await request(makeApp()).get(
      '/api/admin/fin/approvals/not-a-uuid/audit-trail',
    )

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INVALID_APPROVAL_ID')
    expect(mocks.getApprovalAuditTrail).not.toHaveBeenCalled()
  })

  it('returns a leak-safe 404 when the scoped approval is absent', async () => {
    mocks.getApprovalAuditTrail.mockResolvedValueOnce(null)

    const res = await request(makeApp({ environment: 'TEST' })).get(
      `/api/admin/fin/approvals/${APPROVAL_ID}/audit-trail`,
    )

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ code: 'NOT_FOUND' })
    expect(mocks.getApprovalAuditTrail).toHaveBeenCalledWith({
      environment: 'TEST',
      id: APPROVAL_ID,
    })
  })

  it('requires platform-admin authorization', async () => {
    const res = await request(makeApp({ role: 'agent' })).get(
      `/api/admin/fin/approvals/${APPROVAL_ID}/audit-trail`,
    )

    expect(res.status).toBe(403)
    expect(mocks.getApprovalAuditTrail).not.toHaveBeenCalled()
  })
})
