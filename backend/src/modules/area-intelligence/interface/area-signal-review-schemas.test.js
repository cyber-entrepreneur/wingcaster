import { describe, expect, it } from 'vitest'
import { areaSignalRejectBodySchema, areaSignalVerifyBodySchema } from './area-signal-review-schemas.js'

describe('area signal review schemas (PA-ARE-003)', () => {
  it('accepts optional verify notes', () => {
    expect(areaSignalVerifyBodySchema.parse({})).toEqual({})
    expect(areaSignalVerifyBodySchema.parse({ notes: 'Looks accurate' }).notes).toBe('Looks accurate')
  })

  it('requires a reject reason', () => {
    expect(() => areaSignalRejectBodySchema.parse({})).toThrow()
    expect(areaSignalRejectBodySchema.parse({ reason: 'Duplicate POI' }).reason).toBe('Duplicate POI')
  })
})
