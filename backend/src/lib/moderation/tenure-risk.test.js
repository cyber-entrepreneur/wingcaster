import { describe, expect, it } from 'vitest'
import scoreTenureRiskDefault, {
  TENURE_RISK_TIERS,
  isStepUpRequired,
  isTwoPersonRejectRequired,
  scoreTenureRisk,
  tenureRiskLabel,
} from './tenure-risk.js'
import {
  TENURE_RISK_TIERS as TiersFromBarrel,
  scoreTenureRisk as scoreFromBarrel,
  tenureRiskLabel as labelFromBarrel,
} from './index.js'

const UNKNOWN = {
  tier: 'unknown',
  score: null,
  signals: [],
  version: 'v1-stub',
}

describe('scoreTenureRisk (v1 stub)', () => {
  it('named, default, and barrel exports agree', () => {
    expect(scoreTenureRisk).toBe(scoreTenureRiskDefault)
    expect(scoreFromBarrel).toBe(scoreTenureRisk)
    expect(TiersFromBarrel).toEqual(TENURE_RISK_TIERS)
    expect(labelFromBarrel).toBe(tenureRiskLabel)
  })

  it('returns unknown for empty input', () => {
    expect(scoreTenureRisk({})).toEqual(UNKNOWN)
    expect(scoreTenureRisk()).toEqual(UNKNOWN)
    expect(scoreTenureRisk(undefined)).toEqual(UNKNOWN)
    expect(scoreTenureRisk(null)).toEqual(UNKNOWN)
  })

  it('returns unknown for a richly populated agent + submission (v1 must not score)', () => {
    const result = scoreTenureRisk({
      agent: {
        id: 'agt_1',
        created_at: '2020-01-01T00:00:00.000Z',
        wingcaster_tenure_days: 1800,
        prior_rejection_ratio: 0.92,
      },
      submission: {
        id: 'sub_1',
        portal: 'property_finder',
        fee_history: [{ portal: 'bayut', rejected: true }],
      },
      agency: {
        id: 'agy_1',
        onboarded_at: '2018-06-01T00:00:00.000Z',
        two_person_reject_required: true,
      },
    })
    expect(result).toEqual(UNKNOWN)
    expect(result.tier).toBe('unknown')
    expect(result.score).toBeNull()
    expect(result.signals).toEqual([])
    expect(result.version).toBe('v1-stub')
  })

  it('never throws on missing or malformed data', () => {
    expect(() => scoreTenureRisk()).not.toThrow()
    expect(() => scoreTenureRisk(null)).not.toThrow()
    expect(() => scoreTenureRisk(undefined)).not.toThrow()
    expect(() => scoreTenureRisk({})).not.toThrow()
    expect(() => scoreTenureRisk({ agent: null, submission: null, agency: null })).not.toThrow()
    expect(() => isStepUpRequired(null)).not.toThrow()
    expect(() => isStepUpRequired(undefined)).not.toThrow()
    expect(() => isTwoPersonRejectRequired(null, null)).not.toThrow()
    expect(() => isTwoPersonRejectRequired(undefined, undefined)).not.toThrow()
    expect(() => tenureRiskLabel(null)).not.toThrow()
    expect(() => tenureRiskLabel(undefined)).not.toThrow()
  })
})

describe('TENURE_RISK_TIERS', () => {
  it('includes unknown as a legal v1 tier', () => {
    expect(TENURE_RISK_TIERS).toContain('unknown')
    expect(TENURE_RISK_TIERS).toEqual(['low', 'medium', 'high', 'unknown'])
  })
})

describe('tenureRiskLabel', () => {
  it("maps unknown → 'Risk unknown'", () => {
    expect(tenureRiskLabel('unknown')).toBe('Risk unknown')
  })

  it('maps scored tiers to title case', () => {
    expect(tenureRiskLabel('low')).toBe('Low')
    expect(tenureRiskLabel('medium')).toBe('Medium')
    expect(tenureRiskLabel('high')).toBe('High')
  })
})

describe('isStepUpRequired', () => {
  it('is false for the v1 unknown stub', () => {
    expect(isStepUpRequired(scoreTenureRisk({}))).toBe(false)
    expect(isStepUpRequired(UNKNOWN)).toBe(false)
  })

  it('is true only for tier === high (Phase 2 override path)', () => {
    expect(isStepUpRequired({ tier: 'high' })).toBe(true)
    expect(isStepUpRequired({ tier: 'low' })).toBe(false)
    expect(isStepUpRequired({ tier: 'medium' })).toBe(false)
  })
})

describe('isTwoPersonRejectRequired', () => {
  it('is false for the v1 unknown stub even when the agency flag is set', () => {
    expect(
      isTwoPersonRejectRequired(scoreTenureRisk({}), { two_person_reject_required: true }),
    ).toBe(false)
  })

  it('is true only when agency.two_person_reject_required and tier is high', () => {
    expect(
      isTwoPersonRejectRequired({ tier: 'high' }, { two_person_reject_required: true }),
    ).toBe(true)
    expect(
      isTwoPersonRejectRequired({ tier: 'high' }, { two_person_reject_required: false }),
    ).toBe(false)
    expect(
      isTwoPersonRejectRequired({ tier: 'high' }, {}),
    ).toBe(false)
    expect(
      isTwoPersonRejectRequired({ tier: 'unknown' }, { two_person_reject_required: true }),
    ).toBe(false)
  })
})
