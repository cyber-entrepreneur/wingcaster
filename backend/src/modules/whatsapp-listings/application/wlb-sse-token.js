/**
 * Short-lived, single-use SSE tokens for WhatsApp listing draft progress.
 *
 * EventSource cannot set Authorization headers, so the client mints a 60s
 * SSE-scoped JWT via POST /api/onboarding/wlb/session and passes it as
 * `?token=`. Full session JWTs must never appear in the SSE URL.
 */

import { randomUUID } from 'crypto'
import { signScopedToken, verifyToken } from '../../../auth.js'

export const WLB_SSE_PURPOSE = 'wlb_sse'
export const WLB_SSE_TTL_SECONDS = 60

/** @type {Map<string, number>} jti → expiry epoch ms */
const consumedJtis = new Map()

function pruneConsumed() {
  const now = Date.now()
  for (const [jti, expMs] of consumedJtis) {
    if (expMs <= now) consumedJtis.delete(jti)
  }
}

/**
 * Mint a 60s SSE-scoped token bound to agent + draft session.
 * @param {{ userId: string, sessionId: string, ttlSeconds?: number }} args
 */
export function mintWlbSseToken({ userId, sessionId, ttlSeconds = WLB_SSE_TTL_SECONDS }) {
  if (!userId || !sessionId) {
    throw new Error('userId and sessionId are required')
  }
  const jti = randomUUID()
  const token = signScopedToken(
    {
      id: userId,
      purpose: WLB_SSE_PURPOSE,
      session_id: sessionId,
      jti,
    },
    ttlSeconds,
  )
  return {
    sse_token: token,
    expires_in: ttlSeconds,
    jti,
  }
}

/**
 * @returns {{ ok: true, userId: string, sessionId: string, jti: string } | { ok: false, error: string, status: number }}
 */
export function redeemWlbSseToken(rawToken, { expectedSessionId } = {}) {
  pruneConsumed()
  const decoded = verifyToken(rawToken)
  if (!decoded || decoded.purpose !== WLB_SSE_PURPOSE) {
    return { ok: false, status: 401, error: 'Invalid SSE token' }
  }
  if (!decoded.id || !decoded.session_id || !decoded.jti) {
    return { ok: false, status: 401, error: 'Invalid SSE token' }
  }
  if (expectedSessionId && decoded.session_id !== expectedSessionId) {
    return { ok: false, status: 403, error: 'SSE token session mismatch' }
  }
  if (consumedJtis.has(decoded.jti)) {
    return { ok: false, status: 401, error: 'SSE token already used' }
  }
  const expMs = decoded.exp ? Number(decoded.exp) * 1000 : Date.now() + WLB_SSE_TTL_SECONDS * 1000
  consumedJtis.set(decoded.jti, expMs)
  return {
    ok: true,
    userId: decoded.id,
    sessionId: decoded.session_id,
    jti: decoded.jti,
  }
}

/** Test helper — clear the single-use ledger. */
export function resetWlbSseTokenLedger() {
  consumedJtis.clear()
}

/**
 * True when a raw string looks like a WLB SSE token (purpose claim present).
 */
export function isWlbSseToken(rawToken) {
  const decoded = verifyToken(rawToken)
  return Boolean(decoded && decoded.purpose === WLB_SSE_PURPOSE)
}
