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
  relatedEntityType = null,
  relatedEntityId = null,
  extras = {},
}) {
  try {
    const usage = providerResult.usage || { inputTokens: 0, outputTokens: 0 }
    const cost = estimateCostMicroUsd(providerResult.provider, providerResult.model, usage.inputTokens, usage.outputTokens)
    await insert('ai_call_usage', {
      id: uuidv4(),
      tenant_id: tenantId,
      feature,
      call_type: callType,
      provider: providerResult.provider,
      model: providerResult.model,
      input_tokens: Number(usage.inputTokens) || 0,
      output_tokens: Number(usage.outputTokens) || 0,
      cost_estimate_micro_usd: cost,
      fallback_from: providerResult.fallbackFrom || null,
      related_entity_type: relatedEntityType,
      related_entity_id: relatedEntityId,
      occurred_at: new Date().toISOString(),
      data: extras,
    })
  } catch (err) {
    logger.warn({ err, feature, callType }, 'recordAiCall failed — call succeeded, log did not')
  }
}
