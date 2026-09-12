/**
 * Unit tests for purpose-scoped HMAC signed tokens.
 */
import { createHmac } from 'node:crypto'
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  SCHEDULED_DELETION_VIEW_PURPOSE,
  SCHEDULED_DELETION_VIEW_TTL_SECONDS,
  RELATIONSHIP_CONSENT_PURPOSE,
  RELATIONSHIP_CONSENT_TTL_SECONDS,
  signPurposeToken,
  signScheduledDeletionViewToken,
  signRelationshipConsentToken,
  verifyPurposeToken,
  verifyScheduledDeletionViewToken,
  verifyRelationshipConsentToken,
} from './signed-token.js'

function craftExpiredToken(secret = process.env.JWT_SECRET) {
  const payload = {
    purpose: 'x',
    iat: Math.floor(Date.now() / 1000) - 120,
    exp: Math.floor(Date.now() / 1000) - 60,
  }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${sig}`
}

describe('signed-token', () => {
  const prev = process.env.JWT_SECRET

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-signed-token-secret'
  })

  afterEach(() => {
    if (prev === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = prev
  })

  it('round-trips a purpose token', () => {
    const token = signPurposeToken({
      purpose: 'scheduled_deletion_view',
      ttlSeconds: 60,
      claims: { deletion_request_id: 'dr_1', user_id: 'u_1' },
    })
    const verified = verifyPurposeToken(token, { purpose: 'scheduled_deletion_view' })
    expect(verified.ok).toBe(true)
    expect(verified.payload.deletion_request_id).toBe('dr_1')
    expect(verified.payload.user_id).toBe('u_1')
    expect(verified.payload.purpose).toBe(SCHEDULED_DELETION_VIEW_PURPOSE)
  })

  it('rejects tampered payloads', () => {
    const token = signPurposeToken({ purpose: 'x', ttlSeconds: 60, claims: { a: 1 } })
    const [body, sig] = token.split('.')
    const tampered = `${body.slice(0, -2)}aa.${sig}`
    const verified = verifyPurposeToken(tampered, { purpose: 'x' })
    expect(verified.ok).toBe(false)
    expect(verified.code).toBe('invalid_signature')
  })

  it('rejects wrong purpose', () => {
    const token = signPurposeToken({ purpose: 'a', ttlSeconds: 60 })
    const verified = verifyPurposeToken(token, { purpose: 'b' })
    expect(verified.ok).toBe(false)
    expect(verified.code).toBe('wrong_purpose')
  })

  it('rejects expired tokens', () => {
    const token = craftExpiredToken()
    const verified = verifyPurposeToken(token, { purpose: 'x' })
    expect(verified.ok).toBe(false)
    expect(verified.code).toBe('expired')
  })

  it('scheduled deletion helper uses 60-day purpose', () => {
    const token = signScheduledDeletionViewToken({ deletionRequestId: 'dr', userId: 'u' })
    const verified = verifyScheduledDeletionViewToken(token)
    expect(verified.ok).toBe(true)
    expect(verified.payload.purpose).toBe('scheduled_deletion_view')
    expect(verified.payload.exp - verified.payload.iat).toBe(SCHEDULED_DELETION_VIEW_TTL_SECONDS)
  })

  it('relationship consent helper uses relationship_consent purpose', () => {
    const token = signRelationshipConsentToken({
      relationshipId: 'rel_1',
      contactId: 'cnt_1',
      jti: 'jti_1',
    })
    const verified = verifyRelationshipConsentToken(token)
    expect(verified.ok).toBe(true)
    expect(verified.payload.purpose).toBe(RELATIONSHIP_CONSENT_PURPOSE)
    expect(verified.payload.relationship_id).toBe('rel_1')
    expect(verified.payload.contact_id).toBe('cnt_1')
    expect(verified.payload.jti).toBe('jti_1')
    expect(verified.payload.exp - verified.payload.iat).toBe(RELATIONSHIP_CONSENT_TTL_SECONDS)
  })
})
