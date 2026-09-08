/**
 * Pure mapping helpers for AGT-PUB-003 publish-outcome aggregation.
 * DB stores error_class as snake_case; the JSON API uses UPPER_SNAKE.
 */

export const API_ERROR_CLASS = Object.freeze({
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  PORTAL_RULES_VIOLATION: 'PORTAL_RULES_VIOLATION',
  PORTAL_DOWN: 'PORTAL_DOWN',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  INVALID_CONTENT: 'INVALID_CONTENT',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
})

/** Transient classes the receipt may retry without a content/auth fix. */
export const RETRYABLE_ERROR_CLASSES = Object.freeze([
  API_ERROR_CLASS.PORTAL_DOWN,
  API_ERROR_CLASS.UNKNOWN_ERROR,
])

export const DESTINATION_STATUS = Object.freeze({
  SUCCEEDED: 'succeeded',
  IN_REVIEW: 'in_review',
  FAILED: 'failed',
})

export const JOB_AGGREGATE = Object.freeze({
  ALL_SUCCEEDED: 'all_succeeded',
  ALL_FAILED: 'all_failed',
  IN_REVIEW_ONLY: 'in_review_only',
  PARTIAL: 'partial',
  MIXED: 'mixed',
})

const SUCCEEDED_RAW = new Set([
  'published', 'succeeded', 'success', 'live', 'completed', 'approved',
])
const FAILED_RAW = new Set([
  'failed', 'error', 'rejected',
])
const IN_REVIEW_RAW = new Set([
  'in_review', 'pending_review', 'submitted', 'queued', 'pending_moderation',
  'under_review', 'pending_pa', 'pending', 'pending_retry', 'processing',
  'draft', 'scheduled',
])

/**
 * @param {string|null|undefined} dbValue snake_case from distribution_attempts
 * @returns {string|null} UPPER_SNAKE API form
 */
export function toApiErrorClass(dbValue) {
  if (dbValue == null || String(dbValue).trim() === '') return null
  return String(dbValue).trim().toUpperCase()
}

/**
 * @param {string|null|undefined} apiValue UPPER_SNAKE from the client
 * @returns {string|null} snake_case for DB / filters
 */
export function toDbErrorClass(apiValue) {
  if (apiValue == null || String(apiValue).trim() === '') return null
  return String(apiValue).trim().toLowerCase()
}

/**
 * Map a distribution_jobs / latest-attempt status onto the receipt enum.
 * @param {string|null|undefined} jobStatus
 * @param {string|null|undefined} attemptStatus
 */
export function mapDestinationStatus(jobStatus, attemptStatus) {
  const raw = String(attemptStatus || jobStatus || '').toLowerCase().trim()
  if (SUCCEEDED_RAW.has(raw)) return DESTINATION_STATUS.SUCCEEDED
  if (FAILED_RAW.has(raw)) return DESTINATION_STATUS.FAILED
  if (IN_REVIEW_RAW.has(raw)) return DESTINATION_STATUS.IN_REVIEW
  if (!raw) return DESTINATION_STATUS.IN_REVIEW
  return DESTINATION_STATUS.FAILED
}

/**
 * @param {string} status succeeded|in_review|failed
 * @param {string|null} apiErrorClass
 */
export function isRetryAvailable(status, apiErrorClass) {
  if (status !== DESTINATION_STATUS.FAILED) return false
  return RETRYABLE_ERROR_CLASSES.includes(apiErrorClass)
}

/**
 * Filter failed destinations whose error_class is in the requested retry set.
 * Unknown / non-retryable classes are skipped (retry-all never 409s the batch).
 *
 * @param {Array<{ status: string, error_class: string|null, retry_available?: boolean }>} destinations
 * @param {string[]} [errorClassesToRetry]
 */
export function filterRetryableDestinations(destinations, errorClassesToRetry) {
  const wanted = new Set(
    (errorClassesToRetry && errorClassesToRetry.length
      ? errorClassesToRetry
      : RETRYABLE_ERROR_CLASSES
    ).map((c) => toApiErrorClass(c)),
  )
  return (destinations || []).filter((dest) => {
    if (dest.status !== DESTINATION_STATUS.FAILED) return false
    const cls = dest.error_class || null
    if (!wanted.has(cls)) return false
    if (dest.retry_available === false) return false
    return isRetryAvailable(dest.status, cls)
  })
}

/**
 * Aggregate mapping (AGT-PUB-003):
 *   all succeeded, none in_review, none failed → all_succeeded
 *   all failed → all_failed
 *   only in_review (no success, no fail) → in_review_only
 *   some succeeded + some in_review, none failed → partial
 *   otherwise mix of fail + anything → mixed
 *
 * @param {string[]} statuses
 */
export function computeAggregate(statuses) {
  const list = Array.isArray(statuses) ? statuses : []
  const n = list.length
  if (n === 0) return JOB_AGGREGATE.ALL_FAILED

  let succeeded = 0
  let failed = 0
  let inReview = 0
  for (const status of list) {
    if (status === DESTINATION_STATUS.SUCCEEDED) succeeded += 1
    else if (status === DESTINATION_STATUS.FAILED) failed += 1
    else inReview += 1
  }

  if (succeeded === n && inReview === 0 && failed === 0) return JOB_AGGREGATE.ALL_SUCCEEDED
  if (failed === n) return JOB_AGGREGATE.ALL_FAILED
  if (inReview === n && succeeded === 0 && failed === 0) return JOB_AGGREGATE.IN_REVIEW_ONLY
  if (failed === 0 && succeeded > 0 && inReview > 0) return JOB_AGGREGATE.PARTIAL
  return JOB_AGGREGATE.MIXED
}

export function countByStatus(statuses) {
  const list = Array.isArray(statuses) ? statuses : []
  let succeeded = 0
  let failed = 0
  let inReview = 0
  for (const status of list) {
    if (status === DESTINATION_STATUS.SUCCEEDED) succeeded += 1
    else if (status === DESTINATION_STATUS.FAILED) failed += 1
    else inReview += 1
  }
  return { succeeded, in_review: inReview, failed, total: list.length }
}

/** Job is terminal once every destination has a receipt status (always, given the 3-way map). */
export function isTerminalAggregate(aggregate) {
  return Object.values(JOB_AGGREGATE).includes(aggregate)
}

export function templateCodeForAggregate(aggregate) {
  return `publishing_job.completed.${aggregate}`
}

export function receiptDeepLink(jobId) {
  return `wingcaster://publish-receipt/${jobId}`
}

/**
 * @param {string|null} apiErrorClass
 * @param {{ listingId?: string|null, portalCode?: string|null }} ctx
 */
export function fixDeepLinkFor(apiErrorClass, { listingId, portalCode } = {}) {
  const portal = portalCode ? encodeURIComponent(portalCode) : ''
  const listing = listingId ? encodeURIComponent(listingId) : ''
  switch (apiErrorClass) {
    case API_ERROR_CLASS.AUTH_EXPIRED:
      return portal
        ? `wingcaster://channels/reconnect?portal=${portal}`
        : 'wingcaster://channels/reconnect'
    case API_ERROR_CLASS.PORTAL_RULES_VIOLATION:
    case API_ERROR_CLASS.INVALID_CONTENT:
      return listing
        ? `wingcaster://listings/${listing}/fix${portal ? `?portal=${portal}` : ''}`
        : null
    case API_ERROR_CLASS.QUOTA_EXCEEDED:
      return 'wingcaster://billing'
    default:
      return null
  }
}

export function moderationQueueDeepLink({ listingId, destinationId, status } = {}) {
  if (status !== DESTINATION_STATUS.IN_REVIEW) return null
  if (!listingId || !destinationId) return null
  return `wingcaster://listings/${encodeURIComponent(listingId)}/submissions/${encodeURIComponent(destinationId)}`
}

export function substitutePlaceholders(text, { N, M, jobId, deepLink } = {}) {
  if (text == null) return ''
  return String(text)
    .replaceAll('{N}', String(N ?? ''))
    .replaceAll('{M}', String(M ?? ''))
    .replaceAll('{jobId}', String(jobId ?? ''))
    .replaceAll('{deep_link}', String(deepLink ?? ''))
    .replaceAll('{{N}}', String(N ?? ''))
    .replaceAll('{{M}}', String(M ?? ''))
    .replaceAll('{{jobId}}', String(jobId ?? ''))
    .replaceAll('{{deep_link}}', String(deepLink ?? ''))
}
