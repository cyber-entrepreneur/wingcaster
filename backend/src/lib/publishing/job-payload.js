/**
 * Load a publishing job + destinations in one SQL family (JOINs / LATERAL).
 * Callers must not loop per-destination queries — this module is the join.
 */

import { query as defaultQuery } from '../../db.js'
import {
  computeAggregate,
  countDestinations,
  errorClassToApi,
  fixDeepLink,
  mapDestinationStatus,
  moderationQueueDeepLink,
  retryAvailable,
} from './aggregate.js'

/**
 * Single destination SELECT. Uses:
 * - latest distribution_attempts by attempted_at (LATERAL)
 * - timeline as jsonb_agg (LATERAL) — no JS loop of attempt queries
 * - portal_registry on platform / payload portal code
 * - credit_consumptions / credit_reservations by request_id OR related_entity_id
 */
export const LOAD_PUBLISHING_JOB_SQL = `
WITH caller AS (
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
),
canonical AS (
  SELECT
    COALESCE(pj.id, dj.publishing_job_id, dj.id) AS job_id,
    COALESCE(pj.property_id, dj.property_id) AS property_id,
    COALESCE(pj.agent_id, dj.agent_id) AS agent_id,
    COALESCE(pj.agency_id, dj.agency_id) AS agency_id,
    COALESCE(pj.submitted_at, dj.created_at) AS submitted_at,
    pj.completed_at AS completed_at,
    (pj.id IS NULL) AS synthetic,
    (dj.id IS NOT NULL AND dj.publishing_job_id IS NULL AND pj.id IS NULL) AS legacy_single
    FROM (SELECT $2::text AS param) p
    LEFT JOIN public.publishing_jobs pj ON pj.id = p.param
    LEFT JOIN public.distribution_jobs dj ON dj.id = p.param AND pj.id IS NULL
),
owned AS (
  SELECT c.*
    FROM canonical c
   WHERE c.job_id IS NOT NULL
     AND (
       c.agent_id IN (SELECT agent_id FROM caller)
       OR c.agent_id IN (SELECT user_id FROM caller)
       OR c.agency_id IN (SELECT agency_id FROM caller_agencies)
       OR EXISTS (
         SELECT 1
           FROM public.distribution_jobs d
          WHERE (d.publishing_job_id = c.job_id OR d.id = c.job_id)
            AND (
              d.agent_id IN (SELECT agent_id FROM caller)
              OR d.agent_id IN (SELECT user_id FROM caller)
              OR d.agency_id IN (SELECT agency_id FROM caller_agencies)
            )
       )
     )
)
SELECT
  o.job_id,
  o.property_id AS listing_id,
  o.agent_id AS job_agent_id,
  o.agency_id AS job_agency_id,
  o.submitted_at,
  o.completed_at,
  o.synthetic,
  o.legacy_single,
  COALESCE(
    NULLIF(p.data->>'short_ref', ''),
    NULLIF(p.data->>'listing_short_ref', ''),
    NULLIF(p.data->>'hrid', ''),
    UPPER(SUBSTRING(REPLACE(COALESCE(p.id, o.property_id, ''), '-', '') FROM 1 FOR 8))
  ) AS listing_short_ref,
  dj.id AS destination_id,
  dj.platform,
  dj.status AS job_status,
  dj.retry_count,
  dj.provider_post_id,
  dj.error_message AS job_error_message,
  dj.published_at,
  dj.created_at AS dest_created_at,
  dj.updated_at AS dest_updated_at,
  dj.payload,
  dj.data AS dest_data,
  pr.code AS portal_code,
  pr.display_name AS portal_display_name,
  pr.logo_url AS portal_logo_url,
  pr.country_codes AS portal_country_codes,
  latest.id AS attempt_id,
  latest.status AS attempt_status,
  latest.error_class AS attempt_error_class,
  latest.error_message AS attempt_error_message,
  latest.attempted_at,
  latest.response AS attempt_response,
  latest.data AS attempt_data,
  COALESCE(charged.credit_charged, 0)::bigint AS credit_charged,
  COALESCE(held.credit_reserved, 0)::bigint AS credit_reserved,
  COALESCE(hist.timeline, '[]'::jsonb) AS timeline
  FROM owned o
  LEFT JOIN public.properties p ON p.id = o.property_id
  LEFT JOIN public.distribution_jobs dj
    ON (
      dj.publishing_job_id = o.job_id
      OR (o.legacy_single AND dj.id = o.job_id)
      OR (o.synthetic AND NOT o.legacy_single AND dj.publishing_job_id = o.job_id)
    )
  LEFT JOIN public.portal_registry pr
    ON pr.code = COALESCE(
      dj.platform,
      dj.payload->>'portal',
      dj.payload->>'portal_code',
      dj.data->>'portal',
      dj.data->>'portal_code'
    )
  LEFT JOIN LATERAL (
    SELECT a.id, a.status, a.error_class, a.error_message, a.attempted_at, a.response, a.data, a.created_at
      FROM public.distribution_attempts a
     WHERE a.distribution_job_id = dj.id
     ORDER BY a.attempted_at DESC NULLS LAST, a.created_at DESC NULLS LAST
     LIMIT 1
  ) latest ON true
  LEFT JOIN LATERAL (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'status', t.status,
          'error_class', CASE WHEN t.error_class IS NULL THEN NULL ELSE upper(t.error_class) END,
          'portal_message', t.error_message,
          'event_at', t.attempted_at,
          'correlation_id', COALESCE(t.data->>'correlation_id', t.id)
        )
        ORDER BY t.attempted_at ASC NULLS LAST, t.created_at ASC NULLS LAST
      ),
      '[]'::jsonb
    ) AS timeline
      FROM public.distribution_attempts t
     WHERE t.distribution_job_id = dj.id
  ) hist ON true
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(cc.credits_amount), 0)::bigint AS credit_charged
      FROM public.credit_consumptions cc
     WHERE cc.feature LIKE 'publishing.realestate.%'
       AND (
         cc.related_entity_id = dj.id
         OR cc.request_id = COALESCE(
           dj.data->>'request_id',
           latest.data->>'request_id',
           dj.id
         )
       )
  ) charged ON true
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(cr.credits_amount), 0)::bigint AS credit_reserved
      FROM public.credit_reservations cr
     WHERE cr.feature LIKE 'publishing.realestate.%'
       AND cr.status = 'HELD'
       AND (
         cr.request_id = COALESCE(
           dj.data->>'request_id',
           latest.data->>'request_id',
           dj.id
         )
         OR cr.data->>'related_entity_id' = dj.id
       )
  ) held ON true
`

function asIso(value) {
  if (value == null) return null
  if (value instanceof Date) return value.toISOString()
  return value
}

function asNumber(value) {
  const n = Number(value || 0)
  return Number.isFinite(n) ? n : 0
}

function parseJson(value, fallback) {
  if (value == null) return fallback
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return fallback
    }
  }
  return value
}

function liveUrlFrom(row) {
  const response = parseJson(row.attempt_response, {}) || {}
  const destData = parseJson(row.dest_data, {}) || {}
  const payload = parseJson(row.payload, {}) || {}
  const candidates = [
    response.live_url,
    response.url,
    response.permalink,
    destData.live_url,
    payload.live_url,
    row.provider_post_id,
  ]
  for (const c of candidates) {
    if (c && /^https?:\/\//i.test(String(c))) return String(c)
  }
  return candidates.find((c) => c && String(c).startsWith('http')) || null
}

function correlationIdFrom(row) {
  const attemptData = parseJson(row.attempt_data, {}) || {}
  const destData = parseJson(row.dest_data, {}) || {}
  return attemptData.correlation_id
    || destData.correlation_id
    || row.attempt_id
    || row.destination_id
    || null
}

function portalFrom(row) {
  const codes = row.portal_country_codes
  const all = Array.isArray(codes) ? codes : []
  const code = row.portal_code || row.platform || null
  return {
    code,
    display_name: row.portal_display_name || (code ? String(code).replace(/_/g, ' ') : null),
    logo_url: row.portal_logo_url || null,
    country_code: all[0] || null,
    all_country_codes: all,
  }
}

function mapDestinationRow(row) {
  if (!row.destination_id) return null
  const errorClass = errorClassToApi(row.attempt_error_class)
  const status = mapDestinationStatus({
    jobStatus: row.job_status,
    attemptStatus: row.attempt_status,
  })
  const correlationId = correlationIdFrom(row)
  const listingId = row.listing_id || null
  return {
    id: row.destination_id,
    portal: portalFrom(row),
    channel_type: row.portal_code ? 'realestate' : 'social',
    status,
    error_class: errorClass,
    portal_message: row.attempt_error_message || row.job_error_message || null,
    credit_charged: asNumber(row.credit_charged),
    credit_reserved: asNumber(row.credit_reserved),
    event_at: asIso(row.attempted_at || row.published_at || row.dest_updated_at || row.dest_created_at),
    live_url: liveUrlFrom(row),
    retry_available: retryAvailable({ status, errorClass }),
    fix_deep_link: fixDeepLink({
      errorClass,
      listingId,
      destinationId: row.destination_id,
      correlationId,
    }),
    moderation_queue_deep_link: moderationQueueDeepLink({
      status,
      listingId,
      destinationId: row.destination_id,
    }),
    correlation_id: correlationId,
    timeline: parseJson(row.timeline, []) || [],
  }
}

export function assemblePublishingJobPayload(rows) {
  if (!rows?.length || !rows[0]?.job_id) return null
  const head = rows[0]
  const destinations = rows.map(mapDestinationRow).filter(Boolean)
  const counts = countDestinations(destinations)
  const credits = destinations.reduce(
    (acc, dest) => {
      acc.total_charged += dest.credit_charged
      acc.total_reserved += dest.credit_reserved
      return acc
    },
    { total_charged: 0, total_reserved: 0 },
  )
  return {
    job: {
      id: head.job_id,
      listing_id: head.listing_id || null,
      listing_short_ref: head.listing_short_ref || null,
      aggregate: computeAggregate(counts),
      submitted_at: asIso(head.submitted_at),
      completed_at: asIso(head.completed_at),
      counts,
      credits,
    },
    destinations,
  }
}

/**
 * @param {string} jobId
 * @param {string} callerUserId
 * @param {{ queryFn?: Function }} [opts]
 * @returns {Promise<{job: object, destinations: object[]}|null>}
 */
export async function loadPublishingJobPayload(jobId, callerUserId, { queryFn } = {}) {
  if (!jobId || !callerUserId) return null
  const run = queryFn || defaultQuery
  const rows = await run(LOAD_PUBLISHING_JOB_SQL, [callerUserId, jobId])
  return assemblePublishingJobPayload(rows)
}

/**
 * System load (retry notify / emitPublishingJobCompleted) — no caller scope.
 * Still a single JOIN query; ownership was already checked on the HTTP path.
 */
export const LOAD_PUBLISHING_JOB_UNSCOPED_SQL = `
SELECT
  COALESCE(pj.id, dj_seed.publishing_job_id, dj_seed.id, $1::text) AS job_id,
  COALESCE(pj.property_id, dj.property_id, dj_seed.property_id) AS listing_id,
  COALESCE(pj.agent_id, dj.agent_id, dj_seed.agent_id) AS job_agent_id,
  COALESCE(pj.agency_id, dj.agency_id, dj_seed.agency_id) AS job_agency_id,
  COALESCE(pj.submitted_at, dj.created_at, dj_seed.created_at) AS submitted_at,
  pj.completed_at AS completed_at,
  (pj.id IS NULL) AS synthetic,
  (dj_seed.id IS NOT NULL AND dj_seed.publishing_job_id IS NULL AND pj.id IS NULL) AS legacy_single,
  COALESCE(
    NULLIF(p.data->>'short_ref', ''),
    NULLIF(p.data->>'listing_short_ref', ''),
    NULLIF(p.data->>'hrid', ''),
    UPPER(SUBSTRING(REPLACE(COALESCE(p.id, pj.property_id, dj.property_id, dj_seed.property_id, ''), '-', '') FROM 1 FOR 8))
  ) AS listing_short_ref,
  dj.id AS destination_id,
  dj.platform,
  dj.status AS job_status,
  dj.retry_count,
  dj.provider_post_id,
  dj.error_message AS job_error_message,
  dj.published_at,
  dj.created_at AS dest_created_at,
  dj.updated_at AS dest_updated_at,
  dj.payload,
  dj.data AS dest_data,
  pr.code AS portal_code,
  pr.display_name AS portal_display_name,
  pr.logo_url AS portal_logo_url,
  pr.country_codes AS portal_country_codes,
  latest.id AS attempt_id,
  latest.status AS attempt_status,
  latest.error_class AS attempt_error_class,
  latest.error_message AS attempt_error_message,
  latest.attempted_at,
  latest.response AS attempt_response,
  latest.data AS attempt_data,
  COALESCE(charged.credit_charged, 0)::bigint AS credit_charged,
  COALESCE(held.credit_reserved, 0)::bigint AS credit_reserved,
  COALESCE(hist.timeline, '[]'::jsonb) AS timeline
  FROM (SELECT $1::text AS param) q
  LEFT JOIN public.publishing_jobs pj ON pj.id = q.param
  LEFT JOIN public.distribution_jobs dj_seed ON dj_seed.id = q.param AND pj.id IS NULL
  LEFT JOIN public.distribution_jobs dj ON (
    CASE
      WHEN pj.id IS NOT NULL THEN dj.publishing_job_id = pj.id
      WHEN dj_seed.publishing_job_id IS NOT NULL THEN dj.publishing_job_id = dj_seed.publishing_job_id
      WHEN dj_seed.id IS NOT NULL THEN dj.id = dj_seed.id
      ELSE false
    END
  )
  LEFT JOIN public.properties p ON p.id = COALESCE(pj.property_id, dj.property_id, dj_seed.property_id)
  LEFT JOIN public.portal_registry pr
    ON pr.code = COALESCE(
      dj.platform,
      dj.payload->>'portal',
      dj.payload->>'portal_code',
      dj.data->>'portal'
    )
  LEFT JOIN LATERAL (
    SELECT a.id, a.status, a.error_class, a.error_message, a.attempted_at, a.response, a.data, a.created_at
      FROM public.distribution_attempts a
     WHERE a.distribution_job_id = dj.id
     ORDER BY a.attempted_at DESC NULLS LAST, a.created_at DESC NULLS LAST
     LIMIT 1
  ) latest ON true
  LEFT JOIN LATERAL (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'status', t.status,
          'error_class', CASE WHEN t.error_class IS NULL THEN NULL ELSE upper(t.error_class) END,
          'portal_message', t.error_message,
          'event_at', t.attempted_at,
          'correlation_id', COALESCE(t.data->>'correlation_id', t.id)
        )
        ORDER BY t.attempted_at ASC NULLS LAST, t.created_at ASC NULLS LAST
      ),
      '[]'::jsonb
    ) AS timeline
      FROM public.distribution_attempts t
     WHERE t.distribution_job_id = dj.id
  ) hist ON true
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(cc.credits_amount), 0)::bigint AS credit_charged
      FROM public.credit_consumptions cc
     WHERE cc.feature LIKE 'publishing.realestate.%'
       AND (
         cc.related_entity_id = dj.id
         OR cc.request_id = COALESCE(dj.data->>'request_id', latest.data->>'request_id', dj.id)
       )
  ) charged ON true
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(cr.credits_amount), 0)::bigint AS credit_reserved
      FROM public.credit_reservations cr
     WHERE cr.feature LIKE 'publishing.realestate.%'
       AND cr.status = 'HELD'
       AND (
         cr.request_id = COALESCE(dj.data->>'request_id', latest.data->>'request_id', dj.id)
         OR cr.data->>'related_entity_id' = dj.id
       )
  ) held ON true
`

export async function loadPublishingJobPayloadUnscoped(jobId, { queryFn } = {}) {
  if (!jobId) return null
  const run = queryFn || defaultQuery
  const rows = await run(LOAD_PUBLISHING_JOB_UNSCOPED_SQL, [jobId])
  return assemblePublishingJobPayload(rows)
}
