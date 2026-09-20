import { PLATFORM_KEYS } from '../../modules/social-cards/dimensions.js'
import { POST_TONES } from '../../lib/credits/ai-producers/config.js'

export const CREATIVE_SOURCES = new Set(['manual', 'ai'])
export const CREATIVE_APPROVAL_STATES = new Set(['not_required', 'pending', 'approved', 'rejected'])
export const CREATIVE_STATUSES = new Set(['draft', 'ready', 'published', 'archived'])
export const RENDITION_PROVIDERS = new Set(['local', 'bannerbear'])
export const RENDITION_STATUSES = new Set(['pending', 'rendering', 'ready', 'failed'])
export const APPROVAL_REQUEST_STATES = new Set(['pending', 'approved', 'rejected'])

export const VARIANT_COUNT = 4
export const VARIANT_TONES = POST_TONES.slice(0, VARIANT_COUNT)

export const PUBLIC_CHANNEL_KEYS = new Set(PLATFORM_KEYS)

/** Map dimension channel_key → AI caption channel key. */
export const CHANNEL_KEY_TO_AI_CHANNEL = {
  instagram_feed: 'instagram',
  instagram_story: 'instagram',
  instagram_reel: 'instagram',
  facebook_feed: 'facebook',
  facebook_story: 'facebook',
  tiktok: 'tiktok',
  x: 'x',
  linkedin: 'linkedin',
}

/** Map dimension channel_key → publish-social platform payload. */
export const CHANNEL_KEY_TO_PUBLISH = {
  instagram_feed: { platform: 'instagram' },
  instagram_story: { platform: 'instagram', format: 'story' },
  instagram_reel: { platform: 'instagram', format: 'reel' },
  facebook_feed: { platform: 'facebook' },
  facebook_story: { platform: 'facebook', format: 'story' },
  tiktok: { platform: 'tiktok' },
  x: { platform: 'x' },
  linkedin: { platform: 'linkedin' },
}

export function aiChannelsForKeys(channelKeys) {
  const set = new Set()
  for (const key of channelKeys) {
    const mapped = CHANNEL_KEY_TO_AI_CHANNEL[key]
    if (mapped) set.add(mapped)
  }
  return [...set]
}

export function hasPublicChannels(channelKeys) {
  return channelKeys.some((key) => PUBLIC_CHANNEL_KEYS.has(key))
}

export function variantLabelForTone(tone) {
  const labels = {
    warm: 'Warm lifestyle',
    professional: 'Professional yield',
    concise: 'Price-led concise',
    luxury: 'Luxury aspirational',
  }
  return labels[tone] || tone
}
