import { describe, expect, it } from 'vitest'
import { deprecatePackageVersionBodySchema } from './package-deprecate-schemas.js'

describe('deprecatePackageVersionBodySchema', () => {
  it('accepts a reason', () => {
    expect(deprecatePackageVersionBodySchema.safeParse({ reason: 'superseded by v2' }).success).toBe(true)
  })

  it('rejects unknown fields', () => {
    expect(deprecatePackageVersionBodySchema.safeParse({
      reason: 'done',
      environment: 'LIVE',
    }).success).toBe(false)
  })
})
