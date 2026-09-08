/**
 * Dual-read / dual-write helpers for conversations.channel + conversations.source
 * while `source_channel` remains the compatibility column (30-day window).
 *
 * Read: prefer `channel` / `source` when present, else derive from `source_channel`.
 * Write: always populate `channel`, `source`, AND `source_channel`.
 *
 * `source_channel` keeps the historical messaging discriminator (e.g.
 * `instagram_comment`) so outbound dispatch still routes comment vs DM
 * threads. Coarse `channel` is the transport used for dual-badge UI.
 */

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

export function present(value) {
  return value != null && String(value).trim() !== ''
}

function firstPresent(...values) {
  for (const value of values) {
    if (present(value)) return String(value)
  }
  return null
}

/** Mirror of migration 318 channel CASE (ILIKE). */
export function deriveChannelFromSourceChannel(sourceChannel) {
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
export function deriveSourceFromSourceChannel(sourceChannel) {
  const value = String(sourceChannel || '').toLowerCase()
  if (value.includes('bazaar')) return 'bazaar'
  if (value.includes('bayut')) return 'bayut'
  if (value.includes('property_finder')) return 'property_finder'
  if (value.includes('dubizzle')) return 'dubizzle'
  if (value.includes('olx')) return 'olx'
  return 'direct'
}

export function isCoarseChannel(value) {
  return COARSE_CHANNELS.has(String(value || '').toLowerCase())
}

/** Prefer `channel` if present, else derive from `source_channel`. */
export function readChannel(row) {
  if (present(row?.channel)) return String(row.channel)
  return deriveChannelFromSourceChannel(row?.source_channel)
}

/** Prefer `source` if present, else derive from `source_channel`. */
export function readSource(row) {
  if (present(row?.source)) return String(row.source)
  return deriveSourceFromSourceChannel(row?.source_channel)
}

/**
 * Messaging / compatibility key used by orchestrator dispatch and
 * one-thread-per-(contact, source_channel) identity.
 * Prefer historical `source_channel`, else compose from channel+source.
 */
export function readSourceChannel(row) {
  if (present(row?.source_channel)) return String(row.source_channel)
  const channel = readChannel(row)
  const source = readSource(row)
  if (source && source !== 'direct') return `${channel}:${source}`
  return channel
}

/**
 * Dual-write payload for conversations inserts/updates.
 * Always returns channel, source, and source_channel.
 *
 * `channel` on input may be a coarse transport (`whatsapp`) or a historical
 * messaging value (`instagram_comment`). Historical values are preserved on
 * `source_channel` and mapped onto the coarse `channel` column.
 */
export function conversationChannelSourceFields(input = {}) {
  const historical = firstPresent(input.source_channel, input.sourceChannel)
  const requestedChannel = firstPresent(input.channel)
  const requestedSource = firstPresent(input.source)

  const deriveFrom = historical || requestedChannel
  const channel = requestedChannel && isCoarseChannel(requestedChannel)
    ? requestedChannel
    : deriveChannelFromSourceChannel(deriveFrom)
  const source = requestedSource || deriveSourceFromSourceChannel(deriveFrom)

  let source_channel
  if (historical) {
    source_channel = historical
  } else if (requestedChannel && !isCoarseChannel(requestedChannel)) {
    source_channel = requestedChannel
  } else if (source && source !== 'direct') {
    source_channel = `${channel}:${source}`
  } else {
    source_channel = requestedChannel || channel
  }

  return { channel, source, source_channel }
}

/** Match a conversation to a messaging-channel lookup key during the dual-read window. */
export function matchesConversationChannel(row, messagingChannel) {
  if (!present(messagingChannel)) return false
  const key = String(messagingChannel)
  const storedCompat = firstPresent(row?.source_channel)
  if (storedCompat) {
    if (storedCompat === key) return true
    const prefix = `${key}:`
    if (storedCompat.startsWith(prefix)) return true
    return false
  }
  const storedChannel = firstPresent(row?.channel)
  if (!storedChannel) return false
  return storedChannel === key || storedChannel === deriveChannelFromSourceChannel(key)
}

/** Hydrate a conversation (or source_channel-bearing row) so all three fields are present. */
export function withChannelSource(row) {
  if (!row || typeof row !== 'object') return row
  return {
    ...row,
    channel: readChannel(row),
    source: readSource(row),
    source_channel: readSourceChannel(row),
  }
}
