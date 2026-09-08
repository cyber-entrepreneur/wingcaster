/**
 * Dual-read helpers for conversations.channel + conversations.source while
 * `source_channel` remains the compatibility field (30-day migration window).
 *
 * Read: prefer `channel` / `source` when present, else derive from `source_channel`.
 * Keep in sync with `backend/src/conversations/channel-source.js`.
 */

export type ChannelSourceRow = {
  channel?: string | null
  source?: string | null
  source_channel?: string | null
}

const COARSE_CHANNELS = new Set([
  'whatsapp',
  'email',
  'sms',
  'instagram_dm',
  'facebook_messenger',
  'tiktok',
  'x_dm',
  'linkedin',
  'telegram',
  'direct',
])

export function present(value: unknown): value is string {
  return value != null && String(value).trim() !== ''
}

/** Mirror of migration 318 channel CASE (ILIKE). */
export function deriveChannelFromSourceChannel(sourceChannel: string | null | undefined): string {
  const value = String(sourceChannel || '').toLowerCase()
  if (value.startsWith('whatsapp')) return 'whatsapp'
  if (value.startsWith('email')) return 'email'
  if (value.startsWith('sms')) return 'sms'
  if (value.startsWith('instagram') || value.startsWith('ig_dm')) return 'instagram_dm'
  if (value.startsWith('facebook') || value.startsWith('fb_')) return 'facebook_messenger'
  if (value.startsWith('tiktok')) return 'tiktok'
  if (value.startsWith('x_dm') || value.startsWith('twitter')) return 'x_dm'
  if (value.startsWith('linkedin')) return 'linkedin'
  if (value.startsWith('telegram')) return 'telegram'
  return 'direct'
}

/** Mirror of migration 318 source CASE (ILIKE). */
export function deriveSourceFromSourceChannel(sourceChannel: string | null | undefined): string {
  const value = String(sourceChannel || '').toLowerCase()
  if (value.includes('bazaar')) return 'bazaar'
  if (value.includes('bayut')) return 'bayut'
  if (value.includes('property_finder')) return 'property_finder'
  if (value.includes('dubizzle')) return 'dubizzle'
  if (value.includes('olx')) return 'olx'
  return 'direct'
}

export function isCoarseChannel(value: string | null | undefined): boolean {
  return COARSE_CHANNELS.has(String(value || '').toLowerCase())
}

/** Prefer `channel` if present, else derive from `source_channel`. */
export function readChannel(row: ChannelSourceRow | null | undefined): string {
  if (present(row?.channel)) return String(row.channel)
  return deriveChannelFromSourceChannel(row?.source_channel)
}

/** Prefer `source` if present, else derive from `source_channel`. */
export function readSource(row: ChannelSourceRow | null | undefined): string {
  if (present(row?.source)) return String(row.source)
  return deriveSourceFromSourceChannel(row?.source_channel)
}

/**
 * Messaging / compatibility key. Prefer historical `source_channel`, else
 * compose from channel+source.
 */
export function readSourceChannel(row: ChannelSourceRow | null | undefined): string {
  if (present(row?.source_channel)) return String(row.source_channel)
  const channel = readChannel(row)
  const source = readSource(row)
  if (source && source !== 'direct') return `${channel}:${source}`
  return channel
}
