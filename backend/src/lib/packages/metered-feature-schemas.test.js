import { describe, expect, it } from 'vitest'
import {
  meteredFeatureListQuerySchema,
  meteredFeaturePatchBodySchema,
} from './metered-feature-schemas.js'

describe('meteredFeaturePatchBodySchema', () => {
  it('accepts display_name patch with reason', () => {
    const parsed = meteredFeaturePatchBodySchema.parse({
      display_name: 'Instagram publish',
      reason: 'Rename for clarity',
    })
    expect(parsed.display_name).toBe('Instagram publish')
  })

  it('rejects economics fields and unknown keys', () => {
    expect(() =>
      meteredFeaturePatchBodySchema.parse({
        credits_per_unit: 99,
        reason: 'nope',
      }),
    ).toThrow()
    expect(() =>
      meteredFeaturePatchBodySchema.parse({
        display_name: 'X',
        reason: 'ok',
        credits_per_unit: 1,
      }),
    ).toThrow()
  })

  it('requires at least one mutable field besides reason', () => {
    expect(() =>
      meteredFeaturePatchBodySchema.parse({
        reason: 'nothing to change',
      }),
    ).toThrow(/At least one/)
  })
})

describe('meteredFeatureListQuerySchema', () => {
  it('accepts category and active filters', () => {
    const parsed = meteredFeatureListQuerySchema.parse({
      category: 'ai.content',
      active: 'true',
    })
    expect(parsed.category).toBe('ai.content')
  })

  it('rejects unknown query keys', () => {
    expect(() => meteredFeatureListQuerySchema.parse({ q: 'search' })).toThrow()
  })
})
