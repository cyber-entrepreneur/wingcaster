import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const tenantAuth = vi.hoisted(() => ({
  listUserAgencyMemberships: vi.fn(),
}))

const config = vi.hoisted(() => ({
  ensureAgencySiteConfig: vi.fn(),
  updateAgencySiteCopyFields: vi.fn(),
  publishAgencySiteConfig: vi.fn(),
}))

const db = vi.hoisted(() => ({
  findOne: vi.fn(),
}))

vi.mock('../../tenant-authorization.js', () => tenantAuth)
vi.mock('../../db.js', () => db)
vi.mock('./agency-site-config.js', () => ({
  ...config,
  FEATURED_FILTERS: ['all', 'by_area', 'by_property_type', 'by_price_range'],
  FEATURED_SORTS: ['newest', 'most_viewed', 'manual'],
}))

let registerAgencySiteConfigRoutes

async function createApp(userId = 'usr_owner') {
  const app = express()
  app.use(express.json())
  registerAgencySiteConfigRoutes(app, {
    authMiddleware: (req, _res, next) => {
      req.user = { id: userId }
      next()
    },
  })
  return app
}

beforeEach(async () => {
  vi.resetModules()
  tenantAuth.listUserAgencyMemberships.mockReset()
  config.ensureAgencySiteConfig.mockReset()
  config.updateAgencySiteCopyFields.mockReset()
  config.publishAgencySiteConfig.mockReset()
  db.findOne.mockReset()

  tenantAuth.listUserAgencyMemberships.mockImplementation(async (userId) => {
    if (userId === 'usr_owner') {
      return [{ agency_id: 'agc_1', tenant_id: 'agency:agc_1', role: 'owner', affiliation_mode: 'exclusive' }]
    }
    return [{ agency_id: 'agc_1', tenant_id: 'agency:agc_1', role: 'member', affiliation_mode: 'exclusive' }]
  })
  db.findOne.mockResolvedValue({ id: 'agc_1', name: 'Elite Realty' })
  config.ensureAgencySiteConfig.mockResolvedValue({
    id: 'cfg_1',
    agency_id: 'agc_1',
    copy_fields: { header: { tagline: 'Find your home' } },
  })
  config.updateAgencySiteCopyFields.mockResolvedValue({
    id: 'cfg_1',
    agency_id: 'agc_1',
    copy_fields: { header: { tagline: 'Updated tagline' } },
  })
  config.publishAgencySiteConfig.mockResolvedValue({
    id: 'cfg_1',
    agency_id: 'agc_1',
    published_at: '2026-09-03T00:00:00Z',
  })

  ;({ registerAgencySiteConfigRoutes } = await import('./agency-site-config-routes.js'))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('agency site config routes', () => {
  it('loads copy config for agency admins', async () => {
    const app = await createApp()
    const res = await request(app).get('/api/agency/white-label/copy')
    expect(res.status).toBe(200)
    expect(config.ensureAgencySiteConfig).toHaveBeenCalledWith('agc_1')
  })

  it('rejects non-admin members', async () => {
    const app = await createApp('usr_member')
    const res = await request(app).get('/api/agency/white-label/copy')
    expect(res.status).toBe(403)
  })

  it('updates copy fields', async () => {
    const app = await createApp()
    const res = await request(app).put('/api/agency/white-label/copy').send({
      copy_fields: { header: { tagline: 'Updated tagline' } },
    })
    expect(res.status).toBe(200)
    expect(config.updateAgencySiteCopyFields).toHaveBeenCalled()
  })

  it('publishes copy config', async () => {
    const app = await createApp()
    const res = await request(app).post('/api/agency/white-label/copy/publish')
    expect(res.status).toBe(200)
    expect(config.publishAgencySiteConfig).toHaveBeenCalledWith('agc_1')
  })
})
