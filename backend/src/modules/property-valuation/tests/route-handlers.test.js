import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseCsv, normalizeExternalComparable, registerAdminRoutes } from '../interface/admin-routes.js'
import { registerPublicRoutes } from '../interface/public-routes.js'
import { registerRoleRoutes } from '../interface/role-routes.js'
import { listUserAgencyMemberships, listAgencyMemberships } from '../../../tenant-authorization.js'
import { insert as dbInsert } from '../../../db.js'

vi.mock('../../../tenant-authorization.js', () => ({
  listUserAgencyMemberships: vi.fn().mockResolvedValue([]),
  listAgencyMemberships: vi.fn().mockResolvedValue([]),
}))

vi.mock('../../../lib/credits/feature-check.js', () => ({
  checkEntitlement: vi.fn().mockResolvedValue({ enabled: true, registered: true }),
}))

vi.mock('../../../lib/credits/tenant-context.js', () => ({
  resolveRequestCreditTenant: vi.fn().mockReturnValue({
    creditTenantId: 'personal:agent-1',
    publicTenantId: 'personal:agent-1',
    scope: 'personal',
    scopeId: 'agent-1',
  }),
}))

vi.mock('../../../db.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    insert: vi.fn(async (_collection, item) => item),
    findAll: vi.fn(async () => []),
    findOne: vi.fn(async () => null),
    query: vi.fn(async () => []),
  }
})

// Ownership checks in public-routes hit the real authz layer (which reads
// `properties` + `agency_members` via ../../../db.js). Route-handler tests
// don't spin up Postgres, so stub the helper to return the requested
// property for the caller — real-postgres coverage lives in the
// integration tests.
vi.mock('../../../lib/authz.js', async () => {
  const actual = await vi.importActual('../../../lib/authz.js')
  return {
    ...actual,
    assertOwnsProperty: vi.fn(async (_userId, propertyId) => ({ id: propertyId, agent_id: _userId })),
  }
})

function fakeExpress() {
  const routes = []
  const app = {
    get: (path, ...handlers) => routes.push({ method: 'get', path, handlers }),
    post: (path, ...handlers) => routes.push({ method: 'post', path, handlers }),
    put: (path, ...handlers) => routes.push({ method: 'put', path, handlers }),
    delete: (path, ...handlers) => routes.push({ method: 'delete', path, handlers }),
  }
  return { app, routes }
}

function mockRes() {
  const res = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

const logger = { warn: () => {}, error: () => {}, info: () => {}, debug: () => {}, child: () => logger }

describe('Admin Route Helpers', () => {
  it('parseCsv handles basic rows', () => {
    const text = 'price,currency,title\n100000,USD,Test A\n200000,USD,Test B'
    const parsed = parseCsv(text)
    expect(parsed.headers).toEqual(['price', 'currency', 'title'])
    expect(parsed.rows).toHaveLength(2)
    expect(parsed.rows[0]).toEqual({ price: '100000', currency: 'USD', title: 'Test A' })
  })

  it('parseCsv handles quoted commas', () => {
    const text = 'price,title\n100000,"Luxury villa, Batroun"\n200000,Plain'
    const parsed = parseCsv(text)
    expect(parsed.rows[0].title).toBe('Luxury villa, Batroun')
    expect(parsed.rows[1].title).toBe('Plain')
  })

  it('normalizeExternalComparable skips invalid price', () => {
    expect(normalizeExternalComparable({ price: 'not-a-number', currency: 'USD' })).toBeNull()
    expect(normalizeExternalComparable({ currency: 'USD' })).toBeNull()
    expect(normalizeExternalComparable({ price: '0', currency: 'USD' })).toBeNull()
  })

  it('normalizeExternalComparable defaults optional fields', () => {
    const result = normalizeExternalComparable({ price: '150000', currency: 'USD' })
    expect(result).toMatchObject({
      price: 150000,
      currency: 'USD',
      source: 'manual_csv',
      property_type: 'apartment',
      condition: 'unknown',
      status: 'active',
      price_normalized_usd: 150000,
    })
  })

  it('normalizeExternalComparable preserves explicit values', () => {
    const result = normalizeExternalComparable({
      price: '300000',
      currency: 'LBP',
      source: 'agent_csv',
      source_url: 'https://example.com/1',
      external_id: 'ext-1',
      title: 'Villa',
      property_type: 'villa',
      bedrooms: '3',
      bathrooms: '2',
      area_sqm: '220',
      condition: 'newly_renovated',
      location_text: 'Mar Mikhael',
      latitude: '33.89',
      longitude: '35.51',
    })
    expect(result).toMatchObject({
      source: 'agent_csv',
      price: 300000,
      currency: 'LBP',
      price_normalized_usd: null,
      property_type: 'villa',
      bedrooms: 3,
      bathrooms: 2,
      area_sqm: 220,
      condition: 'newly_renovated',
      location_text: 'Mar Mikhael',
      latitude: 33.89,
      longitude: 35.51,
    })
  })
})

describe('Admin Route Registration', () => {
  it('registers all expected admin endpoints', () => {
    const { app, routes } = fakeExpress()
    const services = {
      configService: {},
      currencyService: {},
      comparableService: {},
      analysisService: {},
      trendService: {},
      scraperService: {},
      dal: {},
      adapter: {},
      logger,
    }
    registerAdminRoutes(app, services)

    const paths = routes.map((r) => `${r.method.toUpperCase()} ${r.path}`)
    expect(paths).toContain('GET /api/admin/pricing/configs')
    expect(paths).toContain('POST /api/admin/pricing/configs')
    expect(paths).toContain('POST /api/admin/pricing/external-comparables/import-csv')
    expect(paths).toContain('POST /api/admin/pricing/currency-rates/refresh')
    expect(paths).toContain('POST /api/admin/pricing/recalculate')
    expect(paths).toContain('GET /api/admin/pricing/agent-price-reports')
    expect(paths).toContain('POST /api/admin/pricing/agent-price-reports/:id/review')
    expect(paths).toContain('GET /api/admin/pricing/agent-price-reports/:id')
    expect(paths).toContain('GET /api/admin/pricing/benchmarks/:segmentId/series')
    expect(paths).toContain('GET /api/admin/pricing/reports')
    expect(paths).toContain('GET /api/admin/pricing/reports.csv')
    expect(paths).toContain('GET /api/admin/pricing/reports/:reportId')
    expect(paths).toContain('GET /api/admin/pricing/reports/:reportId/reporter-history')
    expect(paths).toContain('GET /api/admin/pricing/reports/:reportId/audit-trail')
    expect(paths).toContain('POST /api/admin/pricing/reports/:id/review')
    expect(paths).toContain('POST /api/admin/pricing/reports/:reportId/confirm-remove')
    expect(paths).toContain('POST /api/admin/pricing/reports/:reportId/confirm-quarantine')
    expect(paths).toContain('POST /api/admin/pricing/reports/:reportId/reject-as-invalid')
    expect(paths).toContain('POST /api/admin/pricing/reports/:reportId/request-info')
  })

  it('CSV import route imports valid rows and logs failures', async () => {
    const { app, routes } = fakeExpress()
    const inserted = []
    const importLogs = []
    const services = {
      scraperService: {
        upsertExternalComparable: vi.fn().mockImplementation((row) => {
          inserted.push(row)
          return Promise.resolve(row)
        }),
      },
      dal: {
        insert: vi.fn().mockImplementation((collection, item) => {
          if (collection === 'csv_import_logs') importLogs.push(item)
          return Promise.resolve(item)
        }),
      },
      logger,
    }
    registerAdminRoutes(app, services)

    const csvRoute = routes.find((r) => r.path === '/api/admin/pricing/external-comparables/import-csv')
    expect(csvRoute).toBeDefined()

    const req = { user: { id: 'admin-1' }, body: { csv_text: 'price,currency,title\n100000,USD,Valid\ninvalid,USD,Missing price\n200000,USD,Also valid' } }
    const res = mockRes()
    const handler = csvRoute.handlers[csvRoute.handlers.length - 1]
    await handler(req, res, () => {})

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ imported: 2, failed: 1 }))
    expect(inserted).toHaveLength(2)
    expect(importLogs[0].rows_received).toBe(3)
    expect(importLogs[0].rows_imported).toBe(2)
    expect(importLogs[0].rows_failed).toBe(1)
  })

  it('currency refresh route returns fetched rate', async () => {
    const { app, routes } = fakeExpress()
    const services = {
      currencyService: {
        refreshRates: vi.fn().mockResolvedValue({ rate: 89000, source: 'lira_rate' }),
      },
      logger,
    }
    registerAdminRoutes(app, services)

    const refreshRoute = routes.find((r) => r.path === '/api/admin/pricing/currency-rates/refresh')
    const req = { user: { id: 'admin-1' }, body: {} }
    const res = mockRes()
    const handler = refreshRoute.handlers[refreshRoute.handlers.length - 1]
    await handler(req, res, () => {})

    expect(res.json).toHaveBeenCalledWith({ rate: 89000, source: 'lira_rate' })
  })

  it('currency refresh route returns 503 when all providers fail', async () => {
    const { app, routes } = fakeExpress()
    const services = {
      currencyService: {
        refreshRates: vi.fn().mockResolvedValue(null),
      },
      logger,
    }
    registerAdminRoutes(app, services)

    const refreshRoute = routes.find((r) => r.path === '/api/admin/pricing/currency-rates/refresh')
    const req = { user: { id: 'admin-1' }, body: {} }
    const res = mockRes()
    const handler = refreshRoute.handlers[refreshRoute.handlers.length - 1]
    await handler(req, res, () => {})

    expect(res.status).toHaveBeenCalledWith(503)
    expect(res.json).toHaveBeenCalledWith({ error: 'All currency rate providers failed' })
  })

  it('agent price report review updates status and reviewer', async () => {
    const { app, routes } = fakeExpress()
    const reports = [{ id: 'rpt-1', status: 'pending' }]
    const services = {
      dal: {
        findOne: vi.fn().mockImplementation((collection, filter) => {
          if (collection === 'agent_price_reports') return Promise.resolve(reports.find(filter))
          return Promise.resolve(null)
        }),
        update: vi.fn().mockImplementation((collection, filter, updater) => {
          const idx = reports.findIndex(filter)
          if (idx >= 0) reports[idx] = updater(reports[idx])
          return Promise.resolve(reports[idx])
        }),
      },
      logger,
    }
    registerAdminRoutes(app, services)

    const reviewRoute = routes.find((r) => r.path === '/api/admin/pricing/agent-price-reports/:id/review')
    const req = { user: { id: 'admin-1' }, params: { id: 'rpt-1' }, body: { status: 'verified', notes: 'Looks good' } }
    const res = mockRes()
    const handler = reviewRoute.handlers[reviewRoute.handlers.length - 1]
    await handler(req, res, () => {})

    expect(res.json).toHaveBeenCalledWith({ success: true })
    expect(reports[0].status).toBe('verified')
    expect(reports[0].reviewed_by).toBe('admin-1')
    expect(reports[0].review_notes).toBe('Looks good')
  })

  it('agent price report review via admin service supports request_info', async () => {
    const { app, routes } = fakeExpress()
    const review = vi.fn().mockResolvedValue({ success: true, status: 'request_info' })
    registerAdminRoutes(app, {
      agentPriceReportAdminService: { reviewReport: review },
      logger,
    })

    const reviewRoute = routes.find((r) => r.path === '/api/admin/pricing/agent-price-reports/:id/review')
    const req = {
      user: { id: 'admin-1' },
      params: { id: 'rpt-1' },
      body: { status: 'request_info', reason_code: 'need_comps', notes: 'More comps' },
      get: () => 'live',
    }
    const res = mockRes()
    const handler = reviewRoute.handlers[reviewRoute.handlers.length - 1]
    await handler(req, res, () => {})

    expect(review).toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith({ success: true, status: 'request_info' })
  })
})

describe('Public Route Registration', () => {
  it('registers public pricing endpoints', () => {
    const { app, routes } = fakeExpress()
    const services = {
      analysisService: {},
      comparableService: {},
      trendService: {},
      configService: {},
      dal: {},
      adapter: {},
      logger,
    }
    registerPublicRoutes(app, services)

    const paths = routes.map((r) => `${r.method.toUpperCase()} ${r.path}`)
    expect(paths).toContain('GET /api/pricing/analysis/:propertyId')
    expect(paths).toContain('GET /api/pricing/comparables/:propertyId')
    expect(paths).toContain('GET /api/pricing/trends/:areaId')
    expect(paths).toContain('POST /api/pricing/report-comparable')
    expect(paths).toContain('POST /api/pricing/bad-comparable-reports')
    expect(paths).toContain('POST /api/pricing/agent-price-reports')
    expect(paths).toContain('POST /api/pricing/evidence-uploads')
  })

  function mockDal(seed = {}) {
    const store = {
      comparable_reports: [...(seed.comparable_reports || [])],
      agent_price_reports: [...(seed.agent_price_reports || [])],
      audit_log: [],
      pricing_evidence_files: [...(seed.pricing_evidence_files || [])],
    }
    return {
      store,
      findAll: vi.fn(async (collection, filter) => (store[collection] || []).filter(filter || (() => true))),
      findOne: vi.fn(async (collection, filter) => (store[collection] || []).find(filter || (() => true)) || null),
      insert: vi.fn(async (collection, item) => {
        if (!store[collection]) store[collection] = []
        store[collection].push(item)
        return item
      }),
    }
  }

  it('report comparable route creates pending report', async () => {
    const { app, routes } = fakeExpress()
    const dal = mockDal()
    registerPublicRoutes(app, { dal, logger })

    const route = routes.find((r) => r.path === '/api/pricing/report-comparable')
    const req = {
      user: { id: 'user-1' },
      body: {
        comparable_id: 'comp-1',
        comparable_type: 'external',
        reason: 'fake_listing',
        notes: 'Already sold',
        reporter_confidence: 'self_witnessed',
        supporting_document_ids: [],
      },
    }
    const res = mockRes()
    await route.handlers[route.handlers.length - 1](req, res, () => {})

    expect(res.status).toHaveBeenCalledWith(201)
    const report = dal.store.comparable_reports[0]
    expect(report).toMatchObject({
      comparable_id: 'comp-1',
      comparable_type: 'external',
      reason: 'fake_listing',
      status: 'pending',
      reporter_confidence: 'self_witnessed',
    })
    expect(report.expires_at).toBeTruthy()
    expect(dbInsert).toHaveBeenCalledWith(
      'audit_log',
      expect.objectContaining({ type: 'bad_comparable_submit' }),
    )
  })

  it('report comparable route rejects missing fields', async () => {
    const { app, routes } = fakeExpress()
    registerPublicRoutes(app, { dal: mockDal(), logger })

    const route = routes.find((r) => r.path === '/api/pricing/report-comparable')
    const req = { user: { id: 'user-1' }, body: { comparable_id: 'comp-1' } }
    const res = mockRes()
    await route.handlers[route.handlers.length - 1](req, res, () => {})

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'comparable_id, comparable_type, and reason are required' })
  })

  it('report comparable rejects open duplicates with 409', async () => {
    const { app, routes } = fakeExpress()
    const dal = mockDal({
      comparable_reports: [{
        id: 'existing-1',
        reporter_id: 'user-1',
        comparable_id: 'comp-1',
        status: 'pending',
        created_at: new Date().toISOString(),
      }],
    })
    registerPublicRoutes(app, { dal, logger })
    const route = routes.find((r) => r.path === '/api/pricing/report-comparable')
    const req = {
      user: { id: 'user-1' },
      body: {
        comparable_id: 'comp-1',
        comparable_type: 'external',
        reason: 'incorrect_price',
        notes: 'Duplicate attempt with enough notes for validation.',
      },
    }
    const res = mockRes()
    await route.handlers[route.handlers.length - 1](req, res, () => {})
    expect(res.status).toHaveBeenCalledWith(409)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'DUPLICATE_REPORT', existing_report_id: 'existing-1' }),
    )
  })

  it('agent price report route creates pending report', async () => {
    const { app, routes } = fakeExpress()
    const dal = mockDal()
    registerPublicRoutes(app, { dal, logger })

    const route = routes.find((r) => r.path === '/api/pricing/agent-price-reports')
    const req = {
      user: { id: 'agent-1' },
      body: {
        property_id: 'prop-1',
        sold_price: 420000,
        currency: 'USD',
        sold_date: '2026-01-15',
        notes: 'Verified sale',
        reporter_confidence: 'hard_evidence',
        supporting_document_ids: [],
        segment_id: 'seg_dxb_marina',
        segment_label: 'Dubai Marina',
        country_code: 'ae',
        recommendation_price_point: 415000,
      },
    }
    const res = mockRes()
    await route.handlers[route.handlers.length - 1](req, res, () => {})

    expect(res.status).toHaveBeenCalledWith(201)
    const report = dal.store.agent_price_reports[0]
    expect(report).toMatchObject({
      agent_id: 'agent-1',
      property_id: 'prop-1',
      sold_price: 420000,
      currency: 'USD',
      sold_date: '2026-01-15',
      status: 'pending_review',
      reporter_confidence: 'hard_evidence',
      segment_id: 'seg_dxb_marina',
      segment_label: 'Dubai Marina',
      country_code: 'AE',
      recommendation_price_point: 415000,
      env: 'live',
    })
    expect(report.expires_at).toBeTruthy()
    expect(dbInsert).toHaveBeenCalledWith(
      'audit_log',
      expect.objectContaining({ type: 'price_report_submit' }),
    )
  })

  it('agent price report route persists segment recommendation and country fields', async () => {
    const { app, routes } = fakeExpress()
    const inserted = []
    const services = {
      dal: {
        insert: vi.fn().mockImplementation((collection, item) => {
          inserted.push(item)
          return Promise.resolve(item)
        }),
      },
      logger,
    }
    registerPublicRoutes(app, services)
    const route = routes.find((r) => r.path === '/api/pricing/agent-price-reports')
    const req = {
      user: { id: 'agent-1' },
      body: {
        sold_price: 420000,
        currency: 'USD',
        notes: 'Verified sale with segment fields.',
        segment_id: 'seg_dxb_marina',
        segment_label: 'Dubai Marina',
        country_code: 'ae',
        recommendation_price_point: 415000,
      },
    }
    const res = mockRes()
    await route.handlers[route.handlers.length - 1](req, res, () => {})
    expect(res.status).toHaveBeenCalledWith(201)
    expect(inserted[0]).toMatchObject({
      segment_id: 'seg_dxb_marina',
      country_code: 'AE',
      recommendation_price_point: 415000,
      env: 'live',
    })
  })

  it('returns INVALID_BODY 400 when segment_id is missing', async () => {
    const { app, routes } = fakeExpress()
    const services = {
      dal: {
        insert: vi.fn().mockImplementation((_c, item) => Promise.resolve(item)),
      },
      logger,
    }
    registerPublicRoutes(app, services)
    const route = routes.find((r) => r.path === '/api/pricing/agent-price-reports')
    const req = {
      user: { id: 'agent-1' },
      body: {
        sold_price: 420000,
        currency: 'USD',
        notes: 'Missing segment on purpose.',
        segment_label: 'Dubai Marina',
        country_code: 'AE',
        recommendation_price_point: 415000,
      },
    }
    const res = mockRes()
    await route.handlers[route.handlers.length - 1](req, res, () => {})
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'INVALID_BODY',
        errors: expect.arrayContaining([
          expect.objectContaining({ path: expect.stringMatching(/segment_id/) }),
        ]),
      }),
    )
  })


  it('agent price report route rejects negative recommendation_price_point', async () => {
    const { app, routes } = fakeExpress()
    registerPublicRoutes(app, { dal: { insert: vi.fn() }, logger })
    const route = routes.find((r) => r.path === '/api/pricing/agent-price-reports')
    const req = {
      user: { id: 'agent-1' },
      body: {
        sold_price: 100000,
        currency: 'USD',
        notes: 'Negative recommendation should fail.',
        segment_id: 'seg_x',
        segment_label: 'X',
        country_code: 'AE',
        recommendation_price_point: -1,
      },
    }
    const res = mockRes()
    await route.handlers[route.handlers.length - 1](req, res, () => {})
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'INVALID_BODY',
        errors: expect.arrayContaining([
          expect.objectContaining({ path: 'recommendation_price_point' }),
        ]),
      }),
    )
  })

  it('agent price report route rejects invalid sold price', async () => {
    const { app, routes } = fakeExpress()
    registerPublicRoutes(app, { dal: mockDal(), logger })

    const route = routes.find((r) => r.path === '/api/pricing/agent-price-reports')
    const req = { user: { id: 'agent-1' }, body: { sold_price: 0 } }
    const res = mockRes()
    await route.handlers[route.handlers.length - 1](req, res, () => {})

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'INVALID_BODY',
        errors: expect.arrayContaining([
          expect.objectContaining({ path: 'sold_price' }),
        ]),
      }),
    )
  })

  it('agent price report returns 403 FEATURE_NOT_ENABLED when entitlement is off', async () => {
    const { checkEntitlement } = await import('../../../lib/credits/feature-check.js')
    vi.mocked(checkEntitlement).mockResolvedValueOnce({ enabled: false, registered: true })
    const { app, routes } = fakeExpress()
    registerPublicRoutes(app, { dal: mockDal(), logger })
    const route = routes.find((r) => r.path === '/api/pricing/agent-price-reports')
    const req = {
      user: { id: 'agent-1' },
      body: { sold_price: 100000, currency: 'USD', notes: 'enough notes for the soft floor here' },
    }
    const res = mockRes()
    await route.handlers[route.handlers.length - 1](req, res, () => {})
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'FEATURE_NOT_ENABLED',
        required_capability: 'valuation.price_reports.submit',
        upsell_url: '/plans?highlight=wf06',
      }),
    )
  })

  it('agent price report rate-limits after daily quota', async () => {
    const { app, routes } = fakeExpress()
    const now = new Date().toISOString()
    const prior = Array.from({ length: 200 }, (_, i) => ({
      id: `r${i}`,
      reporter_id: 'agent-1',
      created_at: now,
    }))
    const dal = mockDal({ agent_price_reports: prior })
    registerPublicRoutes(app, { dal, logger })
    const route = routes.find((r) => r.path === '/api/pricing/agent-price-reports')
    const req = {
      user: { id: 'agent-1' },
      body: {
        external_property_title: 'Villa 9',
        sold_price: 900000,
        currency: 'AED',
        notes: 'Enough depth for the soft floor on a rate-limited path.',
      },
    }
    const res = mockRes()
    await route.handlers[route.handlers.length - 1](req, res, () => {})
    expect(res.status).toHaveBeenCalledWith(429)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'RATE_LIMITED', daily_quota: 200, used: 200 }),
    )
  })
})

describe('Agent and Agency Pricing Routes', () => {
  it('returns only the authenticated agent owned portfolio', async () => {
    const { app, routes } = fakeExpress()
    const properties = [
      { id: 'mine', agent_id: 'agent-1', status: 'active', price: 100000 },
      { id: 'other', agent_id: 'agent-2', status: 'active', price: 200000 },
    ]
    const services = {
      dal: {
        findAll: vi.fn().mockImplementation((collection, filter) => {
          const rows = collection === 'properties' ? properties : []
          return Promise.resolve(rows.filter(filter))
        }),
      },
      analysisService: { getAnalysis: vi.fn().mockResolvedValue({ comparable_count: 2, target_vs_median: 'at', confidence: 'high', rate_is_stale: false }) },
      recalculationJobService: {},
      logger,
    }
    registerRoleRoutes(app, services)
    const route = routes.find((item) => item.path === '/api/agent/pricing/portfolio')
    const req = { user: { id: 'agent-1' } }
    const res = mockRes()
    await route.handlers[route.handlers.length - 1](req, res, () => {})

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      summary: expect.objectContaining({ total_listings: 1, analyzed_listings: 1 }),
      listings: [expect.objectContaining({ id: 'mine' })],
    }))
  })

  it('rejects price adjustment for a listing owned by another agent', async () => {
    const { app, routes } = fakeExpress()
    const services = {
      dal: { findOne: vi.fn().mockResolvedValue(null) },
      analysisService: {},
      recalculationJobService: {},
      logger,
    }
    registerRoleRoutes(app, services)
    const route = routes.find((item) => item.path === '/api/agent/pricing/properties/:propertyId/adjust-price')
    const req = { user: { id: 'agent-1' }, params: { propertyId: 'other' }, body: { new_price: 300000 } }
    const res = mockRes()
    await route.handlers[route.handlers.length - 1](req, res, () => {})

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ error: 'Owned property not found' })
  })

  it('updates an owned price, records old and new values, and invalidates affected analyses', async () => {
    const { app, routes } = fakeExpress()
    const property = { id: 'mine', agent_id: 'agent-1', status: 'active', price: 100000, currency: 'USD' }
    const inserted = []
    const services = {
      dal: {
        findOne: vi.fn().mockImplementation((collection, filter) => {
          const rows = collection === 'properties' ? [property] : collection === 'property_price_analyses' ? [{ id: 'analysis-1', property_id: 'mine' }] : []
          return Promise.resolve(rows.find(filter) || null)
        }),
        update: vi.fn().mockResolvedValue(1),
        insert: vi.fn().mockImplementation((collection, item) => { inserted.push({ collection, item }); return Promise.resolve(item) }),
      },
      analysisService: {},
      recalculationJobService: { invalidateForPropertyChange: vi.fn().mockResolvedValue(undefined) },
      logger,
    }
    registerRoleRoutes(app, services)
    const route = routes.find((item) => item.path === '/api/agent/pricing/properties/:propertyId/adjust-price')
    const req = { user: { id: 'agent-1' }, params: { propertyId: 'mine' }, body: { new_price: 125000, reason: 'Seller approved' } }
    const res = mockRes()
    await route.handlers[route.handlers.length - 1](req, res, () => {})

    expect(inserted[0]).toMatchObject({
      collection: 'pricing_decisions',
      item: expect.objectContaining({ actor_id: 'agent-1', action: 'adjust_price', old_price: 100000, new_price: 125000, reason: 'Seller approved' }),
    })
    expect(services.recalculationJobService.invalidateForPropertyChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'mine', price: 125000 }))
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('rejects agency portfolio access without active membership', async () => {
    const { app, routes } = fakeExpress()
    const services = {
      dal: { findAll: vi.fn().mockResolvedValue([]) },
      analysisService: {},
      recalculationJobService: {},
      logger,
    }
    vi.mocked(listUserAgencyMemberships).mockResolvedValueOnce([])
    registerRoleRoutes(app, services)
    const route = routes.find((item) => item.path === '/api/agency/pricing/portfolio')
    const req = { user: { id: 'agent-1' } }
    const res = mockRes()
    await route.handlers[route.handlers.length - 1](req, res, () => {})

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ error: 'Active agency membership required' })
    expect(listUserAgencyMemberships).toHaveBeenCalledWith('agent-1')
  })
})
