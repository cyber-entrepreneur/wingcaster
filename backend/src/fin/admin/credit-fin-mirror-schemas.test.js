import { describe, expect, it } from 'vitest'
import { creditFinMirrorRunBodySchema } from './credit-fin-mirror-schemas.js'

describe('credit-fin-mirror-schemas', () => {
  it('accepts empty run bodies', () => {
    expect(creditFinMirrorRunBodySchema.safeParse({}).success).toBe(true)
  })

  it('rejects unknown run body fields', () => {
    expect(creditFinMirrorRunBodySchema.safeParse({ environment: 'LIVE' }).success).toBe(false)
  })
})
