import { describe, expect, it } from 'vitest'
import {
  hashIdentity,
  identityHashes,
  normalizeEmail,
  normalizePhone,
  normalizeUsername,
} from './identity-normalize.js'

describe('normalizeEmail', () => {
  it('returns null for empty, whitespace, and non-strings', () => {
    expect(normalizeEmail('')).toBeNull()
    expect(normalizeEmail('   ')).toBeNull()
    expect(normalizeEmail(null)).toBeNull()
    expect(normalizeEmail(12)).toBeNull()
  })

  it('trims and lowercases Latin email', () => {
    expect(normalizeEmail('  Alice@Example.COM ')).toBe('alice@example.com')
  })

  it('does not strip gmail +tag aliases', () => {
    expect(normalizeEmail('user+tag@gmail.com')).toBe('user+tag@gmail.com')
    expect(normalizeEmail('user@gmail.com')).toBe('user@gmail.com')
    expect(hashIdentity(normalizeEmail('user+tag@gmail.com')))
      .not.toBe(hashIdentity(normalizeEmail('user@gmail.com')))
  })
})

describe('normalizePhone', () => {
  it('returns null for empty and non-phone values', () => {
    expect(normalizePhone('')).toBeNull()
    expect(normalizePhone('   ')).toBeNull()
    expect(normalizePhone(null)).toBeNull()
    expect(normalizePhone({})).toBeNull()
  })

  it('treats E.164 variants as equivalent', () => {
    expect(normalizePhone('+961 71 123 456')).toBe('+96171123456')
    expect(normalizePhone('+96171123456')).toBe('+96171123456')
    expect(normalizePhone('961-71-123-456')).toBe('+96171123456')
    expect(hashIdentity(normalizePhone('+1 (555) 010-0199')))
      .toBe(hashIdentity(normalizePhone('+15550100199')))
  })
})

describe('normalizeUsername', () => {
  it('returns null for empty and non-strings', () => {
    expect(normalizeUsername('')).toBeNull()
    expect(normalizeUsername('  \t')).toBeNull()
    expect(normalizeUsername(null)).toBeNull()
  })

  it('folds Latin case and trims', () => {
    expect(normalizeUsername('  AliAgent ')).toBe('aliagent')
    expect(normalizeUsername('ALIAGENT')).toBe('aliagent')
  })

  it('folds Arabic and NFKC compatibility characters', () => {
    expect(normalizeUsername('  وكيل  ')).toBe('وكيل')
    // ﬁ (U+FB01) NFKC-folds to "fi"
    expect(normalizeUsername('ﬁle')).toBe('file')
    expect(normalizeUsername('FILE')).toBe('file')
  })
})

describe('identityHashes', () => {
  it('hashes normalized values and uses absent placeholders when missing', () => {
    const a = identityHashes({ email: 'A@x.test', phone: '', username: '  Bob ', absentSeed: 'u1' })
    const b = identityHashes({ email: 'a@x.test', phone: null, username: 'BOB', absentSeed: 'u1' })
    expect(a.email).toBe(b.email)
    expect(a.username).toBe(b.username)
    expect(a.phone).toBe(b.phone)
    expect(a.normalized.phone).toBeNull()
  })
})
