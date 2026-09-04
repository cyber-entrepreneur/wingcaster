/**
 * Consumer notification dispatcher.
 *
 * Single entry for email / SMS / WhatsApp / in-app / push (FCM).
 * Transports are the existing modules — this file only validates, rate-limits,
 * maps outcomes, and runs the retry worker.
 *
 * @example
 * await dispatchConsumerNotification({
 *   channel: 'email',
 *   recipient: 'buyer@example.com',
 *   subject: '3 new listings match "Beirut 2-bed"',
 *   body: 'Open the app to review matches.',
 *   html: '<p>Open the app to review matches.</p>',
 *   metadata: {
 *     // deep_link_url — where to navigate on tap (in-app, push)
 *     deep_link_url: 'https://app.example.com/saved-searches/ss_123',
 *     // tracking_token — attribution back to the source event
 *     tracking_token: 'ss_123:listing_456',
 *     // alert_type — cooldown key with recipient (+ tenant_id)
 *     alert_type: 'saved_search_match',
 *     // priority — 'urgent' skips the per-recipient cooldown
 *     priority: 'normal',
 *     tenant_id: 'ten_abc',
 *   },
 * })
 *
 * `metadata` is reserved for:
 *   deep_link_url, tracking_token, alert_type, priority,
 *   and future fields (action_buttons, image_url, …).
 * In-app writes the object onto public.notifications.metadata.
 * Cooldown hashes (tenant_id + recipient + alert_type).
 */

import { createHash, randomUUID } from 'crypto'
import { findOne, insert, query, update } from '../../db.js'
import logger from '../logger.js'
import { isEmailEnabled, sendEmail } from './email.js'
import { isSMSEnabled, sendSMS } from './sms.js'
import { isWhatsAppConfigured, sendWhatsAppText } from '../../whatsapp.js'
import { isPushConfigured, sendPushNotification } from './push.js'

export const DISPATCH_MAX_RETRIES = 5
export const DISPATCH_MAX_AGE_MS = 24 * 60 * 60 * 1000

const CFG_DEFAULTS = Object.freeze({
  NOTIFICATION_PER_TENANT_PER_HOUR: 1000,
  NOTIFICATION_PER_RECIPIENT_COOLDOWN_MINUTES: 60,
  NOTIFICATION_BATCH_SIZE: 100,
  NOTIFICATION_INTER_BATCH_DELAY_MS: 100,
})

const TRANSIENT_CODES = new Set([
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EPIPE',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_SOCKET',
])

const UNCONFIGURED_CODES = new Set([
  'EMAIL_UNCONFIGURED',
  'SMS_UNCONFIGURED',
  'WHATSAPP_UNCONFIGURED',
  'PUSH_UNCONFIGURED',
])

let dbCfgCache = null
let dbCfgCachedAt = 0
const DB_CFG_TTL_MS = 30_000

function sleepMs(ms) {
  if (!ms || ms <= 0) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function readEnvInt(key) {
  const raw = process.env[key]
  if (raw == null || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : null
}

async function loadDbCfg() {
  const now = Date.now()
  if (dbCfgCache && now - dbCfgCachedAt < DB_CFG_TTL_MS) return dbCfgCache
  try {
    const rows = await query(
      `SELECT key, value FROM public.platform_config WHERE key LIKE 'NOTIFICATION_%'`,
    )
    dbCfgCache = Object.fromEntries((rows || []).map((r) => [r.key, r.value]))
  } catch {
    dbCfgCache = {}
  }
  dbCfgCachedAt = now
  return dbCfgCache
}

export async function getDispatchConfig() {
  const dbCfg = await loadDbCfg()
  const cfg = {}
  for (const [key, fallback] of Object.entries(CFG_DEFAULTS)) {
    const envVal = readEnvInt(key)
    if (envVal != null) {
      cfg[key] = envVal
      continue
    }
    const fromDb = dbCfg[key]
    const parsed = fromDb == null ? NaN : Number(fromDb)
    cfg[key] = Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
  }
  return cfg
}

/** Test hook — drop the CFG cache so env/DB changes are visible immediately. */
export function _resetDispatchConfigCache() {
  dbCfgCache = null
  dbCfgCachedAt = 0
}

function normalizeChannel(channel) {
  const c = String(channel || '').toLowerCase().trim()
  if (c === 'inapp' || c === 'in-app') return 'in_app'
  return c
}

function metadataOf(metadata) {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}
}

function isUrgent(meta) {
  return String(meta.priority || '').toLowerCase() === 'urgent'
}

function cooldownKey({ tenantId, recipient, alertType }) {
  return createHash('sha256')
    .update(`${tenantId || ''}::${recipient}::${alertType}`)
    .digest('hex')
}

function backoffMs(attempts) {
  const n = Math.max(1, Number(attempts) || 1)
  return (2 ** n) * 60 * 1000
}

function httpStatusFromError(err) {
  const direct = Number(err?.status || err?.statusCode || err?.details?.status || 0)
  if (direct) return direct
  const code = String(err?.code || '')
  const match = code.match(/(?:^|_)([45]\d{2})$/)
  return match ? Number(match[1]) : 0
}

function classifyTransportError(err, transport) {
  const code = String(err?.code || '')
  const message = err?.message || String(err)
  const http = httpStatusFromError(err)
  const prefix = String(transport || '').toUpperCase() || 'TRANSPORT'

  if (UNCONFIGURED_CODES.has(code) || /not configured/i.test(message)) {
    return {
      ok: false,
      status: 'skipped',
      code: UNCONFIGURED_CODES.has(code) ? code : `${prefix}_UNCONFIGURED`,
      error: message,
    }
  }

  const twilioCode = Number(err?.details?.code || (typeof err?.code === 'number' ? err.code : 0))
  if (http === 429 || twilioCode === 20429 || /rate.?limit/i.test(message) || /429/.test(code)) {
    return {
      ok: false,
      status: 'pending',
      code: code || 'RATE_LIMITED',
      error: message,
      retry_after: 60 * 1000,
    }
  }

  if (http >= 500 || TRANSIENT_CODES.has(code) || /timeout/i.test(message)) {
    return {
      ok: false,
      status: 'pending',
      code: code || 'TRANSIENT_FAILURE',
      error: message,
      retry_after: backoffMs(1),
    }
  }

  if (http >= 400 && http < 500) {
    return {
      ok: false,
      status: 'failed',
      code: code || `HTTP_${http}`,
      error: message,
    }
  }

  return {
    ok: false,
    status: 'pending',
    code: code || 'UNKNOWN_FAILURE',
    error: message,
    retry_after: backoffMs(1),
  }
}

function validateRecipientForChannel(channel, recipient) {
  if (!recipient) return 'recipient is required'
  const value = String(recipient).trim()
  switch (channel) {
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : 'invalid email format'
    case 'sms':
      return /^\+[1-9]\d{7,14}$/.test(value) ? null : 'invalid E.164 phone (expected +CCDDDDDDDD)'
    case 'whatsapp':
      return /^(\+[1-9]\d{7,14}|[1-9]\d{11,15})$/.test(value) ? null : 'invalid WhatsApp recipient'
    case 'in_app':
    case 'push':
      return /^[a-zA-Z0-9_-]{3,64}$/.test(value) ? null : 'invalid user id'
    default:
      return null
  }
}

async function checkCooldown(recipient, meta) {
  if (isUrgent(meta) || meta.skip_cooldown) return null
  const alertType = meta.alert_type
  if (!alertType) return null
  const cfg = await getDispatchConfig()
  const minutes = cfg.NOTIFICATION_PER_RECIPIENT_COOLDOWN_MINUTES
  if (!minutes) return null
  const key = cooldownKey({ tenantId: meta.tenant_id, recipient, alertType })
  const now = new Date()
  try {
    const rows = await query(
      `SELECT expires_at FROM public.notification_dispatch_cooldowns
        WHERE id = $1 AND expires_at > $2::timestamptz`,
      [key, now.toISOString()],
    )
    if (!rows?.length) return null
    const expiresAt = new Date(rows[0].expires_at).getTime()
    return {
      code: 'COOLDOWN',
      error: 'recipient+alert_type still in cooldown window',
      retry_after_ms: Math.max(0, expiresAt - now.getTime()),
    }
  } catch (err) {
    logger.warn({ err: err.message }, 'notification cooldown lookup failed; allowing send')
    return null
  }
}

async function recordCooldown(recipient, meta) {
  if (isUrgent(meta) || meta.skip_cooldown) return
  const alertType = meta.alert_type
  if (!alertType) return
  const cfg = await getDispatchConfig()
  const minutes = cfg.NOTIFICATION_PER_RECIPIENT_COOLDOWN_MINUTES
  if (!minutes) return
  const key = cooldownKey({ tenantId: meta.tenant_id, recipient, alertType })
  const now = new Date()
  const expiresAt = new Date(now.getTime() + minutes * 60 * 1000).toISOString()
  try {
    await query(
      `INSERT INTO public.notification_dispatch_cooldowns
         (id, recipient, alert_type, tenant_id, expires_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5::timestamptz, $6::timestamptz, $6::timestamptz)
       ON CONFLICT (id) DO UPDATE
         SET expires_at = EXCLUDED.expires_at,
             updated_at = EXCLUDED.updated_at`,
      [key, String(recipient), String(alertType), meta.tenant_id || null, expiresAt, now.toISOString()],
    )
  } catch (err) {
    logger.warn({ err: err.message }, 'notification cooldown write failed')
  }
}

async function checkTenantRateLimit(channel, meta) {
  const tenantId = meta.tenant_id
  if (!tenantId) return null
  const cfg = await getDispatchConfig()
  const cap = cfg.NOTIFICATION_PER_TENANT_PER_HOUR
  if (!cap) return null
  const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  try {
    const rows = await query(
      `SELECT count(*)::int AS n,
              min(created_at) AS oldest
         FROM public.notification_dispatch_rate_events
        WHERE tenant_id = $1 AND created_at >= $2::timestamptz`,
      [String(tenantId), windowStart],
    )
    const n = Number(rows?.[0]?.n || 0)
    if (n < cap) {
      await query(
        `INSERT INTO public.notification_dispatch_rate_events (id, tenant_id, channel, created_at)
         VALUES ($1, $2, $3, $4::timestamptz)`,
        [randomUUID(), String(tenantId), channel, new Date().toISOString()],
      )
      return null
    }
    const oldest = rows[0]?.oldest ? new Date(rows[0].oldest).getTime() : Date.now()
    const retryAfter = Math.max(1000, oldest + 60 * 60 * 1000 - Date.now())
    return {
      code: 'RATE_LIMITED',
      error: `tenant hourly cap (${cap}) reached`,
      retry_after_ms: retryAfter,
    }
  } catch (err) {
    logger.warn({ err: err.message }, 'notification rate-limit lookup failed; allowing send')
    return null
  }
}

async function checkRateLimit(channel, recipient, metadata) {
  const meta = metadataOf(metadata)
  const cooldown = await checkCooldown(recipient, meta)
  if (cooldown) return { ...cooldown, skipped: true }
  const rate = await checkTenantRateLimit(channel, meta)
  if (rate) return rate
  return null
}

async function dispatchEmail({ recipient, subject, body, html }) {
  if (!isEmailEnabled()) {
    return {
      ok: false,
      status: 'skipped',
      code: 'EMAIL_UNCONFIGURED',
      error: 'Email transport is not configured',
    }
  }
  try {
    const result = await sendEmail({ to: recipient, subject, body, html })
    return {
      ok: true,
      status: 'sent',
      provider: result?.provider || 'email',
      provider_message_id: result?.provider_message_id || null,
    }
  } catch (err) {
    return classifyTransportError(err, 'EMAIL')
  }
}

async function dispatchSms({ recipient, body }) {
  if (!isSMSEnabled()) {
    return {
      ok: false,
      status: 'skipped',
      code: 'SMS_UNCONFIGURED',
      error: 'SMS transport is not configured',
    }
  }
  try {
    const result = await sendSMS({ to: recipient, body })
    return {
      ok: true,
      status: 'sent',
      provider: result?.provider || 'twilio',
      provider_message_id: result?.provider_message_id || null,
    }
  } catch (err) {
    return classifyTransportError(err, 'SMS')
  }
}

async function dispatchWhatsApp({ recipient, body }) {
  if (!isWhatsAppConfigured()) {
    return {
      ok: false,
      status: 'skipped',
      code: 'WHATSAPP_UNCONFIGURED',
      error: 'WhatsApp transport is not configured',
    }
  }
  try {
    const result = await sendWhatsAppText(recipient, body)
    return {
      ok: true,
      status: 'sent',
      provider: 'whatsapp',
      provider_message_id: result?.messages?.[0]?.id || result?.messages?.[0]?.message_id || null,
    }
  } catch (err) {
    return classifyTransportError(err, 'WHATSAPP')
  }
}

async function dispatchInApp({ recipient, subject, body, metadata }) {
  const meta = metadataOf(metadata)
  const now = new Date().toISOString()
  const row = {
    id: randomUUID(),
    user_id: recipient,
    type: 'consumer',
    title: subject || '',
    body: body || '',
    metadata: meta,
    read: false,
    created_at: now,
  }
  try {
    await insert('notifications', row)
    return {
      ok: true,
      status: 'delivered',
      provider: 'in_app',
      provider_message_id: row.id,
    }
  } catch (err) {
    return classifyTransportError(err, 'IN_APP')
  }
}

async function dispatchPush({ recipient, subject, body, metadata }) {
  const meta = metadataOf(metadata)
  try {
    const sent = await sendPushNotification({
      userId: recipient,
      title: subject || '',
      body: body || '',
      data: meta,
      priority: meta.priority,
    })
    if (sent?.ok) {
      return {
        ok: true,
        status: 'sent',
        provider: sent.provider || 'fcm',
        provider_message_id: sent.provider_message_id || null,
        tokens_sent: sent.tokens_sent,
        tokens_invalidated: sent.tokens_invalidated,
      }
    }
    const code = sent?.code || 'PUSH_FAILED'
    if (code === 'NO_TOKENS_FOR_USER' || code === 'NO_VALID_TOKENS' || UNCONFIGURED_CODES.has(code)) {
      return {
        ok: false,
        status: 'skipped',
        code,
        error: sent?.error || code,
        tokens_sent: sent?.tokens_sent || 0,
        tokens_invalidated: sent?.tokens_invalidated || 0,
      }
    }
    return {
      ok: false,
      status: 'pending',
      code,
      error: sent?.error || code,
      retry_after: backoffMs(1),
      tokens_sent: sent?.tokens_sent || 0,
      tokens_invalidated: sent?.tokens_invalidated || 0,
    }
  } catch (err) {
    return classifyTransportError(err, 'PUSH')
  }
}

/**
 * Dispatch one consumer notification on a single channel.
 *
 * @param {object} opts
 * @param {string} opts.channel  email | sms | whatsapp | in_app | push
 * @param {string} opts.recipient
 * @param {string} [opts.subject]
 * @param {string} [opts.body]
 * @param {string} [opts.html]
 * @param {object} [opts.metadata] See file-level JSDoc for reserved keys.
 */
export async function dispatchConsumerNotification({
  channel,
  recipient,
  subject,
  body,
  html,
  metadata,
} = {}) {
  const normalizedChannel = normalizeChannel(channel)
  const validationError = validateRecipientForChannel(normalizedChannel, recipient)
  if (validationError) {
    return { ok: false, status: 'skipped', code: 'INVALID_RECIPIENT', error: validationError }
  }

  const rateLimitError = await checkRateLimit(normalizedChannel, recipient, metadata)
  if (rateLimitError?.skipped) {
    return {
      ok: false,
      status: 'skipped',
      code: rateLimitError.code || 'COOLDOWN',
      error: rateLimitError.error,
      retry_after: rateLimitError.retry_after_ms,
    }
  }
  if (rateLimitError) {
    return {
      ok: false,
      status: 'pending',
      code: rateLimitError.code || 'RATE_LIMITED',
      error: rateLimitError.error,
      retry_after: rateLimitError.retry_after_ms,
    }
  }

  let result
  switch (normalizedChannel) {
    case 'email':
      result = await dispatchEmail({ recipient, subject, body, html, metadata })
      break
    case 'sms':
      result = await dispatchSms({ recipient, body, metadata })
      break
    case 'whatsapp':
      result = await dispatchWhatsApp({ recipient, body, metadata })
      break
    case 'in_app':
      result = await dispatchInApp({ recipient, subject, body, metadata })
      break
    case 'push':
      if (!isPushConfigured()) {
        return {
          ok: false,
          status: 'skipped',
          code: 'PUSH_UNCONFIGURED',
          error: 'FCM credentials not set — configure FCM_SERVICE_ACCOUNT_JSON env var',
        }
      }
      result = await dispatchPush({ recipient, subject, body, metadata })
      break
    default:
      return {
        ok: false,
        status: 'failed',
        code: 'UNKNOWN_CHANNEL',
        error: `Unknown channel: ${channel}`,
      }
  }

  if (result?.ok) {
    await recordCooldown(recipient, metadataOf(metadata))
  }
  return result
}

async function writeAudit({ action, retry, notification, extra = {} }) {
  try {
    await insert('audit_log', {
      id: randomUUID(),
      type: 'notification',
      action,
      entity_type: 'consumer_notification_retries',
      entity_id: retry?.id || null,
      metadata: {
        notification_id: retry?.notification_id || notification?.id || null,
        channel: retry?.channel || notification?.dispatch?.channel || null,
        attempts: retry?.attempts ?? null,
        ...extra,
      },
      created_at: new Date().toISOString(),
    })
  } catch (err) {
    logger.warn({ err: err.message, action, retry_id: retry?.id }, 'notification audit write failed')
  }
}

function hydrateRetry(row) {
  if (!row) return row
  const data = row.data
    ? (typeof row.data === 'string' ? JSON.parse(row.data) : row.data)
    : {}
  const { data: _drop, ...rest } = row
  return { ...data, ...rest }
}

async function resolveRecipient(channel, retry, notification) {
  const stored = retry?.recipient
    || retry?.data?.recipient
    || notification?.dispatch?.recipient
    || notification?.recipient
  if (stored) return stored
  const normalized = normalizeChannel(channel)
  if (normalized === 'in_app' || normalized === 'push') {
    return notification?.user_id || retry?.user_id || null
  }
  const userId = notification?.user_id || retry?.user_id
  if (!userId) return null
  const user = await findOne('users', (u) => u.id === userId)
  if (!user) return null
  if (normalized === 'email') return user.email || null
  if (normalized === 'sms' || normalized === 'whatsapp') return user.phone || null
  return null
}

function isExpired(retry, nowMs = Date.now()) {
  const created = retry?.created_at ? new Date(retry.created_at).getTime() : NaN
  if (!Number.isFinite(created)) return false
  return nowMs - created >= DISPATCH_MAX_AGE_MS
}

async function markRetry(retry, notification, patch) {
  const now = new Date().toISOString()
  await update('consumer_notification_retries', (r) => r.id === retry.id, (r) => ({
    ...r,
    ...patch,
    updated_at: now,
  }))
  if (notification?.id) {
    await update('consumer_notifications', (n) => n.id === notification.id, (n) => ({
      ...n,
      dispatch: {
        ...(n.dispatch || {}),
        status: patch.status === 'completed' ? (patch.delivery_status || 'delivered') : patch.status,
        attempts: patch.attempts ?? n.dispatch?.attempts,
        last_error: patch.last_error ?? n.dispatch?.last_error,
        next_retry_at: patch.next_retry_at ?? n.dispatch?.next_retry_at,
        sent_at: patch.status === 'completed' ? now : n.dispatch?.sent_at,
        delivered_at: patch.status === 'completed' ? now : n.dispatch?.delivered_at,
      },
    }))
  }
}

async function transitionDeadLetter(retry, notification, { reason, error, attempts }) {
  const now = new Date().toISOString()
  await markRetry(retry, notification, {
    status: 'dead_letter',
    attempts,
    last_error: error || reason,
    next_retry_at: null,
    failed_at: now,
    dead_lettered_at: now,
  })
  await writeAudit({
    action: 'dead_letter',
    retry: { ...retry, attempts },
    notification,
    extra: { reason, error: error || null },
  })
}

async function processOneRetry(retry, { nowMs }) {
  const nowIso = new Date(nowMs).toISOString()
  const attemptsSoFar = Number(retry.attempts || 0)

  let notification = null
  if (retry.notification_id) {
    notification = await findOne('consumer_notifications', (n) => n.id === retry.notification_id)
  }

  if (isExpired(retry, nowMs) || attemptsSoFar >= DISPATCH_MAX_RETRIES) {
    await transitionDeadLetter(retry, notification, {
      reason: isExpired(retry, nowMs) ? 'max_age' : 'max_retries',
      error: retry.last_error || null,
      attempts: attemptsSoFar,
    })
    return { retry_id: retry.id, status: 'dead_letter', reason: isExpired(retry, nowMs) ? 'max_age' : 'max_retries' }
  }

  const channel = retry.channel || notification?.dispatch?.channel
  const recipient = await resolveRecipient(channel, retry, notification)
  const subject = notification?.title || retry.subject || ''
  const body = notification?.body || retry.body || ''
  const html = notification?.html || retry.html || undefined
  const metadata = {
    ...(notification?.meta || {}),
    ...(notification?.metadata || {}),
    ...(retry.metadata || {}),
    tenant_id: retry.tenant_id || notification?.tenant_id || notification?.meta?.tenant_id,
    alert_type: retry.alert_type || notification?.type || notification?.meta?.alert_type,
    skip_cooldown: true,
  }

  const result = await dispatchConsumerNotification({
    channel,
    recipient,
    subject,
    body,
    html,
    metadata,
  })

  const attempts = attemptsSoFar + 1

  if (result.ok) {
    await markRetry(retry, notification, {
      status: 'completed',
      attempts,
      last_error: null,
      completed_at: nowIso,
      delivery_status: result.status,
      provider: result.provider,
      provider_message_id: result.provider_message_id,
    })
    return { retry_id: retry.id, status: 'completed', channel: normalizeChannel(channel) }
  }

  if (result.status === 'skipped') {
    await markRetry(retry, notification, {
      status: 'skipped',
      attempts,
      last_error: result.error || result.code,
      skipped_at: nowIso,
      skip_code: result.code,
    })
    await writeAudit({
      action: 'dispatch_skipped',
      retry: { ...retry, attempts },
      notification,
      extra: { code: result.code, error: result.error || null },
    })
    return { retry_id: retry.id, status: 'skipped', code: result.code, error: result.error }
  }

  if (result.status === 'failed' || attempts >= DISPATCH_MAX_RETRIES) {
    await transitionDeadLetter(retry, notification, {
      reason: result.status === 'failed' ? 'permanent_failure' : 'max_retries',
      error: result.error || result.code,
      attempts,
    })
    return {
      retry_id: retry.id,
      status: 'dead_letter',
      reason: result.status === 'failed' ? 'permanent_failure' : 'max_retries',
      error: result.error,
    }
  }

  const waitMs = result.retry_after || backoffMs(attempts)
  await markRetry(retry, notification, {
    status: 'pending',
    attempts,
    last_error: result.error || result.code,
    next_retry_at: new Date(nowMs + waitMs).toISOString(),
  })
  return {
    retry_id: retry.id,
    status: 'pending',
    error: result.error,
    retry_after: waitMs,
  }
}

/**
 * Drain due rows from consumer_notification_retries.
 * Pending (retryable) items are re-queued with 2^N minute backoff.
 * Skipped items are audited and dropped. Exhausted / stale items go to dead_letter.
 *
 * @param {object} [opts]
 * @param {number} [opts.limit]
 * @param {function} [opts.sleep] injectable delay (tests)
 */
export async function processPendingNotificationRetries({ limit = 20, sleep = sleepMs } = {}) {
  const cfg = await getDispatchConfig()
  const batchSize = Math.max(1, cfg.NOTIFICATION_BATCH_SIZE || 100)
  const delayMs = cfg.NOTIFICATION_INTER_BATCH_DELAY_MS
  const nowIso = new Date().toISOString()
  const cap = Math.max(1, Number(limit) || 20)

  let rows
  try {
    rows = await query(
      `SELECT * FROM public.consumer_notification_retries
        WHERE status = 'pending'
          AND (next_retry_at IS NULL OR next_retry_at <= $1::timestamptz)
        ORDER BY next_retry_at NULLS FIRST, created_at ASC
        LIMIT $2`,
      [nowIso, cap],
    )
  } catch (err) {
    logger.error({ err: err.message }, 'notification retry queue read failed')
    throw err
  }

  const pending = (rows || []).map(hydrateRetry)
  const results = []

  for (let i = 0; i < pending.length; i += batchSize) {
    if (i > 0) await sleep(delayMs)
    const chunk = pending.slice(i, i + batchSize)
    for (const retry of chunk) {
      try {
        results.push(await processOneRetry(retry, { nowMs: Date.now() }))
      } catch (err) {
        logger.error({ err: err.message, retry_id: retry.id }, 'notification retry item failed')
        results.push({ retry_id: retry.id, status: 'pending', error: err.message || String(err) })
      }
    }
  }

  return { processed: results.length, results }
}

/**
 * Dispatch a stored consumer_notifications row (manual retry endpoint).
 */
export async function dispatchStoredNotification(notification) {
  if (!notification) {
    return { ok: false, status: 'failed', code: 'MISSING_NOTIFICATION', error: 'Notification record missing' }
  }
  const channel = notification.dispatch?.channel || 'in_app'
  const recipient = await resolveRecipient(channel, notification, notification)
  return dispatchConsumerNotification({
    channel,
    recipient,
    subject: notification.title,
    body: notification.body,
    html: notification.html,
    metadata: {
      ...(notification.meta || {}),
      ...(notification.metadata || {}),
      tenant_id: notification.tenant_id || notification.meta?.tenant_id,
      alert_type: notification.type || notification.meta?.alert_type,
    },
  })
}
