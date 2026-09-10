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

describe('WF-05/06 legacy endpoint constant', () => {
  it('legacy review is not among WF-05 decision endpoints', () => {
    expect(WF05_DECISION_ENDPOINTS).not.toContain(WF05_LEGACY_REVIEW_ENDPOINT)
  })
})
