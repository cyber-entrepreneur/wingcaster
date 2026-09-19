import { describe, expect, it } from 'vitest'
import { scoringOverrideBodySchema } from './scoring-override-schemas.js'

describe('scoringOverrideBodySchema', () => {
  it('accepts a valid override payload', () => {
    const parsed = scoringOverrideBodySchema.safeParse({
      area_id: '11111111-1111-4111-8111-111111111111',
      dimension_id: '22222222-2222-4222-8222-222222222222',
      score: 72.5,
      reason: 'Verified on-site inspection',
      rationale: 'Neighborhood walkability improved after new metro station.',
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects scores above 100', () => {
    const parsed = scoringOverrideBodySchema.safeParse({
      area_id: '11111111-1111-4111-8111-111111111111',
      dimension_id: '22222222-2222-4222-8222-222222222222',
      score: 101,
      reason: 'Too high',
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects unknown keys', () => {
    const parsed = scoringOverrideBodySchema.safeParse({
      area_id: '11111111-1111-4111-8111-111111111111',
      dimension_id: '22222222-2222-4222-8222-222222222222',
      score: 50,
      reason: 'ok',
      extra: true,
    })
    expect(parsed.success).toBe(false)
  })
})
