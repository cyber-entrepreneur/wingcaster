import { describe, expect, it } from 'vitest'
import { maskPhoneE164 } from './maskPhone'

describe('maskPhoneE164', () => {
  it('masks UAE numbers to country code + last two digits', () => {
    expect(maskPhoneE164('+971501234567')).toBe('+971 5X XXX XX67')
  })

  it('accepts already-formatted input', () => {
    expect(maskPhoneE164('+971 50 123 4567')).toBe('+971 5X XXX XX67')
  })

  it('returns empty string for missing input', () => {
    expect(maskPhoneE164(null)).toBe('')
    expect(maskPhoneE164('')).toBe('')
  })
})
