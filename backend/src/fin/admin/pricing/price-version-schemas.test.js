import { describe, expect, it } from 'vitest'
import { draftPriceVersionBodySchema } from './price-version-schemas.js'

describe('draftPriceVersionBodySchema', () => {
  it('accepts PER_UNIT draft body', () => {
    const parsed = draftPriceVersionBodySchema.safeParse({
      model: 'PER_UNIT',
      unit_rate_minor: 100,
      effective_from: '2026-01-01T00:00:00.000Z',
      reason_code: 'PRICE_CHANGE',
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects unknown fields', () => {
    expect(draftPriceVersionBodySchema.safeParse({
      model: 'PER_UNIT',
      unit_rate_minor: 100,
      effective_from: '2026-01-01T00:00:00.000Z',
      environment: 'LIVE',
    }).success).toBe(false)
  })

  it('rejects missing effective_from', () => {
    expect(draftPriceVersionBodySchema.safeParse({
      model: 'PER_UNIT',
      unit_rate_minor: 100,
    }).success).toBe(false)
  })
})
