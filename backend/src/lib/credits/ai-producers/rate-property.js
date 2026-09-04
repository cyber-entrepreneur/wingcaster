import { FEATURES } from '../features.js'
import { recordAiCall, estimateCostMicroUsd } from '../../ai-usage-logger.js'
import { findOne, update } from '../../../db.js'
import { AI_PRODUCER_ERROR, codedError } from './errors.js'
import { pricingProviderName, producerConfig } from './config.js'
import { propertyRatingSchema } from './schemas.js'
import { runStructured } from './run-structured.js'
import { callOpenAiJsonObject, callAnthropicTool } from './providers.js'
import { propertyRatingSystemPrompt, propertyRatingUserPrompt } from './prompts/openai/property-rating.js'
import { propertyRatingTool } from './prompts/anthropic/property-rating.js'

async function persistRatings(propertyId, aiRatings) {
  const existing = await findOne('properties', (p) => p.id === propertyId)
  if (!existing) {
    throw codedError(`Property ${propertyId} not found`, AI_PRODUCER_ERROR.PROPERTY_NOT_FOUND)
  }
  await update(
    'properties',
    (p) => p.id === propertyId,
    (p) => ({ ...p, ai_ratings: aiRatings, updated_at: new Date().toISOString() }),
  )
}

export async function produceRateProperty(opts = {}) {
  const propertyPayload = opts.propertyPayload && typeof opts.propertyPayload === 'object'
    ? opts.propertyPayload
    : {}
  const areaContext = opts.areaContext && typeof opts.areaContext === 'object'
    ? opts.areaContext
    : {}
  if (!Object.keys(propertyPayload).length) {
    throw codedError('rateProperty requires a propertyPayload', AI_PRODUCER_ERROR.INVALID_INPUT)
  }

  const cfg = producerConfig()
  const system = propertyRatingSystemPrompt()
  const user = propertyRatingUserPrompt({ propertyPayload, areaContext })
  const started = Date.now()

  const structured = await runStructured({
    provider: opts.provider,
    schema: propertyRatingSchema,
    callers: {
      openai: () => callOpenAiJsonObject({
        model: cfg.openai.propertyRatingModel,
        system,
        user,
        temperature: 0.2,
      }),
      anthropic: () => callAnthropicTool({
        model: cfg.anthropic.propertyRatingModel,
        system,
        user,
        tool: propertyRatingTool(),
        temperature: 0.2,
      }),
    },
  })

  const tokensIn = structured.usage?.inputTokens || 0
  const tokensOut = structured.usage?.outputTokens || 0
  const cost = estimateCostMicroUsd(
    pricingProviderName(structured.provider),
    structured.model,
    tokensIn,
    tokensOut,
  )
  const durationMs = Date.now() - started
  const credit = opts.creditContext || {}
  const ratings = structured.parsed.ratings
  const reasoning = structured.parsed.reasoning
  const propertyId = propertyPayload.id || opts.propertyId || opts.listingId || null

  const aiRatings = {
    ratings,
    reasoning,
    provider: structured.provider,
    model: structured.model,
    cost_micro_usd: cost,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    rated_at: new Date().toISOString(),
  }

  if (propertyId) {
    await persistRatings(propertyId, aiRatings)
  }

  await recordAiCall({
    tenantId: credit.tenantId || opts.tenantId || null,
    feature: FEATURES.AI_PROPERTY_RATING,
    callType: credit.callType || 'rateProperty',
    provider: structured.provider,
    model: structured.model,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    cost_micro_usd: cost,
    duration_ms: durationMs,
    request_id: credit.requestId || null,
    providerResult: {
      provider: structured.provider,
      model: structured.model,
      usage: { inputTokens: tokensIn, outputTokens: tokensOut },
      fallbackFrom: structured.provider === (opts.provider || cfg.primary) ? null : (opts.provider || cfg.primary),
    },
    relatedEntityType: credit.relatedEntityType || 'property',
    relatedEntityId: credit.relatedEntityId || propertyId,
    extras: { duration_ms: durationMs, request_id: credit.requestId || null },
  })

  return {
    ok: true,
    result: { ratings, reasoning },
    ratings,
    reasoning,
    provider: structured.provider,
    cost_micro_usd: cost,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
  }
}
