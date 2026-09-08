/**
 * Re-attempt one publishing destination.
 *
 * Live portal adapters are still stubs (BE-BLOCKER-01 / Agent 1). When the
 * adapter is unwired we enqueue a new distribution_attempts row and bump
 * retry_count instead of calling meterFeature (which would consume credits
 * on the publishing.* consume-on-failure path).
 */

import { query } from '../../db.js'
import { recordDistributionAttempt } from './record-attempt.js'
import {
  errorClassToApi,
  isRetryableErrorClass,
  mapDestinationStatus,
  retryAvailable,
} from './aggregate.js'

export class PublishingRetryError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message)
    this.name = 'PublishingRetryError'
    this.status = status
    this.code = code
    this.extra = extra
  }
}

async function loadDestination(jobId, destinationId, callerUserId) {
  const rows = await query(
    `WITH caller AS (
       SELECT a.id AS agent_id, a.user_id, a.agency_id
         FROM public.agents a
        WHERE a.user_id = $1 OR a.id = $1
     ),
     caller_agencies AS (
       SELECT agency_id FROM caller WHERE agency_id IS NOT NULL
       UNION
       SELECT am.agency_id
         FROM public.agency_members am
        WHERE am.status = 'active'
          AND (am.user_id = $1 OR am.agent_id = $1)
     )
     SELECT dj.*, latest.error_class AS latest_error_class, latest.status AS latest_status
       FROM public.distribution_jobs dj
       LEFT JOIN public.publishing_jobs pj ON pj.id = dj.publishing_job_id
       LEFT JOIN LATERAL (
         SELECT a.error_class, a.status
           FROM public.distribution_attempts a
          WHERE a.distribution_job_id = dj.id
          ORDER BY a.attempted_at DESC NULLS LAST, a.created_at DESC NULLS LAST
          LIMIT 1
       ) latest ON true
      WHERE dj.id = $3
        AND (
          dj.publishing_job_id = $2
          OR dj.id = $2
          OR pj.id = $2
        )
        AND (
          dj.agent_id IN (SELECT agent_id FROM caller)
          OR dj.agent_id IN (SELECT user_id FROM caller)
          OR COALESCE(pj.agent_id, dj.agent_id) IN (SELECT agent_id FROM caller)
          OR COALESCE(pj.agency_id, dj.agency_id) IN (SELECT agency_id FROM caller_agencies)
        )
      LIMIT 1`,
    [callerUserId, jobId, destinationId],
  )
  return rows[0] || null
}

function assertRetryable(row) {
  const status = mapDestinationStatus({
    jobStatus: row.status,
    attemptStatus: row.latest_status,
  })
  const errorClass = errorClassToApi(row.latest_error_class)
  if (!retryAvailable({ status, errorClass }) && !isRetryableErrorClass(errorClass)) {
    throw new PublishingRetryError(
      409,
      'ERROR_CLASS_NOT_RETRYABLE',
      'Destination error_class is not retryable',
      { error_class: errorClass, status },
    )
  }
  if (status !== 'failed' && !isRetryableErrorClass(errorClass)) {
    throw new PublishingRetryError(
      409,
      'ERROR_CLASS_NOT_RETRYABLE',
      'Destination is not in a retryable failed state',
      { error_class: errorClass, status },
    )
  }
}

/**
 * @returns {Promise<object>} the new distribution_attempts row
 */
export async function retryPublishingDestination({
  jobId,
  destinationId,
  callerUserId,
  source = 'manual_single',
} = {}) {
  const row = await loadDestination(jobId, destinationId, callerUserId)
  if (!row) {
    throw new PublishingRetryError(404, 'NOT_FOUND', 'Not found')
  }
  assertRetryable(row)

  const previousClass = row.latest_error_class || 'unknown_error'
  const attempt = await recordDistributionAttempt({
    distributionJobId: row.id,
    status: 'pending_retry',
    errorClass: previousClass,
    errorMessage: 'Retry enqueued',
    extra: {
      source,
      retry: true,
      previous_error_class: previousClass,
    },
  })

  await query(
    `UPDATE public.distribution_jobs
        SET retry_count = COALESCE(retry_count, 0) + 1,
            status = 'pending_retry',
            error_message = $2,
            updated_at = CURRENT_TIMESTAMP,
            data = COALESCE(data, '{}'::jsonb) || jsonb_build_object(
              'last_retry_at', CURRENT_TIMESTAMP::text,
              'last_retry_source', $3::text
            )
      WHERE id = $1`,
    [row.id, 'Retry enqueued', source],
  )

  return attempt
}

export async function retryPublishingDestinations({
  jobId,
  destinationIds,
  callerUserId,
  source = 'manual_retry_all',
} = {}) {
  const attempts = []
  for (const destinationId of destinationIds || []) {
    const attempt = await retryPublishingDestination({
      jobId,
      destinationId,
      callerUserId,
      source,
    })
    attempts.push(attempt)
  }
  return attempts
}
