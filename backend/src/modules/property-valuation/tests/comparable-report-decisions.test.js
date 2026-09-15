import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createComparableReportDecisionService,
  goneReviewBody,
  DecisionError,
  DECISION_ERROR,
  REPORT_ERROR,
  UNDO_GRACE_MS,
  REPORT_ERROR,
  UNDO_GRACE_MS,
  WF05_DECISION_STATUS,
  assertStepUp,
} from '../application/comparable-report-decisions.js'
import {
  createMarketImpactService,
  tierFromImpact,
  MARKET_IMPACT_TIERS,
  estimateRemovalMovePct,
} from '../application/market-impact-service.js'
import { registerAdminRoutes } from '../interface/admin-routes.js'
import { signElevatedToken, ELEVATION_HEADER } from '../../../auth.js'

const logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn(), child: () => logger }

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
  res.setHeader = vi.fn().mockReturnValue(res)
  return res
}

function memoryDal(seed = {}) {
  const store = { ...seed }
  for (const key of Object.keys(store)) {
    if (!Array.isArray(store[key])) store[key] = []
  }
  return {
    store,
    async findOne(collection, filter) {
      return (store[collection] || []).find(filter) || null
    },
    async findAll(collection, filter) {
      return (store[collection] || []).filter(filter || (() => true))
    },
    async insert(collection, item) {
      if (!store[collection]) store[collection] = []
      store[collection].push(item)
      return item
    },
    async update(collection, filter, updater) {
      const rows = store[collection] || []
      for (let i = 0; i < rows.length; i++) {
        if (filter(rows[i])) rows[i] = updater(rows[i])
      }
    },
  }
}

function baseReport(overrides = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    reporter_id: 'reporter-1',
    comparable_id: 'cmp-ext-1',
    comparable_type: 'external',
    reason: 'already_sold',
    notes: null,
    status: 'pending',
    data: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

function makeReq({ userId = 'pa-1', env = 'live', body = {}, elevation = null } = {}) {
  const headers = {}
  if (elevation) headers[ELEVATION_HEADER] = elevation
  return {
    user: { id: userId, email: 'pa@test.local', token_version: 0 },
    sessionEnv: env,
    body,
    params: {},
    headers,
    get: (name) => {
      if (String(name).toLowerCase() === 'x-wingcaster-env') return env
      return headers[String(name).toLowerCase()] || null
    },
  }
}

describe('market-impact scoring', () => {
  it('tiers high when valuations_affected crosses threshold', () => {
    expect(tierFromImpact({ valuationsAffected: 25, pctMoveMedian: 1, pctMoveMax: 2 }))
      .toBe(MARKET_IMPACT_TIERS.HIGH)
  })

  it('tiers high on large median move even with few valuations', () => {
    expect(tierFromImpact({ valuationsAffected: 3, pctMoveMedian: -12, pctMoveMax: -12 }))
      .toBe(MARKET_IMPACT_TIERS.HIGH)
  })

  it('tiers none when nothing is affected', () => {
    expect(tierFromImpact({ valuationsAffected: 0 })).toBe(MARKET_IMPACT_TIERS.NONE)
  })

  it('estimates removal move from weight share', () => {
    const move = estimateRemovalMovePct({
      weight: 0.5,
      totalWeight: 1,
      medianPrice: 100,
      comparablePrice: 150,
    })
    expect(Math.abs(move)).toBeGreaterThan(0)
  })

  it('scores from in-memory evidence via DAL', async () => {
    const dal = memoryDal({
      analysis_comparable_evidence: [
        {
          id: 'e1',
          analysis_run_id: 'run-1',
          property_id: 'p1',
          comparable_id: 'cmp-1',
          comparable_type: 'external',
          weight: 0.4,
          normalized_price: 200,
        },
        {
          id: 'e2',
          analysis_run_id: 'run-1',
          property_id: 'p2',
          comparable_id: 'cmp-1',
          comparable_type: 'external',
          weight: 0.2,
          normalized_price: 180,
        },
      ],
      pricing_analysis_runs: [{ id: 'run-1', calculated_at: new Date().toISOString() }],
      property_price_analyses: [
        { property_id: 'p1', median_price: 150 },
        { property_id: 'p2', median_price: 160 },
      ],
    })
    const service = createMarketImpactService({ dal, logger })
    const impact = await service.scoreComparable({ comparableId: 'cmp-1', comparableType: 'external' })
    expect(impact.valuations_affected).toBe(2)
    expect(impact.affected_property_ids).toEqual(expect.arrayContaining(['p1', 'p2']))
    expect(['low', 'medium', 'high', 'none']).toContain(impact.tier)
  })
})

describe('WF-05 decision service', () => {
  let dal
  let enqueued
  let approvals
  let audits

  beforeEach(() => {
    enqueued = []
    approvals = []
    audits = []
    dal = memoryDal({
      comparable_reports: [baseReport()],
      external_comparables: [{
        id: 'cmp-ext-1',
        source: 'olx',
        status: 'active',
        data: {},
      }],
    })
  })

  function buildService(impactOverride) {
    const marketImpactService = {
      scoreComparable: vi.fn().mockResolvedValue(impactOverride || {
        tier: 'low',
        valuations_affected: 2,
        pct_move_median: 3,
        pct_move_max: 5,
        affected_property_ids: ['prop-a', 'prop-b'],
        requires_two_person: false,
      }),
    }
    return createComparableReportDecisionService({
      dal,
      adapter: {},
      recalculationJobService: {
        enqueue: vi.fn(async (payload, requestedBy) => {
          const job = { id: `job-${enqueued.length + 1}`, status: 'queued', ...payload, requested_by: requestedBy }
          enqueued.push(job)
          return job
        }),
      },
      marketImpactService,
      logger,
      listMemberships: vi.fn().mockResolvedValue([]),
      runTransaction: vi.fn(async (fn) => {
        const client = {
          query: vi.fn(async (sql, params) => {
            if (String(sql).includes('INSERT INTO fin.approval_requests')) {
              approvals.push({ id: params[0], sql, params })
            }
            return { rows: [] }
          }),
        }
        return fn(client)
      }),
      writeAuditFn: vi.fn(async (_client, payload) => {
        audits.push(payload)
      }),
    })
  }

  it('low-impact confirm-remove commits, tombstones, and enqueues recalc', async () => {
    const service = buildService({
      tier: 'low',
      valuations_affected: 2,
      pct_move_median: 3,
      pct_move_max: 4,
      affected_property_ids: ['prop-a', 'prop-b'],
      requires_two_person: false,
    })
    const req = makeReq({ body: { notes: 'Confirmed sold' } })
    const result = await service.confirmRemove({
      req,
      reportId: baseReport().id,
      notes: 'Confirmed sold',
    })
    expect(result.httpStatus).toBe(202)
    expect(result.body.status).toBe(WF05_DECISION_STATUS.CONFIRMED_REMOVED)
    expect(enqueued).toHaveLength(2)
    expect(approvals).toHaveLength(0)
    const ec = await dal.findOne('external_comparables', (r) => r.id === 'cmp-ext-1')
    expect(ec.status).toBe('removed')
    expect(audits.some((a) => a.action === 'COMPARABLE_REPORT_CONFIRMED_REMOVED')).toBe(true)
  })

  it('high-impact confirm-remove creates approval_request without recalc', async () => {
    const service = buildService({
      tier: 'high',
      valuations_affected: 34,
      pct_move_median: -11.2,
      pct_move_max: -18.7,
      affected_property_ids: ['p1', 'p2', 'p3'],
      requires_two_person: true,
    })
    const elevation = signElevatedToken({ userId: 'pa-1', tokenVersion: 0 })
    const req = makeReq({ elevation })
    const result = await service.confirmRemove({
      req,
      reportId: baseReport().id,
      notes: 'High impact removal proposal',
    })
    expect(result.httpStatus).toBe(202)
    expect(result.body.decision).toBe('REMOVE_PROPOSED')
    expect(result.body.status).toBe(WF05_DECISION_STATUS.REMOVE_PROPOSED)
    expect(result.body.approval_request_id).toBeTruthy()
    expect(result.body.recalculation_deferred).toBe(true)
    expect(enqueued).toHaveLength(0)
    expect(approvals).toHaveLength(1)
    const ec = await dal.findOne('external_comparables', (r) => r.id === 'cmp-ext-1')
    expect(ec.status).toBe('active')
    const report = await dal.findOne('comparable_reports', (r) => r.id === baseReport().id)
    expect(report.status).toBe('remove_proposed')
  })

  it('high-impact confirm-remove requires step-up', async () => {
    const service = buildService({
      tier: 'high',
      valuations_affected: 30,
      pct_move_median: -12,
      pct_move_max: -15,
      affected_property_ids: ['p1'],
      requires_two_person: true,
    })
    const req = makeReq()
    await expect(service.confirmRemove({
      req,
      reportId: baseReport().id,
      notes: 'needs step-up',
    })).rejects.toMatchObject({
      code: DECISION_ERROR.STEP_UP_REQUIRED,
      httpStatus: 401,
    })
    expect(enqueued).toHaveLength(0)
    expect(approvals).toHaveLength(0)
  })

  it('confirm-quarantine sets confirmed_quarantined with hours window', async () => {
    const service = buildService()
    const result = await service.confirmQuarantine({
      req: makeReq(),
      reportId: baseReport().id,
      notes: 'Hold while agency fixes',
      quarantineHours: 48,
    })
    expect(result.httpStatus).toBe(200)
    expect(result.body.status).toBe(WF05_DECISION_STATUS.CONFIRMED_QUARANTINED)
    expect(result.body.quarantine_hours).toBe(48)
    const ec = await dal.findOne('external_comparables', (r) => r.id === 'cmp-ext-1')
    expect(ec.status).toBe('quarantined')
  })

  it('reject-as-invalid requires reason_code + notes', async () => {
    const service = buildService()
    await expect(service.rejectAsInvalid({
      req: makeReq(),
      reportId: baseReport().id,
      reasonCode: 'comparable_correct',
      notes: 'ok',
    })).rejects.toMatchObject({ code: DECISION_ERROR.INVALID_INPUT })

    const result = await service.rejectAsInvalid({
      req: makeReq(),
      reportId: baseReport().id,
      reasonCode: 'comparable_correct',
      notes: 'Comparable matches portal evidence',
    })
    expect(result.body.status).toBe(WF05_DECISION_STATUS.REJECTED)
    expect(enqueued).toHaveLength(0)
  })

  it('request-info sets awaiting_info with requested_evidence', async () => {
    const service = buildService()
    const result = await service.requestInfo({
      req: makeReq(),
      reportId: baseReport().id,
      reasonCode: 'need_sale_record',
      notes: 'Please attach the DLD sale record',
      requestedEvidence: ['sale_record', 'portal_screenshot'],
    })
    expect(result.body.status).toBe(WF05_DECISION_STATUS.AWAITING_INFO)
    expect(result.body.requested_evidence).toEqual(['sale_record', 'portal_screenshot'])
  })

  it('blocks own-case decisions with 403', async () => {
    dal = memoryDal({
      comparable_reports: [baseReport({ reporter_id: 'pa-1' })],
      external_comparables: [{ id: 'cmp-ext-1', status: 'active', data: {} }],
    })
    const service = buildService()
    await expect(service.confirmRemove({
      req: makeReq({ userId: 'pa-1' }),
      reportId: baseReport().id,
      notes: 'should fail',
    })).rejects.toMatchObject({
      code: DECISION_ERROR.OWN_CASE,
      httpStatus: 403,
    })
  })

  it('goneReviewBody points at the four WF-05 endpoints', () => {
    const body = goneReviewBody()
    expect(body.code).toBe('GONE')
    expect(body.migrate_to_endpoints).toHaveLength(4)
    expect(body.migrate_to).toContain('confirm-remove')
  })
})

describe('WF-05 admin route registration', () => {
  it('registers decision endpoints and keeps legacy review as 410', async () => {
    const { app, routes } = fakeExpress()
    registerAdminRoutes(app, {
      configService: {},
      currencyService: {},
      comparableService: {},
      analysisService: {},
      trendService: {},
      scraperService: {},
      recalculationJobService: { enqueue: vi.fn() },
      dal: memoryDal({ comparable_reports: [] }),
      adapter: {},
      logger,
    })

    const paths = routes.map((r) => `${r.method.toUpperCase()} ${r.path}`)
    expect(paths).toContain('POST /api/admin/pricing/reports/:id/review')
    expect(paths).toContain('POST /api/admin/pricing/reports/:reportId/confirm-remove')
    expect(paths).toContain('POST /api/admin/pricing/reports/:reportId/confirm-quarantine')
    expect(paths).toContain('POST /api/admin/pricing/reports/:reportId/reject-as-invalid')
    expect(paths).toContain('POST /api/admin/pricing/reports/:reportId/request-info')

    const review = routes.find((r) => r.path === '/api/admin/pricing/reports/:id/review')
    const handler = review.handlers[review.handlers.length - 1]
    const req = makeReq({ body: { status: 'reviewed' } })
    // Bypass auth middleware in unit harness
    req.user = { id: 'pa-1', platform_role: 'platform_admin', env: 'live' }
    const res = mockRes()
    await handler(req, res, (err) => { throw err })
    expect(res.status).toHaveBeenCalledWith(410)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'GONE' }))
  })

  it('confirm-remove route delegates to decision service', async () => {
    const { app, routes } = fakeExpress()
    const decisionService = {
      confirmRemove: vi.fn().mockResolvedValue({
        httpStatus: 202,
        body: { success: true, status: 'confirmed_removed' },
      }),
    }
    registerAdminRoutes(app, {
      configService: {},
      currencyService: {},
      comparableService: {},
      analysisService: {},
      trendService: {},
      scraperService: {},
      recalculationJobService: {},
      decisionService,
      marketImpactService: { scoreComparable: vi.fn() },
      dal: memoryDal(),
      adapter: {},
      logger,
    })
    const route = routes.find((r) => r.path === '/api/admin/pricing/reports/:reportId/confirm-remove')
    const handler = route.handlers[route.handlers.length - 1]
    const req = makeReq({ body: { notes: 'ok' } })
    req.params = { reportId: 'rep-1' }
    req.user = { id: 'pa-1', platform_role: 'platform_admin', env: 'live' }
    const res = mockRes()
    await handler(req, res, (err) => { throw err })
    expect(decisionService.confirmRemove).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(202)
  })
})

describe('assertStepUp', () => {
  it('throws DecisionError when elevation missing', () => {
    expect(() => assertStepUp(makeReq())).toThrow(DecisionError)
  })
})

describe('WF-05 bulk / undo / affected (Agent 6)', () => {
  const logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn(), child: () => logger }

  it('bulkRejectAsInvalid returns 207 with OWN_CASE and ALREADY_DECIDED failures', async () => {
    const dal = memoryDal({
      comparable_reports: [
        baseReport({ id: 'ok-1' }),
        baseReport({ id: 'own-1', reporter_id: 'pa-1' }),
        baseReport({ id: 'done-1', status: 'rejected' }),
        baseReport({ id: 'ok-2', comparable_id: 'cmp-2' }),
      ],
    })
    let clock = Date.parse('2026-09-08T12:00:00.000Z')
    const service = createComparableReportDecisionService({ dal, now: () => clock, logger })
    const result = await service.bulkRejectAsInvalid({
      report_ids: ['ok-1', 'own-1', 'done-1', 'ok-2', 'missing-1'],
      reason_code: 'insufficient_evidence',
      notes: 'Need stronger proof of sale.',
      actorId: 'pa-1',
    })
    expect(result.status).toBe(207)
    expect(result.body.succeeded.map((r) => r.id).sort()).toEqual(['ok-1', 'ok-2'])
    expect(result.body.succeeded.every((r) => r.status === 'rejected')).toBe(true)
    expect(result.body.failed).toEqual(expect.arrayContaining([
      { id: 'own-1', error: REPORT_ERROR.OWN_CASE },
      { id: 'done-1', error: REPORT_ERROR.ALREADY_DECIDED },
      { id: 'missing-1', error: REPORT_ERROR.NOT_FOUND },
    ]))
  })

  it('undoDecision restores within grace and refuses after', async () => {
    let clock = Date.parse('2026-09-08T12:00:00.000Z')
    const dal = memoryDal({ comparable_reports: [baseReport({ id: 'undo-1' })], audit_log: [] })
    const service = createComparableReportDecisionService({
      dal,
      now: () => clock,
      logger,
      runTransaction: async (fn) => fn({ query: async () => ({ rows: [] }) }),
    })
    await service.bulkRejectAsInvalid({
      report_ids: ['undo-1'],
      reason_code: 'out_of_scope',
      notes: 'Out of geographic scope for this queue.',
      actorId: 'pa-3',
    })
    clock += 1000
    const restored = await service.undoDecision('undo-1', { actorId: 'pa-3' })
    expect(restored.status).toBe('pending')

    await service.bulkRejectAsInvalid({
      report_ids: ['undo-1'],
      reason_code: 'other',
      notes: 'Rejecting after second review pass.',
      actorId: 'pa-3',
    })
    clock += UNDO_GRACE_MS + 1
    await expect(service.undoDecision('undo-1')).rejects.toMatchObject({
      code: REPORT_ERROR.UNDO_EXPIRED,
    })
  })

  it('listAffectedValuations paginates properties referencing the comparable', async () => {
    const dal = memoryDal({
      comparable_reports: [baseReport({ id: 'aff-1', comparable_id: 'cmp-shared', comparable_type: 'external' })],
      analysis_comparable_evidence: [
        { id: 'e1', property_id: 'p1', comparable_id: 'cmp-shared', comparable_type: 'external', weight: 0.4 },
        { id: 'e2', property_id: 'p2', comparable_id: 'cmp-shared', comparable_type: 'external', weight: 0.3 },
      ],
      property_price_analyses: [
        { id: 'a1', property_id: 'p1', median_price: 100 },
        { id: 'a2', property_id: 'p2', median_price: 120 },
      ],
      properties: [
        { id: 'p1', title: 'One', city: 'Dubai' },
        { id: 'p2', title: 'Two', city: 'Dubai' },
      ],
    })
    const service = createComparableReportDecisionService({ dal, logger })
    const page1 = await service.listAffectedValuations('aff-1', { page: 1, pageSize: 1 })
    expect(page1.pagination.total).toBe(2)
    expect(page1.items).toHaveLength(1)
  })

  it('registers bulk/undo/affected routes before :reportId and keeps review at 410', async () => {
    const { app, routes } = fakeExpress()
    registerAdminRoutes(app, {
      configService: {},
      currencyService: {},
      comparableService: {},
      analysisService: {},
      trendService: {},
      scraperService: {},
      recalculationJobService: {},
      decisionService: {
        bulkRejectAsInvalid: vi.fn(),
        bulkRequestInfo: vi.fn(),
        undoDecision: vi.fn(),
        listAffectedValuations: vi.fn(),
        confirmRemove: vi.fn(),
        confirmQuarantine: vi.fn(),
        rejectAsInvalid: vi.fn(),
        requestInfo: vi.fn(),
      },
      marketImpactService: { scoreComparable: vi.fn() },
      dal: memoryDal(),
      adapter: {},
      logger,
    })
    const paths = routes.map((r) => `${r.method.toUpperCase()} ${r.path}`)
    expect(paths).toContain('POST /api/admin/pricing/reports/bulk-reject-as-invalid')
    expect(paths).toContain('POST /api/admin/pricing/reports/bulk-request-info')
    expect(paths).toContain('POST /api/admin/pricing/reports/:reportId/undo-decision')
    expect(paths).toContain('GET /api/admin/pricing/reports/:reportId/affected-valuations')
    const bulkIdx = paths.indexOf('POST /api/admin/pricing/reports/bulk-reject-as-invalid')
    const idIdx = paths.findIndex((p) => p.includes('/:reportId/confirm-remove'))
    expect(bulkIdx).toBeGreaterThanOrEqual(0)
    expect(idIdx).toBeGreaterThan(bulkIdx)

    const review = routes.find((r) => r.path === '/api/admin/pricing/reports/:id/review')
    const handler = review.handlers[review.handlers.length - 1]
    const req = makeReq({ body: { status: 'reviewed' } })
    req.user = { id: 'pa-1', platform_role: 'platform_admin', env: 'live' }
    const res = mockRes()
    await handler(req, res, (err) => { throw err })
    expect(res.status).toHaveBeenCalledWith(410)
  })
})


describe('WF-05 undoDecision audit rows (PR #130 follow-up)', () => {
  const logger = {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    child: () => logger,
  }
  const memTx = async (fn) => fn({ query: async () => ({ rows: [] }) })

  function decidedReport(overrides = {}) {
    const decidedAt = '2026-09-08T12:00:00.000Z'
    const undo = {
      undo_token_id: 'tok-1',
      undo_expires_at: new Date(Date.parse(decidedAt) + UNDO_GRACE_MS).toISOString(),
      undo_consumed: false,
    }
    return baseReport({
      id: 'undo-audit-1',
      status: 'rejected',
      reviewed_by: 'pa-3',
      reviewed_at: decidedAt,
      data: {
        ...undo,
        decision: {
          action: 'reject_as_invalid',
          decided_by: 'pa-3',
          decided_at: decidedAt,
          previous_status: 'pending',
          previous_data: {},
          undo_token_id: undo.undo_token_id,
          undo_expires_at: undo.undo_expires_at,
        },
      },
      ...overrides,
    })
  }

  it('successful undo writes one audit row with outcome reverted', async () => {
    let clock = Date.parse('2026-09-08T12:00:01.000Z')
    const dal = memoryDal({ comparable_reports: [decidedReport()], audit_log: [] })
    const service = createComparableReportDecisionService({ dal, now: () => clock, logger, runTransaction: memTx })
    await service.undoDecision('undo-audit-1', {
      actorId: 'pa-3',
      undoTokenId: 'tok-1',
      requestIp: '1.2.3.4',
      userAgent: 'vitest',
    })
    const audits = dal.store.audit_log
    expect(audits).toHaveLength(1)
    expect(audits[0].type).toBe('comparable_report_undo_attempt')
    expect(audits[0].metadata.outcome).toBe('reverted')
    expect(audits[0].entity_id).toBe('undo-audit-1')
  })

  it('expired token → 410 + audit outcome expired', async () => {
    let clock = Date.parse('2026-09-08T12:00:00.000Z') + UNDO_GRACE_MS + 1
    const dal = memoryDal({ comparable_reports: [decidedReport()], audit_log: [] })
    const service = createComparableReportDecisionService({ dal, now: () => clock, logger, runTransaction: memTx })
    await expect(
      service.undoDecision('undo-audit-1', { actorId: 'pa-3', undoTokenId: 'tok-1' }),
    ).rejects.toMatchObject({ code: REPORT_ERROR.UNDO_EXPIRED, httpStatus: 410 })
    expect(dal.store.audit_log).toHaveLength(1)
    expect(dal.store.audit_log[0].metadata.outcome).toBe('expired')
  })

  it('token consumed by recalc commit → 409 + audit outcome token_consumed', async () => {
    const dal = memoryDal({
      comparable_reports: [
        decidedReport({
          data: {
            undo_token_id: 'tok-1',
            undo_expires_at: new Date(Date.now() + 60_000).toISOString(),
            undo_consumed: false,
            decision: {
              action: 'confirm_remove',
              decided_by: 'pa-3',
              decided_at: new Date().toISOString(),
              previous_status: 'pending',
              previous_data: {},
              recalc_job_id: 'job-1',
              undo_token_id: 'tok-1',
            },
          },
        }),
      ],
      audit_log: [],
    })
    const service = createComparableReportDecisionService({
      dal,
      logger,
      runTransaction: memTx,
      recalculationJobService: {
        get: vi.fn(async () => ({ id: 'job-1', status: 'succeeded' })),
      },
    })
    await expect(
      service.undoDecision('undo-audit-1', { actorId: 'pa-3', undoTokenId: 'tok-1' }),
    ).rejects.toMatchObject({ code: REPORT_ERROR.RECALC_COMMITTED, httpStatus: 409 })
    expect(dal.store.audit_log[0].metadata.outcome).toBe('token_consumed')
  })

  it('wrong reviewer and own-case rejections write audit rows', async () => {
    const dalWrong = memoryDal({ comparable_reports: [decidedReport()], audit_log: [] })
    let clock = Date.parse('2026-09-08T12:00:01.000Z')
    const svcWrong = createComparableReportDecisionService({ dal: dalWrong, now: () => clock, logger, runTransaction: memTx })
    await expect(
      svcWrong.undoDecision('undo-audit-1', { actorId: 'other-pa', undoTokenId: 'tok-1' }),
    ).rejects.toMatchObject({ code: REPORT_ERROR.SAME_REVIEWER, httpStatus: 409 })
    expect(dalWrong.store.audit_log[0].metadata.outcome).toBe('wrong_reviewer')

    const dalOwn = memoryDal({
      comparable_reports: [decidedReport({ reporter_id: 'pa-3' })],
      audit_log: [],
    })
    const svcOwn = createComparableReportDecisionService({ dal: dalOwn, now: () => clock, logger, runTransaction: memTx })
    await expect(
      svcOwn.undoDecision('undo-audit-1', { actorId: 'pa-3', undoTokenId: 'tok-1' }),
    ).rejects.toMatchObject({ code: REPORT_ERROR.OWN_CASE, httpStatus: 403 })
    expect(dalOwn.store.audit_log[0].metadata.outcome).toBe('own_case')
  })

  it('audit-insert failure surfaces 5xx and logs at alert level', async () => {
    const dal = memoryDal({ comparable_reports: [decidedReport()], audit_log: [] })
    const origInsert = dal.insert.bind(dal)
    dal.insert = async (collection, item) => {
      if (collection === 'audit_log') throw new Error('audit down')
      return origInsert(collection, item)
    }
    let clock = Date.parse('2026-09-08T12:00:01.000Z')
    const service = createComparableReportDecisionService({ dal, now: () => clock, logger, runTransaction: memTx })
    await expect(
      service.undoDecision('undo-audit-1', { actorId: 'pa-3', undoTokenId: 'tok-1' }),
    ).rejects.toMatchObject({ httpStatus: 500, code: 'AUDIT_WRITE_FAILED' })
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ alert: true }),
      expect.stringMatching(/undo_attempt audit insert failed/i),
    )
  })
})

describe('WF-05 castSecondApprovalVote atomicity Option A (PR #130 follow-up)', () => {
  const logger = {
    warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn(), child: () => logger,
  }

  function proposedReport() {
    return baseReport({
      id: 'apr-1',
      status: 'remove_proposed',
      reviewed_by: 'pa-proposer',
      approval_request_id: 'apreq-1',
      comparable_id: 'cmp-ext-1',
      comparable_type: 'external',
      data: { approval_request_id: 'apreq-1' },
    })
  }

  function buildAtomicService({ throwInFinalize = false, throwAfterCommit = false, outboxRows }) {
    const dal = memoryDal({
      comparable_reports: [proposedReport()],
      external_comparables: [{ id: 'cmp-ext-1', status: 'active', data: {} }],
      audit_log: [],
    })
    const enqueued = []
    const runTransaction = vi.fn(async (fn) => {
      const snapshot = structuredClone(dal.store)
      const client = {
        query: vi.fn(async () => ({ rows: [] })),
      }
      try {
        return await fn(client)
      } catch (err) {
        for (const key of Object.keys(dal.store)) delete dal.store[key]
        Object.assign(dal.store, structuredClone(snapshot))
        throw err
      }
    })
    const marketImpactService = {
      scoreComparable: vi.fn(async () => {
        if (throwInFinalize) throw new Error('finalize boom')
        return {
          tier: 'high',
          valuations_affected: 3,
          pct_move_median: -10,
          pct_move_max: -12,
          affected_property_ids: ['p1', 'p2'],
          requires_two_person: true,
        }
      }),
    }
    const service = createComparableReportDecisionService({
      dal,
      logger,
      marketImpactService,
      runTransaction,
      writeAuditFn: vi.fn(async () => {}),
      insertOutboxFn: vi.fn(async (_client, row) => {
        const entry = {
          id: row.id || 'obx-1',
          topic: row.topic,
          dedupe_key: row.dedupeKey,
          payload: row.payload,
          status: 'PENDING',
          dispatched_at: null,
          published_at: null,
        }
        outboxRows.push(entry)
        return entry
      }),
      afterCommitBeforeDispatch: throwAfterCommit
        ? async () => { throw new Error('post-commit boom') }
        : null,
      recalculationJobService: {
        enqueue: vi.fn(async (payload, requestedBy) => {
          const job = { id: `job-${enqueued.length + 1}`, status: 'queued', ...payload, requested_by: requestedBy }
          enqueued.push(job)
          return job
        }),
      },
    })
    return { service, dal, enqueued, outboxRows, runTransaction }
  }

  it('happy path approve finalizes and dispatches outbox recalc', async () => {
    const outboxRows = []
    const { service, dal, enqueued } = buildAtomicService({ outboxRows })
    const result = await service.castSecondApprovalVote({
      approvalRequestId: 'apreq-1',
      decision: 'approve',
      viewerId: 'pa-second',
      viewerEmail: 'second@test.local',
      notes: 'Second look confirms removal',
      env: 'live',
    })
    expect(result.status).toBe('confirmed_removed')
    expect(dal.store.comparable_reports[0].status).toBe('confirmed_removed')
    expect(dal.store.external_comparables[0].status).toBe('removed')
    expect(outboxRows[0].status).toBe('PUBLISHED')
    expect(outboxRows[0].dispatched_at).toBeTruthy()
    expect(enqueued.length).toBe(2)
  })

  it('throw between commit and enqueue leaves outbox PENDING; poll dispatches', async () => {
    const outboxRows = []
    const { service, dal, enqueued } = buildAtomicService({ throwAfterCommit: true, outboxRows })
    await expect(
      service.castSecondApprovalVote({
        approvalRequestId: 'apreq-1',
        decision: 'approve',
        viewerId: 'pa-second',
        env: 'live',
      }),
    ).rejects.toThrow(/post-commit boom/)
    expect(dal.store.comparable_reports[0].status).toBe('confirmed_removed')
    expect(outboxRows).toHaveLength(1)
    expect(outboxRows[0].dispatched_at).toBeNull()
    expect(outboxRows[0].status).toBe('PENDING')
    expect(enqueued).toHaveLength(0)

    // Follow-up poll / dispatch recovers the outbox
    const jobs = await service.dispatchComparableRemovedOutbox({
      propertyIds: outboxRows[0].payload.property_ids,
      requestedBy: 'pa-second',
      outboxRow: outboxRows[0],
    })
    expect(jobs).toHaveLength(2)
    expect(outboxRows[0].dispatched_at).toBeTruthy()
    expect(outboxRows[0].status).toBe('PUBLISHED')
  })

  it('throw inside finalize rolls back — no partial state', async () => {
    const outboxRows = []
    const { service, dal, enqueued } = buildAtomicService({ throwInFinalize: true, outboxRows })
    await expect(
      service.castSecondApprovalVote({
        approvalRequestId: 'apreq-1',
        decision: 'approve',
        viewerId: 'pa-second',
        env: 'live',
      }),
    ).rejects.toThrow(/finalize boom/)
    expect(dal.store.comparable_reports[0].status).toBe('remove_proposed')
    expect(dal.store.external_comparables[0].status).toBe('active')
    expect(outboxRows).toHaveLength(0)
    expect(enqueued).toHaveLength(0)
  })
})
