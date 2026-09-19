/**
 * AGN-REP-008 — Agency custom report route tests.
 */
import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  query: vi.fn(),
  findAll: vi.fn(),
}))

const tenantAuth = vi.hoisted(() => ({
  listUserAgencyMemberships: vi.fn(),
}))

vi.mock('../../db.js', () => db)
vi.mock('../../tenant-authorization.js', () => tenantAuth)

let registerAgencyCustomReportRoutes

const AGENCY_ID = 'agency-1'
const OWNER = 'user-owner'
const MEMBER = 'user-member'

function ownerMembership() {
  return {
    agency_id: AGENCY_ID,
    tenant_id: `agency:${AGENCY_ID}`,
    user_id: OWNER,
    role: 'owner',
    status: 'active',
  }
}

async function createApp(userId = OWNER) {
  const app = express()
  app.use(express.json())
  registerAgencyCustomReportRoutes(app, {
    auth: (req, _res, next) => {
      req.user = { id: userId }
      next()
    },
  })
  return app
}

beforeEach(async () => {
  vi.resetModules()
  db.query.mockReset()
  db.findAll.mockReset()
  tenantAuth.listUserAgencyMemberships.mockReset()

  tenantAuth.listUserAgencyMemberships.mockImplementation(async (userId) => {
    if (userId === OWNER) return [ownerMembership()]
    if (userId === MEMBER) return [{
      agency_id: AGENCY_ID,
      tenant_id: `agency:${AGENCY_ID}`,
      user_id: MEMBER,
      role: 'member',
      status: 'active',
      capability_packs: [],
    }]
    return []
  })

  db.findAll.mockImplementation(async (collection) => {
    if (collection === 'agents') {
      return [{ id: 'agent-1', agency_id: AGENCY_ID, name: 'Agent One' }]
    }
    if (collection === 'properties') {
      return [
        { id: 'p1', agency_id: AGENCY_ID, agent_id: 'agent-1', status: 'active', created_at: '2026-09-10T00:00:00.000Z', area: 'Downtown', property_type: 'apartment' },
      ]
    }
    if (collection === 'inquiries') {
      return [{ id: 'i1', agency_id: AGENCY_ID, agent_id: 'agent-1', created_at: '2026-09-11T00:00:00.000Z' }]
    }
    return []
  })

  db.query.mockImplementation(async (sql) => {
    if (sql.includes('INSERT INTO public.agency_custom_reports')) {
      return []
    }
    if (sql.includes('FROM public.agency_custom_reports') && sql.includes('WHERE agency_id')) {
      return [{
        id: 'report-1',
        agency_id: AGENCY_ID,
        name: 'Weekly pipeline',
        definition: {
          metrics: ['listings_count', 'inquiries_count'],
          dimensions: ['agent'],
          filters: {},
        },
        created_by: OWNER,
        updated_by: OWNER,
        created_at: '2026-09-01T00:00:00.000Z',
        updated_at: '2026-09-01T00:00:00.000Z',
      }]
    }
    return []
  })

  ;({ registerAgencyCustomReportRoutes } = await import('./custom-reports-routes.js'))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GET /api/agency/reports/custom/catalog', () => {
  it('returns metrics and dimensions for owner', async () => {
    const app = await createApp(OWNER)
    const res = await request(app).get('/api/agency/reports/custom/catalog')
    expect(res.status).toBe(200)
    expect(res.body.metrics.length).toBeGreaterThan(0)
    expect(res.body.dimensions.length).toBeGreaterThan(0)
  })
})

describe('POST /api/agency/reports/custom/run', () => {
  it('runs an ad-hoc report definition', async () => {
    const app = await createApp(OWNER)
    const res = await request(app)
      .post('/api/agency/reports/custom/run')
      .send({
        definition: {
          metrics: ['listings_count', 'inquiries_count'],
          dimensions: ['agent'],
          filters: {},
        },
      })
    expect(res.status).toBe(200)
    expect(res.body.rows.length).toBeGreaterThan(0)
    expect(res.body.totals.listings_count).toBeGreaterThanOrEqual(1)
  })
})

describe('POST /api/agency/reports/custom', () => {
  it('creates a saved report for owner', async () => {
    const app = await createApp(OWNER)
    const res = await request(app)
      .post('/api/agency/reports/custom')
      .send({
        name: 'Weekly pipeline',
        definition: {
          metrics: ['listings_count'],
          dimensions: [],
          filters: {},
        },
      })
    expect(res.status).toBe(201)
    expect(res.body.report.name).toBe('Weekly pipeline')
  })

  it('rejects members without finance pack', async () => {
    const app = await createApp(MEMBER)
    const res = await request(app)
      .post('/api/agency/reports/custom')
      .send({
        name: 'Blocked',
        definition: { metrics: ['listings_count'], dimensions: [], filters: {} },
      })
    expect(res.status).toBe(403)
  })
})
