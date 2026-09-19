/**
 * AGN-CRD-001 — Agency wallet overview route tests (mocked db + credit service).
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
  agencyTenantId: vi.fn((id) => `agency:${id}`),
}))

const creditService = vi.hoisted(() => ({
  balance: vi.fn(),
  transactions: vi.fn(),
}))

vi.mock('../../db.js', () => db)
vi.mock('../../identity.js', () => identity)
vi.mock('../../tenant-authorization.js', () => tenantAuth)
vi.mock('./compat.js', () => ({
  createCreditService: () => creditService,
}))

let registerAgencyWalletOverviewRoutes

const AGENCY_ID = 'agency-1'
const OWNER = 'user-owner'
const MEMBER = 'user-member'
const FINANCE_MEMBER = 'user-finance'

function ownerMembership() {
  return {
    agency_id: AGENCY_ID,
    tenant_id: `agency:${AGENCY_ID}`,
    user_id: OWNER,
    role: 'owner',
    status: 'active',
  }
}

function financeMembership() {
  return {
    agency_id: AGENCY_ID,
    tenant_id: `agency:${AGENCY_ID}`,
    user_id: FINANCE_MEMBER,
    role: 'member',
    status: 'active',
    capability_packs: ['finance'],
  }
}

async function createApp(userId = OWNER) {
  const app = express()
  app.use(express.json())
  registerAgencyWalletOverviewRoutes(app, {
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
  db.query.mock.savedThreshold = null
  identity.findUserById.mockReset()
  tenantAuth.listUserAgencyMemberships.mockReset()
  tenantAuth.listAgencyMemberships.mockReset()
  creditService.balance.mockReset()
  creditService.transactions.mockReset()

  tenantAuth.listUserAgencyMemberships.mockImplementation(async (userId) => {
    if (userId === OWNER) return [ownerMembership()]
    if (userId === FINANCE_MEMBER) return [financeMembership()]
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

  creditService.balance.mockResolvedValue({
    tenant_id: 'wallet-agency',
    credits_remaining: 250,
    credits_reserved: 10,
    currency: 'USD',
  })
  creditService.transactions.mockResolvedValue([
    {
      id: 'tx-1',
      type: 'consumption',
      amount: 5,
      description: 'WhatsApp draft',
      created_at: '2026-09-01T12:00:00.000Z',
    },
  ])

  db.query.mockImplementation(async (sql, params = []) => {
    if (sql.includes('agency_credit_wallet_settings') && sql.includes('SELECT')) {
      if (db.query.mock.savedThreshold != null) {
        const savedThreshold = db.query.mock.savedThreshold
        return [{
          agency_id: AGENCY_ID,
          low_balance_alert_threshold: savedThreshold,
          updated_by: OWNER,
          updated_at: '2026-09-19T00:00:00.000Z',
        }]
      }
      return []
    }
    if (sql.includes('credit_wallets') && sql.includes('scope = \'agent\'')) {
      return [{ user_id: 'agent-1', credits_remaining: 5000, credits_reserved: 0, tenant_id: 'wallet-agent' }]
    }
    if (sql.includes('credit_consumptions')) {
      return [{ total: 30000 }]
    }
    if (sql.includes('INSERT INTO public.agency_credit_wallet_settings')) {
      db.query.mock.savedThreshold = params[1]
      return []
    }
    return []
  })

  identity.findUserById.mockResolvedValue({ id: 'agent-1', name: 'Agent One', email: 'agent@example.com' })

  ;({ registerAgencyWalletOverviewRoutes } = await import('./wallet-overview-routes.js'))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GET /api/agency/credits/wallet-overview', () => {
  it('returns wallet overview for agency owner', async () => {
    const app = await createApp(OWNER)
    const res = await request(app).get('/api/agency/credits/wallet-overview')
    expect(res.status).toBe(200)
    expect(res.body.balance.credits_remaining).toBe(250)
    expect(res.body.kpis.wallet_balance).toBe(250)
    expect(res.body.allocation.slices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'agent-1', kind: 'agent' }),
        expect.objectContaining({ key: 'unallocated', kind: 'pool' }),
      ]),
    )
    expect(res.body.permissions.can_manage_settings).toBe(true)
    expect(res.body.permissions.can_top_up).toBe(false)
  })

  it('allows finance-pack members to view the wallet', async () => {
    const app = await createApp(FINANCE_MEMBER)
    const res = await request(app).get('/api/agency/credits/wallet-overview')
    expect(res.status).toBe(200)
    expect(res.body.permissions.can_manage_settings).toBe(false)
  })

  it('rejects members without finance or read_only packs', async () => {
    const app = await createApp(MEMBER)
    const res = await request(app).get('/api/agency/credits/wallet-overview')
    expect(res.status).toBe(403)
  })
})

describe('PUT /api/agency/credits/wallet-settings', () => {
  it('updates alert threshold for owner', async () => {
    const app = await createApp(OWNER)
    const res = await request(app)
      .put('/api/agency/credits/wallet-settings')
      .send({ low_balance_alert_threshold: 75 })
    expect(res.status).toBe(200)
    expect(res.body.settings.low_balance_alert_threshold).toBe(75)
    expect(db.query).toHaveBeenCalled()
  })

  it('rejects invalid threshold', async () => {
    const app = await createApp(OWNER)
    const res = await request(app)
      .put('/api/agency/credits/wallet-settings')
      .send({ low_balance_alert_threshold: -5 })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/non-negative/)
  })

  it('rejects finance members from writing settings', async () => {
    const app = await createApp(FINANCE_MEMBER)
    const res = await request(app)
      .put('/api/agency/credits/wallet-settings')
      .send({ low_balance_alert_threshold: 50 })
    expect(res.status).toBe(403)
  })
})
