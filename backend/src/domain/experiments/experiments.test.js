/**
 * Wave 2D — unit tests for assignment engine + significance math.
 */
import { describe, expect, it } from 'vitest'
import {
  computeEvenAssignment,
  computeBanditAssignment,
  computeAssignment,
  hashBucket,
  twoProportionZTest,
  normalCdf,
  EVEN_MODEL_VERSION,
  HOLDOUT_VARIANT,
} from './index.js'

describe('experiment assignment engine', () => {
  const baseExperiment = {
    id: 'exp_test_1',
    allocation: 'even',
    holdout_pct: 20,
    variants: [
      { key: 'A', label: 'Control copy' },
      { key: 'B', label: 'Treatment copy' },
    ],
  }

  it('is deterministic for the same contact×experiment', () => {
    const a = computeEvenAssignment(baseExperiment, 'ctc_same')
    const b = computeEvenAssignment(baseExperiment, 'ctc_same')
    expect(a.variant).toBe(b.variant)
    expect(a.assignment_reason).toBe(b.assignment_reason)
    expect(a.model_version).toBe(EVEN_MODEL_VERSION)
  })

  it('produces different buckets across contacts', () => {
    const buckets = new Set()
    for (let i = 0; i < 50; i += 1) {
      buckets.add(hashBucket(baseExperiment.id, `ctc_${i}`).holdoutBucket)
    }
    expect(buckets.size).toBeGreaterThan(10)
  })

  it('respects holdout_pct approximately over a large sample', () => {
    let holdouts = 0
    const n = 5000
    for (let i = 0; i < n; i += 1) {
      const result = computeEvenAssignment(baseExperiment, `ctc_holdout_${i}`)
      if (result.variant === HOLDOUT_VARIANT) holdouts += 1
    }
    const share = holdouts / n
    // 20% ± 3pp tolerance for hash distribution
    expect(share).toBeGreaterThan(0.17)
    expect(share).toBeLessThan(0.23)
  })

  it('splits non-holdout mass evenly across variants', () => {
    const counts = { A: 0, B: 0, holdout: 0 }
    const n = 4000
    for (let i = 0; i < n; i += 1) {
      const result = computeEvenAssignment(baseExperiment, `ctc_even_${i}`)
      counts[result.variant] = (counts[result.variant] || 0) + 1
    }
    const treated = counts.A + counts.B
    expect(treated).toBeGreaterThan(0)
    const ratio = counts.A / treated
    expect(ratio).toBeGreaterThan(0.45)
    expect(ratio).toBeLessThan(0.55)
  })

  it('records even reason and model_version on treatment', () => {
    // Find a contact that is not holdout
    let found = null
    for (let i = 0; i < 200; i += 1) {
      const r = computeEvenAssignment(baseExperiment, `ctc_reason_${i}`)
      if (r.variant !== HOLDOUT_VARIANT) {
        found = r
        break
      }
    }
    expect(found).not.toBeNull()
    expect(found.assignment_reason).toBe('even')
    expect(found.model_version).toBe(EVEN_MODEL_VERSION)
  })

  it('bandit path returns NOT_CONFIGURED (no stub result)', () => {
    try {
      computeBanditAssignment(baseExperiment, 'ctc_1')
      expect.unreachable('expected NOT_CONFIGURED')
    } catch (err) {
      expect(err.code).toBe('NOT_CONFIGURED')
    }
    try {
      computeAssignment({ ...baseExperiment, allocation: 'bandit' }, 'ctc_1')
      expect.unreachable('expected NOT_CONFIGURED')
    } catch (err) {
      expect(err.code).toBe('NOT_CONFIGURED')
    }
  })
})

describe('twoProportionZTest significance', () => {
  it('refuses significance below min sample (no fabricated confidence)', () => {
    const result = twoProportionZTest({
      successesA: 5,
      trialsA: 20,
      successesB: 2,
      trialsB: 20,
      minSample: 30,
    })
    expect(result.significant_at_95).toBe(false)
    expect(result.p_value).toBeNull()
    expect(result.confidence).toBeNull()
    expect(result.reason).toBe('insufficient_sample')
  })

  it('computes a real p-value when samples are large and rates differ', () => {
    const result = twoProportionZTest({
      successesA: 80,
      trialsA: 200,
      successesB: 40,
      trialsB: 200,
      minSample: 30,
    })
    expect(result.reason).toBe('two_proportion_z')
    expect(result.p_value).toBeGreaterThan(0)
    expect(result.p_value).toBeLessThan(0.05)
    expect(result.significant_at_95).toBe(true)
    expect(result.confidence).toBeGreaterThan(0.95)
    expect(result.lift).toBeCloseTo(1, 5) // 0.4 vs 0.2 → 100% lift
    expect(result.ci_95[0]).toBeLessThan(result.diff)
    expect(result.ci_95[1]).toBeGreaterThan(result.diff)
  })

  it('reports non-significant when rates are equal', () => {
    const result = twoProportionZTest({
      successesA: 50,
      trialsA: 200,
      successesB: 50,
      trialsB: 200,
    })
    expect(result.significant_at_95).toBe(false)
    expect(result.p_value).toBeGreaterThan(0.5)
    expect(result.lift).toBe(0)
  })

  it('normalCdf is monotone and symmetric around 0.5', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 5)
    expect(normalCdf(-1)).toBeLessThan(0.5)
    expect(normalCdf(1)).toBeGreaterThan(0.5)
    expect(normalCdf(1) + normalCdf(-1)).toBeCloseTo(1, 5)
  })
})
