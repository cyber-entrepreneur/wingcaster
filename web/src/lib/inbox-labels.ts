/** Human labels for conversation transport channels (AGT-INB-001/005). */
export const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  email: 'Email',
  instagram_dm: 'Instagram DM',
  instagram_comment: 'Instagram Comment',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  tiktok_dm: 'TikTok DM',
  tiktok_comment: 'TikTok Comment',
  x: 'X',
  x_dm: 'X DM',
  x_mention: 'X Mention',
  facebook_messenger: 'Facebook Messenger',
  facebook_comment: 'Facebook Comment',
  messenger: 'Messenger',
  linkedin: 'LinkedIn',
  linkedin_comment: 'LinkedIn Comment',
  telegram: 'Telegram',
  direct: 'Direct',
  wingcaster_webhook: 'WingCaster',
}

/** Human labels for inquiry origin sources (AGT-INB-001/005). */
export const SOURCE_LABELS: Record<string, string> = {
  direct: 'Direct',
  agent_profile: 'Agent profile',
  agency_profile: 'Agency profile',
  white_label: 'White-label',
  widget: 'Widget',
  bazaar: 'Bazaar',
  olx: 'OLX',
  bayut: 'Bayut',
  property_finder: 'Property Finder',
  dubizzle: 'Dubizzle',
  aqar: 'Aqar',
  wasalt: 'Wasalt',
  aqarmap: 'Aqarmap',
  '3akarat': '3akarat',
  instagram: 'Instagram',
  unknown: 'Unknown',
}

export function channelLabel(channel: string | null | undefined): string {
  const key = String(channel || '').toLowerCase()
  return CHANNEL_LABELS[key] || (key ? key.replace(/_/g, ' ') : 'Direct')
}

export function sourceLabel(source: string | null | undefined): string {
  const key = String(source || 'direct').toLowerCase()
  return SOURCE_LABELS[key] || key.replace(/_/g, ' ')
}

/** Filter chip options — transport channels. */
export const INBOX_CHANNEL_FILTERS = [
  'whatsapp',
  'email',
  'sms',
  'instagram_dm',
  'facebook_messenger',
  'tiktok',
  'x_dm',
  'linkedin',
  'telegram',
] as const

/** Filter chip options — origin sources. */
export const INBOX_SOURCE_FILTERS = [
  'direct',
  'bazaar',
  'bayut',
  'property_finder',
  'dubizzle',
  'olx',
  'aqar',
  'wasalt',
  'aqarmap',
  '3akarat',
  'widget',
  'white_label',
  'agent_profile',
  'agency_profile',
] as const
