/**
 * Telegram channel publishing via Bot API.
 *
 * Tenants store a bot token (encrypted) and target channel id / @handle
 * on their marketplace_connection.settings.
 */

import { v4 as uuidv4 } from 'uuid'
import { tryDecrypt } from '../credentials.js'

const API_BASE = 'https://api.telegram.org'

function resolveBotToken(connection) {
  const settings = connection?.settings || {}
  const creds = settings.credentials || {}
  const targets = settings.enterprise_targets || {}
  return (
    tryDecrypt(creds.access_token_encrypted)
    || tryDecrypt(targets.telegram_bot_token_encrypted)
    || tryDecrypt(settings.bot_token_encrypted)
    || process.env.TELEGRAM_BOT_TOKEN
    || null
  )
}

function resolveChannelId(connection) {
  const settings = connection?.settings || {}
  const targets = settings.enterprise_targets || {}
  return (
    targets.telegram_channel_id
    || settings.channel_id
    || settings.handle
    || connection?.account_name
    || null
  )
}

export function isTelegramPublishConfigured(connection) {
  return Boolean(resolveBotToken(connection) && resolveChannelId(connection))
}

/**
 * Publish a photo post (or text-only) to a Telegram channel.
 */
export async function publishTelegramChannelPost({
  connection,
  caption,
  imageUrl = null,
  creditContext = null,
} = {}) {
  const token = resolveBotToken(connection)
  const chatId = resolveChannelId(connection)
  if (!token) {
    throw Object.assign(new Error('Telegram bot token is not configured on this connection'), {
      code: 'TELEGRAM_UNCONFIGURED',
    })
  }
  if (!chatId) {
    throw Object.assign(new Error('Telegram channel id or @handle is required on this connection'), {
      code: 'MISSING_TELEGRAM_CHANNEL',
    })
  }

  const text = String(caption || '').trim()
  const endpoint = imageUrl ? 'sendPhoto' : 'sendMessage'
  const body = imageUrl
    ? { chat_id: chatId, photo: imageUrl, caption: text || undefined }
    : { chat_id: chatId, text: text || ' ' }

  const res = await fetch(`${API_BASE}/bot${token}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.ok === false) {
    const err = new Error(
      `Telegram publish error (${res.status}): ${data?.description || JSON.stringify(data).slice(0, 200)}`,
    )
    err.code = data?.error_code ? `TELEGRAM_${data.error_code}` : `TELEGRAM_${res.status}`
    err.details = data
    throw err
  }

  const messageId = data?.result?.message_id

  return {
    ok: true,
    provider: 'telegram_bot_api',
    provider_message_id: messageId != null ? String(messageId) : null,
    publish_id: messageId != null ? String(messageId) : `tg_${uuidv4()}`,
    external_url: null,
    simulated: false,
  }
}
