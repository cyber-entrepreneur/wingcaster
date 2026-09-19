/**
 * AGN-CRD-006 — Agency feature quota route tests.
 */
import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  query: vi.fn(),
}))

const identity = vi.hoisted(() => ({
  findUserById: vi.fn(),
}))

const tenantAuth = vi.hoisted(() => ({
  listUserAgencyMemberships: vi.fn(),
  listAgencyMemberships: vi.fn(),
}))

vi.mock('../../db.js', () => db)
vi.mock('../../identity.js', () => identity)
vi.mock('../../tenant-authorization.js', () => tenantAuth)

let registerAgencyFeatureQuotaRoutes

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
  registerAgencyFeatureQuotaRoutes(app, {
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
  identity.findUserById.mockReset()
  tenantAuth.listUserAgencyMemberships.mockReset()
  tenantAuth.listAgencyMemberships.mockReset()

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

  tenantAuth.listAgencyMemberships.mockResolvedValue([
    { user_id: 'agent-1', role: 'member', status: 'active' },
  ])

  identity.findUserById.mockResolvedValue({ id: 'agent-1', name: 'Agent One', email: 'agent@example.com' })

  db.query.mockImplementation(async (sql, params = []) => {
    if (sql.includes('FROM public.credit_wallets') && sql.includes("scope = 'agent'")) {
      return [{ tenant_id: 'wallet-agent-1', user_id: 'agent-1' }]
    }
    if (sql.includes('FROM public.tenant_subscriptions')) {
      return [{
        id: 'sub-1',
        billing_cycle_start: '2026-09-01T00:00:00.000Z',
        billing_cycle_end: '2026-10-01T00:00:00.000Z',
        properties_committed: 10,
        package_version_id: 'pkg-v1',
        status: 'ACTIVE',
      }]
    }
    if (sql.includes('FROM public.metered_features')) {
      return [{
        id: 'feat-1',
        code: 'publishing.social.instagram',
        display_name: 'Instagram publish',
        category: 'publishing.social',
        credits_per_unit: 100,
        active: true,
      }]
    }
    if (sql.includes('FROM public.package_feature_flags')) {
      return [{ enabled: true }]
    }
    if (sql.includes('FROM public.package_feature_quotas')) {
      return [{ credits_per_property: 100 }]
    }
    if (sql.includes('GROUP BY c.tenant_id')) {
      return [{ tenant_id: 'wallet-agent-1', used: 5000 }]
    }
    if (sql.includes('COALESCE(SUM(c.credits_amount)')) {
      return [{ used: 5000 }]
    }
    return []
  })

  ;({ registerAgencyFeatureQuotaRoutes } = await import('./agency-feature-quotas-routes.js'))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GET /api/agency/credits/feature-quotas', () => {
  it('returns grouped agency quotas for owner', async () => {
    const app = await createApp(OWNER)
    const res = await request(app).get('/api/agency/credits/feature-quotas')
    expect(res.status).toBe(200)
    expect(res.body.agency_id).toBe(AGENCY_ID)
    expect(res.body.groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'social',
          quotas: expect.arrayContaining([
            expect.objectContaining({
              feature_code: 'publishing.social.instagram',
              agent_breakdown: expect.arrayContaining([
                expect.objectContaining({ agent_name: 'Agent One' }),
              ]),
            }),
          ]),
        }),
      ]),
    )
  })

  it('rejects members without finance/read_only/marketer packs', async () => {
    const app = await createApp(MEMBER)
    const res = await request(app).get('/api/agency/credits/feature-quotas')
    expect(res.status).toBe(403)
  })
})
