/**
 * Unit tests for WLB SSE short-lived tokens.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  mintWlbSseToken,
  redeemWlbSseToken,
  resetWlbSseTokenLedger,
  isWlbSseToken,
  WLB_SSE_TTL_SECONDS,
} from '../application/wlb-sse-token.js'
import { signToken } from '../../../auth.js'

beforeEach(() => {
  resetWlbSseTokenLedger()
})

describe('wlb-sse-token', () => {
  it('mints a 60s SSE-scoped token that redeems once', () => {
    const minted = mintWlbSseToken({ userId: 'agent-1', sessionId: 'sess-1' })
    expect(minted.expires_in).toBe(WLB_SSE_TTL_SECONDS)
    expect(isWlbSseToken(minted.sse_token)).toBe(true)

    const first = redeemWlbSseToken(minted.sse_token, { expectedSessionId: 'sess-1' })
    expect(first.ok).toBe(true)
    if (first.ok) {
      expect(first.userId).toBe('agent-1')
      expect(first.sessionId).toBe('sess-1')
    }

    const second = redeemWlbSseToken(minted.sse_token, { expectedSessionId: 'sess-1' })
    expect(second.ok).toBe(false)
    if (!second.ok) expect(second.error).toMatch(/already used/i)
  })

  it('rejects session JWT masquerading as SSE query token', () => {
    const sessionJwt = signToken({
      id: 'agent-1',
      verified_at: new Date().toISOString(),
      token_version: 0,
    })
    expect(isWlbSseToken(sessionJwt)).toBe(false)
    const redeemed = redeemWlbSseToken(sessionJwt, { expectedSessionId: 'sess-1' })
    expect(redeemed.ok).toBe(false)
  })

  it('rejects session_id mismatch', () => {
    const minted = mintWlbSseToken({ userId: 'agent-1', sessionId: 'sess-1' })
    const redeemed = redeemWlbSseToken(minted.sse_token, { expectedSessionId: 'other' })
    expect(redeemed.ok).toBe(false)
    if (!redeemed.ok) expect(redeemed.status).toBe(403)
  })
})
