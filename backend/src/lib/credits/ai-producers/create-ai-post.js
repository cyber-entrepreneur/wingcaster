import { FEATURES } from '../features.js'
import { recordAiCall, estimateCostMicroUsd } from '../../ai-usage-logger.js'
import { AI_PRODUCER_ERROR, codedError } from './errors.js'
import { DEFAULT_POST_CHANNELS, POST_TONES, pricingProviderName, producerConfig } from './config.js'
import { captionsSchema, normalizeCaptionsEnvelope } from './schemas.js'
import { runStructured } from './run-structured.js'
import { callOpenAiJsonObject, callAnthropicTool } from './providers.js'
import { postCreationSystemPrompt, postCreationUserPrompt } from './prompts/openai/post-creation.js'
import { postCreationTool } from './prompts/anthropic/post-creation.js'

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

export async function produceAiPost(opts = {}) {
  assertEnglish(opts.language)
  const description = typeof opts.description === 'string' ? opts.description.trim() : ''
  if (!description) {
    throw codedError(
      'createAiPost requires a description from AI_LISTINGS_DESCRIBE',
      AI_PRODUCER_ERROR.INVALID_INPUT,
    )
  }

  const channels = requestedChannels(opts.channels)
  const tone = POST_TONES.includes(opts.tone) ? opts.tone : 'warm'
  const cfg = producerConfig()
  const system = postCreationSystemPrompt(tone)
  const user = postCreationUserPrompt({
    description,
    propertyPayload: opts.propertyPayload,
    tone,
    channels,
  })
  const schema = captionsSchema(channels)
  const started = Date.now()

  const structured = await runStructured({
    provider: opts.provider,
    schema,
    normalize: normalizeCaptionsEnvelope,
    callers: {
      openai: () => callOpenAiJsonObject({
        model: cfg.openai.postCreationModel,
        system,
        user,
        temperature: 0.4,
      }),
      anthropic: () => callAnthropicTool({
        model: cfg.anthropic.postCreationModel,
        system,
        user,
        tool: postCreationTool(channels),
        temperature: 0.4,
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
    callType: credit.callType || 'createAiPost',
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
    extras: { duration_ms: durationMs, request_id: credit.requestId || null, channels, tone },
  })

  const captions = structured.parsed.captions
  return {
    ok: true,
    result: { captions },
    captions,
    provider: structured.provider,
    cost_micro_usd: cost,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
  }
}
