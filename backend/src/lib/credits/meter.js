/**
 * Thin wrap for feature adapters. When tenantId is present, charges via
 * withCredits; otherwise runs work unmetered so existing tests/callers
 * that have no tenant context still function.
 *
 * Canonical adapter pattern — extract internal work, wrap once at export:
 *
 *   async function _doPublish(opts) { ... actual API calls ... }
 *   export async function publish(opts = {}) {
 *     return meterFeature(FEATURES.SOME_FEATURE, opts, () => _doPublish(opts))
 *   }
 *
 * Do not call the exported function recursively from inside meterFeature
 * (no __charged bootstrap tricks); that pattern is error-prone and can
 * double-charge if refactored incorrectly.
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
