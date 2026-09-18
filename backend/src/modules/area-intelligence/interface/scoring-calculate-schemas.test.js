import { describe, expect, it } from 'vitest'
import { scoringCalculateBodySchema } from './scoring-calculate-schemas.js'

describe('scoringCalculateBodySchema', () => {
  it('accepts all_areas scope', () => {
    const parsed = scoringCalculateBodySchema.safeParse({ scope: 'all_areas' })
    expect(parsed.success).toBe(true)
  })

  it('accepts legacy area_id-only body', () => {
    const parsed = scoringCalculateBodySchema.safeParse({
      area_id: '11111111-1111-4111-8111-111111111111',
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects one_dimension without dimension_id', () => {
    const parsed = scoringCalculateBodySchema.safeParse({
      scope: 'one_dimension',
      area_id: '11111111-1111-4111-8111-111111111111',
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects unknown keys', () => {
    const parsed = scoringCalculateBodySchema.safeParse({
      scope: 'all_areas',
      extra: true,
    })
    expect(parsed.success).toBe(false)
  })
})
