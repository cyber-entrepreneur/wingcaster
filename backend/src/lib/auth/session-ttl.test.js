/**
 * Unit tests for T6 session TTL shortening.
 *
 * Covers:
 *   - signToken default: 7-day expiresIn
 *   - signToken with ttlSeconds: honours the caller's TTL
 *   - signToken with garbage TTL (0, negative, NaN): falls back to default
 *   - MFA_POLICY_SESSION_TTL_SECONDS: 8h < DEFAULT_SESSION_TTL_SECONDS
 */
import jwt from 'jsonwebtoken'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

let signToken
let DEFAULT_SESSION_TTL_SECONDS
let MFA_POLICY_SESSION_TTL_SECONDS

beforeEach(async () => {
  process.env.JWT_SECRET = 'test-secret-t6'
  ;({
    signToken,
    DEFAULT_SESSION_TTL_SECONDS,
    MFA_POLICY_SESSION_TTL_SECONDS,
  } = await import('../../auth.js'))
})

afterEach(() => {
  delete process.env.JWT_SECRET
})

function decode(token) {
  return jwt.decode(token)
}

describe('signToken TTL', () => {
  it('default = 7 days when no ttlSeconds passed', () => {
    const token = signToken({ id: 'u-1', verified_at: '2026-01-01T00:00:00Z' })
    const decoded = decode(token)
    const seconds = decoded.exp - decoded.iat
    expect(seconds).toBe(DEFAULT_SESSION_TTL_SECONDS)
    expect(seconds).toBe(7 * 24 * 3600)
  })

  it('honours explicit ttlSeconds', () => {
    const token = signToken(
      { id: 'u-1', verified_at: '2026-01-01T00:00:00Z' },
      { ttlSeconds: MFA_POLICY_SESSION_TTL_SECONDS },
    )
    const decoded = decode(token)
    const seconds = decoded.exp - decoded.iat
    expect(seconds).toBe(MFA_POLICY_SESSION_TTL_SECONDS)
    expect(seconds).toBe(8 * 3600)
  })

  it('falls back to default on garbage ttlSeconds', () => {
    for (const bad of [0, -1, NaN, null, undefined, 'string']) {
      const token = signToken(
        { id: 'u-1', verified_at: '2026-01-01T00:00:00Z' },
        { ttlSeconds: bad },
      )
      const decoded = decode(token)
      expect(decoded.exp - decoded.iat).toBe(DEFAULT_SESSION_TTL_SECONDS)
    }
  })

  it('MFA_POLICY_SESSION_TTL_SECONDS is strictly shorter than default', () => {
    expect(MFA_POLICY_SESSION_TTL_SECONDS).toBeLessThan(DEFAULT_SESSION_TTL_SECONDS)
  })
})
