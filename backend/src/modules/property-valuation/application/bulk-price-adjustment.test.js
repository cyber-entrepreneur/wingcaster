import { describe, expect, it } from 'vitest'
import {
  buildPreviewRows,
  computeNewPrice,
  evaluateSafetyCaps,
} from './bulk-price-adjustment.js'

describe('computeNewPrice', () => {
  it('applies percent up', () => {
    expect(computeNewPrice(100, 'percent_up', 10, null)).toBe(110)
  })

  it('applies percent down', () => {
    expect(computeNewPrice(100, 'percent_down', 10, null)).toBe(90)
  })

  it('uses median for recommendation', () => {
    expect(computeNewPrice(100, 'recommendation', null, { median_price: 120 })).toBe(120)
  })
})

describe('buildPreviewRows', () => {
  it('builds preview rows and totals', () => {
    const preview = buildPreviewRows(
      [
        { id: 'p1', price: 100, title: 'A', agent_id: 'a1', pricing_analysis: { median_price: 110 } },
        { id: 'p2', price: 200, title: 'B', agent_id: 'a2', pricing_analysis: { median_price: 180 } },
      ],
      'recommendation',
      null,
    )
    expect(preview.rows).toHaveLength(2)
    expect(preview.totals.listing_count).toBe(2)
    expect(preview.totals.total_value_before).toBe(300)
    expect(preview.totals.total_value_after).toBe(290)
  })
})

describe('evaluateSafetyCaps', () => {
  it('blocks large listing counts', () => {
    const result = evaluateSafetyCaps({
      totals: { listing_count: 101, aggregate_change_percent: 10 },
      rows: [],
    })
    expect(result.ok).toBe(false)
    expect(result.code).toBe('SAFETY_CAP_LISTINGS')
  })

  it('blocks large aggregate value changes', () => {
    const result = evaluateSafetyCaps({
      totals: { listing_count: 10, aggregate_change_percent: 55 },
      rows: [],
    })
    expect(result.ok).toBe(false)
    expect(result.code).toBe('SAFETY_CAP_VALUE')
  })
})
