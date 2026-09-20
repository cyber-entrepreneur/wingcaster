import { z } from 'zod'
import { DEFAULT_POST_CHANNELS } from './config.js'

const ratingScore = z.number().min(1).max(10)

export const propertyRatingSchema = z.object({
  ratings: z.object({
    quality: ratingScore,
    price_fairness: ratingScore,
    area_fit: ratingScore,
    presentation: ratingScore,
    overall: ratingScore,
  }),
  reasoning: z.object({
    quality: z.string().min(1),
    price_fairness: z.string().min(1),
    area_fit: z.string().min(1),
    presentation: z.string().min(1),
    overall: z.string().min(1),
  }),
})

export function captionsSchema(channels = DEFAULT_POST_CHANNELS) {
  const shape = {}
  for (const channel of channels) {
    shape[channel] = z.string().min(1)
  }
  return z.object({
    captions: z.object(shape).passthrough(),
  })
}

export function normalizeCaptionsEnvelope(parsed) {
  if (!parsed || typeof parsed !== 'object') return parsed
  if (parsed.captions && typeof parsed.captions === 'object') return parsed
  const hasChannelKey = DEFAULT_POST_CHANNELS.some((channel) => typeof parsed[channel] === 'string')
  if (hasChannelKey) return { captions: parsed }
  return parsed
}

export function variantsCaptionsSchema(channels = DEFAULT_POST_CHANNELS, tones = ['warm', 'professional', 'concise', 'luxury']) {
  const captionShape = {}
  for (const channel of channels) {
    captionShape[channel] = z.string().min(1)
  }
  const variantSchema = z.object({
    tone: z.enum(tones),
    label: z.string().min(1),
    captions: z.object(captionShape).passthrough(),
  })
  return z.object({
    variants: z.array(variantSchema).min(tones.length),
  })
}

export function normalizeVariantsEnvelope(parsed) {
  if (!parsed || typeof parsed !== 'object') return parsed
  if (Array.isArray(parsed.variants)) return parsed
  return parsed
}

export function parseWithSchema(schema, parsed, { normalize } = {}) {
  const input = typeof normalize === 'function' ? normalize(parsed) : parsed
  return schema.safeParse(input)
}
