import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  classifyMarketImpactTier,
  computeValuationMove,
  createMarketImpactService,
  MARKET_IMPACT_TIERS,
} from '../application/market-impact-service.js'
import {
  createComparableReportReadService,
  normalizeReportStatus,
  normalizeReasonCategory,
  deriveSeverity,
} from '../application/comparable-report-read-service.js'
import { registerAdminRoutes } from '../interface/admin-routes.js'
import { WINGCASTER_ENV_HEADER } from '../../../lib/session-env.js'

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
  res.send = vi.fn().mockReturnValue(res)
  res.setHeader = vi.fn().mockReturnValue(res)
  return res
}

const logger = { warn: () => {}, error: () => {}, info: () => {}, debug: () => {}, child: () => logger }

function hoursAgo(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

function buildDal(seed = {}) {
  const store = {
    comparable_reports: seed.comparable_reports || [],
    users: seed.users || [],
    agencies: seed.agencies || [],
    agency_members: seed.agency_members || [],
    properties: seed.properties || [],
    external_comparables: seed.external_comparables || [],
    analysis_comparable_evidence: seed.analysis_comparable_evidence || [],
    property_price_analyses: seed.property_price_analyses || [],
    agent_price_reports: seed.agent_price_reports || [],
    audit_log: seed.audit_log || [],
  }
  return {
    findAll: vi.fn(async (collection, filter = () => true) => (store[collection] || []).filter(filter)),
    findOne: vi.fn(async (collection, filter) => (store[collection] || []).find(filter) || null),
    insert: vi.fn(async (_c, item) => item),
    update: vi.fn(async () => 0),
    store,
  }
}

describe('market-impact-service', () => {
  it('classifies tiers including high (two-person trigger)', () => {
    expect(classifyMarketImpactTier({ valuations_affected: 0 })).toBe(MARKET_IMPACT_TIERS.NONE)
    expect(classifyMarketImpactTier({
      valuations_affected: 12,
      pct_move_median: 4,
      pct_move_max: 7.8,
    })).toBe(MARKET_IMPACT_TIERS.LOW)
    expect(classifyMarketImpactTier({
      valuations_affected: 18,
      pct_move_median: 6,
      pct_move_max: 9,
    })).toBe(MARKET_IMPACT_TIERS.MEDIUM)
    expect(classifyMarketImpactTier({
      valuations_affected: 34,
      pct_move_median: -11.2,
      pct_move_max: -18.7,
    })).toBe(MARKET_IMPACT_TIERS.HIGH)
  })

  it('computes valuation move when removing a comparable', () => {
    const evidence = [
      { comparable_id: 'cmp-a', normalized_price: 100, weight: 3, property_id: 'p1' },
      { comparable_id: 'cmp-b', normalized_price: 200, weight: 1, property_id: 'p1' },
      { comparable_id: 'cmp-c', normalized_price: 220, weight: 1, property_id: 'p1' },
    ]
    const move = computeValuationMove(evidence, 'cmp-a')
    expect(move).not.toBeNull()
    expect(Math.abs(move.pct_move)).toBeGreaterThan(0)
  })

  it('scores impact from evidence + active analyses', async () => {
    const dal = buildDal({
      analysis_comparable_evidence: [
        {
          analysis_run_id: 'run-1',
          property_id: 'prop-1',
          comparable_id: 'cmp-1',
          comparable_type: 'external',
          normalized_price: 100,
          weight: 0.2,
        },
        {
          analysis_run_id: 'run-1',
          property_id: 'prop-1',
          comparable_id: 'cmp-other',
          comparable_type: 'external',
          normalized_price: 200,
          weight: 1,
        },
        {
          analysis_run_id: 'run-1',
          property_id: 'prop-1',
          comparable_id: 'cmp-other-2',
          comparable_type: 'external',
          normalized_price: 210,
          weight: 1,
        },
      ],
      property_price_analyses: [
        {
          id: 'an-1',
          property_id: 'prop-1',
          latest_run_id: 'run-1',
          median_price: 150,
          calculated_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 86400000).toISOString(),
        },
      ],
      properties: [{ id: 'prop-1', neighborhood: 'Marina', city: 'Dubai' }],
    })

    const service = createMarketImpactService({ dal, logger })
    const impact = await service.scoreComparableImpact({
      comparableId: 'cmp-1',
      comparableType: 'external',
    })
    expect(impact.valuations_affected).toBe(1)
    expect(impact.tier).toBe(MARKET_IMPACT_TIERS.LOW)
    expect(impact.requires_two_person).toBe(false)
    expect(impact.top_markets[0]?.market).toBe('Marina')
  })
})

describe('comparable-report-read-service helpers', () => {
  it('normalizes legacy statuses and reasons', () => {
    expect(normalizeReportStatus('actioned')).toBe('confirmed_removed')
    expect(normalizeReportStatus('dismissed')).toBe('rejected')
    expect(normalizeReportStatus('reviewed')).toBe('confirmed_quarantined')
    expect(normalizeReportStatus('pending')).toBe('pending')
    expect(normalizeReasonCategory('incorrect_price')).toBe('wrong_price')
    expect(normalizeReasonCategory('fake_listing')).toBe('spam')
    expect(normalizeReasonCategory('already_sold')).toBe('already_sold')
  })

  it('derives severity from category and delta', () => {
    expect(deriveSeverity({ reasonCategory: 'already_sold', marketImpactTier: 'high' })).toBe('critical')
    expect(deriveSeverity({ reasonCategory: 'wrong_price', deltaPct: -25 })).toBe('high')
    expect(deriveSeverity({ reasonCategory: 'other', deltaPct: 2 })).toBe('low')
  })
})

describe('comparable-report list/detail/is_own', () => {
  let dal
  let service

  beforeEach(() => {
    dal = buildDal({
      users: [
        { id: 'pa-1', name: 'Platform Admin', email: 'pa@wingcaster.test' },
        { id: 'rep-1', name: 'Sara Al Mansouri', email: 'sara@elite.test', data: {} },
        { id: 'rep-2', name: 'Ahmed Khan', email: 'ahmed@test.com' },
      ],
      agencies: [
        { id: 'agy-elite', name: 'Elite Real Estate Dubai' },
        { id: 'agy-marina', name: 'Marina Ventures' },
      ],
      agency_members: [
        { user_id: 'rep-1', agency_id: 'agy-elite', status: 'active' },
        { user_id: 'pa-1', agency_id: 'agy-marina', status: 'active' },
      ],
      external_comparables: [
        {
          id: 'cmp-marina',
          title: '2BR Marina apartment · AED 2.4M',
          location_text: 'Marina Gate, Dubai Marina',
          source: 'agency_owned',
          price: 2400000,
          currency: 'AED',
          property_type: 'apartment',
          bedrooms: 2,
          status: 'active',
          agency_id: 'agy-marina',
        },
        {
          id: 'cmp-saadiyat',
          title: 'Villa · Saadiyat',
          location_text: 'Saadiyat Beach, Abu Dhabi',
          source: 'olx',
          price: 5200000,
          currency: 'AED',
          property_type: 'villa',
          status: 'active',
        },
      ],
      comparable_reports: [
        {
          id: 'cmr-1',
          reporter_id: 'rep-1',
          comparable_id: 'cmp-marina',
          comparable_type: 'external',
          reason: 'incorrect_price',
          notes: 'Listed price is stale',
          status: 'pending',
          created_at: hoursAgo(2),
          updated_at: hoursAgo(2),
          data: {
            env: 'live',
            reported_field: 'price',
            reported_value: 2400000,
            observed_value: 3400000,
            evidence_files: [
              {
                filename: 'portal_screenshot.png',
                uploaded_at: hoursAgo(2),
                size_bytes: 218430,
                content_type: 'image/png',
              },
              {
                filename: 'dld.pdf',
                uploaded_at: hoursAgo(2),
                size_bytes: 1000,
                content_type: 'application/pdf',
              },
            ],
          },
        },
        {
          id: 'cmr-2',
          reporter_id: 'rep-2',
          comparable_id: 'cmp-saadiyat',
          comparable_type: 'external',
          reason: 'already_sold',
          notes: 'Sold Aug 14',
          status: 'pending',
          created_at: hoursAgo(5),
          updated_at: hoursAgo(5),
          data: {
            env: 'live',
            reported_field: 'status',
            observed_value: 'sold',
            observed_at: '2026-08-14',
            severity: 'high',
            evidence_files: [
              { filename: 'dld_record.png', size_bytes: 50000, content_type: 'image/png' },
            ],
          },
        },
        {
          id: 'cmr-own',
          reporter_id: 'pa-1',
          comparable_id: 'cmp-marina',
          comparable_type: 'external',
          reason: 'wrong_details',
          status: 'pending',
          created_at: hoursAgo(1),
          updated_at: hoursAgo(1),
          data: { env: 'live' },
        },
        {
          id: 'cmr-test-env',
          reporter_id: 'rep-1',
          comparable_id: 'cmp-marina',
          comparable_type: 'external',
          reason: 'other',
          status: 'pending',
          created_at: hoursAgo(1),
          updated_at: hoursAgo(1),
          data: { env: 'test' },
        },
        {
          id: 'cmr-old',
          reporter_id: 'rep-2',
          comparable_id: 'cmp-saadiyat',
          comparable_type: 'external',
          reason: 'already_sold',
          status: 'actioned',
          reviewed_by: 'pa-other',
          reviewed_at: hoursAgo(10),
          created_at: hoursAgo(80),
          updated_at: hoursAgo(10),
          data: { env: 'live', decision_reason: 'confirmed' },
        },
      ],
      analysis_comparable_evidence: Array.from({ length: 30 }, (_, i) => ([
        {
          analysis_run_id: `run-${i}`,
          property_id: `prop-${i}`,
          comparable_id: 'cmp-saadiyat',
          comparable_type: 'external',
          normalized_price: 5000000,
          weight: 2,
        },
        {
          analysis_run_id: `run-${i}`,
          property_id: `prop-${i}`,
          comparable_id: 'cmp-other',
          comparable_type: 'external',
          normalized_price: 4000000,
          weight: 1,
        },
      ])).flat(),
      property_price_analyses: Array.from({ length: 30 }, (_, i) => ({
        id: `an-${i}`,
        property_id: `prop-${i}`,
        latest_run_id: `run-${i}`,
        median_price: 4500000,
        calculated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      })),
    })

    service = createComparableReportReadService({ dal, logger })
  })

  it('returns list shape with pagination, counts, market_impact, requires_two_person', async () => {
    const req = {
      user: { id: 'pa-viewer', env: 'live' },
      get: (h) => (h === WINGCASTER_ENV_HEADER ? 'live' : undefined),
    }
    const result = await service.listReports(
      { status: 'pending', within: '7d', page: 1, pageSize: 2 },
      { viewerId: 'pa-viewer', req },
    )

    expect(result.pagination).toEqual({
      page: 1,
      page_size: 2,
      total: 3,
      has_next: true,
    })
    expect(result.counts.pending).toBe(3)
    expect(result.reports).toHaveLength(2)

    const row = result.reports[0]
    expect(row).toMatchObject({
      id: expect.any(String),
      status: 'pending',
      reason_category: expect.any(String),
      severity: expect.any(String),
      is_own: expect.any(Boolean),
      requires_two_person: expect.any(Boolean),
      env: 'live',
    })
    expect(row.reporter).toMatchObject({
      id: expect.any(String),
      display_name: expect.any(String),
      pattern_flag: expect.any(Boolean),
    })
    expect(row.comparable).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      source: expect.any(String),
      source_display: expect.any(String),
    })
    expect(row.market_impact).toMatchObject({
      tier: expect.stringMatching(/^(none|low|medium|high)$/),
      valuations_affected: expect.any(Number),
      pct_move_median: expect.any(Number),
      pct_move_max: expect.any(Number),
    })
    expect(row.evidence).toMatchObject({
      file_count: expect.any(Number),
      files: expect.any(Array),
    })
    expect(row).not.toHaveProperty('_decided_at')

    // Default sort: high market impact first (cmr-2 with 30 valuations)
    expect(result.reports[0].id).toBe('cmr-2')
    expect(result.reports[0].market_impact.tier).toBe('high')
    expect(result.reports[0].requires_two_person).toBe(true)
  })

  it('marks is_own when viewer is reporter or agent at comparable-owning agency', async () => {
    const req = {
      user: { id: 'pa-1', env: 'live' },
      get: () => 'live',
    }
    const asReporter = await service.listReports(
      { status: 'pending', within: 'all', q: 'cmr-own' },
      { viewerId: 'pa-1', req },
    )
    expect(asReporter.reports[0].is_own).toBe(true)

    const asAgencyMate = await service.listReports(
      { status: 'pending', within: 'all', q: 'cmr-1' },
      { viewerId: 'pa-1', req },
    )
    expect(asAgencyMate.reports[0].is_own).toBe(true)

    const outsider = await service.listReports(
      { status: 'pending', within: 'all', q: 'cmr-2' },
      { viewerId: 'pa-1', req },
    )
    expect(outsider.reports[0].is_own).toBe(false)
  })

  it('scopes list to X-Wingcaster-Env', async () => {
    const live = await service.listReports(
      { within: 'all' },
      { viewerId: 'pa-viewer', req: { user: { id: 'pa-viewer', env: 'live' }, get: () => 'live' } },
    )
    expect(live.reports.every((r) => r.env === 'live')).toBe(true)
    expect(live.reports.find((r) => r.id === 'cmr-test-env')).toBeUndefined()

    const testEnv = await service.listReports(
      { within: 'all' },
      { viewerId: 'pa-viewer', req: { user: { id: 'pa-viewer', env: 'test' }, get: () => 'test' } },
    )
    expect(testEnv.reports).toHaveLength(1)
    expect(testEnv.reports[0].id).toBe('cmr-test-env')
  })

  it('returns detail payload for get-by-id', async () => {
    const detail = await service.getReport('cmr-2', {
      viewerId: 'pa-viewer',
      req: { user: { id: 'pa-viewer', env: 'live' }, get: () => 'live' },
    })
    expect(detail).toMatchObject({
      id: 'cmr-2',
      status: 'pending',
      reason_category: 'already_sold',
      requires_two_person: true,
      env: 'live',
    })
    expect(detail.comparable.current_fields).toMatchObject({
      price: 5200000,
      currency: 'AED',
      property_type: 'villa',
    })
    expect(detail.reporter_claim).toMatchObject({
      reported_field: 'status',
      observed_value: 'sold',
    })
    expect(detail.market_impact.top_markets).toEqual(expect.any(Array))
    expect(detail.related_reports).toEqual(expect.any(Array))
    expect(detail.evidence.file_count).toBe(1)
  })

  it('returns reporter history and audit trail', async () => {
    const history = await service.getReporterHistory('cmr-2', {
      limit: 10,
      viewerId: 'pa-viewer',
      req: { user: { env: 'live' }, get: () => 'live' },
    })
    expect(history.reporter_id).toBe('rep-2')
    expect(history.reports.length).toBeGreaterThanOrEqual(2)
    expect(history.reports.some((r) => r.is_current)).toBe(true)

    const audit = await service.getAuditTrail('cmr-old', {
      viewerId: 'pa-viewer',
      req: { user: { env: 'live' }, get: () => 'live' },
    })
    expect(audit.events.length).toBeGreaterThanOrEqual(2)
    expect(audit.events[0].action).toBe('report.submitted')
    expect(audit.events.some((e) => e.action === 'report.decided')).toBe(true)
  })

  it('maps legacy actioned status to confirmed_removed in filters', async () => {
    const result = await service.listReports(
      { status: 'confirmed_removed', within: 'all' },
      { viewerId: 'pa-viewer', req: { user: { env: 'live' }, get: () => 'live' } },
    )
    expect(result.reports).toHaveLength(1)
    expect(result.reports[0].id).toBe('cmr-old')
    expect(result.reports[0].status).toBe('confirmed_removed')
  })
})

describe('admin routes comparable-report reads', () => {
  it('registers list/detail/history/audit/csv and keeps review', () => {
    const { app, routes } = fakeExpress()
    registerAdminRoutes(app, {
      dal: buildDal(),
      logger,
    })
    const paths = routes.map((r) => `${r.method.toUpperCase()} ${r.path}`)
    expect(paths).toContain('GET /api/admin/pricing/reports')
    expect(paths).toContain('GET /api/admin/pricing/reports.csv')
    expect(paths).toContain('GET /api/admin/pricing/reports/:reportId')
    expect(paths).toContain('GET /api/admin/pricing/reports/:reportId/reporter-history')
    expect(paths).toContain('GET /api/admin/pricing/reports/:reportId/audit-trail')
    expect(paths).toContain('POST /api/admin/pricing/reports/:id/review')
  })

  it('list route returns extended shape and stamps env header', async () => {
    const dal = buildDal({
      comparable_reports: [{
        id: 'cmr-x',
        reporter_id: 'rep-1',
        comparable_id: 'cmp-1',
        comparable_type: 'external',
        reason: 'other',
        status: 'pending',
        created_at: hoursAgo(1),
        updated_at: hoursAgo(1),
        data: { env: 'live' },
      }],
      users: [{ id: 'rep-1', name: 'Reporter', email: 'r@test.com' }],
      external_comparables: [{ id: 'cmp-1', title: 'Unit', source: 'bayut' }],
    })
    const { app, routes } = fakeExpress()
    registerAdminRoutes(app, { dal, logger })
    const route = routes.find((r) => r.method === 'get' && r.path === '/api/admin/pricing/reports')
    const handler = route.handlers.at(-1)
    const req = {
      user: { id: 'admin-1', env: 'live' },
      query: { status: 'pending', page: '1', pageSize: '25' },
      get: (h) => (h === WINGCASTER_ENV_HEADER ? 'live' : undefined),
    }
    const res = mockRes()
    await handler(req, res, () => {})

    expect(res.setHeader).toHaveBeenCalledWith(WINGCASTER_ENV_HEADER, 'live')
    const body = res.json.mock.calls[0][0]
    expect(body.reports).toEqual(expect.any(Array))
    expect(body.pagination).toMatchObject({ page: 1, page_size: 25 })
    expect(body.counts).toMatchObject({ pending: expect.any(Number) })
  })

  it('get-by-id route returns 404 for missing report', async () => {
    const { app, routes } = fakeExpress()
    registerAdminRoutes(app, { dal: buildDal(), logger })
    const route = routes.find((r) => r.method === 'get' && r.path === '/api/admin/pricing/reports/:reportId')
    const handler = route.handlers.at(-1)
    const req = {
      user: { id: 'admin-1', env: 'live' },
      params: { reportId: 'missing' },
      get: () => 'live',
    }
    const res = mockRes()
    await handler(req, res, () => {})
    expect(res.status).toHaveBeenCalledWith(404)
  })
})
