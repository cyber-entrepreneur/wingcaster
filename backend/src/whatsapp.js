/**
 * WhatsApp Cloud API client for REB.
 * Uses META_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID from env.
 * Per-tenant OAuth connections override env when present.
 */
import { FEATURES } from './lib/credits/features.js'
import { meterFeature } from './lib/credits/meter.js'
import { resolveConnectionCredentials } from './lib/credentials.js'

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0'
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`

export function getWhatsAppConfig() {
  return {
    accessToken: process.env.META_ACCESS_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    wabaId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
    appId: process.env.META_APP_ID || '',
    appSecret: process.env.META_APP_SECRET || '',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'reb-whatsapp-verify',
    defaultRecipient: (process.env.WHATSAPP_DEFAULT_RECIPIENT || '').replace(/\D/g, ''),
    publicAppUrl: process.env.PUBLIC_APP_URL || 'http://localhost:7100',
  }
}

export function isWhatsAppConfigured() {
  const cfg = getWhatsAppConfig()
  return Boolean(cfg.accessToken && cfg.phoneNumberId && cfg.wabaId)
}

/**
 * Resolve WhatsApp API credentials for a tenant connection, preferring OAuth-stored
 * tokens over the global env fallback.
 */
export function resolveWhatsAppCredentials(connection = null) {
  const envCfg = getWhatsAppConfig()
  if (connection) {
    const creds = resolveConnectionCredentials(connection)
    if (creds?.wa_access_token_override && creds?.wa_phone_number_id) {
      return {
        accessToken: creds.wa_access_token_override,
        phoneNumberId: creds.wa_phone_number_id,
        wabaId: creds.wa_business_account_id || envCfg.wabaId,
        appId: envCfg.appId,
        appSecret: envCfg.appSecret,
        verifyToken: envCfg.verifyToken,
        defaultRecipient: envCfg.defaultRecipient,
        publicAppUrl: envCfg.publicAppUrl,
        source: 'tenant',
      }
    }
  }
  return {
    ...envCfg,
    source: envCfg.accessToken && envCfg.phoneNumberId ? 'env' : 'none',
  }
}

export function isTenantWhatsAppConfigured(connection) {
  const cfg = resolveWhatsAppCredentials(connection)
  return Boolean(cfg.accessToken && cfg.phoneNumberId && cfg.source === 'tenant')
}

function normalizePhone(phone) {
  if (!phone) return ''
  return String(phone).replace(/[^\d]/g, '')
}

async function graphRequest(path, { method = 'GET', body, config = null } = {}) {
  const cfg = config || getWhatsAppConfig()
  if (!cfg.accessToken) {
    throw new Error('META_ACCESS_TOKEN is not configured')
  }
  const url = path.startsWith('http') ? path : `${GRAPH_BASE}${path}`
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${cfg.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.error?.message || `WhatsApp API error (${res.status})`
    const err = new Error(msg)
    err.status = res.status
    err.details = data?.error || data
    throw err
  }
  return data
}

export async function getWhatsAppHealth(connection = null) {
  const cfg = resolveWhatsAppCredentials(connection)
  if (!cfg.accessToken || !cfg.phoneNumberId) {
    return {
      configured: false,
      healthy: false,
      error: 'Missing META_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, or WHATSAPP_BUSINESS_ACCOUNT_ID',
    }
  }
  try {
    const phone = await graphRequest(
      `/${cfg.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,code_verification_status`,
      { config: cfg },
    )
    return {
      configured: true,
      healthy: true,
      phone_number_id: cfg.phoneNumberId,
      waba_id: cfg.wabaId,
      display_phone_number: phone.display_phone_number,
      verified_name: phone.verified_name,
      quality_rating: phone.quality_rating,
      code_verification_status: phone.code_verification_status,
    }
  } catch (e) {
    return {
      configured: true,
      healthy: false,
      phone_number_id: cfg.phoneNumberId,
      waba_id: cfg.wabaId,
      error: e.message,
      details: e.details,
    }
  }
}

export function buildListingChatCard(property, { listingUrl } = {}) {
  const photos = Array.isArray(property.photos)
    ? property.photos
    : String(property.photos || '').split('|').filter(Boolean)
  const price = Number(property.price || 0).toLocaleString('en-US')
  const unit = property.type === 'rent' && property.price_unit ? `/${property.price_unit}` : ''
  const beds = property.bedrooms != null ? `${property.bedrooms} bed` : ''
  const baths = property.bathrooms != null ? `${property.bathrooms} bath` : ''
  const area = property.area ? `${property.area} ${property.area_unit || 'sqm'}` : ''
  const facts = [beds, baths, area].filter(Boolean).join(' · ')
  const url = listingUrl || `${getWhatsAppConfig().publicAppUrl}/property/${property.id}`

  const body = [
    `🏠 *${property.title}*`,
    `${property.type === 'rent' ? 'For Rent' : 'For Sale'} · $${price}${unit}`,
    property.location ? `📍 ${property.location}` : null,
    facts || null,
    property.reference ? `Ref: ${property.reference}` : null,
    '',
    'View details:',
    url,
    '',
    property.agent_name ? `Agent: ${property.agent_name}` : null,
    property.agency_name ? `Agency: ${property.agency_name}` : null,
  ].filter((line) => line !== null).join('\n')

  return {
    body,
    imageUrl: photos[0] || null,
    listingUrl: url,
  }
}

export async function sendWhatsAppText(to, body, creditContext, { config = null } = {}) {
  return meterFeature(
    FEATURES.COMMUNICATION_WHATSAPP_CONVERSATION_WINDOW_24H,
    { creditContext, relatedEntityId: to },
    async () => {
  const cfg = config || getWhatsAppConfig()
  const phone = normalizePhone(to)
  if (!phone) throw new Error('Recipient phone number is required (international format, digits only)')
  if (!body?.trim()) throw new Error('Message body is required')

  return graphRequest(`/${cfg.phoneNumberId}/messages`, {
    method: 'POST',
    body: {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'text',
      text: { preview_url: true, body: body.trim() },
    },
    config: cfg,
  })
    },
  )
}

export async function sendWhatsAppImage(to, { link, caption, config = null }) {
  const cfg = config || getWhatsAppConfig()
  const phone = normalizePhone(to)
  if (!phone) throw new Error('Recipient phone number is required')
  if (!link) throw new Error('Image link is required')

  return graphRequest(`/${cfg.phoneNumberId}/messages`, {
    method: 'POST',
    body: {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'image',
      image: {
        link,
        caption: (caption || '').slice(0, 1024),
      },
    },
    config: cfg,
  })
}

export async function sendWhatsAppInteractive(to, payload, { config = null } = {}) {
  const cfg = config || getWhatsAppConfig()
  const phone = normalizePhone(to)
  if (!phone) throw new Error('Recipient phone number is required')

  return graphRequest(`/${cfg.phoneNumberId}/messages`, {
    method: 'POST',
    body: {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'interactive',
      interactive: payload,
    },
    config: cfg,
  })
}

export async function sendListingToWhatsApp(property, to, creditContext, { config = null } = {}) {
  return meterFeature(
    FEATURES.PUBLISHING_SOCIAL_WHATSAPP,
    { creditContext, listingId: property?.id, relatedEntityId: property?.id },
    async () => {
  const cfg = config || getWhatsAppConfig()
  const card = buildListingChatCard(property)
  const recipient = normalizePhone(to) || cfg.defaultRecipient
  if (!recipient) {
    const err = new Error('No WhatsApp recipient. Set connection notify number or WHATSAPP_DEFAULT_RECIPIENT.')
    err.code = 'MISSING_RECIPIENT'
    throw err
  }

  const inner = { ...(creditContext || {}), skipMetering: true }
  let response
  if (card.imageUrl && /^https?:\/\//i.test(card.imageUrl)) {
    try {
      response = await sendWhatsAppImage(recipient, { link: card.imageUrl, caption: card.body, config: cfg })
    } catch {
      response = await sendWhatsAppText(recipient, card.body, inner, { config: cfg })
    }
  } else {
    response = await sendWhatsAppText(recipient, card.body, inner, { config: cfg })
  }

  return {
    recipient,
    card,
    message_id: response?.messages?.[0]?.id || null,
    response,
  }
    },
  )
}

function extractMediaIds(message) {
  const media = []
  if (message.image?.id) media.push({ id: message.image.id, type: 'image', mimeType: message.image.mime_type || 'image/jpeg' })
  if (message.video?.id) media.push({ id: message.video.id, type: 'video', mimeType: message.video.mime_type || 'video/mp4' })
  if (message.audio?.id) media.push({ id: message.audio.id, type: 'audio', mimeType: message.audio.mime_type || 'audio/mpeg' })
  if (message.voice?.id) media.push({ id: message.voice.id, type: 'voice', mimeType: message.voice.mime_type || 'audio/ogg' })
  if (message.document?.id) media.push({ id: message.document.id, type: 'document', mimeType: message.document.mime_type || 'application/pdf' })
  return media
}

export function parseIncomingWhatsAppWebhook(payload) {
  const events = []
  const entries = payload?.entry || []
  for (const entry of entries) {
    for (const change of entry.changes || []) {
      const value = change.value || {}
      const contacts = value.contacts || []
      const contactName = contacts[0]?.profile?.name || ''
      for (const message of value.messages || []) {
        const media = extractMediaIds(message)
        const text = message.text?.body || message.button?.text || message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || ''
        events.push({
          type: 'message',
          waba_id: entry.id,
          from: message.from,
          name: contactName,
          message_id: message.id,
          timestamp: message.timestamp,
          text,
          interactive_id: message.interactive?.button_reply?.id || message.interactive?.list_reply?.id || null,
          media,
          media_ids: media.map((m) => m.id),
          raw_type: message.type,
        })
      }
      for (const status of value.statuses || []) {
        events.push({
          type: 'status',
          waba_id: entry.id,
          message_id: status.id,
          status: status.status,
          recipient_id: status.recipient_id,
          timestamp: status.timestamp,
        })
      }
    }
  }
  return events
}
