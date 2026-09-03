/**
 * Thin wrap for feature adapters. When tenantId is present, charges via
 * withCredits; otherwise runs work unmetered so existing tests/callers
 * that have no tenant context still function.
 */
import { randomUUID } from 'node:crypto'
import { withCredits } from './with-credits.js'

export async function meterFeature(feature, opts, work) {
  const ctx = opts?.creditContext || {}
  const tenantId = ctx.tenantId || opts?.tenantId || null
  if (!tenantId || ctx.skipMetering) return work()
  return withCredits({
    tenantId,
    feature,
    requestId: ctx.requestId || `${feature}:${opts?.relatedEntityId || opts?.listingId || randomUUID()}`,
    callType: ctx.callType || 'default',
    relatedEntityType: ctx.relatedEntityType || null,
    relatedEntityId: ctx.relatedEntityId || opts?.listingId || opts?.relatedEntityId || null,
    creditsAmount: ctx.creditsAmount,
    consumeOnFailure: ctx.consumeOnFailure,
  }, work)
}
