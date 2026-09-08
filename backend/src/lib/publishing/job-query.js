/**
 * Single-statement (JOIN) loader for GET /api/publishing/jobs/:jobId.
 *
 * Zero N+1: destinations, latest attempt, portal_registry, credits, and
 * attempt timeline are all assembled in one SQL statement. Callers must not
 * loop per destination to fetch portals or credits.
 */

import { query as defaultQuery } from '../../db.js'
import {
  computeAggregate,
  countByStatus,
  fixDeepLinkFor,
  isRetryAvailable,
  mapDestinationStatus,
  moderationQueueDeepLink,
  toApiErrorClass,
} from './aggregate.js'

/**
 * Resolves a publishing_jobs row OR a legacy distribution_jobs.id (no parent)
 * OR a destination id that already has a parent (returns the parent job).
 *
 * Scoped to caller agent_id (and agency_id when both sides have one).
 * Credits: JOIN credit_consumptions by related_entity_id = destination id
 * OR request_id on job/attempt data; reservations by request_id / HELD.
 */
export const LOAD_PUBLISHING_JOB_SQL = `
WITH candidates AS (
  SELECT
    1 AS priority,
    pj.id AS publishing_job_id,
    pj.property_id,
    pj.agent_id,
    pj.agency_id,
    pj.submitted_at,
    pj.completed_at,
    false AS is_legacy
  FROM public.publishing_jobs pj
  WHERE pj.id = $1
    AND pj.agent_id = $2
    AND ($3::text IS NULL OR pj.agency_id IS NULL OR pj.agency_id = $3)

  UNION ALL

  SELECT
    2 AS priority,
    pj.id AS publishing_job_id,
    pj.property_id,
    pj.agent_id,
    pj.agency_id,
    pj.submitted_at,
    pj.completed_at,
    false AS is_legacy
  FROM public.distribution_jobs dj
  JOIN public.publishing_jobs pj ON pj.id = dj.publishing_job_id
  WHERE dj.id = $1
    AND pj.agent_id = $2
    AND ($3::text IS NULL OR pj.agency_id IS NULL OR pj.agency_id = $3)

  UNION ALL

  SELECT
    3 AS priority,
    dj.id AS publishing_job_id,
    dj.property_id,
    dj.agent_id,
    dj.agency_id,
    COALESCE(dj.scheduled_at, dj.created_at) AS submitted_at,
    CASE
      WHEN dj.status IN ('published', 'succeeded', 'success', 'failed')
        THEN COALESCE(dj.published_at, dj.updated_at)
      ELSE NULL
    END AS completed_at,
    true AS is_legacy
  FROM public.distribution_jobs dj
  WHERE dj.id = $1
    AND dj.publishing_job_id IS NULL
    AND dj.agent_id = $2
    AND ($3::text IS NULL OR dj.agency_id IS NULL OR dj.agency_id = $3)
),
scoped_job AS (
  SELECT *
    FROM candidates
   ORDER BY priority
   LIMIT 1
)
SELECT
  sj.publishing_job_id,
  sj.property_id AS job_property_id,
  sj.agent_id AS job_agent_id,
  sj.agency_id AS job_agency_id,
  sj.submitted_at AS job_submitted_at,
  sj.completed_at AS job_completed_at,
  sj.is_legacy,
  dj.id AS destination_id,
  dj.platform,
  dj.status AS dest_job_status,
  dj.payload,
  dj.provider_post_id,
  dj.error_message AS dest_error_message,
  dj.retry_count,
  dj.published_at,
  dj.created_at AS dest_created_at,
  dj.updated_at AS dest_updated_at,
  dj.data AS dest_data,
  p.id AS listing_id,
  COALESCE(
    NULLIF(p.data->>'listing_short_ref', ''),
    NULLIF(p.data->>'short_ref', ''),
    NULLIF(p.canonical_id, ''),
    UPPER(LEFT(REPLACE(COALESCE(p.id, sj.property_id, dj.id), '-', ''), 8))
  ) AS listing_short_ref,
  pr.code AS portal_code,
  pr.display_name AS portal_display_name,
  pr.logo_url AS portal_logo_url,
  pr.country_codes AS portal_country_codes,
  t.code AS territory_code,
  la.id AS attempt_id,
  la.status AS attempt_status,
  la.error_class AS attempt_error_class,
  la.error_message AS attempt_error_message,
  la.attempted_at,
  la.response AS attempt_response,
  la.data AS attempt_data,
  COALESCE(cc.credit_charged, 0)::bigint AS credit_charged,
  COALESCE(cr.credit_reserved, 0)::bigint AS credit_reserved,
  COALESCE(tl.timeline, '[]'::json) AS timeline
FROM scoped_job sj
LEFT JOIN public.distribution_jobs dj
  ON (sj.is_legacy AND dj.id = sj.publishing_job_id)
  OR (NOT sj.is_legacy AND dj.publishing_job_id = sj.publishing_job_id)
LEFT JOIN public.properties p
  ON p.id = COALESCE(sj.property_id, dj.property_id)
LEFT JOIN public.territories t
  ON t.id = p.territory_id
LEFT JOIN public.portal_registry pr
  ON pr.code = COALESCE(
    dj.platform,
    dj.payload->>'portal',
    dj.payload->>'portal_code',
    dj.data->>'portal',
    dj.data->>'portal_code'
  )
LEFT JOIN LATERAL (
  SELECT a.*
    FROM public.distribution_attempts a
   WHERE a.distribution_job_id = dj.id
   ORDER BY a.attempted_at DESC NULLS LAST, a.created_at DESC NULLS LAST
   LIMIT 1
) la ON TRUE
LEFT JOIN LATERAL (
  SELECT COALESCE(json_agg(
    json_build_object(
      'id', a.id,
      'status', a.status,
      'error_class', a.error_class,
      'error_message', a.error_message,
      'attempted_at', a.attempted_at
    ) ORDER BY a.attempted_at ASC
  ), '[]'::json) AS timeline
    FROM public.distribution_attempts a
   WHERE a.distribution_job_id = dj.id
) tl ON TRUE
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(c.credits_amount), 0)::bigint AS credit_charged
    FROM public.credit_consumptions c
   WHERE c.feature LIKE 'publishing.realestate.%'
     AND (
       c.related_entity_id = dj.id
       OR ($4::uuid IS NOT NULL AND c.tenant_id = $4 AND c.related_entity_id = sj.publishing_job_id)
       OR c.request_id = COALESCE(
            dj.data->>'request_id',
            la.data->>'request_id',
            la.response->>'request_id'
          )
     )
) cc ON TRUE
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(x.credits_amount), 0)::bigint AS credit_reserved
    FROM public.credit_reservations x
   WHERE x.feature LIKE 'publishing.realestate.%'
     AND x.status = 'HELD'
     AND (
       x.request_id = COALESCE(
            dj.data->>'request_id',
            la.data->>'request_id',
            la.response->>'request_id'
          )
       OR x.data->>'related_entity_id' IN (dj.id, sj.publishing_job_id)
     )
) cr ON TRUE
`

function asJson(value) {
  if (value == null) return {}
  if (typeof value === 'string') {
    try { return JSON.parse(value) } catch { return {} }
  }
  return typeof value === 'object' ? value : {}
}

function asIso(value) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

function asNumber(value) {
  const n = Number(value || 0)
  return Number.isFinite(n) ? n : 0
}

function pickLiveUrl(payload, destData, attemptResponse, providerPostId) {
  const payloadObj = asJson(payload)
  const dest = asJson(destData)
  const response = asJson(attemptResponse)
  const candidates = [
    payloadObj.live_url, payloadObj.liveUrl, payloadObj.url,
    dest.live_url, dest.liveUrl, dest.url,
    response.live_url, response.liveUrl, response.url,
    providerPostId,
  ]
  for (const c of candidates) {
    if (c && /^https?:\/\//i.test(String(c))) return String(c)
  }
  return providerPostId ? String(providerPostId) : null
}

function pickCorrelationId(destData, attemptData, attemptId, destinationId) {
  const dest = asJson(destData)
  const attempt = asJson(attemptData)
  return dest.correlation_id || dest.correlationId
    || attempt.correlation_id || attempt.correlationId
    || attemptId || destinationId || null
}

function pickPortalMessage(attemptError, destError, attemptResponse) {
  if (attemptError) return String(attemptError)
  const response = asJson(attemptResponse)
  if (response.message) return String(response.message)
  if (response.error_user_msg) return String(response.error_user_msg)
  if (destError) return String(destError)
  return null
}

function pickCountryCode(destData, payload, territoryCode, countryCodes) {
  const dest = asJson(destData)
  const payloadObj = asJson(payload)
  const fromJob = dest.country_code || dest.countryCode
    || payloadObj.country_code || payloadObj.countryCode
  if (fromJob) return String(fromJob).toUpperCase()
  if (territoryCode) return String(territoryCode).toUpperCase()
  if (Array.isArray(countryCodes) && countryCodes[0]) return String(countryCodes[0]).toUpperCase()
  return null
}

function mapTimeline(raw) {
  let list = []
  try {
    list = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : [])
  } catch {
    list = []
  }
  if (!Array.isArray(list)) list = []
  return list.map((item) => ({
    id: item.id,
    status: item.status || null,
    error_class: toApiErrorClass(item.error_class),
    error_message: item.error_message || null,
    attempted_at: asIso(item.attempted_at),
  }))
}

/**
 * @param {object} opts
 * @param {string} opts.jobId
 * @param {string} opts.agentId
 * @param {string|null} [opts.agencyId]
 * @param {string|null} [opts.creditTenantId]
 * @param {typeof defaultQuery} [opts.query]
 * @returns {Promise<{ payload: object, statementCount: number } | null>}
 */
export async function loadPublishingJob({
  jobId,
  agentId,
  agencyId = null,
  creditTenantId = null,
  query: queryFn = defaultQuery,
} = {}) {
  if (!jobId || !agentId) return null
  let statementCount = 0
  const run = async (sql, params) => {
    statementCount += 1
    return queryFn(sql, params)
  }
  const rows = await run(LOAD_PUBLISHING_JOB_SQL, [
    jobId,
    agentId,
    agencyId || null,
    creditTenantId || null,
  ])
  if (!rows?.length) return null
  const first = rows[0]
  if (!first.publishing_job_id) return null

  const destinations = []
  for (const row of rows) {
    if (!row.destination_id) continue
    const portalCode = row.portal_code || row.platform || null
    const countryCodes = Array.isArray(row.portal_country_codes)
      ? row.portal_country_codes
      : []
    const status = mapDestinationStatus(row.dest_job_status, row.attempt_status)
    const errorClass = toApiErrorClass(row.attempt_error_class)
    const listingId = row.listing_id || row.job_property_id || null
    destinations.push({
      id: row.destination_id,
      portal: {
        code: portalCode,
        display_name: row.portal_display_name || portalCode,
        logo_url: row.portal_logo_url || null,
        country_code: pickCountryCode(row.dest_data, row.payload, row.territory_code, countryCodes),
        all_country_codes: countryCodes,
      },
      channel_type: row.portal_code ? 'realestate' : 'social',
      status,
      error_class: errorClass,
      portal_message: pickPortalMessage(row.attempt_error_message, row.dest_error_message, row.attempt_response),
      credit_charged: asNumber(row.credit_charged),
      credit_reserved: asNumber(row.credit_reserved),
      event_at: asIso(row.attempted_at) || asIso(row.published_at) || asIso(row.dest_updated_at),
      live_url: pickLiveUrl(row.payload, row.dest_data, row.attempt_response, row.provider_post_id),
      retry_available: isRetryAvailable(status, errorClass),
      fix_deep_link: fixDeepLinkFor(errorClass, { listingId, portalCode }),
      moderation_queue_deep_link: moderationQueueDeepLink({
        listingId,
        destinationId: row.destination_id,
        status,
      }),
      correlation_id: pickCorrelationId(row.dest_data, row.attempt_data, row.attempt_id, row.destination_id),
      timeline: mapTimeline(row.timeline),
    })
  }

  const statuses = destinations.map((d) => d.status)
  const counts = countByStatus(statuses)
  const credits = {
    total_charged: destinations.reduce((sum, d) => sum + d.credit_charged, 0),
    total_reserved: destinations.reduce((sum, d) => sum + d.credit_reserved, 0),
  }

  const payload = {
    job: {
      id: first.publishing_job_id,
      listing_id: first.listing_id || first.job_property_id || null,
      listing_short_ref: first.listing_short_ref || null,
      aggregate: computeAggregate(statuses),
      submitted_at: asIso(first.job_submitted_at),
      completed_at: asIso(first.job_completed_at),
      counts,
      credits,
      agent_id: first.job_agent_id || null,
      agency_id: first.job_agency_id || null,
      is_legacy: Boolean(first.is_legacy),
    },
    destinations,
  }

  return { payload, statementCount }
}

export async function loadPublishingJobPayload(opts) {
  const result = await loadPublishingJob(opts)
  return result?.payload || null
}
