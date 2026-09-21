import { describe, expect, it } from 'vitest'
import {
  challengeFromVerifier,
  createPkcePair,
  generateCodeVerifier,
  MAX_VERIFIER_LENGTH,
  MIN_VERIFIER_LENGTH,
} from './pkce.js'

describe('pkce', () => {
  it('matches RFC 7636 appendix B verifier S256 challenge', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
    expect(challengeFromVerifier(verifier)).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
  })

  it('generates verifier within RFC length bounds', () => {
    const verifier = generateCodeVerifier()
    expect(verifier.length).toBeGreaterThanOrEqual(MIN_VERIFIER_LENGTH)
    expect(verifier.length).toBeLessThanOrEqual(MAX_VERIFIER_LENGTH)
    expect(challengeFromVerifier(verifier)).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('createPkcePair returns S256 challenge', () => {
    const pair = createPkcePair()
    expect(pair.codeChallengeMethod).toBe('S256')
    expect(challengeFromVerifier(pair.codeVerifier)).toBe(pair.codeChallenge)
  })
})
