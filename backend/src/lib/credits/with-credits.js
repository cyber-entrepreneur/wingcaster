/**
 * withCredits helper — reserve, run work, consume (or release on failure).
 * Wired to feature callers in PR D. Pulls actual_cost_micro_usd from
 * ai_call_usage when the call was AI-driven.
 */
import { query } from '../../db.js'
import { consume, release, reserve } from './engine.js'
import { FEATURES } from './features.js'

export async function loadAiCallCost({ tenantId, feature, relatedEntityId }) {
  const rows = await query(
    `SELECT COALESCE(SUM(cost_estimate_micro_usd), 0)::bigint AS qty
       FROM public.ai_call_usage
      WHERE ($1::text IS NULL OR tenant_id = $1)
        AND feature = $2
        AND ($3::text IS NULL OR related_entity_id = $3)`,
    [tenantId == null ? null : String(tenantId), feature, relatedEntityId || null],
  )
  const qty = Number(rows[0]?.qty || 0)
  return qty > 0 ? qty : null
}

export async function withCredits({
  tenantId,
  feature = FEATURES.WHATSAPP_LISTINGS,
  callType = 'default',
  requestId,
  creditsAmount,
  relatedEntityType = null,
  relatedEntityId = null,
  work,
} = {}) {
  await reserve({ tenantId, feature, requestId, creditsAmount })
  try {
    const result = await work()
    const actualCostMicroUsd = await loadAiCallCost({
      tenantId,
      feature,
      relatedEntityId: relatedEntityId || requestId,
    })
    await consume({
      tenantId,
      feature,
      requestId,
      callType,
      creditsAmount,
      actualCostMicroUsd,
      relatedEntityType,
      relatedEntityId,
    })
    return result
  } catch (error) {
    await release({ tenantId, feature, requestId }).catch(() => {})
    throw error
  }
}
