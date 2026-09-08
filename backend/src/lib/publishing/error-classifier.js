/**
 * Normalize raw provider / adapter errors into a stable error_class for
 * distribution_attempts. Used by the publish pipeline and retry policy.
 *
 * Codes (CHECK-constrained on the column):
 *   auth_expired | portal_rules_violation | portal_down |
 *   quota_exceeded | invalid_content | unknown_error
 */

export const ERROR_CLASSES = /** @type {const} */ ([
  'auth_expired',
  'portal_rules_violation',
  'portal_down',
  'quota_exceeded',
  'invalid_content',
  'unknown_error',
])

export const ERROR_CLASS = Object.freeze(
  Object.fromEntries(ERROR_CLASSES.map((c) => [c.toUpperCase(), c])),
)

const AUTH_CODES = new Set([
  'AUTH_EXPIRED',
  'TOKEN_EXPIRED',
  'INVALID_TOKEN',
  'OAUTH_EXCEPTION',
  'MISSING_OAUTH_TOKEN',
  'PUBLISH_CREDENTIALS_MISSING',
  'INSTAGRAM_UNCONFIGURED',
  'FACEBOOK_UNCONFIGURED',
  'LINKEDIN_UNCONFIGURED',
  'X_UNCONFIGURED',
  'TIKTOK_UNCONFIGURED',
  'UNAUTHORIZED',
  'FORBIDDEN',
])

const QUOTA_CODES = new Set([
  'QUOTA_EXCEEDED',
  'RATE_LIMIT',
  'RATE_LIMITED',
  'THROTTLED',
  'TOO_MANY_REQUESTS',
])

const INVALID_CODES = new Set([
  'INVALID_CONTENT',
  'MISSING_CONTENT',
  'MISSING_MEDIA',
  'MISSING_MEDIA_ID',
  'MISSING_CAROUSEL_IMAGES',
  'MISSING_RECIPIENT',
  'MISSING_AUTHOR',
  'MISSING_TENANT_TARGET',
  'VALIDATION_ERROR',
  'BAD_REQUEST',
])

const RULES_CODES = new Set([
  'PORTAL_RULES_VIOLATION',
  'POLICY_VIOLATION',
  'COMMUNITY_STANDARDS',
  'CONTENT_VIOLATION',
  'SPAM',
])

const DOWN_CODES = new Set([
  'PORTAL_DOWN',
  'SERVICE_UNAVAILABLE',
  'GATEWAY_TIMEOUT',
  'BAD_GATEWAY',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
])

function collectText(err) {
  if (err == null) return ''
  if (typeof err === 'string') return err
  const parts = []
  const walk = (value, depth = 0) => {
    if (value == null || depth > 4) return
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      parts.push(String(value))
      return
    }
    if (Array.isArray(value)) {
      for (const item of value.slice(0, 20)) walk(item, depth + 1)
      return
    }
    if (typeof value === 'object') {
      for (const key of ['message', 'code', 'error_code', 'type', 'title', 'detail', 'error_user_msg', 'error_subcode', 'status', 'statusCode', 'httpStatus', 'name']) {
        if (key in value) walk(value[key], depth + 1)
      }
      if (value.error && typeof value.error === 'object') walk(value.error, depth + 1)
      if (value.details && typeof value.details === 'object') walk(value.details, depth + 1)
      if (value.response && typeof value.response === 'object') walk(value.response, depth + 1)
      if (value.data && typeof value.data === 'object') walk(value.data, depth + 1)
    }
  }
  walk(err)
  return parts.join(' ').toLowerCase()
}

function numericCodes(err) {
  const out = []
  const push = (v) => {
    const n = Number(v)
    if (Number.isFinite(n)) out.push(n)
  }
  if (!err || typeof err !== 'object') return out
  push(err.code)
  push(err.status)
  push(err.statusCode)
  push(err.httpStatus)
  push(err.error_subcode)
  if (err.error && typeof err.error === 'object') {
    push(err.error.code)
    push(err.error.error_subcode)
    push(err.error.status)
  }
  if (err.details && typeof err.details === 'object') {
    push(err.details.code)
    push(err.details.error?.code)
    push(err.details.error?.error_subcode)
  }
  return out
}

function stringCodes(err) {
  const out = []
  const push = (v) => {
    if (v == null) return
    const s = String(v).trim()
    if (!s) return
    out.push(s.toUpperCase().replace(/[\s-]+/g, '_'))
  }
  if (!err || typeof err !== 'object') {
    if (typeof err === 'string') push(err)
    return out
  }
  push(err.code)
  push(err.error_code)
  push(err.name)
  push(err.type)
  if (err.error && typeof err.error === 'object') {
    push(err.error.code)
    push(err.error.type)
    push(err.error.error_user_title)
  }
  if (err.details && typeof err.details === 'object') {
    push(err.details.code)
    push(err.details.error?.code)
    push(err.details.error?.type)
  }
  return out
}

/**
 * @param {unknown} rawError - provider Error, Graph payload, or free-form object/string
 * @returns {typeof ERROR_CLASSES[number]}
 */
export function classifyProviderError(rawError) {
  if (rawError == null || rawError === '') return ERROR_CLASS.UNKNOWN_ERROR

  const codes = stringCodes(rawError)
  const nums = numericCodes(rawError)
  const text = collectText(rawError)

  // Explicit already-normalized class
  for (const c of codes) {
    if (ERROR_CLASSES.includes(/** @type {any} */ (c.toLowerCase()))) {
      return /** @type {typeof ERROR_CLASSES[number]} */ (c.toLowerCase())
    }
  }

  // Auth — Meta 190 / 102, HTTP 401
  if (
    nums.includes(190) ||
    nums.includes(102) ||
    nums.includes(401) ||
    codes.some((c) => AUTH_CODES.has(c) || c.includes('AUTH') && (c.includes('EXPIR') || c.includes('TOKEN') || c.includes('OAUTH'))) ||
    /\b(auth(entication|orization)? (fail|error|expired)|(invalid|expired|revoked) (access )?token|(access )?token (is )?(invalid|expired|revoked)|error validating access token|oauthexception|session has expired|invalid oauth|not authorized|unauthorized)\b/i.test(text)
  ) {
    return ERROR_CLASS.AUTH_EXPIRED
  }

  // Quota / rate limit — HTTP 429, Meta 4 / 17 / 32 / 613
  if (
    nums.includes(429) ||
    nums.includes(4) ||
    nums.includes(17) ||
    nums.includes(32) ||
    nums.includes(613) ||
    codes.some((c) => QUOTA_CODES.has(c) || c.includes('RATE_LIMIT') || c.includes('THROTTL') || c.includes('QUOTA')) ||
    /\b(rate[- ]?limit|too many requests|throttl|quota (exceeded|limit)|usage limit|call limit|application request limit)\b/i.test(text)
  ) {
    return ERROR_CLASS.QUOTA_EXCEEDED
  }

  // Portal down — 5xx, network
  if (
    nums.some((n) => n >= 500 && n <= 599) ||
    codes.some((c) => DOWN_CODES.has(c) || c.endsWith('_UNAVAILABLE')) ||
    /\b(service unavailable|temporarily unavailable|bad gateway|gateway timeout|econnrefused|etimedout|econnreset|enotfound|network error|connection reset|portal.?down|try again later)\b/i.test(text)
  ) {
    return ERROR_CLASS.PORTAL_DOWN
  }

  // Portal rules / policy
  if (
    nums.includes(368) ||
    codes.some((c) => RULES_CODES.has(c) || c.includes('POLICY') || c.includes('COMMUNITY')) ||
    /\b(community standards|violat(es|ion)|content.?policy|policy.?viol|not allowed|restricted|spam|disallowed|terms of (service|use)|prohibited)\b/i.test(text)
  ) {
    return ERROR_CLASS.PORTAL_RULES_VIOLATION
  }

  // Invalid content / validation — HTTP 400 (after auth/quota checks)
  if (
    nums.includes(400) ||
    nums.includes(422) ||
    codes.some((c) => INVALID_CODES.has(c) || c.includes('MISSING_') || c.includes('INVALID_')) ||
    /\b(invalid (media|image|video|format|content|caption|payload)|missing (media|image|video|content|caption|recipient)|unsupported (media|format|type)|too large|file size|aspect ratio|validation (failed|error)|malformed)\b/i.test(text)
  ) {
    return ERROR_CLASS.INVALID_CONTENT
  }

  return ERROR_CLASS.UNKNOWN_ERROR
}

/** @deprecated Use classifyProviderError — alias for call-site clarity */
export function classifyError(rawError) {
  return classifyProviderError(rawError)
}
