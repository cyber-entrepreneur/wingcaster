import { FEATURES } from '../features.js'
import { recordAiCall, estimateCostMicroUsd } from '../../ai-usage-logger.js'
import { AI_PRODUCER_ERROR, codedError } from './errors.js'
import {
  DEFAULT_POST_CHANNELS,
  POST_TONES,
  pricingProviderName,
  producerConfig,
} from './config.js'
import { variantsCaptionsSchema, normalizeVariantsEnvelope } from './schemas.js'
import { runStructured } from './run-structured.js'
import { callOpenAiJsonObject, callAnthropicTool } from './providers.js'
import {
  postVariantsSystemPrompt,
  postVariantsUserPrompt,
} from './prompts/shared-post-variants.js'
import { postVariantsTool } from './prompts/anthropic/post-variants.js'
import { VARIANT_COUNT } from '../../../domain/creative/constants.js'

function requestedChannels(channels) {
  const list = Array.isArray(channels) && channels.length
    ? channels.map((c) => String(c).toLowerCase())
    : DEFAULT_POST_CHANNELS
  return [...new Set(list)]
}

function assertEnglish(language) {
  const resolved = String(language ?? 'en').toLowerCase()
  if (resolved === 'en') return resolved
  throw codedError(
    'Arabic prompt templates are Phase 2 — this call cannot generate Arabic captions in v1',
    AI_PRODUCER_ERROR.LANGUAGE_NOT_YET_SUPPORTED,
  )
}

/**
 * Generate ≥4 copy variants per channel, varying angle/tone across warm,
 * professional, concise, and luxury.
 */
export async function produceAiPostVariants(opts = {}) {
  assertEnglish(opts.language)
  const description = typeof opts.description === 'string' ? opts.description.trim() : ''
  if (!description) {
    throw codedError(
      'produceAiPostVariants requires a description from AI_LISTINGS_DESCRIBE',
      AI_PRODUCER_ERROR.INVALID_INPUT,
    )
  }

  const channels = requestedChannels(opts.channels)
  const variantCount = Math.max(VARIANT_COUNT, Number(opts.variantCount) || VARIANT_COUNT)
  const tones = POST_TONES.slice(0, variantCount)
  const cfg = producerConfig()
  const system = postVariantsSystemPrompt(tones)
  const user = postVariantsUserPrompt({
    description,
    propertyPayload: opts.propertyPayload,
    tones,
    channels,
  })
  const schema = variantsCaptionsSchema(channels, tones)
  const started = Date.now()

  const structured = await runStructured({
    provider: opts.provider,
    schema,
    normalize: normalizeVariantsEnvelope,
    callers: {
      openai: () => callOpenAiJsonObject({
        model: cfg.openai.postCreationModel,
        system,
        user,
        temperature: 0.55,
      }),
      anthropic: () => callAnthropicTool({
        model: cfg.anthropic.postCreationModel,
        system,
        user,
        tool: postVariantsTool(channels, tones),
        temperature: 0.55,
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

  await recordAiCall({
    tenantId: credit.tenantId || opts.tenantId || null,
    feature: FEATURES.AI_POST_CREATION,
    callType: credit.callType || 'produceAiPostVariants',
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
    relatedEntityType: credit.relatedEntityType || null,
    relatedEntityId: credit.relatedEntityId || opts.relatedEntityId || null,
    extras: { duration_ms: durationMs, request_id: credit.requestId || null, channels, variantCount },
  })

  const variants = structured.parsed.variants
  if (!Array.isArray(variants) || variants.length < VARIANT_COUNT) {
    throw codedError(
      `Expected at least ${VARIANT_COUNT} variants, got ${variants?.length || 0}`,
      AI_PRODUCER_ERROR.AI_STRUCTURED_OUTPUT_FAILED,
    )
  }

  return {
    ok: true,
    variants,
    provider: structured.provider,
    cost_micro_usd: cost,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
  }
}
