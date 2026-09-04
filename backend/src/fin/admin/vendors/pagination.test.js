import { describe, expect, it } from 'vitest'
import { CATEGORY } from '../../errors.js'
import { DEFAULT_LIMIT, MAX_LIMIT, encodeCursor, parsePagination, slicePage } from './pagination.js'
import { buildRates, deltaPct, primaryRateKey } from './writes.js'

describe('vendor admin pagination', () => {
  it('defaults limit to 50 and caps at 200', () => {
    expect(parsePagination({}).limit).toBe(DEFAULT_LIMIT)
    expect(parsePagination({ limit: '500' }).limit).toBe(MAX_LIMIT)
    expect(parsePagination({ limit: '1' }).limit).toBe(1)
  })

  it('round-trips an opaque cursor', () => {
    const token = encodeCursor({ name: 'acme', id: '1' })
    expect(parsePagination({ cursor: token }).cursor).toEqual({ name: 'acme', id: '1' })
  })

  it('rejects a malformed cursor', () => {
    try {
      parsePagination({ cursor: 'not-valid' })
      throw new Error('expected throw')
    } catch (error) {
      expect(error.category).toBe(CATEGORY.VALIDATION)
    }
  })

  it('slicePage exposes next page when limit+1 rows exist', () => {
    const { page, hasMore } = slicePage([1, 2, 3], 2)
    expect(page).toEqual([1, 2])
    expect(hasMore).toBe(true)
  })
})

describe('vendor admin rate helpers', () => {
  it('buildRates accepts a single unit_cost_minor payload', () => {
    const rates = buildRates({
      product_code: 'gpt-4o-mini.input_tokens',
      unit_cost_minor: 180,
      currency: 'USD',
    })
    expect(primaryRateKey(rates)).toBe('gpt-4o-mini.input_tokens')
    expect(rates['gpt-4o-mini.input_tokens'].unit_cost_minor).toBe(180)
  })

  it('deltaPct is 0 for a new SKU (no prior) and >20 for a 76% hike', () => {
    expect(deltaPct(null, 30)).toBe(0)
    expect(deltaPct(0, 30)).toBe(0)
    expect(deltaPct(17, 18)).toBeLessThan(20)
    expect(deltaPct(17, 30)).toBeGreaterThan(20)
  })
})
