import { DEFAULT_POST_CHANNELS, POST_TONES } from '../config.js'

const CHANNEL_RULES = {
  instagram: 'Instagram: warm, aspirational, emoji-friendly, 3-5 hashtags.',
  facebook: 'Facebook: longer, feature-focused, community tone. Hashtags optional.',
  tiktok: 'TikTok: hook-first, casual, include a trending-sound placeholder such as [Sound: …], ≤5 hashtags.',
  x: 'X (Twitter): pithy, ≤280 characters including hashtags, 1-2 hashtags.',
  linkedin: 'LinkedIn: professional, market-context, no hashtags.',
  whatsapp: 'WhatsApp: brief, direct, exactly one call-to-action.',
}

export function postCreationSystemPrompt(tone) {
  const resolvedTone = POST_TONES.includes(tone) ? tone : 'warm'
  return `You are a real-estate social caption writer. Write English captions only.
Adapt the provided listing DESCRIPTION into per-channel captions. Do not invent a new listing from raw property fields. Do not add amenities, prices, or locations that are not already in the description.
Tone: ${resolvedTone}.
Return a JSON object with a "captions" key whose values are strings, one per requested channel.`
}

export function postCreationUserPrompt({ description, propertyPayload, tone, channels }) {
  const requested = (channels?.length ? channels : DEFAULT_POST_CHANNELS).map((c) => String(c).toLowerCase())
  const rules = requested.map((channel) => `- ${CHANNEL_RULES[channel] || `${channel}: match the platform's native voice.`}`).join('\n')
  const facts = summarizeFacts(propertyPayload)
  return `Listing description (source of truth — adapt this, do not rewrite from scratch):
${description}

Optional listing facts for call-to-action only (ignore anything not already supported by the description):
${facts}

Tone: ${POST_TONES.includes(tone) ? tone : 'warm'}
Channels:
${rules}

Return JSON:
{
  "captions": {
${requested.map((channel) => `    "${channel}": "string"`).join(',\n')}
  }
}`
}

function summarizeFacts(payload) {
  if (!payload || typeof payload !== 'object') return '(none)'
  const keys = ['title', 'city', 'neighborhood', 'location', 'price', 'price_unit', 'currency', 'bedrooms', 'bathrooms', 'area', 'area_unit', 'property_type']
  const facts = {}
  for (const key of keys) {
    if (payload[key] != null && payload[key] !== '') facts[key] = payload[key]
  }
  return Object.keys(facts).length ? JSON.stringify(facts) : '(none)'
}

export { CHANNEL_RULES }
