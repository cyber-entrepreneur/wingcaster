/**
 * Pure identity normalization + hashing for free-trial claim enforcement.
 * Two inputs that authenticate as the same account must hash to the same value.
 */
import { createHash } from 'node:crypto'

export function normalizeEmail(email) {
  if (typeof email !== 'string') return null
  const trimmed = email.trim().toLowerCase()
  return trimmed || null
  // Gmail-style +tag aliases are NOT stripped in v1. Treat as distinct.
}

/**
 * Canonical E.164-style form used at claim time.
 * Digits only, then prefix '+'. Matches signup inputs like
 * "+961 71 123 456" and "+96171123456".
 */
export function normalizePhone(phone) {
  if (phone == null) return null
  if (typeof phone !== 'string' && typeof phone !== 'number') return null
  const digits = String(phone).replace(/\D/g, '')
  if (!digits) return null
  return `+${digits}`
}

export function normalizeUsername(username) {
  if (typeof username !== 'string') return null
  const normalized = username.normalize('NFKC').trim().toLocaleLowerCase()
  return normalized || null
}

export function hashIdentity(value) {
  if (!value) return null
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

export function absentDimensionHash(dimension, seed) {
  return hashIdentity(`absent:${dimension}:${seed}`)
}

export function identityHashes({ email, phone, username, absentSeed } = {}) {
  const emailNorm = normalizeEmail(email)
  const phoneNorm = normalizePhone(phone)
  const usernameNorm = normalizeUsername(username)
  const seed = absentSeed || 'unspecified'
  return {
    email: emailNorm ? hashIdentity(emailNorm) : absentDimensionHash('email', seed),
    phone: phoneNorm ? hashIdentity(phoneNorm) : absentDimensionHash('phone', seed),
    username: usernameNorm ? hashIdentity(usernameNorm) : absentDimensionHash('username', seed),
    normalized: {
      email: emailNorm,
      phone: phoneNorm,
      username: usernameNorm,
    },
  }
}
