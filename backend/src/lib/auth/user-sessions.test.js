import { describe, expect, it } from 'vitest'
import {
  normalizeIp,
  parseUserAgent,
  publicSession,
  sessionIdFromToken,
} from './user-sessions.js'

describe('parseUserAgent', () => {
  it('summarises Chrome on macOS as a desktop session', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
    expect(parseUserAgent(ua)).toEqual({
      device_kind: 'desktop',
      device_summary: 'Chrome 141 on macOS 14',
    })
  })

  it('summarises Safari on iPhone as mobile', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
    expect(parseUserAgent(ua)).toEqual({
      device_kind: 'mobile',
      device_summary: 'Safari 18 on iOS 18',
    })
  })

  it('treats iPad as tablet', () => {
    const ua = 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
    expect(parseUserAgent(ua).device_kind).toBe('tablet')
  })

  it('returns unknown for an empty UA — does not invent a device', () => {
    expect(parseUserAgent('')).toEqual({ device_kind: 'unknown', device_summary: 'Unknown device' })
    expect(parseUserAgent(null)).toEqual({ device_kind: 'unknown', device_summary: 'Unknown device' })
  })
})

describe('normalizeIp', () => {
  it('unwraps IPv4-mapped IPv6', () => {
    expect(normalizeIp('::ffff:192.0.2.42')).toBe('192.0.2.42')
  })

  it('returns null for empty input', () => {
    expect(normalizeIp(null)).toBeNull()
    expect(normalizeIp('')).toBeNull()
  })
})

describe('session helpers', () => {
  it('prefers session_id over jti', () => {
    expect(sessionIdFromToken({ session_id: 'a', jti: 'b' })).toBe('a')
    expect(sessionIdFromToken({ jti: 'b' })).toBe('b')
    expect(sessionIdFromToken({})).toBeNull()
  })

  it('serialises a row for the SET-004 contract', () => {
    const created = new Date('2026-09-12T10:00:00.000Z')
    const body = publicSession({
      id: 'sess-1',
      device_kind: 'desktop',
      device_summary: 'Chrome 141 on macOS 14',
      ip: '192.0.2.42',
      ip_country_iso: null,
      ip_country: null,
      ip_city: null,
      created_at: created,
      last_active_at: created,
    }, 'sess-1')
    expect(body).toEqual({
      id: 'sess-1',
      is_current: true,
      device_kind: 'desktop',
      device_summary: 'Chrome 141 on macOS 14',
      ip: '192.0.2.42',
      ip_country_iso: null,
      ip_country: null,
      ip_city: null,
      created_at: '2026-09-12T10:00:00.000Z',
      last_active_at: '2026-09-12T10:00:00.000Z',
    })
  })
})
