import { describe, expect, it } from 'vitest'
import { creditJanitorRunBodySchema } from './credit-janitor-schemas.js'

describe('credit-janitor-schemas', () => {
  it('accepts empty run bodies', () => {
    expect(creditJanitorRunBodySchema.safeParse({}).success).toBe(true)
  })

  it('rejects unknown run body fields', () => {
    expect(creditJanitorRunBodySchema.safeParse({ environment: 'LIVE' }).success).toBe(false)
  })
})
