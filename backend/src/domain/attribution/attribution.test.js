/**
 * Wave 2C — unit tests for attribution credit math + funnel mapping.
 */
import { describe, expect, it } from 'vitest'
import { computeCreditWeights } from './attribution-engine.js'
import { CONVERSION_EVENT_MAP, FUNNEL_STAGES } from './constants.js'
import { majorToMicros } from './finance-attest.js'
import { isConversionEvent } from './conversions.js'

describe('attribution credit weights', () => {
  const execs = ['exec_a', 'exec_b', 'exec_c']

  it('last gives 1.0 to the final touchpoint', () => {
    const r = computeCreditWeights(execs, 'last')
    expect(r.configured).toBe(true)
    expect(r.weights).toEqual([{ execution_id: 'exec_c', credit_weight: 1 }])
  })

  it('first gives 1.0 to the first touchpoint', () => {
    const r = computeCreditWeights(execs, 'first')
    expect(r.weights).toEqual([{ execution_id: 'exec_a', credit_weight: 1 }])
  })

  it('linear splits equally and sums to 1', () => {
    const r = computeCreditWeights(execs, 'linear')
    const sum = r.weights.reduce((s, w) => s + w.credit_weight, 0)
    expect(sum).toBeCloseTo(1, 10)
    expect(r.weights).toHaveLength(3)
    expect(r.weights.every((w) => Math.abs(w.credit_weight - 1 / 3) < 1e-9)).toBe(true)
  })

  it('position uses 40/20/40 for three+ touchpoints', () => {
    const r = computeCreditWeights(execs, 'position')
    expect(r.weights[0]).toEqual({ execution_id: 'exec_a', credit_weight: 0.4 })
    expect(r.weights[1]).toEqual({ execution_id: 'exec_b', credit_weight: 0.2 })
    expect(r.weights[2]).toEqual({ execution_id: 'exec_c', credit_weight: 0.4 })
    const sum = r.weights.reduce((s, w) => s + w.credit_weight, 0)
    expect(sum).toBeCloseTo(1, 10)
  })

  it('position with two touchpoints is 50/50', () => {
    const r = computeCreditWeights(['e1', 'e2'], 'position')
    expect(r.weights).toEqual([
      { execution_id: 'e1', credit_weight: 0.5 },
      { execution_id: 'e2', credit_weight: 0.5 },
    ])
  })

  it('data_driven returns NOT_CONFIGURED without inventing credits', () => {
    const r = computeCreditWeights(execs, 'data_driven')
    expect(r.configured).toBe(false)
    expect(r.code).toBe('NOT_CONFIGURED')
    expect(r.weights).toEqual([])
  })

  it('empty touchpoints yield empty weights for launch models', () => {
    expect(computeCreditWeights([], 'last').weights).toEqual([])
    expect(computeCreditWeights([], 'linear').weights).toEqual([])
  })
})

describe('conversion event map', () => {
  it('covers the full business funnel to commission', () => {
    expect(isConversionEvent('lead.created')).toBe(true)
    expect(isConversionEvent('commission.earned')).toBe(true)
    expect(isConversionEvent('message.delivered')).toBe(false)
    expect(CONVERSION_EVENT_MAP['transaction.closed'].to_stage).toBe('transaction')
    expect(CONVERSION_EVENT_MAP['commission.earned'].to_stage).toBe('commission')
    expect(FUNNEL_STAGES).toContain('commission')
  })
})

describe('finance micros conversion', () => {
  it('converts major currency units to micros', () => {
    expect(majorToMicros(250000)).toBe(250_000_000_000)
    expect(majorToMicros('12.5')).toBe(12_500_000)
    expect(majorToMicros(null)).toBeNull()
  })
})
