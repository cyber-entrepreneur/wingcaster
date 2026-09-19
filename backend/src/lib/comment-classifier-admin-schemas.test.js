import { describe, expect, it } from 'vitest'
import { commentClassifierRunBodySchema } from './comment-classifier-admin-schemas.js'

describe('commentClassifierRunBodySchema (PA-CLS-001)', () => {
  it('accepts an empty body', () => {
    expect(commentClassifierRunBodySchema.parse({})).toEqual({})
  })

  it('rejects unknown fields', () => {
    expect(() => commentClassifierRunBodySchema.parse({ force: true })).toThrow()
  })
})
