import { describe, expect, it } from 'vitest'
import {
  deriveReasonCategory,
  maskDisplayName,
  maskEmail,
  maskIp,
  maskPhone,
  maskUserAgent,
  maskUsername,
} from './mask.js'

describe('account-recovery maskers', () => {
  it('masks email keeping local initial + tld', () => {
    expect(maskEmail('omar.khoury@example.ae')).toMatch(/^o\*\*\*@.+\.ae$/)
  })

  it('masks phone preserving country and last digits', () => {
    const masked = maskPhone('+971551234512')
    expect(masked.startsWith('+971')).toBe(true)
    expect(masked.endsWith('12')).toBe(true)
    expect(masked).not.toContain('123451')
  })

  it('masks username with bookends', () => {
    expect(maskUsername('omar_kh23')).toMatch(/^om\*+23$/)
  })

  it('masks display name last segment', () => {
    expect(maskDisplayName('Omar Khoury')).toMatch(/^Omar K/)
    expect(maskDisplayName('Omar Khoury')).toContain('*')
  })

  it('masks ipv4 keeping /16-ish prefix', () => {
    expect(maskIp('185.104.212.44')).toBe('185.104.XXX.XXX')
  })

  it('masks user agent into device · browser', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    expect(maskUserAgent(ua)).toMatch(/iPhone · Safari/)
  })

  it('derives reason category from text', () => {
    expect(deriveReasonCategory('Lost phone; SMS OTP no longer reaching me')).toBe('lost_phone')
    expect(deriveReasonCategory('phishing email compromised my account')).toBe('compromised_account')
  })
})
