import { describe, expect, it } from 'vitest'
import { formatCountdown, isExpired, remainingMs } from './countdown'

describe('formatCountdown', () => {
  it('renders mm:ss with leading zeros', () => {
    expect(formatCountdown(125_000)).toBe('02:05')
    expect(formatCountdown(5_000)).toBe('00:05')
    expect(formatCountdown(0)).toBe('00:00')
    expect(formatCountdown(-12)).toBe('00:00')
  })

  it('remainingMs / isExpired agree around the expiry instant', () => {
    const now = Date.parse('2026-09-09T12:00:00.000Z')
    const expires = '2026-09-09T12:01:00.000Z'
    expect(remainingMs(expires, now)).toBe(60_000)
    expect(isExpired(expires, now)).toBe(false)
    expect(isExpired(expires, now + 60_000)).toBe(true)
  })
})
