/**
 * Best-effort backfill of distribution_attempts.error_class from error_message
 * (and nested response payloads). Logs how many rows stayed unclassified.
 */

import { logger as defaultLogger } from '../logger.js'
import { classifyProviderError, ERROR_CLASS } from './error-classifier.js'

/**
 * @param {object} opts
 * @param {{ query: Function }} opts.pool - pg Pool or compatible { query }
 * @param {import('pino').Logger} [opts.logger]
 * @returns {Promise<{ scanned: number, updated: number, unclassified: number }>}
 */
export async function backfillDistributionAttemptErrorClasses({
  pool,
  logger = defaultLogger,
} = {}) {
  if (!pool?.query) {
    throw new Error('backfillDistributionAttemptErrorClasses requires pool.query')
  }

  const { rows } = await pool.query(`
    SELECT id, error_message, response, error_class
      FROM public.distribution_attempts
     WHERE error_class IS NULL
       AND (
         error_message IS NOT NULL
         OR response IS NOT NULL
       )
  `)

  let updated = 0
  let unclassified = 0

  for (const row of rows) {
    const raw = {
      message: row.error_message,
      details: row.response,
    }
    const classified = classifyProviderError(raw)
    if (classified === ERROR_CLASS.UNKNOWN_ERROR) {
      // Still write unknown_error when we had an error_message so the column
      // is populated; count separately for ops visibility.
      unclassified += 1
    }
    await pool.query(
      `UPDATE public.distribution_attempts
          SET error_class = $2
        WHERE id = $1
          AND error_class IS NULL`,
      [row.id, classified],
    )
    updated += 1
  }

  logger.info(
    {
      scanned: rows.length,
      updated,
      unclassified,
    },
    'distribution_attempts.error_class backfill complete',
  )

  return { scanned: rows.length, updated, unclassified }
}
