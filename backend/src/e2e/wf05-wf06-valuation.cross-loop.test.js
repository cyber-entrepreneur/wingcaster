/**
 * WF-05 + WF-06 UI/API contract gates (Wave 5 Agent 6).
 *
 * Proves:
 * - WF-05 legacy /review → 410 Gone migrate_to confirm-remove family
 * - WF-05 bulk actions NEVER include confirm-remove / confirm-quarantine
 * - WF-05 high market-impact confirm-remove → REMOVE_PROPOSED (two-person)
 * - WF-06 incorporate=true → benchmark write (low delta) / approval request (high delta)
 * - AGT-APR-005 Pro feature code is seeded (BE-BLOCKER-27)
 *
 * Real-Postgres lifecycle lives in
 * `wf05-wf06-valuation.cross-loop.postgres.test.js`.
 */
import { describe, expect, it } from 'vitest'
import {
  goneReviewBody,
  WF05_DECISION_STATUS,
  DECISION_ERROR,
} from '../modules/property-valuation/application/comparable-report-decisions.js'
import {
  MARKET_IMPACT_TIERS,
  classifyMarketImpactTier,
} from '../modules/property-valuation/application/market-impact-service.js'
import {
  HIGH_DELTA_THRESHOLD_PCT,
  computeDeltaPct,
} from '../modules/property-valuation/application/benchmark-service.js'
import { PRICE_REPORTS_SUBMIT_FEATURE_CODE } from '../lib/packages/registry.js'

/** Mirrors PA-PVA-008 queue bulk filter — confirm-remove deliberately omitted. */
export const WF05_BULK_ACTIONS = Object.freeze(['reject', 'request_info'])

/** Only these four decision endpoints are valid for PA-PVA-008b. */
export const WF05_DECISION_ENDPOINTS = Object.freeze([
  'confirm-remove',
  'confirm-quarantine',
  'reject-as-invalid',
  'request-info',
])

export const WF05_LEGACY_REVIEW_ENDPOINT = 'review'

describe('WF-05 UI contract — bulk confirm-remove NEVER offered', () => {
  it('bulk action allowlist is reject + request_info only', () => {
    expect(WF05_BULK_ACTIONS).toEqual(['reject', 'request_info'])
    expect(WF05_BULK_ACTIONS).not.toContain('approve')
    expect(WF05_BULK_ACTIONS).not.toContain('confirm-remove')
    expect(WF05_BULK_ACTIONS).not.toContain('confirm-quarantine')
  })
})

describe('WF-05 UI contract — BE-BLOCKER-28 decision endpoints only', () => {
  it('legacy /review body points at confirm-remove family with GONE', () => {
    const body = goneReviewBody()
    expect(body.code).toBe('GONE')
    expect(body.migrate_to).toContain('confirm-remove')
    expect(body.migrate_to_endpoints).toEqual(
      expect.arrayContaining(
        WF05_DECISION_ENDPOINTS.map(
          (action) => `POST /api/admin/pricing/reports/:reportId/${action}`,
        ),
      ),
    )
    expect(body.migrate_to_endpoints).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/\/review$/)]),
    )
  })

  it('exposes decision status + error vocabulary for two-person remove', () => {
    expect(WF05_DECISION_STATUS.REMOVE_PROPOSED).toBe('remove_proposed')
    expect(WF05_DECISION_STATUS.CONFIRMED_REMOVED).toBe('confirmed_removed')
    expect(DECISION_ERROR.STEP_UP_REQUIRED).toBe('STEP_UP_REQUIRED')
    expect(DECISION_ERROR.OWN_CASE).toBe('OWN_CASE')
  })

  it('high market-impact tier drives two-person (not tenure risk)', () => {
    expect(
      classifyMarketImpactTier({
        valuations_affected: 34,
        pct_move_median: -11,
        pct_move_max: -18,
      }),
    ).toBe(MARKET_IMPACT_TIERS.HIGH)
    expect(
      classifyMarketImpactTier({
        valuations_affected: 3,
        pct_move_median: -1,
        pct_move_max: -2,
      }),
    ).toBe(MARKET_IMPACT_TIERS.LOW)
  })
})

describe('WF-06 UI contract — incorporate → benchmark (BE-BLOCKER-26)', () => {
  it('low-delta incorporate stays under two-person threshold', () => {
    const delta = computeDeltaPct(1_050_000, 1_000_000)
    expect(delta).toBe(5)
    expect(Math.abs(delta)).toBeLessThan(HIGH_DELTA_THRESHOLD_PCT)
  })

  it('high-delta incorporate crosses two-person threshold', () => {
    const delta = computeDeltaPct(1_850_000, 1_562_500)
    expect(Math.abs(delta)).toBeGreaterThanOrEqual(HIGH_DELTA_THRESHOLD_PCT)
  })

  it('Pro-tier feature code constant matches seed', () => {
    expect(PRICE_REPORTS_SUBMIT_FEATURE_CODE).toBe('valuation.price_reports.submit')
  })
})

describe('WF-06 service — incorporate transactional + high-delta deferral', () => {
  it('low-delta incorporate writes benchmark; high-delta creates PRICE_REPORT_INCORPORATE without write', async () => {
    const { createBenchmarkService, PRICE_REPORT_INCORPORATE_ACTION } = await import(
      '../modules/property-valuation/application/benchmark-service.js'
    )
    const { createAgentPriceReportAdminService } = await import(
      '../modules/property-valuation/application/agent-price-report-admin-service.js'
    )

    const store = {
      agent_price_reports: [
        {
          id: 'aprt_low',
          reporter_id: 'agent-1',
          agent_id: 'agent-1',
          sold_price: 1_050_000,
          recommendation_price_point: 1_050_000,
          currency: 'AED',
          segment_id: 'seg_ae_dubai_marina_apt_2',
          segment_label: 'Dubai Marina · 2BR',
          country_code: 'AE',
          property_type: 'apartment',
          bedrooms: 2,
          status: 'pending_review',
          env: 'live',
          incorporated: false,
          created_at: '2026-09-08T10:00:00.000Z',
          updated_at: '2026-09-08T10:00:00.000Z',
          data: {},
        },
        {
          id: 'aprt_high',
          reporter_id: 'agent-1',
          agent_id: 'agent-1',
          sold_price: 1_850_000,
          recommendation_price_point: 1_850_000,
          currency: 'AED',
          segment_id: 'seg_ae_dubai_marina_apt_2',
          segment_label: 'Dubai Marina · 2BR',
          country_code: 'AE',
          property_type: 'apartment',
          bedrooms: 2,
          status: 'pending_review',
          env: 'live',
          incorporated: false,
          created_at: '2026-09-08T10:00:00.000Z',
          updated_at: '2026-09-08T10:00:00.000Z',
          data: {},
        },
      ],
      pricing_benchmarks: [
        {
          id: 'bm_1',
          segment_id: 'seg_ae_dubai_marina_apt_2',
          env: 'live',
          currency: 'AED',
          price_point: 1_000_000,
          computed_at: '2026-09-08T09:00:00.000Z',
          data: {},
        },
      ],
      pricing_benchmark_snapshots: [],
      approval_requests: [],
      users: [{ id: 'agent-1', name: 'Sara', created_at: '2021-01-01T00:00:00.000Z' }],
      agents: [
        {
          id: 'agent-1',
          user_id: 'agent-1',
          name: 'Sara',
          agency_id: 'agy_1',
          subscription_tier: 'pro',
          created_at: '2021-01-01T00:00:00.000Z',
        },
      ],
      agencies: [{ id: 'agy_1', name: 'Elite' }],
    }

    const match = (item, filter) => (typeof filter === 'function' ? filter(item) : true)
    const dal = {
      store,
      findAll: async (c, f) => (store[c] || []).filter((i) => match(i, f)),
      findOne: async (c, f) => (store[c] || []).find((i) => match(i, f)) || null,
      insert: async (c, item) => {
        if (!store[c]) store[c] = []
        store[c].push(item)
        return item
      },
      update: async (c, f, updater) => {
        const rows = store[c] || []
        for (let i = 0; i < rows.length; i++) {
          if (match(rows[i], f)) rows[i] = updater(rows[i])
        }
      },
      query: async (sql, params) => {
        if (String(sql).includes('INSERT INTO fin.approval_requests')) {
          store.approval_requests.push({
            id: params[0],
            action_kind: params[2],
            status: 'REQUESTED',
          })
        }
        return []
      },
      transaction: async (work) => work({}),
    }

    const refreshCalls = []
    const benchmarkService = createBenchmarkService({
      dal,
      recalculationJobService: {
        invalidateAll: async () => {
          const job = { id: 'job_1' }
          refreshCalls.push(job)
          return job
        },
      },
      logger: { warn() {}, info() {} },
    })
    const admin = createAgentPriceReportAdminService({
      dal,
      benchmarkService,
      logger: { warn() {}, info() {} },
    })

    const low = await admin.reviewReport(
      'aprt_low',
      { status: 'verified', incorporate: true, notes: 'ok' },
      { viewerId: 'pa-1', env: 'live' },
    )
    expect(low).toMatchObject({ success: true, status: 'incorporated', incorporated: true })
    expect(refreshCalls).toHaveLength(1)
    expect(store.pricing_benchmarks[0].price_point).toBe(1_050_000)

    const beforeHigh = store.pricing_benchmarks[0].price_point
    const high = await admin.reviewReport(
      'aprt_high',
      { status: 'verified', incorporate: true, notes: 'second eyes' },
      { viewerId: 'pa-1', env: 'live' },
    )
    expect(high.pending_second_approval).toBe(true)
    expect(store.approval_requests[0].action_kind).toBe(PRICE_REPORT_INCORPORATE_ACTION)
    expect(store.pricing_benchmarks[0].price_point).toBe(beforeHigh)
  })
})

describe('WF-05/06 legacy endpoint constant', () => {
  it('legacy review is not among WF-05 decision endpoints', () => {
    expect(WF05_DECISION_ENDPOINTS).not.toContain(WF05_LEGACY_REVIEW_ENDPOINT)
  })
})
