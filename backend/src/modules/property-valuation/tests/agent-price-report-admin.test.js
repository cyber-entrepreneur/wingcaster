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
    approval_actions: [],
    audit_log: [],
    outbox_events: [],
    users: [],
    agents: [],
    agencies: [],
    ...seed,
  }

  const match = (item, filter) => {
    if (typeof filter === 'function') return filter(item)
    return true
  }

  let txDepth = 0
  let beginCount = 0

  const dal = {
    store,
    beginCount: () => beginCount,
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
      const text = String(sql)
      if (text.includes('INSERT INTO fin.approval_requests')) {
        store.approval_requests.push({
          id: params[0],
          environment: params[1],
          action_kind: params[2],
          payload_hash: params[3],
          payload: typeof params[4] === 'string' ? JSON.parse(params[4]) : params[4],
          created_at: params[5],
          created_by_actor_id: params[6],
          status: 'REQUESTED',
        })
        return []
      }
      if (text.includes('INSERT INTO fin.approval_actions')) {
        store.approval_actions.push({
          id: params[0],
          request_id: params[1],
          actor_id: params[2],
          decision: params[3],
          created_at: params[4],
        })
        return []
      }
      if (text.includes('UPDATE fin.approval_requests') && text.includes('SET status')) {
        const row = store.approval_requests.find((r) => r.id === params[0])
        if (row) {
          const statusMatch = text.match(/status = '([A-Z_]+)'/)
          if (statusMatch) row.status = statusMatch[1]
          row.updated_at = params[1]
        }
        return []
      }
      if (text.includes('FROM fin.approval_actions')) {
        return store.approval_actions.filter((a) => String(a.request_id) === String(params[0]))
      }
      return []
    }),
    transaction: vi.fn(async (work) => {
      const outer = txDepth === 0
      if (outer) beginCount += 1
      txDepth += 1
      const snapshot = outer
        ? JSON.parse(JSON.stringify({
          agent_price_reports: store.agent_price_reports,
          pricing_benchmarks: store.pricing_benchmarks,
          pricing_benchmark_snapshots: store.pricing_benchmark_snapshots,
          approval_requests: store.approval_requests,
          approval_actions: store.approval_actions,
          audit_log: store.audit_log,
          outbox_events: store.outbox_events,
          users: store.users,
          agents: store.agents,
          agencies: store.agencies,
        }))
        : null
      try {
        return await work({})
      } catch (err) {
        if (outer && snapshot) {
          for (const [key, rows] of Object.entries(snapshot)) {
            if (!Array.isArray(store[key])) store[key] = []
            store[key].length = 0
            for (const row of rows) store[key].push(row)
          }
        }
        throw err
      } finally {
        txDepth -= 1
      }
    }),
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
    expect(paths).toContain('POST /api/admin/valuation/approval-requests/:id/vote')
    expect(paths).toContain('POST /api/admin/pricing/agent-price-reports/:id/reveal-audit')
    expect(paths).toContain('GET /api/admin/pricing/benchmarks/:segmentId/series')
  })
})


describe('WF-06 second-approver vote + undo tokens', () => {
  let dal
  let service
  let benchmarkService

  beforeEach(() => {
    dal = createMemoryDal({
      agent_price_reports: [],
      pricing_benchmarks: [{
        id: 'bm1',
        segment_id: 'seg_ae_dubai_marina_apt_2',
        price_point: 1600000,
        currency: 'AED',
        env: 'live',
        computed_at: '2026-09-01T00:00:00.000Z',
      }],
    })
    benchmarkService = createBenchmarkService({ dal })
    service = createAgentPriceReportAdminService({ dal, benchmarkService })
  })

  it('issues undo_token_id on signal-only review and undoes with token', async () => {
    dal.store.agent_price_reports.push(seedReport({ id: 'aprt_undo', status: 'pending_review' }))
    const result = await service.reviewReport(
      'aprt_undo',
      { status: 'verified', incorporate: false, notes: 'signal' },
      { viewerId: 'pa-1', env: 'live' },
    )
    expect(result.undo_token_id).toBeTruthy()
    expect(result.undo_expires_at).toBeTruthy()

    const undone = await service.undoReview('aprt_undo', {
      viewerId: 'pa-1',
      env: 'live',
      undoTokenId: result.undo_token_id,
    })
    expect(undone.status).toBe('pending_review')

    await expect(
      service.undoReview('aprt_undo', {
        viewerId: 'pa-1',
        env: 'live',
        undoTokenId: result.undo_token_id,
      }),
    ).rejects.toMatchObject({ code: 'TOKEN_CONSUMED', status: 410 })
  })

  it('second approver approve incorporates; SAME_REVIEWER and TOKEN_CONSUMED enforced', async () => {
    dal.store.agent_price_reports.push(seedReport({
      id: 'aprt_2p',
      status: 'pending_review',
      recommendation_price_point: 2000000,
      sold_price: 2000000,
    }))
    // Force high delta by low benchmark
    dal.store.pricing_benchmarks[0].price_point = 1000000

    const first = await service.reviewReport(
      'aprt_2p',
      { status: 'verified', incorporate: true, notes: 'needs 2p' },
      { viewerId: 'pa-1', env: 'live' },
    )
    expect(first.pending_second_approval).toBe(true)
    const approvalId = first.approval_request_id

    await expect(
      service.castSecondApprovalVote({
        approvalRequestId: approvalId,
        decision: 'approve',
        viewerId: 'pa-1',
        env: 'live',
      }),
    ).rejects.toMatchObject({ code: 'SAME_REVIEWER', status: 409 })

    const approved = await service.castSecondApprovalVote({
      approvalRequestId: approvalId,
      decision: 'approve',
      notes: 'ok',
      viewerId: 'pa-2',
      env: 'live',
    })
    expect(approved.status).toBe('incorporated')

    await expect(
      service.castSecondApprovalVote({
        approvalRequestId: approvalId,
        decision: 'approve',
        viewerId: 'pa-3',
        env: 'live',
      }),
    ).rejects.toMatchObject({ code: 'TOKEN_CONSUMED', status: 410 })
  })

  it('second approver decline returns report to pending_review', async () => {
    dal.store.agent_price_reports.push(seedReport({
      id: 'aprt_dec',
      status: 'pending_review',
      recommendation_price_point: 2000000,
      sold_price: 2000000,
    }))
    dal.store.pricing_benchmarks[0].price_point = 1000000

    const first = await service.reviewReport(
      'aprt_dec',
      { status: 'verified', incorporate: true },
      { viewerId: 'pa-1', env: 'live' },
    )

    const declined = await service.castSecondApprovalVote({
      approvalRequestId: first.approval_request_id,
      decision: 'decline',
      viewerId: 'pa-2',
      env: 'live',
    })
    expect(declined.status).toBe('pending_review')
    const row = dal.store.agent_price_reports.find((r) => r.id === 'aprt_dec')
    expect(row.status).toBe('pending_review')
  })

  it('OWN_CASE when reporter tries to second-vote', async () => {
    dal.store.agent_price_reports.push(seedReport({
      id: 'aprt_own',
      reporter_id: 'agent-user-1',
      status: 'pending_second_approval',
      reviewed_by: 'pa-1',
      reviewed_at: new Date().toISOString(),
      approval_request_id: 'apr-own',
      data: { approval_request_id: 'apr-own' },
    }))
    dal.store.approval_requests.push({
      id: 'apr-own',
      status: 'REQUESTED',
      created_by_actor_id: 'pa-1',
    })

    await expect(
      service.castSecondApprovalVote({
        approvalRequestId: 'apr-own',
        decision: 'approve',
        viewerId: 'agent-user-1',
        env: 'live',
      }),
    ).rejects.toMatchObject({ code: 'OWN_CASE', status: 403 })
  })

  it('approve path commits vote + incorporate + audit + outbox in a single outer txn', async () => {
    dal.store.agent_price_reports.push(seedReport({
      id: 'aprt_atomic',
      status: 'pending_review',
      recommendation_price_point: 2000000,
      sold_price: 2000000,
    }))
    dal.store.pricing_benchmarks[0].price_point = 1000000

    const first = await service.reviewReport(
      'aprt_atomic',
      { status: 'verified', incorporate: true },
      { viewerId: 'pa-1', env: 'live' },
    )
    const beginsBefore = dal.beginCount()

    const approved = await service.castSecondApprovalVote({
      approvalRequestId: first.approval_request_id,
      decision: 'approve',
      notes: 'atomic ok',
      viewerId: 'pa-2',
      env: 'live',
    })

    expect(dal.beginCount() - beginsBefore).toBe(1)
    expect(dal.transaction).toHaveBeenCalled()
    expect(approved.status).toBe('incorporated')
    expect(approved.outbox?.topic).toBe('valuation.price_report_incorporated')
    expect(approved.outbox?.dispatched_at).toBeNull()

    const report = dal.store.agent_price_reports.find((r) => r.id === 'aprt_atomic')
    const approval = dal.store.approval_requests.find((r) => r.id === first.approval_request_id)
    const action = dal.store.approval_actions.find((a) => a.request_id === first.approval_request_id)
    const outbox = dal.store.outbox_events.find((o) => o.topic === 'valuation.price_report_incorporated')

    expect(approval.status).toBe('APPROVED')
    expect(report.status).toBe('incorporated')
    expect(report.data.audit_trail.some((e) => e.action === 'second_approval_approved')).toBe(true)
    expect(action).toBeTruthy()
    expect(outbox).toMatchObject({ status: 'PENDING', dispatched_at: null })
  })

  it('rolls back approve txn when commitIncorporate throws — no approval flip, no action, no audit', async () => {
    dal.store.agent_price_reports.push(seedReport({
      id: 'aprt_inc_fail',
      status: 'pending_review',
      recommendation_price_point: 2000000,
      sold_price: 2000000,
      data: { __force_incorporate_throw: true },
    }))
    dal.store.pricing_benchmarks[0].price_point = 1000000

    const first = await service.reviewReport(
      'aprt_inc_fail',
      { status: 'verified', incorporate: true },
      { viewerId: 'pa-1', env: 'live' },
    )
    // Re-apply failure flag after review (review may rewrite data)
    const pending = dal.store.agent_price_reports.find((r) => r.id === 'aprt_inc_fail')
    pending.data = { ...(pending.data || {}), __force_incorporate_throw: true }

    await expect(
      service.castSecondApprovalVote({
        approvalRequestId: first.approval_request_id,
        decision: 'approve',
        viewerId: 'pa-2',
        env: 'live',
      }),
    ).rejects.toMatchObject({ code: 'INCORPORATE_FAILED' })

    const report = dal.store.agent_price_reports.find((r) => r.id === 'aprt_inc_fail')
    const approval = dal.store.approval_requests.find((r) => r.id === first.approval_request_id)
    expect(report.status).toBe('pending_second_approval')
    expect(approval.status).toBe('REQUESTED')
    // First reviewer is tracked on report.reviewed_by (no self-approval action row).
    // Second vote must not land after incorporate failure.
    expect(
      dal.store.approval_actions.filter(
        (a) => a.request_id === first.approval_request_id && String(a.actor_id) === 'pa-2',
      ),
    ).toHaveLength(0)
    expect(report.data?.audit_trail?.some((e) => e.action === 'second_approval_approved') || false).toBe(false)
    expect(dal.store.outbox_events).toHaveLength(0)
  })

  it('rolls back approve txn when appendAuditEvent throws', async () => {
    dal.store.agent_price_reports.push(seedReport({
      id: 'aprt_audit_fail',
      status: 'pending_review',
      recommendation_price_point: 2000000,
      sold_price: 2000000,
    }))
    dal.store.pricing_benchmarks[0].price_point = 1000000

    const first = await service.reviewReport(
      'aprt_audit_fail',
      { status: 'verified', incorporate: true },
      { viewerId: 'pa-1', env: 'live' },
    )
    const pending = dal.store.agent_price_reports.find((r) => r.id === 'aprt_audit_fail')
    pending.data = { ...(pending.data || {}), __force_audit_write_failure: true }

    await expect(
      service.castSecondApprovalVote({
        approvalRequestId: first.approval_request_id,
        decision: 'approve',
        viewerId: 'pa-2',
        env: 'live',
      }),
    ).rejects.toMatchObject({ code: 'AUDIT_WRITE_FAILED' })

    const report = dal.store.agent_price_reports.find((r) => r.id === 'aprt_audit_fail')
    const approval = dal.store.approval_requests.find((r) => r.id === first.approval_request_id)
    expect(report.status).toBe('pending_second_approval')
    expect(approval.status).toBe('REQUESTED')
    expect(
      dal.store.approval_actions.filter(
        (a) => a.request_id === first.approval_request_id && String(a.actor_id) === 'pa-2',
      ),
    ).toHaveLength(0)
    expect(dal.store.outbox_events).toHaveLength(0)
  })

  it('recordRevealAudit appends pii_revealed audit event', async () => {
    dal.store.agent_price_reports.push(seedReport({ id: 'aprt_pii' }))
    await service.recordRevealAudit('aprt_pii', {
      viewerId: 'pa-1',
      field: 'agent_display_name',
      kind: 'name',
    })
    const row = dal.store.agent_price_reports.find((r) => r.id === 'aprt_pii')
    expect(row.data.audit_trail.some((e) => e.action === 'pii_revealed')).toBe(true)
  })
})

