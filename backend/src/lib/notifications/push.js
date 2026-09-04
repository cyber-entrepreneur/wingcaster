/**
 * FCM push transport for consumer notifications.
 *
 * JWT signing, OAuth2 access-token generation, and the 1-hour token cache
 * are handled by google-auth-library (a direct dependency; firebase-admin
 * uses it internally). Do not roll your own JWT.
 *
 * Env:
 *   FCM_SERVICE_ACCOUNT_JSON  service-account JSON (raw or base64)
 *   FCM_PROJECT_ID            optional override of JSON project_id
 *
 * Web tokens are stored and sent via FCM's webpush payload. Native WebPush
 * (VAPID / service worker) is a follow-up and is not implemented here.
 */

import logger from '../logger.js'
import { query } from '../../db.js'

export const FCM_MAX_BATCH = 500

const INVALID_TOKEN_CODES = new Set([
  'messaging/invalid-argument',
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-recipient',
  'INVALID_ARGUMENT',
  'NOT_FOUND',
])

let messagingOverride = null

function unconfiguredError() {
  const err = new Error('FCM credentials not set — configure FCM_SERVICE_ACCOUNT_JSON env var')
  err.code = 'PUSH_UNCONFIGURED'
  return err
}

export function parseServiceAccount() {
  const raw = process.env.FCM_SERVICE_ACCOUNT_JSON
  if (!raw || !String(raw).trim()) return null
  const trimmed = String(raw).trim()
  try {
    const json = trimmed.startsWith('{')
      ? trimmed
      : Buffer.from(trimmed, 'base64').toString('utf8')
    const parsed = JSON.parse(json)
    if (!parsed || typeof parsed !== 'object') return null
    if (!parsed.client_email || !parsed.private_key) return null
    return parsed
  } catch {
    return null
  }
}

export function isPushConfigured() {
  return Boolean(parseServiceAccount())
}

export function getFcmProjectId(serviceAccount = parseServiceAccount()) {
  const override = String(process.env.FCM_PROJECT_ID || '').trim()
  if (override) return override
  const fromJson = String(serviceAccount?.project_id || '').trim()
  return fromJson || null
}

/** Test hook — inject a fake messaging client (no network). */
export function _setMessagingForTests(client) {
  messagingOverride = client
}

/** Test hook — drop the injected client so the next test starts clean. */
export function _resetPushForTests() {
  messagingOverride = null
}

async function getMessagingClient() {
  if (messagingOverride) return messagingOverride
  const serviceAccount = parseServiceAccount()
  if (!serviceAccount) throw unconfiguredError()

  const { initializeApp, getApps, cert } = await import('firebase-admin/app')
  const { getMessaging } = await import('firebase-admin/messaging')
  const projectId = getFcmProjectId(serviceAccount)
  const existing = getApps()
  const app = existing.length
    ? existing[0]
    : initializeApp({
      credential: cert(serviceAccount),
      projectId: projectId || undefined,
    })
  return getMessaging(app)
}

function stringifyData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined
  const out = {}
  for (const [key, value] of Object.entries(data)) {
    if (value == null) continue
    out[String(key)] = typeof value === 'string' ? value : JSON.stringify(value)
  }
  return Object.keys(out).length ? out : undefined
}

function isUrgentPriority(priority) {
  return String(priority || '').toLowerCase() === 'urgent'
}

export function buildFcmMessage(row, { title, body, data, priority } = {}) {
  const notification = {
    title: title || '',
    body: body || '',
  }
  const stringData = stringifyData(data)
  const base = {
    token: row.token,
    notification,
    ...(stringData ? { data: stringData } : {}),
  }
  const high = isUrgentPriority(priority)

  if (row.platform === 'ios') {
    return {
      ...base,
      apns: {
        headers: { 'apns-priority': high ? '10' : '5' },
        payload: {
          aps: {
            alert: { title: notification.title, body: notification.body },
            sound: 'default',
          },
        },
      },
    }
  }

  if (row.platform === 'android') {
    return {
      ...base,
      android: {
        priority: high ? 'high' : 'normal',
        notification: {
          ...notification,
          channelId: 'default',
        },
      },
    }
  }

  return {
    ...base,
    webpush: {
      notification,
      ...(data?.deep_link_url ? { fcmOptions: { link: String(data.deep_link_url) } } : {}),
    },
  }
}

function tokenErrorCode(error) {
  return String(
    error?.code
    || error?.errorInfo?.code
    || error?.errorInfo?.status
    || '',
  )
}

export function isStaleTokenError(error) {
  const code = tokenErrorCode(error)
  if (INVALID_TOKEN_CODES.has(code)) return true
  const message = String(error?.message || '')
  return /registration-token-not-registered|invalid-registration-token|NOT_FOUND|INVALID_ARGUMENT/i.test(`${code} ${message}`)
}

async function deleteTokenRow(row, error) {
  try {
    await query(`DELETE FROM public.user_push_tokens WHERE id = $1`, [row.id])
    logger.warn(
      {
        token_id: row.id,
        user_id: row.user_id,
        platform: row.platform,
        code: tokenErrorCode(error) || 'unknown',
      },
      'invalid FCM token deleted',
    )
  } catch (err) {
    logger.error(
      { err: err.message, token_id: row.id },
      'failed to delete stale push token',
    )
  }
}

export async function listPushTokensForUser(userId) {
  return query(
    `SELECT id, user_id, platform, token, device_id, created_at, last_used_at
       FROM public.user_push_tokens
      WHERE user_id = $1
      ORDER BY created_at DESC`,
    [userId],
  )
}

export async function registerPushToken({ userId, token, platform, deviceId } = {}) {
  const existing = await query(
    `SELECT id FROM public.user_push_tokens WHERE token = $1`,
    [token],
  )
  const rows = await query(
    `INSERT INTO public.user_push_tokens (user_id, platform, token, device_id, last_used_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (token) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       platform = EXCLUDED.platform,
       device_id = COALESCE(EXCLUDED.device_id, public.user_push_tokens.device_id),
       last_used_at = NOW()
     RETURNING id`,
    [userId, platform, token, deviceId || null],
  )
  return {
    id: rows[0].id,
    inserted: !existing?.length,
  }
}

export async function deletePushToken({ userId, id } = {}) {
  const rows = await query(
    `DELETE FROM public.user_push_tokens
      WHERE id = $1 AND user_id = $2
      RETURNING id`,
    [id, userId],
  )
  return rows?.[0] || null
}

export async function deleteAllPushTokens(userId) {
  const rows = await query(
    `DELETE FROM public.user_push_tokens
      WHERE user_id = $1
      RETURNING id`,
    [userId],
  )
  return rows?.length || 0
}

/**
 * Send a push to every registered device for `userId`.
 *
 * @param {object} opts
 * @param {string} opts.userId
 * @param {string} [opts.title]
 * @param {string} [opts.body]
 * @param {object} [opts.data]
 * @param {string} [opts.priority]
 * @returns {Promise<{
 *   ok: boolean,
 *   provider?: string,
 *   provider_message_id?: string | null,
 *   tokens_sent: number,
 *   tokens_invalidated: number,
 *   code?: string,
 *   error?: string,
 * }>}
 */
export async function sendPushNotification({ userId, title, body, data, priority } = {}) {
  if (!isPushConfigured()) throw unconfiguredError()

  const tokens = await query(
    `SELECT id, user_id, platform, token
       FROM public.user_push_tokens
      WHERE user_id = $1
      ORDER BY created_at ASC`,
    [userId],
  )

  if (!tokens?.length) {
    return {
      ok: false,
      code: 'NO_TOKENS_FOR_USER',
      error: 'No push tokens registered for user',
      tokens_sent: 0,
      tokens_invalidated: 0,
    }
  }

  const messaging = await getMessagingClient()
  const messages = tokens.map((row) => buildFcmMessage(row, { title, body, data, priority }))

  let tokensSent = 0
  let tokensInvalidated = 0
  let otherFailures = 0
  const messageIds = []
  const succeededIds = []

  for (let i = 0; i < messages.length; i += FCM_MAX_BATCH) {
    const chunkMessages = messages.slice(i, i + FCM_MAX_BATCH)
    const chunkRows = tokens.slice(i, i + FCM_MAX_BATCH)
    const batch = await messaging.sendEach(chunkMessages)
    const responses = batch?.responses || []
    for (let j = 0; j < chunkRows.length; j += 1) {
      const response = responses[j] || { success: false, error: { code: 'UNKNOWN', message: 'missing FCM response' } }
      const row = chunkRows[j]
      if (response.success) {
        tokensSent += 1
        if (response.messageId) messageIds.push(response.messageId)
        succeededIds.push(row.id)
        continue
      }
      if (isStaleTokenError(response.error)) {
        tokensInvalidated += 1
        await deleteTokenRow(row, response.error)
        continue
      }
      otherFailures += 1
      logger.warn(
        {
          token_id: row.id,
          user_id: row.user_id,
          platform: row.platform,
          code: tokenErrorCode(response.error) || 'unknown',
          error: response.error?.message || String(response.error || 'FCM send failed'),
        },
        'FCM send failed for token; keeping registration',
      )
    }
  }

  if (succeededIds.length) {
    try {
      await query(
        `UPDATE public.user_push_tokens
            SET last_used_at = NOW()
          WHERE id = ANY($1::text[])`,
        [succeededIds],
      )
    } catch (err) {
      logger.warn({ err: err.message }, 'push token last_used_at update failed')
    }
  }

  if (tokensSent > 0) {
    return {
      ok: true,
      provider: 'fcm',
      provider_message_id: messageIds[0] || null,
      tokens_sent: tokensSent,
      tokens_invalidated: tokensInvalidated,
    }
  }

  if (otherFailures > 0) {
    return {
      ok: false,
      code: 'FCM_SEND_FAILED',
      error: 'FCM rejected every remaining token',
      tokens_sent: 0,
      tokens_invalidated: tokensInvalidated,
    }
  }

  return {
    ok: false,
    code: 'NO_VALID_TOKENS',
    error: 'All registered push tokens were invalid and have been removed',
    tokens_sent: 0,
    tokens_invalidated: tokensInvalidated,
  }
}
