/**
 * Persist a distribution_attempts row with classified error_class.
 * Single insert path for the publishing pipeline so every attempt is typed.
 */

import { randomUUID } from 'node:crypto'
import { insert } from '../../persistence/index.js'
import { classifyProviderError, ERROR_CLASS } from './error-classifier.js'

/**
 * @param {object} opts
 * @param {string} opts.distributionJobId
 * @param {string} [opts.status] - attempt status (published / failed / pending_retry / …)
 * @param {unknown} [opts.response] - provider response payload
 * @param {unknown} [opts.error] - raw provider error (Error | object | string)
 * @param {string} [opts.errorMessage] - override message text
 * @param {string} [opts.errorClass] - skip classifier when already known
 * @param {string|Date} [opts.attemptedAt]
 * @param {object} [opts.extra] - merged into data JSONB via DAL
 */
export async function recordDistributionAttempt({
  distributionJobId,
  status,
  response = null,
  error = null,
  errorMessage = null,
  errorClass = null,
  attemptedAt = null,
  extra = {},
} = {}) {
  if (!distributionJobId) {
    throw Object.assign(new Error('distributionJobId is required'), { code: 'MISSING_DISTRIBUTION_JOB_ID' })
  }

  const message =
    errorMessage
    ?? (typeof error === 'string' ? error : null)
    ?? error?.message
    ?? error?.error?.message
    ?? null

  const classified = errorClass
    || (status === 'published' || status === 'success' || (!error && !message)
      ? null
      : classifyProviderError(error || message))

  const row = {
    id: randomUUID(),
    distribution_job_id: distributionJobId,
    status: status || (classified ? 'failed' : 'published'),
    response: response ?? (error?.details || error?.response || null),
    error_message: message,
    error_class: classified,
    attempted_at: attemptedAt || new Date().toISOString(),
    ...extra,
  }

  return insert('distribution_attempts', row)
}

export { ERROR_CLASS, classifyProviderError }
