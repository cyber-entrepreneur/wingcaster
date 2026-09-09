import { describe, expect, it } from 'vitest'
import scoreTenureRiskDefault, {
  scoreTenureRisk,
  isStepUpRequired,
  isTwoPersonRejectRequired,
  tenureRiskLabel,
  TENURE_RISK_TIERS,
} from './tenure-risk.js'
import { scoreTenureRisk as scoreFromBarrel } from './index.js'

const FULL_AGENT = {
  id: 'agent-1',
  created_at: '2024-01-15T00:00:00.000Z',
  agency_id: 'agency-1',
  prior_rejections: 2,
  reputation_score: 0.8,
}

const FULL_SUBMISSION = {
  id: 'sub-1',
  listing_id: 'list-1',
  price: 1_250_000,
  photo_count: 12,
  title: 'Bright 2BR near metro',
  anomaly_flags: [],
}

const STUB = { tier: 'unknown', score: null, signals: [], version: 'v1-stub' }

describe('scoreTenureRisk', () => {
  it('exports named and default as the same function', () => {
    expect(scoreTenureRisk).toBe(scoreTenureRiskDefault)
    expect(scoreFromBarrel).toBe(scoreTenureRisk)
  })

  it('exposes tenure risk helpers', () => {
    expect(TENURE_RISK_TIERS).toContain('unknown')
    expect(tenureRiskLabel('unknown')).toBe('Risk unknown')
    expect(isStepUpRequired(STUB)).toBe(false)
    expect(isTwoPersonRejectRequired(STUB, { two_person_reject_required: true })).toBe(false)
  })

  it.each([
    ['empty (no args)', undefined],
    ['null input', null],
    ['partial agent only', { agent: { id: 'a1' } }],
    ['partial submission only', { submission: { id: 's1' } }],
    ['full fixtures', { agent: FULL_AGENT, submission: FULL_SUBMISSION }],
  ])('returns tier unknown for %s', (_label, input) => {
    expect(() => scoreTenureRisk(input)).not.toThrow()
    expect(scoreTenureRisk(input)).toEqual(STUB)
  })

  it('never throws across a range of malformed inputs', () => {
    const cases = [
      null,
      undefined,
      {},
      [],
      'agent',
      0,
      { agent: FULL_AGENT, submission: null },
      { agent: null, submission: FULL_SUBMISSION },
    ]
    for (const input of cases) {
      expect(() => scoreTenureRisk(input)).not.toThrow()
      expect(scoreTenureRisk(input).tier).toBe('unknown')
    }
  })
})
