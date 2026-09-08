/**
 * Publishing job aggregation for AGT-PUB-003 / BE-BLOCKER-10.
 *
 * One publishing_jobs row fans out to N distribution_jobs (destinations).
 * GET composes destinations + portal_registry + latest attempt + credits
 * in a single JOIN query (no per-portal loops).
 */

import { randomUUID } from 'node:crypto'
import { query } from '../../db.js'
import { ERROR_CLASSES } from './error-classifier.js'
import { recordDistributionAttempt } from './record-attempt.js'

/** Transient classes eligible for retry (API returns UPPER_SNAKE). */
export const RETRYABLE_ERROR_CLASSES = Object.freeze(['PORTAL_DOWN', 'UNKNOWN_ERROR'])

const RETRYABLE_SNAKE = new Set(
  RETRYABLE_ERROR_CLASSES.map((c) => c.toLowerCase()),
)

/** Destinations whose job/attempt status maps to receipt `succeeded`. */
const SUCCEEDED_STATUSES = new Set(['published', 'success', 'live', 'succeeded'])
/** Destinations awaiting portal / PA moderation. */
const IN_REVIEW_STATUSES = new Set([
  'in_review',
  'pending_moderation',
  'submitted',
  'pending',
  'queued',
  'draft',
])
/** Explicit failure / retry-queue statuses. */
const FAILED_STATUSES = new Set(['failed', 'error', 'pending_retry', 'rejected', 'expired'])

/**
 * Map DB snake_case error_class → brief UPPER_SNAKE for JSON.
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
export function toApiErrorClass(value) {
  if (value == null || value === '') return null
  const snake = String(value).trim().toLowerCase().replace(/-/g, '_')
  if (!ERROR_CLASSES.includes(/** @type {any} */ (snake))) {
    return String(value).toUpperCase().replace(/-/g, '_')
  }
  return snake.toUpperCase()
}

/**
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
export function toDbErrorClass(value) {
  if (value == null || value === '') return null
  return String(value).trim().toLowerCase().replace(/-/g, '_')
}

/**
 * Normalize a distribution job / attempt status into receipt destination status.
 * Prefer the latest attempt status when present.
 * @param {string|null|undefined} jobStatus
 * @param {string|null|undefined} attemptStatus
 * @returns {'succeeded'|'in_review'|'failed'}
 */
export function mapDestinationStatus(jobStatus, attemptStatus) {
  const raw = String(attemptStatus || jobStatus || '').toLowerCase()
  if (SUCCEEDED_STATUSES.has(raw)) return 'succeeded'
  if (FAILED_STATUSES.has(raw)) return 'failed'
  if (IN_REVIEW_STATUSES.has(raw)) return 'in_review'
  // Unknown → treat as in_review (still open) rather than failed.
  return 'in_review'
}

/**
 * AggregateOutcomeHero mapping from destination status counts.
 * @param {{ succeeded: number, in_review: number, failed: number, total: number }} counts
 * @returns {'all_succeeded'|'mixed'|'all_failed'|'in_review_only'|'partial'}
 */
export function computeAggregate(counts) {
  const succeeded = Number(counts.succeeded || 0)
  const inReview = Number(counts.in_review || 0)
  const failed = Number(counts.failed || 0)
  const total = Number(counts.total || 0)

  if (total === 0) return 'all_failed'
  if (failed === 0 && inReview === 0 && succeeded === total) return 'all_succeeded'
  if (failed === total && succeeded === 0 && inReview === 0) return 'all_failed'
  if (inReview === total && succeeded === 0 && failed === 0) return 'in_review_only'
  if (failed === 0 && succeeded > 0 && inReview > 0) return 'partial'
  return 'mixed'
}

/**
 * @param {string|null|undefined} status
 * @param {string|null|undefined} errorClassSnakeOrApi
 */
export function isRetryAvailable(status, errorClassSnakeOrApi) {
  if (String(status || '').toLowerCase() !== 'failed') return false
  const snake = toDbErrorClass(errorClassSnakeOrApi)
  return Boolean(snake && RETRYABLE_SNAKE.has(snake))
}

function listingShortRef(row) {
  const title = row.listing_title && String(row.listing_title).trim()
  if (title) return title.length > 48 ? `${title.slice(0, 45)}…` : title
  const city = row.listing_city && String(row.listing_city).trim()
  if (city) return city
  const id = row.listing_id || row.property_id
  return id ? String(id).slice(0, 8) : null
}

function liveUrlFromRow(row) {
  const data = row.job_data && typeof row.job_data === 'object' ? row.job_data : {}
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {}
  const response = row.attempt_response && typeof row.attempt_response === 'object'
    ? row.attempt_response
    : {}
  return (
    data.live_url
    || data.portal_live_url
    || data.permalink
    || payload.live_url
    || payload.portal_live_url
    || response.live_url
    || response.permalink
    || null
  )
}

function fixDeepLink(row, destStatus) {
  if (destStatus !== 'failed') return null
  const apiClass = toApiErrorClass(row.error_class)
  const listingId = row.listing_id || row.property_id
  if (apiClass === 'AUTH_EXPIRED') {
    return `/channels/${row.platform || 'portal'}/reconnect`
  }
  if (apiClass === 'PORTAL_RULES_VIOLATION' || apiClass === 'INVALID_CONTENT') {
    return listingId ? `/publish/fix/${listingId}?portal=${row.platform || ''}` : null
  }
  if (apiClass === 'QUOTA_EXCEEDED') {
    return '/billing/top-up'
  }
  return listingId ? `/publish/retry/${listingId}` : null
}

function moderationDeepLink(row, destStatus) {
  if (destStatus !== 'in_review') return null
  const listingId = row.listing_id || row.property_id
  if (!listingId) return null
  return `/listings/${listingId}/submissions/${row.destination_id}`
}

function parseTimeline(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

/**
 * SQL that loads every destination for a publishing job (or a legacy
 * single distribution_jobs id) with portal + latest attempt + credits
 * + attempt timeline — one round-trip, JOIN-based (no JS N+1).
 */
export const PUBLISHING_JOB_AGGREGATION_SQL = `
WITH scoped_jobs AS (
  SELECT
    dj.id AS destination_id,
    dj.publishing_job_id,
    dj.property_id,
    dj.agent_id,
    dj.agency_id,
    dj.platform,
    dj.status AS job_status,
    dj.payload,
    dj.scheduled_at,
    dj.published_at,
    dj.provider_post_id,
    dj.error_message AS job_error_message,
    dj.retry_count,
    dj.created_at AS job_created_at,
    dj.updated_at AS job_updated_at,
    dj.data AS job_data,
    pj.id AS publishing_job_pk,
    pj.submitted_at AS pj_submitted_at,
    pj.completed_at AS pj_completed_at,
    pj.data AS pj_data,
    p.id AS listing_id,
    p.title AS listing_title,
    p.city AS listing_city
  FROM public.distribution_jobs dj
  LEFT JOIN public.publishing_jobs pj
    ON pj.id = dj.publishing_job_id
  LEFT JOIN public.properties p
    ON p.id = COALESCE(pj.property_id, dj.property_id)
  WHERE (
      dj.publishing_job_id = $1
      OR dj.id = $1
      OR pj.id = $1
    )
    AND (
      dj.agent_id = $2
      OR ($3::text IS NOT NULL AND dj.agency_id = $3)
      OR ($3::text IS NOT NULL AND pj.agency_id = $3)
      OR pj.agent_id = $2
    )
),
latest_attempt AS (
  SELECT DISTINCT ON (da.distribution_job_id)
    da.distribution_job_id,
    da.id AS attempt_id,
    da.status AS attempt_status,
    da.response AS attempt_response,
    da.error_message AS attempt_error_message,
    da.error_class,
    da.attempted_at,
    da.data AS attempt_data
  FROM public.distribution_attempts da
  INNER JOIN scoped_jobs sj ON sj.destination_id = da.distribution_job_id
  ORDER BY da.distribution_job_id, da.attempted_at DESC NULLS LAST, da.id DESC
),
attempt_timeline AS (
  SELECT
    da.distribution_job_id,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', da.id,
          'status', da.status,
          'error_class', da.error_class,
          'error_message', da.error_message,
          'attempted_at', da.attempted_at
        )
        ORDER BY da.attempted_at ASC NULLS LAST, da.id ASC
      ),
      '[]'::jsonb
    ) AS timeline
  FROM public.distribution_attempts da
  INNER JOIN scoped_jobs sj ON sj.destination_id = da.distribution_job_id
  GROUP BY da.distribution_job_id
),
credits AS (
  SELECT
    sj.destination_id,
    COALESCE((
      SELECT SUM(cc.credits_amount)::bigint
        FROM public.credit_consumptions cc
       WHERE cc.related_entity_id = sj.destination_id
          OR cc.request_id = COALESCE(
               sj.job_data->>'credit_request_id',
               la.attempt_data->>'credit_request_id',
               sj.destination_id
             )
    ), 0)::bigint AS credit_charged,
    COALESCE((
      SELECT SUM(cr.credits_amount)::bigint
        FROM public.credit_reservations cr
       WHERE cr.status IN ('HELD', 'CONSUMED', 'RELEASED')
         AND (
           cr.request_id = COALESCE(
             sj.job_data->>'credit_request_id',
             la.attempt_data->>'credit_request_id',
             sj.destination_id
           )
           OR cr.id IN (
             SELECT cc.reservation_id
               FROM public.credit_consumptions cc
              WHERE cc.related_entity_id = sj.destination_id
                AND cc.reservation_id IS NOT NULL
           )
         )
    ), 0)::bigint AS credit_reserved,
    COALESCE((
      SELECT SUM(cr.credits_amount)::bigint
        FROM public.credit_reservations cr
       WHERE cr.status = 'HELD'
         AND cr.request_id = COALESCE(
           sj.job_data->>'credit_request_id',
           la.attempt_data->>'credit_request_id',
           sj.destination_id
         )
    ), 0)::bigint AS credit_held,
    COALESCE((
      SELECT SUM(cr.credits_amount)::bigint
        FROM public.credit_reservations cr
       WHERE cr.status = 'RELEASED'
         AND cr.request_id = COALESCE(
           sj.job_data->>'credit_request_id',
           la.attempt_data->>'credit_request_id',
           sj.destination_id
         )
    ), 0)::bigint AS credit_released
  FROM scoped_jobs sj
  LEFT JOIN latest_attempt la ON la.distribution_job_id = sj.destination_id
)
SELECT
  sj.*,
  la.attempt_id,
  la.attempt_status,
  la.attempt_response,
  la.attempt_error_message,
  la.error_class,
  la.attempted_at,
  la.attempt_data,
  tl.timeline,
  pr.code AS portal_code,
  pr.display_name AS portal_display_name,
  pr.logo_url AS portal_logo_url,
  pr.country_codes AS portal_country_codes,
  cred.credit_charged,
  cred.credit_reserved,
  cred.credit_held,
  cred.credit_released
FROM scoped_jobs sj
LEFT JOIN latest_attempt la ON la.distribution_job_id = sj.destination_id
LEFT JOIN attempt_timeline tl ON tl.distribution_job_id = sj.destination_id
LEFT JOIN public.portal_registry pr
  ON pr.code = COALESCE(sj.job_data->>'portal_code', sj.platform)
LEFT JOIN credits cred ON cred.destination_id = sj.destination_id
ORDER BY sj.job_created_at ASC NULLS LAST, sj.destination_id ASC
`

/**
 * @param {object} opts
 * @param {string} opts.jobId
 * @param {string} opts.agentId
 * @param {string|null} [opts.agencyId]
 */
export async function loadPublishingJobRows({ jobId, agentId, agencyId = null }) {
  if (!jobId) throw new Error('jobId is required')
  if (!agentId) throw new Error('agentId is required')
  return query(PUBLISHING_JOB_AGGREGATION_SQL, [jobId, agentId, agencyId || null])
}

/**
 * Build the AGT-PUB-003 receipt payload from JOIN rows.
 * @param {object[]} rows
 * @param {string} requestedId
 */
export function buildPublishingJobPayload(rows, requestedId) {
  if (!rows?.length) return null

  const first = rows[0]
  const publishingJobId = first.publishing_job_pk || first.publishing_job_id || requestedId
  // Legacy: raw distribution_jobs.id with no parent → treat as 1-destination job.
  const jobId = first.publishing_job_pk || (rows.length === 1 && !first.publishing_job_id
    ? first.destination_id
    : (first.publishing_job_id || requestedId))

  const destinations = rows.map((row) => {
    const status = mapDestinationStatus(row.job_status, row.attempt_status)
    const errorClass = status === 'failed' ? toApiErrorClass(row.error_class) : null
    const portalCodes = Array.isArray(row.portal_country_codes)
      ? row.portal_country_codes
      : []
    const timeline = parseTimeline(row.timeline).map((entry) => ({
      id: entry.id,
      status: entry.status,
      error_class: entry.error_class ? toApiErrorClass(entry.error_class) : null,
      error_message: entry.error_message || null,
      attempted_at: entry.attempted_at || null,
    }))

    return {
      id: row.destination_id,
      portal: {
        code: row.portal_code || row.platform || null,
        display_name: row.portal_display_name || row.platform || null,
        logo_url: row.portal_logo_url || null,
        country_code: portalCodes[0] || null,
        all_country_codes: portalCodes,
      },
      channel_type: String(row.platform || '').startsWith('publishing.social')
        || ['instagram', 'facebook', 'tiktok', 'x', 'linkedin', 'whatsapp'].includes(
          String(row.platform || '').toLowerCase(),
        )
        ? 'social'
        : 'realestate',
      status,
      error_class: errorClass,
      portal_message: row.attempt_error_message || row.job_error_message || null,
      credit_charged: Number(row.credit_charged || 0),
      credit_reserved: Number(row.credit_reserved || 0),
      credit_held: Number(row.credit_held || 0),
      credit_released: Number(row.credit_released || 0),
      event_at: row.attempted_at || row.published_at || row.job_updated_at || row.job_created_at || null,
      live_url: status === 'succeeded' ? liveUrlFromRow(row) : null,
      retry_available: isRetryAvailable(status, row.error_class),
      fix_deep_link: fixDeepLink(row, status),
      moderation_queue_deep_link: moderationDeepLink(row, status),
      correlation_id: row.attempt_id || row.destination_id,
      timeline,
    }
  })

  const counts = {
    succeeded: destinations.filter((d) => d.status === 'succeeded').length,
    in_review: destinations.filter((d) => d.status === 'in_review').length,
    failed: destinations.filter((d) => d.status === 'failed').length,
    total: destinations.length,
  }

  const totalCharged = destinations.reduce((sum, d) => sum + Number(d.credit_charged || 0), 0)
  const totalReserved = destinations.reduce((sum, d) => sum + Number(d.credit_reserved || 0), 0)

  const submittedAt = first.pj_submitted_at || first.job_created_at || null
  let completedAt = first.pj_completed_at || null
  if (!completedAt && counts.in_review === 0 && counts.total > 0) {
    // Terminal aggregate — derive from latest destination event.
    const times = destinations.map((d) => d.event_at).filter(Boolean)
    completedAt = times.length
      ? times.reduce((a, b) => (new Date(a) > new Date(b) ? a : b))
      : null
  }

  return {
    job: {
      id: jobId || publishingJobId,
      listing_id: first.listing_id || first.property_id || null,
      listing_short_ref: listingShortRef(first),
      aggregate: computeAggregate(counts),
      submitted_at: submittedAt,
      completed_at: completedAt,
      counts,
      credits: {
        total_charged: totalCharged,
        total_reserved: totalReserved,
      },
    },
    destinations,
  }
}

/**
 * @param {object} opts
 * @param {string} opts.jobId
 * @param {string} opts.agentId
 * @param {string|null} [opts.agencyId]
 */
export async function getPublishingJob({ jobId, agentId, agencyId = null }) {
  const rows = await loadPublishingJobRows({ jobId, agentId, agencyId })
  return buildPublishingJobPayload(rows, jobId)
}

/**
 * Re-queue a failed destination for retry. Does not invoke portal adapters
 * (Agent 1). Sets job to pending_retry and records a new attempt row so the
 * existing retry worker can pick it up.
 */
export async function retryPublishingDestination({
  jobId,
  destinationId,
  agentId,
  agencyId = null,
  errorClassesToRetry = null,
} = {}) {
  const payload = await getPublishingJob({ jobId, agentId, agencyId })
  if (!payload) {
    const err = new Error('Publishing job not found')
    err.code = 'NOT_FOUND'
    err.status = 404
    throw err
  }

  const dest = payload.destinations.find((d) => d.id === destinationId)
  if (!dest) {
    const err = new Error('Destination not found')
    err.code = 'NOT_FOUND'
    err.status = 404
    throw err
  }

  if (dest.status !== 'failed') {
    const err = new Error('Only failed destinations can be retried')
    err.code = 'NOT_FAILED'
    err.status = 409
    throw err
  }

  const allowed = Array.isArray(errorClassesToRetry) && errorClassesToRetry.length
    ? new Set(errorClassesToRetry.map((c) => toApiErrorClass(c)))
    : new Set(RETRYABLE_ERROR_CLASSES)

  const apiClass = dest.error_class || 'UNKNOWN_ERROR'
  if (!allowed.has(apiClass) || !RETRYABLE_SNAKE.has(toDbErrorClass(apiClass))) {
    const err = new Error(`error_class ${apiClass} is not retryable`)
    err.code = 'NOT_RETRYABLE'
    err.status = 409
    err.error_class = apiClass
    throw err
  }

  const now = new Date().toISOString()
  await query(
    `UPDATE public.distribution_jobs
        SET status = 'pending_retry',
            retry_count = COALESCE(retry_count, 0) + 1,
            error_message = NULL,
            updated_at = CURRENT_TIMESTAMP,
            data = COALESCE(data, '{}'::jsonb) || jsonb_build_object(
              'next_retry_at', $2::text,
              'retry_source', 'manual',
              'last_retry_at', $2::text
            )
      WHERE id = $1`,
    [destinationId, now],
  )

  await recordDistributionAttempt({
    distributionJobId: destinationId,
    status: 'pending_retry',
    errorMessage: null,
    errorClass: null,
    attemptedAt: now,
    extra: {
      retry_source: 'manual',
      previous_error_class: toDbErrorClass(apiClass),
    },
  })

  const updated = await getPublishingJob({ jobId, agentId, agencyId })
  const updatedDest = updated?.destinations.find((d) => d.id === destinationId)
  return { job: updated, destination: updatedDest }
}

/**
 * Retry all failed destinations whose error_class is in the allow-list.
 */
export async function retryAllPublishingDestinations({
  jobId,
  agentId,
  agencyId = null,
  errorClassesToRetry = RETRYABLE_ERROR_CLASSES,
} = {}) {
  const payload = await getPublishingJob({ jobId, agentId, agencyId })
  if (!payload) {
    const err = new Error('Publishing job not found')
    err.code = 'NOT_FOUND'
    err.status = 404
    throw err
  }

  const allow = new Set(
    (errorClassesToRetry?.length ? errorClassesToRetry : RETRYABLE_ERROR_CLASSES)
      .map((c) => toApiErrorClass(c)),
  )

  const retried = []
  const skipped = []
  for (const dest of payload.destinations) {
    if (dest.status !== 'failed') {
      skipped.push({ id: dest.id, reason: 'not_failed' })
      continue
    }
    if (!allow.has(dest.error_class) || !isRetryAvailable(dest.status, dest.error_class)) {
      skipped.push({ id: dest.id, reason: 'not_retryable', error_class: dest.error_class })
      continue
    }
    await retryPublishingDestination({
      jobId,
      destinationId: dest.id,
      agentId,
      agencyId,
      errorClassesToRetry: [...allow],
    })
    retried.push(dest.id)
  }

  const updated = await getPublishingJob({ jobId, agentId, agencyId })
  return { ...updated, retried_destination_ids: retried, skipped }
}

/**
 * Ensure a publishing_jobs parent exists and link distribution_jobs to it.
 * Useful for publishers / tests.
 */
export async function createPublishingJob({
  id = randomUUID(),
  propertyId = null,
  agentId = null,
  agencyId = null,
  destinationIds = [],
  submittedAt = null,
  data = {},
} = {}) {
  const submitted = submittedAt || new Date().toISOString()
  await query(
    `INSERT INTO public.publishing_jobs
       (id, property_id, agent_id, agency_id, submitted_at, data)
     VALUES ($1, $2, $3, $4, $5::timestamptz, $6::jsonb)`,
    [id, propertyId, agentId, agencyId, submitted, JSON.stringify(data || {})],
  )
  if (destinationIds.length) {
    await query(
      `UPDATE public.distribution_jobs
          SET publishing_job_id = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ANY($2::text[])`,
      [id, destinationIds],
    )
  }
  return id
}

/**
 * Mark publishing_jobs.completed_at when the aggregate is terminal.
 */
export async function maybeCompletePublishingJob(jobId, aggregate) {
  if (!jobId) return null
  if (aggregate === 'in_review_only' || aggregate === 'partial') {
    // Still open — do not stamp completed_at.
    return null
  }
  const rows = await query(
    `UPDATE public.publishing_jobs
        SET completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP,
            data = COALESCE(data, '{}'::jsonb) || jsonb_build_object('aggregate', $2::text)
      WHERE id = $1
      RETURNING id, completed_at, agent_id`,
    [jobId, aggregate],
  )
  return rows[0] || null
}
