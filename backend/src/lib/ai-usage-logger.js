import { v4 as uuidv4 } from 'uuid'
import { insert } from '../persistence/postgres-adapter.js'
import { AI_PRICING } from './ai-pricing.js'
import { logger } from './logger.js'

/**
 * Cost estimation. Returns cost in micro-USD (USD × 10_000; multiply cents by 10000).
 * NULL if we don't have a pricing entry for this provider+model.
 */
export function estimateCostMicroUsd(provider, model, inputTokens, outputTokens) {
  const key = `${provider}:${model}`
  const price = AI_PRICING[key]
  if (!price) return null
  const inputCost = (Number(inputTokens) || 0) * price.inputPerMillionMicroUsd / 1_000_000
  const outputCost = (Number(outputTokens) || 0) * price.outputPerMillionMicroUsd / 1_000_000
  return Math.round(inputCost + outputCost)
}

/**
 * Record a single AI call. Best-effort — a failed insert must NOT break the
 * caller. The call already succeeded; observability is optional.
 */
export async function recordAiCall({
  tenantId = null,
  feature,
  callType,
  providerResult,
  provider,
  model,
  tokens_in,
  tokens_out,
  cost_micro_usd,
  duration_ms,
  request_id,
  relatedEntityType = null,
  relatedEntityId = null,
  extras = {},
}) {
  try {
    const resolvedProvider = providerResult?.provider || provider
    const resolvedModel = providerResult?.model || model
    const usage = providerResult?.usage || {
      inputTokens: tokens_in || 0,
      outputTokens: tokens_out || 0,
    }
    const pricingProvider = resolvedProvider === 'anthropic' ? 'claude' : resolvedProvider
    const cost = cost_micro_usd ?? estimateCostMicroUsd(
      pricingProvider,
      resolvedModel,
      usage.inputTokens,
      usage.outputTokens,
    )
    // toRow copies the whole insert item into the JSONB `data` column. Nested
    // `data: { request_id }` therefore lands at data.data.request_id. Keep
    // observability fields as top-level payload keys so they hydrate as
    // data.request_id / data.duration_ms on a raw SELECT.
    const { data: _nested, ...safeExtras } = extras || {}
    await insert('ai_call_usage', {
      id: uuidv4(),
      tenant_id: tenantId,
      feature,
      call_type: callType,
      provider: resolvedProvider,
      model: resolvedModel,
      input_tokens: Number(usage.inputTokens) || 0,
      output_tokens: Number(usage.outputTokens) || 0,
      cost_estimate_micro_usd: cost,
      fallback_from: providerResult?.fallbackFrom || null,
      related_entity_type: relatedEntityType,
      related_entity_id: relatedEntityId,
      occurred_at: new Date().toISOString(),
      ...safeExtras,
      duration_ms,
      request_id,
    })
  } catch (err) {
    logger.warn({ err, feature, callType }, 'recordAiCall failed — call succeeded, log did not')
  }
}
