/**
 * On-demand ISR revalidation hook for wingcaster-www.
 *
 * Scaffold: PA save/approve (companion PR) calls this after a published
 * marketing-field change. Failures are logged and never break the PA write.
 */
import { createHmac } from 'node:crypto'
import logger from '../logger.js'

export const MARKETING_REVALIDATE_TIMEOUT_MS = 4000

function signBody(secret, body) {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
}

export async function triggerMarketingRevalidate(reason = 'tier_updated') {
  const url = process.env.MARKETING_REVALIDATE_URL
  const secret = process.env.MARKETING_REVALIDATE_SECRET
  if (!url || !secret) {
    logger.info({ reason }, 'marketing revalidate skipped — env not configured')
    return { skipped: true, reason: 'env_missing' }
  }

  const generated_at = new Date().toISOString()
  const body = JSON.stringify({ reason, generated_at })
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Wingcaster-Signature': signBody(secret, body),
      },
      body,
      signal: AbortSignal.timeout(MARKETING_REVALIDATE_TIMEOUT_MS),
    })
    if (!response.ok) {
      logger.warn(
        { reason, status: response.status },
        'marketing revalidate failed',
      )
      return { skipped: false, ok: false, status: response.status }
    }
    return { skipped: false, ok: true, status: response.status }
  } catch (error) {
    logger.warn({ reason, err: error.message }, 'marketing revalidate failed')
    return { skipped: false, ok: false, error: error.message }
  }
}
