import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Collections } from '../infrastructure/db.js'
import { createBenchmarkService, computeDeltaPct, matchesDeltaBucket } from '../application/benchmark-service.js'
import { createAgentPriceReportAdminService } from '../application/agent-price-report-admin-service.js'
import { registerAdminRoutes } from '../interface/admin-routes.js'

function createMemoryDal(seed = {}) {
  const store = {
    agent_price_reports: [],
    pricing_benchmarks: [],
    pricing_benchmark_snapshots: [],
    approval_requests: [],
    users: [],
    agents: [],
    agencies: [],
    ...seed,
  }

  const match = (item, filter) => {
    if (typeof filter === 'function') return filter(item)
    return true
  }

  const dal = {
    store,
    findAll: vi.fn(async (collection, filter) => (store[collection] || []).filter((item) => match(item, filter))),
    findOne: vi.fn(async (collection, filter) => (store[collection] || []).find((item) => match(item, filter)) || null),
    insert: vi.fn(async (collection, item) => {
      if (!store[collection]) store[collection] = []
      store[collection].push(item)
      return item
    }),
    update: vi.fn(async (collection, filter, updater) => {
      const rows = store[collection] || []
      let count = 0
      for (let i = 0; i < rows.length; i++) {
        if (match(rows[i], filter)) {
          rows[i] = updater(rows[i])
          count += 1
        }
      }
      return count
    }),
    remove: vi.fn(async (collection, filter) => {
      const rows = store[collection] || []
      const keep = []
      let removed = 0
      for (const row of rows) {
        if (match(row, filter)) removed += 1
        else keep.push(row)
      }
      store[collection] = keep
      return removed
    }),
    query: vi.fn(async (sql, params) => {
      // Simulate fin.approval_requests insert for high-delta path
      if (String(sql).includes('INSERT INTO fin.approval_requests')) {
        store.approval_requests.push({
          id: params[0],
          environment: params[1],
          action_kind: params[2],
          payload_hash: params[3],
          payload: JSON.parse(params[4]),
          created_at: params[5],
          created_by_actor_id: params[6],
          status: 'REQUESTED',
        })
        return []
      }
      return []
    }),
    transaction: vi.fn(async (work) => work({})),
  }
  return dal
}

function seedReport(overrides = {}) {
  return {
    id: overrides.id || 'aprt_1',
    reporter_id: overrides.reporter_id || 'agent-user-1',
    agent_id: overrides.agent_id || 'agent-user-1',
    external_property_location: overrides.external_property_location || 'Dubai Marina',
    property_type: overrides.property_type || 'apartment',
    bedrooms: overrides.bedrooms ?? 2,
    sold_price: overrides.sold_price ?? 1850000,
    currency: overrides.currency || 'AED',
    recommendation_price_point: overrides.recommendation_price_point ?? overrides.sold_price ?? 1850000,
    recommendation_price_low: overrides.recommendation_price_low ?? 1750000,
    recommendation_price_high: overrides.recommendation_price_high ?? 1950000,
    segment_id: overrides.segment_id || 'seg_ae_dubai_marina_apt_2',
    segment_label: overrides.segment_label || 'Dubai Marina · 2BR apartments',
    country_code: overrides.country_code || 'AE',
    status: overrides.status || 'pending_review',
    env: overrides.env || 'live',
    incorporated: false,
    created_at: overrides.created_at || '2026-09-08T10:00:00.000Z',
    updated_at: overrides.updated_at || '2026-09-08T10:00:00.000Z',
    data: overrides.data || {},
    ...overrides,
  }
}

describe('benchmark helpers', () => {
  it('computes delta percent', () => {
    expect(computeDeltaPct(1850000, 1562500)).toBe(18.4)
    expect(computeDeltaPct(100, 100)).toBe(0)
    expect(computeDeltaPct(90, 100)).toBe(-10)
  })

  it('matches delta buckets', () => {
    expect(matchesDeltaBucket(3, 'in_band')).toBe(true)
    expect(matchesDeltaBucket(7, 'above_5')).toBe(true)
    expect(matchesDeltaBucket(12, 'above_10')).toBe(true)
    expect(matchesDeltaBucket(-7, 'below_5')).toBe(true)
    expect(matchesDeltaBucket(-12, 'below_10')).toBe(true)
  })
})

describe('agent price report admin service', () => {
  let dal
  let benchmarkService
  let adminService
  let refreshCalls

  beforeEach(() => {
    refreshCalls = []
    dal = createMemoryDal({
      agent_price_reports: [
        seedReport({ id: 'aprt_low', recommendation_price_point: 1050000, sold_price: 1050000 }),
        seedReport({
          id: 'aprt_high',
          recommendation_price_point: 1850000,
          sold_price: 1850000,
          created_at: '2026-09-07T10:00:00.000Z',
        }),
        seedReport({
          id: 'aprt_other',
          status: 'rejected',
          recommendation_price_point: 1000000,
          sold_price: 1000000,
          reviewed_at: '2026-09-01T00:00:00.000Z',
          reviewed_by: 'pa-1',
        }),
      ],
      pricing_benchmarks: [
        {
          id: 'bm_1',
          segment_id: 'seg_ae_dubai_marina_apt_2',
          env: 'live',
          currency: 'AED',
          price_point: 1000000,
          computed_at: '2026-09-08T09:00:00.000Z',
          data: {},
        },
      ],
      users: [{ id: 'agent-user-1', name: 'Sara Al Mansouri', created_at: '2021-01-01T00:00:00.000Z' }],
      agents: [{ id: 'agent-user-1', user_id: 'agent-user-1', name: 'Sara', agency_id: 'agy_1', subscription_tier: 'pro_elite', created_at: '2021-01-01T00:00:00.000Z' }],
      agencies: [{ id: 'agy_1', name: 'Elite Real Estate Dubai' }],
    })
    const recalculationJobService = {
      invalidateAll: vi.fn(async () => {
        const job = { id: 'job_refresh_1' }
        refreshCalls.push(job)
        return job
      }),
    }
    benchmarkService = createBenchmarkService({ dal, recalculationJobService, logger: { warn() {}, info() {} } })
    adminService = createAgentPriceReportAdminService({
      dal,
      benchmarkService,
      logger: { warn() {}, info() {} },
    })
  })

  it('lists with pagination, filters, counts, and joined payload', async () => {
    const page1 = await adminService.listReports(
      { status: 'pending_review', page: 1, pageSize: 1, sort: 'delta_abs:desc' },
      { viewerId: 'pa-1', env: 'live' },
    )
    expect(page1.pagination).toMatchObject({ page: 1, page_size: 1, total: 2, has_next: true })
    expect(page1.reports).toHaveLength(1)
    expect(page1.reports[0].id).toBe('aprt_high')
    expect(page1.reports[0].agent.display_name).toContain('Sara')
    expect(page1.reports[0].agency.name).toContain('Elite')
    expect(page1.reports[0].benchmark_delta.delta_pct).toBe(85)
    expect(page1.reports[0].two_person_required).toBe(true)
    expect(page1.counts.pending).toBe(2)
    expect(page1.counts.pending_high_delta).toBe(1)

    const filtered = await adminService.listReports(
      { status: 'pending_review', delta: 'above_10', page: 1, pageSize: 25 },
      { viewerId: 'pa-1', env: 'live' },
    )
    expect(filtered.reports.every((r) => Math.abs(r.benchmark_delta.delta_pct) >= 10)).toBe(true)
  })

  it('returns detail payload', async () => {
    const detail = await adminService.getReport('aprt_high', { viewerId: 'pa-1', env: 'live' })
    expect(detail.id).toBe('aprt_high')
    expect(detail.subject.segment_id).toBe('seg_ae_dubai_marina_apt_2')
    expect(detail.audit_trail[0].action).toBe('submitted')
    expect(detail.env).toBe('live')
  })

  it('incorporates low-delta reports transactionally and enqueues refresh', async () => {
    // Set recommendation near benchmark so |delta| < 10%
    const report = dal.store.agent_price_reports.find((r) => r.id === 'aprt_low')
    report.recommendation_price_point = 1050000
    report.sold_price = 1050000

    const result = await adminService.reviewReport(
      'aprt_low',
      { status: 'verified', incorporate: true, notes: 'Solid evidence' },
      { viewerId: 'pa-1', env: 'live' },
    )
    expect(result).toMatchObject({ success: true, status: 'incorporated', incorporated: true })
    expect(result.benchmark_refresh_queued).toBe(true)
    expect(refreshCalls).toHaveLength(1)

    const updated = dal.store.agent_price_reports.find((r) => r.id === 'aprt_low')
    expect(updated.status).toBe('incorporated')
    expect(updated.incorporated).toBe(true)
    expect(dal.store.pricing_benchmarks.find((b) => b.segment_id === report.segment_id).price_point).toBe(1050000)
  })

  it('high-delta incorporate creates approval request and does not write benchmark', async () => {
    const beforeBenchmarks = dal.store.pricing_benchmarks.length
    const result = await adminService.reviewReport(
      'aprt_high',
      { status: 'verified', incorporate: true, notes: 'Needs second eyes' },
      { viewerId: 'pa-1', env: 'live' },
    )
    expect(result.pending_second_approval).toBe(true)
    expect(result.request_id || result.approval_request_id).toBeTruthy()
    expect(dal.store.approval_requests).toHaveLength(1)
    expect(dal.store.approval_requests[0].action_kind).toBe('PRICE_REPORT_INCORPORATE')
    expect(dal.store.pricing_benchmarks).toHaveLength(beforeBenchmarks)

    const updated = dal.store.agent_price_reports.find((r) => r.id === 'aprt_high')
    expect(updated.status).toBe('pending_second_approval')
  })

  it('supports request_info status', async () => {
    const result = await adminService.reviewReport(
      'aprt_low',
      { status: 'request_info', reason_code: 'need_comps', notes: 'Add 2 more comps' },
      { viewerId: 'pa-1', env: 'live' },
    )
    expect(result).toMatchObject({ success: true, status: 'request_info' })
    expect(dal.store.agent_price_reports.find((r) => r.id === 'aprt_low').status).toBe('request_info')
  })

  it('rejects own-report reviews with OWN_REPORT', async () => {
    await expect(
      adminService.reviewReport(
        'aprt_low',
        { status: 'verified', incorporate: false },
        { viewerId: 'agent-user-1', env: 'live' },
      ),
    ).rejects.toMatchObject({ code: 'OWN_REPORT', status: 403 })
  })

  it('rolls back benchmark write when status update fails inside the transaction', async () => {
    const report = dal.store.agent_price_reports.find((r) => r.id === 'aprt_low')
    report.recommendation_price_point = 1020000
    report.data = { __force_status_write_failure: true }

    // Simulate transactional rollback: if work throws, revert store mutations
    const snapshot = {
      reports: structuredClone(dal.store.agent_price_reports),
      benchmarks: structuredClone(dal.store.pricing_benchmarks),
      snaps: structuredClone(dal.store.pricing_benchmark_snapshots),
    }
    dal.transaction = vi.fn(async (work) => {
      try {
        return await work({})
      } catch (err) {
        dal.store.agent_price_reports = structuredClone(snapshot.reports)
        dal.store.pricing_benchmarks = structuredClone(snapshot.benchmarks)
        dal.store.pricing_benchmark_snapshots = structuredClone(snapshot.snaps)
        throw err
      }
    })

    await expect(
      adminService.reviewReport(
        'aprt_low',
        { status: 'verified', incorporate: true },
        { viewerId: 'pa-1', env: 'live' },
      ),
    ).rejects.toMatchObject({ code: 'STATUS_WRITE_FAILED' })

    expect(dal.store.agent_price_reports.find((r) => r.id === 'aprt_low').status).toBe('pending_review')
    // Benchmark for this segment should remain the seeded 1_000_000 (no incorporate write kept)
    const bench = dal.store.pricing_benchmarks.find((b) => b.segment_id === report.segment_id)
    expect(bench.price_point).toBe(1000000)
    expect(bench.source_report_id).toBeUndefined()
  })

  it('rejects bulk incorporate', async () => {
    await expect(
      adminService.bulkReview(
        { ids: ['aprt_low'], status: 'verified', incorporate: true },
        { viewerId: 'pa-1', env: 'live' },
      ),
    ).rejects.toMatchObject({ code: 'BULK_INCORPORATE_DISALLOWED', status: 400 })
  })

  it('returns benchmark series points', async () => {
    await benchmarkService.writeBenchmarkFromReport(
      dal.store.agent_price_reports.find((r) => r.id === 'aprt_low'),
      { env: 'live', actorId: 'pa-1' },
    )
    const series = await benchmarkService.getSeries('seg_ae_dubai_marina_apt_2', { window: '90d', env: 'live' })
    expect(series.points.length).toBeGreaterThanOrEqual(1)
    expect(series.currency).toBe('AED')
  })
})

describe('admin route registration for WF-06', () => {
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

  it('registers list, detail, series, review, bulk, undo, csv', () => {
    const { app, routes } = fakeExpress()
    registerAdminRoutes(app, {
      configService: {},
      currencyService: {},
      comparableService: {},
      analysisService: {},
      trendService: {},
      scraperService: {},
      recalculationJobService: {},
      agentPriceReportAdminService: {},
      benchmarkService: {},
      dal: {},
      logger: { warn() {}, info() {} },
    })
    const paths = routes.map((r) => `${r.method.toUpperCase()} ${r.path}`)
    expect(paths).toContain('GET /api/admin/pricing/agent-price-reports')
    expect(paths).toContain('GET /api/admin/pricing/agent-price-reports/:id')
    expect(paths).toContain('GET /api/admin/pricing/agent-price-reports.csv')
    expect(paths).toContain('POST /api/admin/pricing/agent-price-reports/bulk-review')
    expect(paths).toContain('POST /api/admin/pricing/agent-price-reports/:id/review')
    expect(paths).toContain('POST /api/admin/pricing/agent-price-reports/:id/undo-review')
    expect(paths).toContain('GET /api/admin/pricing/benchmarks/:segmentId/series')
  })
})
