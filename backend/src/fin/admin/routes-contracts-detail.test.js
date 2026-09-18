import express from 'express'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { registerFinOpsAdminRoutes } from './routes.js'

vi.mock('./reads.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getContract: vi.fn(async ({ id }) => (
      id === 'contract-1'
        ? {
            id: 'contract-1',
            contract_number: 'C-1001',
            tenant_display_name: 'Acme Realty',
            tenant_public_id: 'tenant-acme',
            status: 'ACTIVE',
            billing_currency: 'USD',
            starts_at: '2026-01-01T00:00:00.000Z',
            ends_at: null,
            version: 3,
            component_count: 2,
            active_version: {
              id: 'ver-2',
              version_n: 2,
              status: 'ACTIVE',
              effective_from: '2026-01-01T00:00:00.000Z',
              components: [
                { id: 'cmp-1', component_type: 'METER_PRICE', price_code: 'social.post' },
              ],
            },
            versions: [
              { id: 'ver-2', version_n: 2, status: 'ACTIVE', components: [] },
              { id: 'ver-1', version_n: 1, status: 'SUPERSEDED', components: [] },
            ],
            draft_versions: [],
          }
        : null
    )),
    listContracts: vi.fn(async () => []),
    loadOverviewKpis: vi.fn(async () => ({ tiles: {} })),
    listTenants: vi.fn(async () => []),
    usageDrill: vi.fn(async () => ({ rows: [] })),
    listLots: vi.fn(async () => []),
    listHolds: vi.fn(async () => []),
    listFacilities: vi.fn(async () => []),
    simulatePrice: vi.fn(async () => ({})),
    listInvoices: vi.fn(async () => []),
    getInvoice: vi.fn(async () => null),
    listPayments: vi.fn(async () => []),
    listReconRuns: vi.fn(async () => []),
    getReconRun: vi.fn(async () => null),
    listDunningCases: vi.fn(async () => []),
    listApprovals: vi.fn(async () => []),
    listAudit: vi.fn(async () => []),
    listConfiguration: vi.fn(async () => ({})),
    getTenant: vi.fn(async () => null),
    getBillingPeriod: vi.fn(async () => null),
    loadExceptions: vi.fn(async () => ({ types: [] })),
  }
})

function mount({ role = 'platform_admin' } = {}) {
  const app = express()
  app.use(express.json())
  registerFinOpsAdminRoutes(app, {
    authMiddleware: (req, _res, next) => {
      req.user = {
        id: '00000000-0000-0000-0000-0000000000a1',
        token_version: 0,
        platform_role: role,
        email: 'admin@example.test',
      }
      next()
    },
    requirePlatformAdmin: (req, res, next) => {
      if (req.user?.platform_role !== 'platform_admin') {
        return res.status(403).json({ error: 'Forbidden: platform admin required' })
      }
      next()
    },
  })
  return app
}

describe('PA-CON-002 contract detail route', () => {
  it('GET /api/admin/fin/contracts/:id refuses non-admin', async () => {
    const app = mount({ role: 'agent' })
    const res = await request(app).get('/api/admin/fin/contracts/contract-1')
    expect(res.status).toBe(403)
  })

  it('GET /api/admin/fin/contracts/:id returns composite detail for admin', async () => {
    const app = mount()
    const res = await request(app).get('/api/admin/fin/contracts/contract-1')
    expect(res.status).toBe(200)
    expect(res.body.contract_number).toBe('C-1001')
    expect(res.body.active_version.status).toBe('ACTIVE')
    expect(res.body.versions).toHaveLength(2)
    expect(res.headers.etag).toBe('"3"')
  })

  it('GET /api/admin/fin/contracts/:id returns 404 when missing', async () => {
    const app = mount()
    const res = await request(app).get('/api/admin/fin/contracts/missing')
    expect(res.status).toBe(404)
    expect(res.body.code).toBe('NOT_FOUND')
  })
})
