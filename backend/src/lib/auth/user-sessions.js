/**
 * Per-login session rows for SHR-SET-004 (Sessions & devices).
 *
 * `token_version` remains the global eject (password change, 2FA disable,
 * agency-admin deprovision). This table is what lets a user revoke *one*
 * browser without signing everyone else out.
 *
 * Geo-IP is intentionally absent: city/country stay null unless a future
 * lookup is wired. Never invent a location from the IP string.
 */

import ipaddr from 'ipaddr.js'
import { v4 as uuidv4 } from 'uuid'
import { query } from '../../db.js'
import logger from '../logger.js'

/** Skip last_active_at writes more often than this. */
export const LAST_ACTIVE_THROTTLE_MS = 5 * 60 * 1000

const lastTouchAt = new Map()

function iso(value) {
  if (value == null) return null
  if (value instanceof Date) return value.toISOString()
  return value
}

export function clientIp(req) {
  if (!req) return null
  const forwarded = req.headers?.['x-forwarded-for']
  const raw = (typeof forwarded === 'string' && forwarded.trim())
    ? forwarded.split(',')[0].trim()
    : (req.ip || req.socket?.remoteAddress || null)
  return normalizeIp(raw)
}

export function normalizeIp(raw) {
  if (raw == null || raw === '') return null
  const trimmed = String(raw).trim()
  if (!trimmed) return null
  try {
    const parsed = ipaddr.parse(trimmed)
    const v4 = parsed.kind() === 'ipv6' && parsed.isIPv4MappedAddress?.()
      ? parsed.toIPv4Address()
      : parsed
    return String(v4).slice(0, 64)
  } catch {
    return trimmed.slice(0, 64)
  }
}

export function parseUserAgent(ua) {
  const raw = String(ua || '').trim()
  if (!raw) return { device_kind: 'unknown', device_summary: 'Unknown device' }

  let device_kind = 'desktop'
  if (/iPad|Tablet|PlayBook|Silk/i.test(raw) || (/Android/i.test(raw) && !/Mobile/i.test(raw))) {
    device_kind = 'tablet'
  } else if (/iPhone|iPod|Android.*Mobile|Windows Phone|webOS|IEMobile|Mobile/i.test(raw)) {
    device_kind = 'mobile'
  } else if (/Windows NT|Macintosh|Mac OS X|Linux|X11|CrOS|Mozilla/i.test(raw)) {
    device_kind = 'desktop'
  } else {
    device_kind = 'unknown'
  }

  let os = 'unknown OS'
  let osVer = ''
  if (/iPhone|iPod/.test(raw)) {
    const ios = raw.match(/OS (\d+)[._]/)
    os = 'iOS'
    osVer = ios ? ` ${ios[1]}` : ''
  } else if (/iPad/.test(raw)) {
    const ios = raw.match(/OS (\d+)[._]/)
    os = 'iPadOS'
    osVer = ios ? ` ${ios[1]}` : ''
  } else if (/Android (\d+)/i.test(raw)) {
    os = 'Android'
    osVer = ` ${raw.match(/Android (\d+)/i)[1]}`
  } else if (/Mac OS X (\d+)[._](\d+)/.test(raw)) {
    const mac = raw.match(/Mac OS X (\d+)[._](\d+)/)
    os = 'macOS'
    osVer = mac ? ` ${mac[1]}` : ''
  } else if (/Windows NT/i.test(raw)) {
    os = 'Windows'
  } else if (/CrOS/.test(raw)) {
    os = 'Chrome OS'
  } else if (/Linux/.test(raw)) {
    os = 'Linux'
  }

  let browser = 'Browser'
  let browserVer = ''
  const edge = raw.match(/Edg(?:e|A|iOS)?\/(\d+)/)
  const chrome = raw.match(/Chrome\/(\d+)/)
  const firefox = raw.match(/Firefox\/(\d+)/)
  const versionSafari = raw.match(/Version\/(\d+).*Safari/)
  if (edge) {
    browser = 'Edge'
    browserVer = ` ${edge[1]}`
  } else if (chrome && !/Chromium/i.test(raw)) {
    browser = 'Chrome'
    browserVer = ` ${chrome[1]}`
  } else if (firefox) {
    browser = 'Firefox'
    browserVer = ` ${firefox[1]}`
  } else if (versionSafari || (/Safari\//.test(raw) && !chrome)) {
    browser = 'Safari'
    const ver = raw.match(/Version\/(\d+)/)
    browserVer = ver ? ` ${ver[1]}` : ''
  }

  return {
    device_kind,
    device_summary: `${browser}${browserVer} on ${os}${osVer}`.trim(),
  }
}

function run(client, sql, params) {
  if (client) return client.query(sql, params)
  return query(sql, params)
}

function rowsOf(result) {
  return Array.isArray(result) ? result : (result?.rows || [])
}

export async function createUserSession({
  userId,
  userAgent = null,
  ip = null,
  ipCountryIso = null,
  ipCountry = null,
  ipCity = null,
  client = null,
} = {}) {
  const id = uuidv4()
  const parsed = parseUserAgent(userAgent)
  const sql = `
    INSERT INTO public.user_sessions (
      id, user_id, jwt_jti, device_summary, device_kind,
      ip, ip_country_iso, ip_country, ip_city
    ) VALUES ($1, $2, $1, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `
  const params = [
    id,
    userId,
    parsed.device_summary,
    parsed.device_kind,
    normalizeIp(ip),
    ipCountryIso || null,
    ipCountry || null,
    ipCity || null,
  ]
  const result = await run(client, sql, params)
  return rowsOf(result)[0]
}

export async function findActiveSession(sessionId, userId = null, { client = null } = {}) {
  if (!sessionId) return null
  const params = userId ? [sessionId, userId] : [sessionId]
  const sql = userId
    ? `SELECT * FROM public.user_sessions WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`
    : `SELECT * FROM public.user_sessions WHERE id = $1 AND revoked_at IS NULL`
  const result = await run(client, sql, params)
  return rowsOf(result)[0] || null
}

export async function isSessionActive(sessionId, userId = null) {
  const row = await findActiveSession(sessionId, userId)
  return Boolean(row)
}

export async function listActiveSessions(userId) {
  const result = await query(
    `SELECT * FROM public.user_sessions
      WHERE user_id = $1 AND revoked_at IS NULL
      ORDER BY last_active_at DESC, created_at DESC`,
    [userId],
  )
  return rowsOf(result)
}

/**
 * Revoke sessions for a user. Returns the number of newly revoked rows.
 * Pass `exceptId` to keep the caller's current session (sign-out-everywhere).
 */
export async function revokeUserSessions(userId, { exceptId = null, client = null } = {}) {
  const sql = exceptId
    ? `UPDATE public.user_sessions
          SET revoked_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL
        RETURNING id`
    : `UPDATE public.user_sessions
          SET revoked_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND revoked_at IS NULL
        RETURNING id`
  const params = exceptId ? [userId, exceptId] : [userId]
  const result = await run(client, sql, params)
  return rowsOf(result).length
}

export async function revokeUserSession(userId, sessionId, { client = null } = {}) {
  const result = await run(
    client,
    `UPDATE public.user_sessions
        SET revoked_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND id = $2 AND revoked_at IS NULL
      RETURNING *`,
    [userId, sessionId],
  )
  return rowsOf(result)[0] || null
}

export async function touchLastActive(sessionId) {
  if (!sessionId) return
  await query(
    `UPDATE public.user_sessions
        SET last_active_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND revoked_at IS NULL
        AND last_active_at < NOW() - ($2::int * INTERVAL '1 millisecond')`,
    [sessionId, LAST_ACTIVE_THROTTLE_MS],
  )
}

/**
 * Fire-and-forget last-active stamp. In-memory gate avoids a write on every
 * authenticated request; the SQL predicate is a second backstop.
 */
export function scheduleTouchLastActive(sessionId) {
  if (!sessionId) return
  const now = Date.now()
  const prev = lastTouchAt.get(sessionId) || 0
  if (now - prev < LAST_ACTIVE_THROTTLE_MS) return
  lastTouchAt.set(sessionId, now)
  if (lastTouchAt.size > 20_000) lastTouchAt.clear()
  touchLastActive(sessionId).catch((err) => {
    logger.warn({ err: err?.message, session_id: sessionId }, 'user_sessions last_active_at update failed')
  })
}

/** Test hook — drop the in-memory throttle so tests can force a write. */
export function _resetLastActiveThrottleForTests() {
  lastTouchAt.clear()
}

export function sessionIdFromToken(decoded) {
  return decoded?.session_id || decoded?.jti || null
}

export function publicSession(row, currentSessionId) {
  return {
    id: row.id,
    is_current: Boolean(currentSessionId) && row.id === currentSessionId,
    device_kind: row.device_kind,
    device_summary: row.device_summary,
    ip: row.ip || null,
    ip_country_iso: row.ip_country_iso || null,
    ip_country: row.ip_country || null,
    ip_city: row.ip_city || null,
    created_at: iso(row.created_at),
    last_active_at: iso(row.last_active_at),
  }
}
