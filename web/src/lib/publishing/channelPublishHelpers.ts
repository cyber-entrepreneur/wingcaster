import type { FeatureQuota } from '@/api/client'

/** Platform id → credits feature code (backend `FEATURES` registry). */
export const PLATFORM_PUBLISH_FEATURE: Record<string, string> = {
  instagram: 'publishing.social.instagram',
  facebook: 'publishing.social.facebook',
  tiktok: 'publishing.social.tiktok',
  x: 'publishing.social.x',
  linkedin: 'publishing.social.linkedin',
  whatsapp: 'publishing.social.whatsapp',
  telegram: 'publishing.social.telegram',
}

/** Default per-post credit unit when quota metadata is unavailable. */
export const DEFAULT_CHANNEL_CREDIT_COST = 1

export function creditCostForPlatform(platform: string, quotas: FeatureQuota[] = []) {
  const code = PLATFORM_PUBLISH_FEATURE[platform]
  if (!code) return DEFAULT_CHANNEL_CREDIT_COST
  const row = quotas.find((q) => q.feature_code === code)
  if (row?.typical_credits && row.typical_credits > 0) return row.typical_credits
  return DEFAULT_CHANNEL_CREDIT_COST
}

export function totalPublishCredits(platforms: string[], quotas: FeatureQuota[] = []) {
  return platforms.reduce((sum, p) => sum + creditCostForPlatform(p, quotas), 0)
}

export function defaultListingCaption(property: {
  title?: string
  city?: string
  location?: string
  price?: number | string
  description?: string
}) {
  const price = property.price ? `$${Number(property.price).toLocaleString()}` : ''
  const city = property.city || property.location || ''
  const head = `${property.title || 'Listing'}${city ? ` · ${city}` : ''}${price ? ` · ${price}` : ''}`
  const body = (property.description || '').trim().slice(0, 500)
  return body ? `${head}\n\n${body}` : `${head}\n\nAvailable on REB`
}
