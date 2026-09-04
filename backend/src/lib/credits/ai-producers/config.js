const ANTHROPIC_MODEL_ALIASES = {
  'claude-3-haiku': 'claude-3-haiku-20240307',
}

export const DEFAULT_POST_CHANNELS = ['instagram', 'facebook', 'tiktok', 'x', 'linkedin', 'whatsapp']
export const POST_TONES = ['warm', 'professional', 'concise', 'luxury']

export function envOr(name, fallback) {
  const value = process.env[name]
  return value == null || value === '' ? fallback : value
}

export function resolveAnthropicModel(raw) {
  const model = raw || 'claude-3-haiku-20240307'
  return ANTHROPIC_MODEL_ALIASES[model] || model
}

export function producerConfig() {
  const primary = envOr('AI_PROVIDER_PRIMARY', 'openai').toLowerCase()
  const fallback = envOr('AI_PROVIDER_FALLBACK', 'anthropic').toLowerCase()
  return {
    primary: primary === 'claude' ? 'anthropic' : primary,
    fallback: fallback === 'claude' ? 'anthropic' : fallback,
    openai: {
      apiKey: envOr('OPENAI_API_KEY', ''),
      postCreationModel: envOr('OPENAI_MODEL_POST_CREATION', 'gpt-4o-mini'),
      propertyRatingModel: envOr('OPENAI_MODEL_PROPERTY_RATING', 'gpt-4o-mini'),
    },
    anthropic: {
      apiKey: envOr('ANTHROPIC_API_KEY', ''),
      postCreationModel: resolveAnthropicModel(envOr('ANTHROPIC_MODEL_POST_CREATION', 'claude-3-haiku')),
      propertyRatingModel: resolveAnthropicModel(envOr('ANTHROPIC_MODEL_PROPERTY_RATING', 'claude-3-haiku')),
    },
  }
}

/**
 * ai-pricing.js keys use `claude:` for Anthropic Haiku. Map the public
 * producer name so cost estimates resolve without changing the price table.
 */
export function pricingProviderName(provider) {
  return provider === 'anthropic' ? 'claude' : provider
}

export function providerOrder({ provider } = {}) {
  const cfg = producerConfig()
  const requested = provider === 'claude' ? 'anthropic' : provider
  const primary = requested || cfg.primary
  const fallback = primary === cfg.fallback ? (primary === 'openai' ? 'anthropic' : 'openai') : cfg.fallback
  const names = []
  if (primary) names.push(primary)
  if (fallback && !names.includes(fallback)) names.push(fallback)
  return names
}
