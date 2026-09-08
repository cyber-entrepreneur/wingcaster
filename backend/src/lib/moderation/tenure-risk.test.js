import { describe, expect, it } from 'vitest'
import scoreTenureRiskDefault, { scoreTenureRisk } from './tenure-risk.js'
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

describe('scoreTenureRisk', () => {
  it('exports named and default as the same function', () => {
    expect(scoreTenureRisk).toBe(scoreTenureRiskDefault)
    expect(scoreFromBarrel).toBe(scoreTenureRisk)
  })

  it.each([
    ['empty (no args)', undefined, undefined],
    ['null agent and submission', null, null],
    ['partial agent only', { id: 'a1' }, undefined],
    ['partial submission only', undefined, { id: 's1' }],
    ['partial both', { id: 'a1' }, { id: 's1', price: 100 }],
    ['full fixtures', FULL_AGENT, FULL_SUBMISSION],
  ])('returns tier unknown for %s', (_label, agent, submission) => {
    expect(() => scoreTenureRisk(agent, submission)).not.toThrow()
    expect(scoreTenureRisk(agent, submission)).toEqual({ tier: 'unknown' })
  })

  it('never throws across a range of malformed inputs', () => {
    const cases = [
      [null, null],
      [undefined, undefined],
      [{}, {}],
      [[], []],
      ['agent', 'submission'],
      [0, false],
      [FULL_AGENT, null],
      [null, FULL_SUBMISSION],
    ]
    for (const [agent, submission] of cases) {
      expect(() => scoreTenureRisk(agent, submission)).not.toThrow()
      expect(scoreTenureRisk(agent, submission).tier).toBe('unknown')
    }
  })
})
