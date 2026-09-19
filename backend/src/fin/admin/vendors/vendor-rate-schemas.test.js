import { describe, expect, it } from 'vitest'
import { applyVendorRateBodySchema } from './vendor-rate-schemas.js'

describe('applyVendorRateBodySchema', () => {
  it('accepts product_code and unit_cost_minor', () => {
    const parsed = applyVendorRateBodySchema.safeParse({
      product_code: 'gpt-4o-mini.input_tokens',
      unit_cost_minor: 180,
      currency: 'USD',
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects missing rate key', () => {
    expect(applyVendorRateBodySchema.safeParse({
      unit_cost_minor: 180,
    }).success).toBe(false)
  })

  it('rejects unknown fields', () => {
    expect(applyVendorRateBodySchema.safeParse({
      product_code: 'sku',
      unit_cost_minor: 180,
      environment: 'LIVE',
    }).success).toBe(false)
  })
})
