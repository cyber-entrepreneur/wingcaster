/**
 * Purpose-scoped HMAC signed tokens for public, session-free links
 * (scheduled deletion view/cancel, and similar email round-trips).
 *
 * Reuses the same HMAC primitives as webhook-verify.js (createHmac +
 * timingSafeEqual) but packages a JSON payload + expiry + purpose claim
 * into a URL-safe token: `<base64url(payload)>.<base64url(sig)>`.
 *
 * Secret: JWT_SECRET (already required in production). Optional override
 * SIGNED_TOKEN_SECRET is accepted but not required — do not document a
 * new Railway env var unless it becomes mandatory.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

const DEFAULT_ALGORITHM = 'sha256'

function signingSecret() {
  const configured = process.env.SIGNED_TOKEN_SECRET || process.env.JWT_SECRET
  if (configured) return configured
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET (or SIGNED_TOKEN_SECRET) is required to sign purpose tokens')
  }
  return 'dev-jwt-secret-change-me'
}

function b64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8')
  return buf.toString('base64url')
}

function fromB64url(value) {
  return Buffer.from(String(value || ''), 'base64url')
}

function safeEqual(a, b) {
  const left = Buffer.isBuffer(a) ? a : Buffer.from(String(a || ''))
  const right = Buffer.isBuffer(b) ? b : Buffer.from(String(b || ''))
  return left.length === right.length && timingSafeEqual(left, right)
}

function hmac(body) {
  return createHmac(DEFAULT_ALGORITHM, signingSecret()).update(body).digest()
}

/**
 * Mint a signed token.
 *
 * @param {{ purpose: string, claims?: object, ttlSeconds: number }} args
 * @returns {string}
 */
export function signPurposeToken({ purpose, claims = {}, ttlSeconds }) {
  if (!purpose) throw new Error('purpose is required')
  const ttl = Number(ttlSeconds)
  if (!Number.isFinite(ttl) || ttl <= 0) throw new Error('ttlSeconds must be a positive number')

  const now = Math.floor(Date.now() / 1000)
  const payload = {
    ...claims,
    purpose: String(purpose),
    iat: now,
    exp: now + Math.floor(ttl),
  }
  const body = b64url(JSON.stringify(payload))
  const sig = b64url(hmac(body))
  return `${body}.${sig}`
}

/**
 * Verify a signed token. Returns `{ ok: true, payload }` or
 * `{ ok: false, error, code }`.
 *
 * @param {string} token
 * @param {{ purpose?: string }} [opts]
 */
export function verifyPurposeToken(token, { purpose } = {}) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return { ok: false, code: 'invalid_token', error: 'Malformed signed token' }
  }
  const [body, sig, extra] = token.split('.')
  if (!body || !sig || extra !== undefined) {
    return { ok: false, code: 'invalid_token', error: 'Malformed signed token' }
  }

  const expected = hmac(body)
  let actual
  try {
    actual = fromB64url(sig)
  } catch {
    return { ok: false, code: 'invalid_token', error: 'Malformed signed token' }
  }
  if (!safeEqual(actual, expected)) {
    return { ok: false, code: 'invalid_signature', error: 'Invalid signed token' }
  }

  let payload
  try {
    payload = JSON.parse(fromB64url(body).toString('utf8'))
  } catch {
    return { ok: false, code: 'invalid_token', error: 'Malformed signed token payload' }
  }

  if (!payload || typeof payload !== 'object') {
    return { ok: false, code: 'invalid_token', error: 'Malformed signed token payload' }
  }

  if (purpose && payload.purpose !== purpose) {
    return { ok: false, code: 'wrong_purpose', error: 'Token purpose mismatch' }
  }

  const exp = Number(payload.exp)
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) {
    return { ok: false, code: 'expired', error: 'Signed token has expired' }
  }

  return { ok: true, payload }
}

/** 60-day TTL for scheduled-deletion public view/cancel links. */
export const SCHEDULED_DELETION_VIEW_TTL_SECONDS = 60 * 24 * 60 * 60

export const SCHEDULED_DELETION_VIEW_PURPOSE = 'scheduled_deletion_view'

export function signScheduledDeletionViewToken({ deletionRequestId, userId }) {
  return signPurposeToken({
    purpose: SCHEDULED_DELETION_VIEW_PURPOSE,
    ttlSeconds: SCHEDULED_DELETION_VIEW_TTL_SECONDS,
    claims: {
      deletion_request_id: deletionRequestId,
      user_id: userId,
    },
  })
}

export function verifyScheduledDeletionViewToken(token) {
  return verifyPurposeToken(token, { purpose: SCHEDULED_DELETION_VIEW_PURPOSE })
}

/**
 * Relationship consent tokens.
 *
 * Dispatch docs mention webhook-verify.js with type='relationship_consent'.
 * We reuse this same HMAC family (createHmac + timingSafeEqual) via purpose
 * tokens — purpose/type = `relationship_consent`. Do not invent a parallel
 * crypto stack.
 */
export const RELATIONSHIP_CONSENT_PURPOSE = 'relationship_consent'

/** 7-day TTL for relationship consent Accept/Reject links. */
export const RELATIONSHIP_CONSENT_TTL_SECONDS = 7 * 24 * 60 * 60

export function signRelationshipConsentToken({
  relationshipId,
  contactId,
  jti,
  ttlSeconds = RELATIONSHIP_CONSENT_TTL_SECONDS,
}) {
  if (!relationshipId) throw new Error('relationshipId is required')
  if (!contactId) throw new Error('contactId is required')
  if (!jti) throw new Error('jti is required')
  return signPurposeToken({
    purpose: RELATIONSHIP_CONSENT_PURPOSE,
    ttlSeconds,
    claims: {
      relationship_id: relationshipId,
      contact_id: contactId,
      jti: String(jti),
    },
  })
}

export function verifyRelationshipConsentToken(token) {
  return verifyPurposeToken(token, { purpose: RELATIONSHIP_CONSENT_PURPOSE })
}
