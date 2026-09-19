import { describe, expect, it } from 'vitest'
import { dunningCaseActionBodySchema } from './dunning-case-schemas.js'

describe('dunningCaseActionBodySchema (PA-DUN-001)', () => {
  it('accepts an empty body', () => {
    expect(dunningCaseActionBodySchema.parse({})).toEqual({})
  })

  it('accepts reason_code for audit stamping', () => {
    expect(dunningCaseActionBodySchema.parse({ reason_code: 'ADMIN_OPS' })).toEqual({
      reason_code: 'ADMIN_OPS',
    })
  })

  it('rejects unknown fields', () => {
    expect(() => dunningCaseActionBodySchema.parse({ force: true })).toThrow()
  })
})
