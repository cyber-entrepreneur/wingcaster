/**
 * Dual-read / dual-write helpers for conversations.channel + conversations.source
 * while source_channel remains during the migration window (BE-BLOCKER-04).
 *
 * channel = transport (whatsapp, email, sms, instagram_dm, …)
 * source  = origin marketplace / direct (bazaar, bayut, property_finder, …)
 *
 * Derivation mirrors migration 318_conversations_channel_source_split.sql.
 */

export function deriveChannelFromSourceChannel(sourceChannel) {
  const raw = String(sourceChannel || '').trim()
  if (!raw) return 'direct'
  const sc = raw.toLowerCase()
  if (sc.startsWith('whatsapp')) return 'whatsapp'
  if (sc.startsWith('email')) return 'email'
  if (sc.startsWith('sms')) return 'sms'
  if (sc.startsWith('instagram') || sc.startsWith('ig_dm')) return 'instagram_dm'
  if (sc.startsWith('facebook') || sc.startsWith('fb_')) return 'facebook_messenger'
  if (sc.startsWith('tiktok')) return 'tiktok'
  if (sc.startsWith('x_dm') || sc.startsWith('twitter')) return 'x_dm'
  if (sc.startsWith('linkedin')) return 'linkedin'
  if (sc.startsWith('telegram')) return 'telegram'
  return 'direct'
}

export function deriveSourceFromSourceChannel(sourceChannel) {
  const sc = String(sourceChannel || '').toLowerCase()
  if (!sc) return 'direct'
  if (sc.includes('bazaar')) return 'bazaar'
  if (sc.includes('bayut')) return 'bayut'
  if (sc.includes('property_finder')) return 'property_finder'
  if (sc.includes('dubizzle')) return 'dubizzle'
  if (sc.includes('olx')) return 'olx'
  return 'direct'
}

/** Dual-read: prefer typed channel column, else derive from legacy source_channel. */
export function conversationChannel(conversation) {
  if (!conversation) return 'direct'
  if (conversation.channel != null && String(conversation.channel).trim() !== '') {
    return String(conversation.channel)
  }
  return deriveChannelFromSourceChannel(conversation.source_channel)
}

/** Dual-read: prefer typed source column, else derive from legacy source_channel. */
export function conversationSource(conversation) {
  if (!conversation) return 'direct'
  if (conversation.source != null && String(conversation.source).trim() !== '') {
    return String(conversation.source)
  }
  return deriveSourceFromSourceChannel(conversation.source_channel)
}

/**
 * Dual-write fields for INSERT/UPDATE. Always sets source_channel (legacy),
 * channel, and source. Optional explicit channel/source override the derived values.
 *
 * When callers pass an orchestrator transport key (e.g. `instagram_comment`),
 * that exact key is kept on `channel` / `source_channel` so dispatch routing
 * continues to work; marketplace origin still lands in `source`.
 */
export function dualWriteChannelSource({
  source_channel: sourceChannelInput,
  channel: channelInput,
  source: sourceInput,
} = {}) {
  const legacyOrTransport = sourceChannelInput != null && String(sourceChannelInput).trim() !== ''
    ? String(sourceChannelInput)
    : (channelInput != null && String(channelInput).trim() !== '' ? String(channelInput) : null)

  // Prefer explicit channel; else keep the transport key as-is when it is a
  // known orchestrator channel; else derive via the migration CASE mapping.
  let channel
  if (channelInput != null && String(channelInput).trim() !== '') {
    channel = String(channelInput)
  } else if (legacyOrTransport) {
    channel = String(legacyOrTransport)
  } else {
    channel = 'direct'
  }

  const source = sourceInput != null && String(sourceInput).trim() !== ''
    ? String(sourceInput)
    : deriveSourceFromSourceChannel(legacyOrTransport || channel)

  return {
    source_channel: legacyOrTransport || channel,
    channel,
    source,
  }
}

/** Present a conversation with channel/source always populated (dual-read). */
export function presentConversation(conversation) {
  if (!conversation) return conversation
  const channel = conversationChannel(conversation)
  const source = conversationSource(conversation)
  return {
    ...conversation,
    channel,
    source,
    source_channel: conversation.source_channel || channel,
  }
}

/** Match helper for (contact_id, transport-channel) lookup during dual-read window. */
export function conversationMatchesChannel(conversation, channel) {
  if (!conversation || channel == null) return false
  const key = String(channel)
  if (conversation.source_channel === key) return true
  if (conversation.channel === key) return true
  return conversationChannel(conversation) === key
}
