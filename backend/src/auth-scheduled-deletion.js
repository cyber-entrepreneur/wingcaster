/**
 * Scheduled account-deletion — public token-signed view/cancel + reminder cron.
 *
 * Auth model: these HTTP surfaces intentionally have NO session. Access is
 * gated solely by an HMAC purpose token (`scheduled_deletion_view`, 60-day
 * TTL). See `lib/signed-token.js` and `lib/public-no-auth.js`.
 */

import { query } from './db.js'
import logger from './lib/logger.js'
import { publicNoAuth } from './lib/public-no-auth.js'
import {
  SCHEDULED_DELETION_VIEW_PURPOSE,
  signScheduledDeletionViewToken,
  verifyScheduledDeletionViewToken,
} from './lib/signed-token.js'
import { sendPlatformNotification } from './notifications/platform-templates/index.js'
import { resolveTemplate } from './notifications/platform-templates/resolver.js'
import { renderTemplate } from './notifications/platform-templates/variables.js'

export const REMINDER_KEYS = Object.freeze({
  tminus7: 'tminus7',
  tminus1: 'tminus1',
})

export const REMINDER_TEMPLATE_CODES = Object.freeze({
  t0: 'scheduled_deletion_confirm_t0',
  tminus7: 'scheduled_deletion_reminder_tminus7',
  tminus1: 'scheduled_deletion_reminder_tminus1',
})

const DAY_MS = 24 * 60 * 60 * 1000

function isoDate(value) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return new Date(value).toISOString()
}

function daysRemaining(scheduledFor, now = new Date()) {
  const target = new Date(scheduledFor).getTime()
  const base = now instanceof Date ? now.getTime() : new Date(now).getTime()
  return Math.max(0, Math.ceil((target - base) / DAY_MS))
}

function formatDeletionDate(scheduledFor) {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(scheduledFor))
  } catch {
    return isoDate(scheduledFor)
  }
}

function maskEmail(email) {
  const raw = String(email || '')
  const at = raw.indexOf('@')
  if (at <= 0) return '•••'
  const local = raw.slice(0, at)
  const domain = raw.slice(at + 1)
  const visibleLocal = local.slice(0, 1)
  const domainParts = domain.split('.')
  const tld = domainParts.length > 1 ? domainParts[domainParts.length - 1] : ''
  const domainHead = domainParts[0] || ''
  const visibleDomain = domainHead.slice(0, 1)
  return `${visibleLocal}•••@${visibleDomain}•••${tld ? `.${tld}` : ''}`
}

async function getPublicAppBase() {
  return (
    process.env.PUBLIC_APP_URL
    || process.env.APP_URL
    || process.env.PUBLIC_API_URL
    || 'http://localhost:5173'
  ).replace(/\/$/, '')
}

export async function buildCancelUrl(token) {
  const base = await getPublicAppBase()
  return `${base}/scheduled-deletion?token=${encodeURIComponent(token)}`
}

export function issueScheduledDeletionViewToken({ deletionRequestId, userId }) {
  return signScheduledDeletionViewToken({ deletionRequestId, userId })
}

async function loadDeletionRequest(id) {
  const rows = await query(
    `SELECT dr.*,
            u.email AS user_email,
            u.name AS user_name
       FROM public.deletion_requests dr
       JOIN public.users u ON u.id = dr.user_id
      WHERE dr.id = $1`,
    [id],
  )
  return rows?.[0] || null
}

function publicPayload(row, { token } = {}) {
  const scheduledFor = isoDate(row.scheduled_for)
  const status = row.status
  const cancelled = Boolean(row.cancelled_at) || status === 'cancelled'
  return {
    deletion_request_id: row.id,
    status,
    scheduled_for: scheduledFor,
    deletion_date: scheduledFor ? formatDeletionDate(scheduledFor) : null,
    days_remaining: scheduledFor && !cancelled ? daysRemaining(scheduledFor) : 0,
    cancelled,
    cancel_available: status === 'scheduled' && !row.cancelled_at,
    email_masked: maskEmail(row.user_email),
    purpose: SCHEDULED_DELETION_VIEW_PURPOSE,
    ...(token ? { view_token: token } : {}),
  }
}

async function resolveFromToken(token) {
  const verified = verifyScheduledDeletionViewToken(token)
  if (!verified.ok) {
    return { ok: false, status: verified.code === 'expired' ? 410 : 401, error: verified.error, code: verified.code }
  }
  const deletionRequestId = verified.payload.deletion_request_id
  if (!deletionRequestId) {
    return { ok: false, status: 401, error: 'Token missing deletion request', code: 'invalid_token' }
  }
  const row = await loadDeletionRequest(deletionRequestId)
  if (!row) {
    return { ok: false, status: 404, error: 'Deletion request not found', code: 'not_found' }
  }
  if (verified.payload.user_id && verified.payload.user_id !== row.user_id) {
    return { ok: false, status: 401, error: 'Token subject mismatch', code: 'invalid_token' }
  }
  return { ok: true, row, payload: verified.payload }
}

export async function getScheduledDeletionByToken(token) {
  const resolved = await resolveFromToken(token)
  if (!resolved.ok) return resolved
  return { ok: true, body: publicPayload(resolved.row) }
}

export async function cancelScheduledDeletionByToken(token, { ip = null } = {}) {
  const resolved = await resolveFromToken(token)
  if (!resolved.ok) return resolved

  const row = resolved.row
  if (row.status === 'completed' || row.completed_at) {
    return { ok: false, status: 409, error: 'Account deletion already completed', code: 'already_completed' }
  }
  if (row.status === 'cancelled' || row.cancelled_at) {
    return { ok: true, body: { ...publicPayload(row), already_cancelled: true } }
  }
  if (row.status !== 'scheduled') {
    return { ok: false, status: 409, error: 'Deletion is not in a cancellable scheduled state', code: 'not_scheduled' }
  }

  const updated = await query(
    `UPDATE public.deletion_requests
        SET status = 'cancelled',
            cancelled_at = NOW(),
            updated_at = NOW(),
            data = COALESCE(data, '{}'::jsonb) || jsonb_build_object('cancelled_via', 'public_token', 'cancelled_ip', to_jsonb($2::text))
      WHERE id = $1
        AND status = 'scheduled'
        AND cancelled_at IS NULL
      RETURNING *`,
    [row.id, ip],
  )
  const next = updated?.[0]
  if (!next) {
    // Race: another cancel won; re-read.
    const again = await loadDeletionRequest(row.id)
    return { ok: true, body: { ...publicPayload(again || row), already_cancelled: true } }
  }
  next.user_email = row.user_email
  next.user_name = row.user_name
  logger.info({ deletion_request_id: row.id, user_id: row.user_id }, 'scheduled deletion cancelled via public token')
  return { ok: true, body: { ...publicPayload(next), cancelled: true } }
}

/**
 * Build template variables shared by T0 / T-7 / T-1 sends.
 */
export async function buildDeletionEmailVariables(row, { token } = {}) {
  const viewToken = token || issueScheduledDeletionViewToken({
    deletionRequestId: row.id,
    userId: row.user_id,
  })
  const cancelUrl = await buildCancelUrl(viewToken)
  const scheduledFor = row.scheduled_for
  return {
    name: row.user_name || row.user_email || 'there',
    deletion_date: formatDeletionDate(scheduledFor),
    days_remaining: String(daysRemaining(scheduledFor)),
    cancel_url: cancelUrl,
    support_email: process.env.SUPPORT_EMAIL || '',
  }
}

export async function renderDeletionTemplate(code, variables) {
  const template = await resolveTemplate({ code, language: 'en' })
  if (!template) {
    const err = new Error(`Missing platform template code=${code}`)
    err.code = 'PLATFORM_TEMPLATE_MISSING'
    throw err
  }
  return {
    template,
    rendered: renderTemplate(template, variables),
  }
}

export async function sendDeletionReminderEmail({ row, reminderKey, send = sendPlatformNotification }) {
  const templateCode = REMINDER_TEMPLATE_CODES[reminderKey]
  if (!templateCode) throw new Error(`Unknown reminder key: ${reminderKey}`)

  const token = issueScheduledDeletionViewToken({
    deletionRequestId: row.id,
    userId: row.user_id,
  })
  const variables = await buildDeletionEmailVariables(row, { token })

  const result = await send({
    code: templateCode,
    to: row.user_email,
    variables,
    language: 'en',
    fallback: {
      subject: reminderKey === 'tminus1'
        ? `Final reminder: your Wingcaster account will be deleted tomorrow`
        : `Reminder: your Wingcaster account will be deleted soon`,
      text: `Hi ${variables.name}, your account is scheduled for deletion on ${variables.deletion_date}. Cancel: ${variables.cancel_url}`,
      html: `<p>Hi ${variables.name}, your account is scheduled for deletion on ${variables.deletion_date}.</p><p><a href="${variables.cancel_url}">Cancel deletion</a></p>`,
    },
  })

  return { result, token, variables, templateCode }
}

/**
 * Append a reminder key after a successful send. Returns true if this
 * caller recorded the key; false if it was already present (or the row
 * is no longer scheduled).
 */
export async function recordReminderSend(deletionRequestId, reminderKey) {
  const rows = await query(
    `UPDATE public.deletion_requests
        SET reminders_sent = array_append(reminders_sent, $2),
            updated_at = NOW()
      WHERE id = $1
        AND status = 'scheduled'
        AND cancelled_at IS NULL
        AND NOT ($2 = ANY (COALESCE(reminders_sent, '{}'::text[])))
      RETURNING id`,
    [deletionRequestId, reminderKey],
  )
  return Boolean(rows?.[0]?.id)
}

/** @deprecated use recordReminderSend — kept as an alias for race tests */
export const claimReminderSend = recordReminderSend

/**
 * Find scheduled deletions due for a reminder relative to `now`.
 * Uses calendar-day matching in UTC: T-7 ⇒ scheduled_for::date = today+7.
 */
export async function findDueReminders({ reminderKey, now = new Date() } = {}) {
  const offsetDays = reminderKey === 'tminus7' ? 7 : reminderKey === 'tminus1' ? 1 : null
  if (offsetDays == null) throw new Error(`Unknown reminder key: ${reminderKey}`)

  const nowDate = now instanceof Date ? now : new Date(now)
  return query(
    `SELECT dr.*,
            u.email AS user_email,
            u.name AS user_name
       FROM public.deletion_requests dr
       JOIN public.users u ON u.id = dr.user_id
      WHERE dr.status = 'scheduled'
        AND dr.cancelled_at IS NULL
        AND dr.scheduled_for IS NOT NULL
        AND (dr.scheduled_for AT TIME ZONE 'UTC')::date
            = (($1::timestamptz AT TIME ZONE 'UTC')::date + ($2::int))
        AND NOT ($3 = ANY (COALESCE(dr.reminders_sent, '{}'::text[])))
      ORDER BY dr.scheduled_for ASC, dr.id ASC`,
    [nowDate.toISOString(), offsetDays, reminderKey],
  )
}

/**
 * Register public scheduled-deletion routes.
 *
 * @param {import('express').Express} app
 */
export function registerScheduledDeletionRoutes(app) {
  // PUBLIC_NO_AUTH — token-signed only; do not attach authMiddleware.
  app.get(
    '/api/auth/scheduled-deletion/:token',
    publicNoAuth,
    async (req, res) => {
      try {
        const result = await getScheduledDeletionByToken(req.params.token)
        if (!result.ok) return res.status(result.status).json({ error: result.error, code: result.code })
        return res.json(result.body)
      } catch (err) {
        logger.error({ err: err.message }, 'scheduled-deletion GET failed')
        return res.status(500).json({ error: 'Internal server error' })
      }
    },
  )

  // PUBLIC_NO_AUTH — token-signed only; do not attach authMiddleware.
  app.post(
    '/api/auth/scheduled-deletion/:token/cancel',
    publicNoAuth,
    async (req, res) => {
      try {
        const result = await cancelScheduledDeletionByToken(req.params.token, { ip: req.ip })
        if (!result.ok) return res.status(result.status).json({ error: result.error, code: result.code })
        return res.json({ success: true, ...result.body })
      } catch (err) {
        logger.error({ err: err.message }, 'scheduled-deletion cancel failed')
        return res.status(500).json({ error: 'Internal server error' })
      }
    },
  )
}

/** Spec-shaped alias; server.js imports the unique name to avoid merge collisions. */
export const registerRoutes = registerScheduledDeletionRoutes

export {
  formatDeletionDate,
  daysRemaining,
  maskEmail,
  publicNoAuth,
}
