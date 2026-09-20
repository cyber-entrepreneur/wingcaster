import { CHANNEL_RULES } from './shared-post-creation.js'

export function postVariantsSystemPrompt(tones) {
  const toneList = tones.join(', ')
  return `You are a real-estate social caption writer. Write English captions only.
Adapt the provided listing DESCRIPTION into multiple creative angles for social channels.
Each variant must use a distinct tone/angle from: ${toneList}.
Do not invent amenities, prices, or locations not supported by the description.
Return a JSON object with a "variants" array. Each variant needs: tone, label, captions (per channel).`
}

export function postVariantsUserPrompt({ description, propertyPayload, tones, channels }) {
  const requested = channels.map((c) => String(c).toLowerCase())
  const rules = requested.map((channel) =>
    `- ${CHANNEL_RULES[channel] || `${channel}: match the platform's native voice.`}`,
  ).join('\n')
  const facts = summarizeFacts(propertyPayload)
  const variantLines = tones.map((tone, i) => `  Variant ${i + 1}: tone="${tone}", distinct angle`).join('\n')

  return `Listing description (source of truth):
${description}

Optional listing facts for CTA only:
${facts}

Channels:
${rules}

Generate exactly ${tones.length} variants:
${variantLines}

Return JSON:
{
  "variants": [
    {
      "tone": "warm",
      "label": "short human label",
      "captions": { ${requested.map((ch) => `"${ch}": "string"`).join(', ')} }
    }
  ]
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
