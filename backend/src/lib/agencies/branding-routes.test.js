import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  findOne: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
}))

const tenantAuth = vi.hoisted(() => ({
  getAgencyMembership: vi.fn(),
}))

vi.mock('../../db.js', () => db)
vi.mock('../../tenant-authorization.js', () => tenantAuth)
vi.mock('../logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

import { registerAgencyBrandingRoutes } from './branding-routes.js'

const ADMIN_USER = 'user-admin'
const OUTSIDER_USER = 'user-outsider'
let agency

function createApp(userId = ADMIN_USER) {
  const app = express()
  app.use(express.json())
  registerAgencyBrandingRoutes(app, {
    authMiddleware: (req, _res, next) => {
      req.user = { id: userId }
      next()
    },
  })
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  agency = {
    id: 'agency-1',
    name: 'Aleph Realty',
    description: 'Trusted local advisors.',
    updated_at: '2026-08-01T00:00:00.000Z',
  }
  db.findOne.mockImplementation(async (collection, predicate) => {
    if (collection !== 'agencies') return null
    return predicate(agency) ? { ...agency } : null
  })
  db.update.mockImplementation(async (collection, predicate, updater) => {
    if (collection === 'agencies' && predicate(agency)) {
      agency = updater({ ...agency })
      return 1
    }
    return 0
  })
  db.insert.mockImplementation(async (_collection, item) => item)
  tenantAuth.getAgencyMembership.mockImplementation(async (agencyId, userId) => {
    if (agencyId === agency.id && userId === ADMIN_USER) {
      return { agency_id: agencyId, user_id: userId, role: 'owner' }
    }
    return null
  })
})

describe('agency branding routes', () => {
  it('returns first-class defaults for an unbranded agency', async () => {
    const response = await request(createApp()).get('/api/agencies/agency-1/branding')

    expect(response.status).toBe(200)
    expect(response.body.branding).toEqual(expect.objectContaining({
      agency_id: 'agency-1',
      name: 'Aleph Realty',
      description: 'Trusted local advisors.',
      logo_url: null,
      favicon_url: null,
      font_family: 'system',
      is_default: true,
    }))
  })

  it('saves identity and brand settings and writes an audit snapshot', async () => {
    const response = await request(createApp())
      .put('/api/agencies/agency-1/branding')
      .send({
        name: 'Aleph International',
        description: 'Cross-border property advisors.',
        logo_url: '/uploads/agency-logo.svg',
        favicon_url: 'https://cdn.example.com/favicon.png',
        primary_color: '#c93c08',
        accent_color: '#0a7a85',
        font_family: 'ibm-plex-sans',
      })

    expect(response.status).toBe(200)
    expect(response.body.branding).toEqual(expect.objectContaining({
      name: 'Aleph International',
      logo_url: '/uploads/agency-logo.svg',
      primary_color: '#C93C08',
      accent_color: '#0A7A85',
      font_family: 'ibm-plex-sans',
      updated_by: ADMIN_USER,
      is_default: false,
    }))
    expect(agency).toEqual(expect.objectContaining({
      brand_primary_color: '#C93C08',
      brand_accent_color: '#0A7A85',
      brand_updated_by: ADMIN_USER,
    }))
    expect(db.insert).toHaveBeenCalledWith('audit_log', expect.objectContaining({
      agency_id: 'agency-1',
      agent_id: ADMIN_USER,
      type: 'agency_branding_updated',
      metadata: expect.objectContaining({
        before: expect.objectContaining({ name: 'Aleph Realty' }),
        after: expect.objectContaining({ name: 'Aleph International' }),
      }),
    }))
  })

  it('strictly validates colors, assets, fonts, and unknown fields', async () => {
    const response = await request(createApp())
      .put('/api/agencies/agency-1/branding')
      .send({
        name: 'Aleph International',
        description: '',
        logo_url: 'javascript:alert(1)',
        favicon_url: null,
        primary_color: 'orange',
        accent_color: '#0A7A85',
        font_family: 'comic-sans',
        unexpected: true,
      })

    expect(response.status).toBe(400)
    expect(response.body).toEqual(expect.objectContaining({
      error: 'Validation failed',
      issues: expect.arrayContaining([
        expect.objectContaining({ path: 'logo_url' }),
        expect.objectContaining({ path: 'primary_color' }),
        expect.objectContaining({ path: 'font_family' }),
        expect.objectContaining({ path: '' }),
      ]),
    }))
    expect(db.update).not.toHaveBeenCalled()
  })

  it('returns a leak-safe not-found response for a caller without ownership', async () => {
    const response = await request(createApp(OUTSIDER_USER))
      .get('/api/agencies/agency-1/branding')

    expect(response.status).toBe(404)
    expect(response.body).toEqual({ error: 'Agency not found' })
    expect(db.update).not.toHaveBeenCalled()
  })

  it('resets visual branding while preserving agency identity copy', async () => {
    agency = {
      ...agency,
      logo_url: '/uploads/logo.png',
      favicon_url: '/uploads/favicon.png',
      brand_primary_color: '#C93C08',
      brand_accent_color: '#0A7A85',
      brand_font_family: 'archivo',
    }

    const response = await request(createApp())
      .post('/api/agencies/agency-1/branding/reset')
      .send({})

    expect(response.status).toBe(200)
    expect(response.body.branding).toEqual(expect.objectContaining({
      name: 'Aleph Realty',
      description: 'Trusted local advisors.',
      logo_url: null,
      favicon_url: null,
      primary_color: null,
      accent_color: null,
      font_family: 'system',
      is_default: true,
    }))
    expect(db.insert).toHaveBeenCalledWith('audit_log', expect.objectContaining({
      type: 'agency_branding_reset',
    }))
  })
})
