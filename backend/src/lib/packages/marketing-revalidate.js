/**
 * On-demand ISR revalidation + confirm status store (BE-VERIFY-15).
 */
import { createHmac, randomUUID } from 'node:crypto'
import logger from '../logger.js'

export const MARKETING_REVALIDATE_TIMEOUT_MS = 4000
export const REVALIDATION_EVENT_TTL_MS = 60_000

const revalidationEvents = new Map()

function signBody(secret, body) {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
}

function pruneExpiredEvents(nowMs = Date.now()) {
  for (const [id, event] of revalidationEvents) {
    const created = Date.parse(event.created_at || 0)
    if (!Number.isFinite(created) || nowMs - created > REVALIDATION_EVENT_TTL_MS) {
      revalidationEvents.delete(id)
    }
  }
}

export function upsertRevalidationEvent(partial) {
  pruneExpiredEvents()
  const id = partial.id || randomUUID()
  const existing = revalidationEvents.get(id) || {}
  const next = {
    ...existing,
    ...partial,
    id,
    created_at: existing.created_at || partial.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  revalidationEvents.set(id, next)
  return next
}

export function getRevalidationEvent(id) {
  pruneExpiredEvents()
  return revalidationEvents.get(id) || null
}

export function clearRevalidationEvents() {
  revalidationEvents.clear()
}

export async function triggerMarketingRevalidate(reason = 'tier_updated', {
  packageId = null,
  versionId = null,
  environment = 'LIVE',
  eventId = null,
} = {}) {
  const url = process.env.MARKETING_REVALIDATE_URL
  const secret = process.env.MARKETING_REVALIDATE_SECRET
  const event = upsertRevalidationEvent({
    id: eventId || undefined,
    reason,
    package_id: packageId,
    version_id: versionId,
    environment,
    status: 'pending',
  })

  if (!url || !secret) {
    logger.info({ reason, event_id: event.id }, 'marketing revalidate skipped — env not configured')
    return upsertRevalidationEvent({
      id: event.id,
      status: 'skipped',
      skipped: true,
      skip_reason: 'env_missing',
      confirmed: false,
    })
  }

  const generated_at = new Date().toISOString()
  const body = JSON.stringify({
    reason,
    generated_at,
    package_id: packageId,
    version_id: versionId,
    environment,
    event_id: event.id,
  })
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
      logger.warn({ reason, status: response.status, event_id: event.id }, 'marketing revalidate failed')
      return upsertRevalidationEvent({
        id: event.id, status: 'failed', ok: false, http_status: response.status, confirmed: false,
      })
    }
    return upsertRevalidationEvent({
      id: event.id, status: 'confirmed', ok: true, http_status: response.status,
      confirmed: true, confirmed_at: new Date().toISOString(),
    })
  } catch (error) {
    logger.warn({ reason, err: error.message, event_id: event.id }, 'marketing revalidate failed')
    return upsertRevalidationEvent({
      id: event.id, status: 'failed', ok: false, error: error.message, confirmed: false,
    })
  }
}
