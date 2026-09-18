import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  findOne: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
}))
const tenantAuth = vi.hoisted(() => ({ getAgencyMembership: vi.fn() }))

vi.mock('../../db.js', () => db)
vi.mock('../../tenant-authorization.js', () => tenantAuth)
vi.mock('../logger.js', () => ({ default: { error: vi.fn() } }))

import { registerAgencyPublicProfileSettingsRoutes } from './public-profile-settings-routes.js'

const agency = { id: 'agency-1', name: 'Aleph Realty', description: 'Trusted advisors.' }
const ownerId = 'user-owner'
let settings

function appFor(userId = ownerId) {
  const app = express()
  app.use(express.json())
  registerAgencyPublicProfileSettingsRoutes(app, {
    authMiddleware: (req, _res, next) => {
      req.user = { id: userId }
      next()
    },
  })
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  settings = null
  db.findOne.mockImplementation(async (collection, predicate) => {
    const rows = collection === 'agencies'
      ? [agency]
      : collection === 'agency_public_profile_settings' && settings
        ? [settings]
        : []
    return rows.find(predicate) || null
  })
  db.insert.mockImplementation(async (collection, item) => {
    if (collection === 'agency_public_profile_settings') settings = { ...item }
    return item
  })
  db.update.mockImplementation(async (collection, predicate, updater) => {
    if (collection === 'agency_public_profile_settings' && settings && predicate(settings)) {
      settings = updater({ ...settings })
      return 1
    }
    return 0
  })
  tenantAuth.getAgencyMembership.mockImplementation(async (agencyId, userId) =>
    agencyId === agency.id && userId === ownerId
      ? { agency_id: agencyId, user_id: userId, role: 'owner' }
      : null)
})

describe('agency public profile settings routes', () => {
  it('returns useful defaults before settings are saved', async () => {
    const response = await request(appFor()).get('/api/agencies/agency-1/public-profile-settings')

    expect(response.status).toBe(200)
    expect(response.body.settings).toEqual(expect.objectContaining({
      agency_id: 'agency-1',
      show_team: true,
      show_listings: true,
      show_reviews: true,
      show_closed_transactions: false,
      show_contact_form: true,
      hero_title: 'Aleph Realty',
      hero_body: 'Trusted advisors.',
      is_default: true,
    }))
  })

  it('creates strict profile settings and audits the before and after state', async () => {
    const payload = {
      show_team: false,
      show_listings: true,
      show_reviews: true,
      show_closed_transactions: true,
      show_contact_form: false,
      hero_title: 'Find your place with Aleph',
      hero_body: 'Local market intelligence with global reach.',
      meta_description: 'Aleph Realty property advisors and active listings.',
    }
    const response = await request(appFor())
      .put('/api/agencies/agency-1/public-profile-settings')
      .send(payload)

    expect(response.status).toBe(200)
    expect(response.body.settings).toEqual(expect.objectContaining({
      ...payload,
      updated_by: ownerId,
      is_default: false,
    }))
    expect(db.insert).toHaveBeenCalledWith('audit_log', expect.objectContaining({
      type: 'agency_public_profile_updated',
      agency_id: 'agency-1',
      metadata: expect.objectContaining({
        before: expect.objectContaining({ show_team: true }),
        after: expect.objectContaining({ show_team: false }),
      }),
    }))
  })

  it('rejects unknown fields and overlong SEO copy', async () => {
    const response = await request(appFor())
      .put('/api/agencies/agency-1/public-profile-settings')
      .send({
        show_team: true,
        show_listings: true,
        show_reviews: true,
        show_closed_transactions: false,
        show_contact_form: true,
        hero_title: 'Aleph',
        hero_body: '',
        meta_description: 'x'.repeat(161),
        unexpected: true,
      })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('Validation failed')
    expect(response.body.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'meta_description' }),
      expect.objectContaining({ path: '' }),
    ]))
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('returns a leak-safe not-found response to non-editors', async () => {
    const response = await request(appFor('user-outsider'))
      .get('/api/agencies/agency-1/public-profile-settings')

    expect(response.status).toBe(404)
    expect(response.body).toEqual({ error: 'Agency not found' })
  })
})
