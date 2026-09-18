import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildAgencySettingsIndex,
  registerAgencySettingsIndexRoutes,
} from './settings-index-routes.js'

const tenantAuth = vi.hoisted(() => ({
  listUserAgencyMemberships: vi.fn(),
}))

vi.mock('../../auth.js', () => ({
  authMiddleware: (_req, _res, next) => next(),
}))
vi.mock('../../tenant-authorization.js', () => tenantAuth)

const AGENCY_ID = 'agency-1'
const OWNER = 'user-owner'
const ADMIN = 'user-admin'
const AGENT = 'user-agent'

async function createApp(userId) {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.user = { id: userId }
    next()
  })
  registerAgencySettingsIndexRoutes(app)
  return app
}

beforeEach(() => {
  tenantAuth.listUserAgencyMemberships.mockReset()
  tenantAuth.listUserAgencyMemberships.mockImplementation(async (userId) => {
    if (userId === OWNER) return [{ agency_id: AGENCY_ID, user_id: userId, role: 'owner' }]
    if (userId === ADMIN) return [{ agency_id: AGENCY_ID, user_id: userId, role: 'admin' }]
    if (userId === AGENT) return [{ agency_id: AGENCY_ID, user_id: userId, role: 'agent' }]
    return []
  })
})

describe('buildAgencySettingsIndex', () => {
  it('includes ownership transfer for owners only', () => {
    const ownerIndex = buildAgencySettingsIndex({ role: 'owner', agencyId: AGENCY_ID })
    const adminIndex = buildAgencySettingsIndex({ role: 'admin', agencyId: AGENCY_ID })

    const ownerItems = ownerIndex.groups.flatMap((group) => group.items.map((item) => item.id))
    const adminItems = adminIndex.groups.flatMap((group) => group.items.map((item) => item.id))

    expect(ownerItems).toContain('ownership_transfer')
    expect(adminItems).not.toContain('ownership_transfer')
    expect(ownerIndex.capabilities.can_transfer_ownership).toBe(true)
    expect(adminIndex.capabilities.can_transfer_ownership).toBe(false)
  })
})

describe('GET /api/agency/settings/index', () => {
  it('returns grouped settings for owners', async () => {
    const app = await createApp(OWNER)
    const res = await request(app).get('/api/agency/settings/index')
    expect(res.status).toBe(200)
    expect(res.body.agency_id).toBe(AGENCY_ID)
    expect(res.body.groups.length).toBeGreaterThan(0)
  })

  it('forbids non-admin members', async () => {
    const app = await createApp(AGENT)
    const res = await request(app).get('/api/agency/settings/index')
    expect(res.status).toBe(403)
  })
})
