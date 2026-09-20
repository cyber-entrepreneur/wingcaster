/** Platforms that publish organic social content (Path B consolidated). */
export const SOCIAL_PUBLISH_PLATFORMS = new Set([
  'instagram',
  'facebook',
  'linkedin',
  'x',
  'tiktok',
  'telegram',
  'whatsapp',
])

/** Public broadcast — no per-contact consent; connection health only. */
export const PUBLIC_SOCIAL_PLATFORMS = new Set([
  'instagram',
  'facebook',
  'linkedin',
  'x',
  'tiktok',
  'telegram',
])

/** Owned messaging — consent-gated when sending to a person. */
export const OWNED_MESSAGING_PLATFORMS = new Set(['whatsapp'])

export function isSocialPublishPlatform(platform) {
  return SOCIAL_PUBLISH_PLATFORMS.has(String(platform || '').toLowerCase())
}

export function isPublicSocialPlatform(platform) {
  return PUBLIC_SOCIAL_PLATFORMS.has(String(platform || '').toLowerCase())
}

export function channelConnectionIdForMarketplaceConnection(connectionId) {
  if (!connectionId) return null
  return `chn_mc_${connectionId}`
}
