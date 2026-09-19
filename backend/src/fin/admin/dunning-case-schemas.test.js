import { describe, expect, it } from 'vitest'
import { dunningCaseActionBodySchema } from './dunning-case-schemas.js'

describe('dunningCaseActionBodySchema (PA-DUN-001)', () => {
  it('accepts an empty body', () => {
    expect(dunningCaseActionBodySchema.parse({})).toEqual({})
  })

  it('rejects unknown fields', () => {
    expect(() => dunningCaseActionBodySchema.parse({ force: true })).toThrow()
  })
})
