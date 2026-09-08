/**
 * AGT-PUB-003 destination / job aggregate helpers.
 *
 * DB stores error_class as snake_case (CHECK on distribution_attempts).
 * The JSON contract uses the uppercase form from the brief.
 */

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

/** Transient classes that may be retried without a content/auth fix. */
export const RETRYABLE_ERROR_CLASSES = Object.freeze(['PORTAL_DOWN', 'UNKNOWN_ERROR'])

const RETRYABLE_SET = new Set(RETRYABLE_ERROR_CLASSES)

const SUCCEEDED_RAW = new Set(['published', 'success', 'succeeded', 'live'])
const FAILED_RAW = new Set(['failed', 'error', 'exhausted', 'pending_retry'])
const IN_REVIEW_RAW = new Set([
  'in_review',
  'pending_review',
  'submitted',
  'queued',
  'pending',
  'draft',
  'moderation',
])

export function errorClassToApi(value) {
  if (value == null || value === '') return null
  return String(value).trim().toUpperCase().replace(/[\s-]+/g, '_')
}

export function errorClassToDb(value) {
  if (value == null || value === '') return null
  return String(value).trim().toLowerCase().replace(/[\s-]+/g, '_')
}

export function isRetryableErrorClass(value) {
  const api = errorClassToApi(value)
  return Boolean(api) && RETRYABLE_SET.has(api)
}

/**
 * Map a destination row (job status + latest attempt) to the contract status.
 */
export function mapDestinationStatus({ jobStatus, attemptStatus } = {}) {
  const attempt = String(attemptStatus || '').toLowerCase()
  const job = String(jobStatus || '').toLowerCase()
  if (SUCCEEDED_RAW.has(attempt) || (SUCCEEDED_RAW.has(job) && !attempt)) {
    return DESTINATION_STATUS.SUCCEEDED
  }
  if (FAILED_RAW.has(attempt) || FAILED_RAW.has(job)) {
    return DESTINATION_STATUS.FAILED
  }
  if (IN_REVIEW_RAW.has(attempt) || IN_REVIEW_RAW.has(job) || !attempt) {
    return DESTINATION_STATUS.IN_REVIEW
  }
  return DESTINATION_STATUS.IN_REVIEW
}

export function retryAvailable({ status, errorClass, error_class } = {}) {
  return status === DESTINATION_STATUS.FAILED && isRetryableErrorClass(errorClass ?? error_class)
}

/**
 * Filter failed destinations whose error_class is in the requested retry set.
 * `errorClasses` are API (uppercase) or DB (snake_case) forms.
 * Requested classes are intersected with the transient retryable set.
 */
export function filterRetryableDestinations(destinations, errorClasses) {
  const wanted = new Set(
    (errorClasses || RETRYABLE_ERROR_CLASSES)
      .map(errorClassToApi)
      .filter((cls) => RETRYABLE_SET.has(cls)),
  )
  return (destinations || []).filter((dest) => {
    if (!retryAvailable(dest)) return false
    return wanted.has(errorClassToApi(dest.error_class ?? dest.errorClass))
  })
}

/**
 * Aggregate mapping (AGT-PUB-003):
 * - all succeeded, none in_review, none failed → all_succeeded
 * - all failed → all_failed
 * - only in_review (no success, no fail) → in_review_only
 * - some succeeded + some in_review, none failed → partial
 * - otherwise mix of fail + anything → mixed
 */
export function computeAggregate(counts) {
  const succeeded = Number(counts?.succeeded || 0)
  const inReview = Number(counts?.in_review || 0)
  const failed = Number(counts?.failed || 0)
  const total = Number(counts?.total || succeeded + inReview + failed)

  if (total === 0) return JOB_AGGREGATE.IN_REVIEW_ONLY
  if (succeeded === total && inReview === 0 && failed === 0) return JOB_AGGREGATE.ALL_SUCCEEDED
  if (failed === total && succeeded === 0 && inReview === 0) return JOB_AGGREGATE.ALL_FAILED
  if (inReview === total && succeeded === 0 && failed === 0) return JOB_AGGREGATE.IN_REVIEW_ONLY
  if (failed === 0 && succeeded > 0 && inReview > 0) return JOB_AGGREGATE.PARTIAL
  return JOB_AGGREGATE.MIXED
}

export function countDestinations(destinations) {
  const counts = { succeeded: 0, in_review: 0, failed: 0, total: 0 }
  for (const dest of destinations || []) {
    counts.total += 1
    if (dest.status === DESTINATION_STATUS.SUCCEEDED) counts.succeeded += 1
    else if (dest.status === DESTINATION_STATUS.FAILED) counts.failed += 1
    else counts.in_review += 1
  }
  return counts
}

export function fixDeepLink({ errorClass, listingId, destinationId, correlationId } = {}) {
  const cls = errorClassToApi(errorClass)
  switch (cls) {
    case 'AUTH_EXPIRED':
      return '/channels/reconnect'
    case 'PORTAL_RULES_VIOLATION':
    case 'INVALID_CONTENT':
      return listingId
        ? `/listings/${listingId}/publish-fix/${destinationId || ''}`
        : '/publish/fix'
    case 'QUOTA_EXCEEDED':
      return '/settings/billing'
    case 'UNKNOWN_ERROR':
      return correlationId
        ? `/support?correlation_id=${encodeURIComponent(correlationId)}`
        : '/support'
    default:
      return null
  }
}

export function moderationQueueDeepLink({ status, listingId, destinationId } = {}) {
  if (status !== DESTINATION_STATUS.IN_REVIEW || !listingId) return null
  return `/listings/${listingId}/submissions/${destinationId || ''}`
}

export const PUBLISH_RECEIPT_DEEP_LINK = (jobId) => `wingcaster://publish-receipt/${jobId}`
