/**
 * Sentry error tracking for the WingCaster API.
 *
 * Init is a silent no-op when SENTRY_DSN is unset (local/dev default).
 * Standing rule: PII default MASKED — never send raw PII to Sentry.
 */

import * as Sentry from '@sentry/node'
import { ProfilingIntegration } from '@sentry/profiling-node'
import logger from '../logger.js'

export const REDACTED = '[Filtered]'

/** Keys whose values must never leave the process as plaintext. */
const SENSITIVE_KEY =
  /^(?:password|passwd|pwd|secret|token|access[_-]?token|refresh[_-]?token|id[_-]?token|authorization|auth|api[_-]?key|x[_-]?api[_-]?key|session|session[_-]?id|cookie|cookies|otp|otp[_-]?code|code|totp|totp[_-]?code|backup[_-]?code|backup[_-]?codes|ssn|social[_-]?security|national[_-]?id|applicant[_-]?id|applicant[_-]?ssn|credit[_-]?card|card[_-]?number|cardnumber|cvv|cvc|email|e[_-]?mail|phone|phone[_-]?number|mobile|msisdn|name|first[_-]?name|last[_-]?name|full[_-]?name|display[_-]?name)$/i

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi
// Require a leading + or separators typical of phone numbers — avoid matching UUIDs.
const PHONE_RE = /(?:\+\d[\d\s().-]{6,}\d)|(?:\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4})/g
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * @param {string} key
 * @returns {boolean}
 */
export function isSensitiveKey(key) {
  return SENSITIVE_KEY.test(String(key || ''))
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function scrubStringValue(value) {
  if (typeof value !== 'string') return value
  if (UUID_RE.test(value)) return value
  return value.replace(EMAIL_RE, REDACTED).replace(PHONE_RE, REDACTED)
}

/**
 * Recursively redact sensitive keys and obvious email/phone plaintext.
 * Safe to call on request bodies, query objects, extras, breadcrumb data.
 *
 * @param {unknown} input
 * @param {string} [parentKey]
 * @returns {unknown}
 */
export function scrubValue(input, parentKey = '') {
  if (parentKey && isSensitiveKey(parentKey)) return REDACTED

  if (input == null) return input
  if (typeof input === 'string') return scrubStringValue(input)
  if (typeof input !== 'object') return input

  if (Array.isArray(input)) {
    return input.map((item) => scrubValue(item, parentKey))
  }

  const out = {}
  for (const [key, value] of Object.entries(input)) {
    out[key] = isSensitiveKey(key) ? REDACTED : scrubValue(value, key)
  }
  return out
}

/**
 * Scrub a query string (`a=1&email=x@y.com`) into a redacted form.
 * @param {string | Record<string, unknown> | undefined} query
 * @returns {string | Record<string, unknown> | undefined}
 */
export function scrubQueryString(query) {
  if (query == null) return query
  if (typeof query === 'object') return /** @type {Record<string, unknown>} */ (scrubValue(query))

  try {
    const params = new URLSearchParams(String(query))
    const parts = []
    for (const [key, value] of params.entries()) {
      const scrubbed = isSensitiveKey(key) ? REDACTED : String(scrubStringValue(value))
      // Keep the redaction marker readable in Sentry (do not percent-encode it).
      parts.push(
        isSensitiveKey(key)
          ? `${encodeURIComponent(key)}=${REDACTED}`
          : `${encodeURIComponent(key)}=${encodeURIComponent(scrubbed)}`,
      )
    }
    return parts.join('&')
  } catch {
    return REDACTED
  }
}

/**
 * beforeSend hook — strip PII from request bodies, query strings, and user context.
 * OK to keep: user_id / tenant_id / agency_id (UUID), route, method, status, stack.
 *
 * @param {import('@sentry/node').Event} event
 * @returns {import('@sentry/node').Event | null}
 */
export function scrubPii(event) {
  if (!event) return event

  if (event.request) {
    if (event.request.data != null) {
      event.request.data = scrubValue(event.request.data)
    }
    if (event.request.query_string != null) {
      event.request.query_string = scrubQueryString(event.request.query_string)
    }
    if (event.request.headers) {
      event.request.headers = /** @type {Record<string, string>} */ (scrubValue(event.request.headers))
    }
    if (event.request.cookies) {
      event.request.cookies = REDACTED
    }
  }

  if (event.user) {
    // Keep only UUID-style id fields — never email/username/ip/name.
    const safe = {}
    if (event.user.id) safe.id = event.user.id
    event.user = safe
  }

  if (event.extra) {
    event.extra = /** @type {Record<string, unknown>} */ (scrubValue(event.extra))
  }

  if (event.contexts) {
    event.contexts = /** @type {typeof event.contexts} */ (scrubValue(event.contexts))
  }

  const crumbs = event.breadcrumbs
  if (Array.isArray(crumbs)) {
    for (const crumb of crumbs) {
      if (crumb?.data) crumb.data = /** @type {Record<string, unknown>} */ (scrubValue(crumb.data))
      if (typeof crumb?.message === 'string') crumb.message = scrubStringValue(crumb.message)
    }
  } else if (crumbs?.values && Array.isArray(crumbs.values)) {
    for (const crumb of crumbs.values) {
      if (crumb?.data) crumb.data = /** @type {Record<string, unknown>} */ (scrubValue(crumb.data))
      if (typeof crumb?.message === 'string') crumb.message = scrubStringValue(crumb.message)
    }
  }

  return event
}

let initialized = false

/**
 * Initialize Sentry. Must run before Express middleware / route handlers.
 * No-ops (with a warn log) when SENTRY_DSN is absent.
 */
export function initSentry() {
  if (initialized) return
  initialized = true

  if (!process.env.SENTRY_DSN) {
    logger.warn('sentry disabled: SENTRY_DSN not set')
    return
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.GIT_SHA || 'unknown',
    tracesSampleRate: 0.1,
    profilesSampleRate: 0.1,
    integrations: [new ProfilingIntegration()],
    beforeSend: scrubPii,
  })

  logger.info(
    { environment: process.env.NODE_ENV || 'development', release: process.env.GIT_SHA || 'unknown' },
    'sentry initialized',
  )
}

/**
 * Auth / security breadcrumbs — never include credentials or revealed PII values.
 *
 * @param {string} message
 * @param {Record<string, unknown>} [data]
 * @param {'info' | 'warning' | 'error'} [level]
 */
export function addAuthBreadcrumb(message, data = {}, level = 'info') {
  Sentry.addBreadcrumb({
    category: 'auth',
    message,
    level,
    data: /** @type {Record<string, unknown>} */ (scrubValue(data)),
  })
}

export { Sentry }
