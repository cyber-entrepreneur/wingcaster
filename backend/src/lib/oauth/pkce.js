/**
 * RFC 7636 PKCE — cryptographically random verifier + S256 challenge.
 */
import { createHash, randomBytes } from 'node:crypto'

const UNRESERVED = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
export const MIN_VERIFIER_LENGTH = 43
export const MAX_VERIFIER_LENGTH = 128
export const DEFAULT_VERIFIER_LENGTH = 64

function assertValidVerifier(verifier) {
  if (typeof verifier !== 'string') {
    throw new Error('code_verifier must be a string')
  }
  if (verifier.length < MIN_VERIFIER_LENGTH || verifier.length > MAX_VERIFIER_LENGTH) {
    throw new Error(`code_verifier must be ${MIN_VERIFIER_LENGTH}-${MAX_VERIFIER_LENGTH} characters`)
  }
  for (const ch of verifier) {
    if (!UNRESERVED.includes(ch)) {
      throw new Error('code_verifier contains invalid characters')
    }
  }
}

/**
 * @param {number} [length]
 * @returns {string}
 */
export function generateCodeVerifier(length = DEFAULT_VERIFIER_LENGTH) {
  const size = Math.min(MAX_VERIFIER_LENGTH, Math.max(MIN_VERIFIER_LENGTH, length))
  const bytes = randomBytes(size)
  let verifier = ''
  for (let i = 0; i < size; i += 1) {
    verifier += UNRESERVED[bytes[i] % UNRESERVED.length]
  }
  return verifier
}

/**
 * @param {string} verifier
 * @returns {string} base64url-encoded SHA-256 digest
 */
export function challengeFromVerifier(verifier) {
  assertValidVerifier(verifier)
  return createHash('sha256')
    .update(verifier)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * @param {number} [length]
 * @returns {{ codeVerifier: string, codeChallenge: string, codeChallengeMethod: 'S256' }}
 */
export function createPkcePair(length = DEFAULT_VERIFIER_LENGTH) {
  const codeVerifier = generateCodeVerifier(length)
  return {
    codeVerifier,
    codeChallenge: challengeFromVerifier(codeVerifier),
    codeChallengeMethod: 'S256',
  }
}
