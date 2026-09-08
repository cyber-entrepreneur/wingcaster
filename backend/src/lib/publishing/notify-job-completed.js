/**
 * Notify the listing agent that a publishing job reached a terminal aggregate.
 *
 * Piggybacks dispatchConsumerNotification (in-app + FCM push). No new dispatcher.
 *
 * Other publishers (Agent 1 live pipeline) should call
 * `emitPublishingJobCompleted(jobId)` after marking completed_at.
 */

import { query } from '../../db.js'
import logger from '../logger.js'
import { dispatchConsumerNotification } from '../notifications/dispatch.js'
import { resolveTemplate } from '../../notifications/platform-templates/resolver.js'
import { renderTemplate } from '../../notifications/platform-templates/variables.js'
import { JOB_AGGREGATE, PUBLISH_RECEIPT_DEEP_LINK } from './aggregate.js'
import { loadPublishingJobPayloadUnscoped } from './job-payload.js'

export const TEMPLATE_CODE_PREFIX = 'publishing_job.completed'

const FALLBACK_COPY = {
  [JOB_AGGREGATE.ALL_SUCCEEDED]: {
    subject: 'Published to {N} of {M} channels',
    body: 'Your listing is live on all {M} selected portals.',
  },
  [JOB_AGGREGATE.MIXED]: {
    subject: 'Published to {N} of {M} channels',
    body: '{N} of {M} portals succeeded; some failed. Open the receipt to retry.',
  },
  [JOB_AGGREGATE.ALL_FAILED]: {
    subject: 'Publish failed for all {M} channels',
    body: 'Nothing went live. Open the receipt to see why and retry.',
  },
  [JOB_AGGREGATE.IN_REVIEW_ONLY]: {
    subject: 'Submitted {M} channels for review',
    body: 'Waiting on portal moderation for all {M} channels.',
  },
  [JOB_AGGREGATE.PARTIAL]: {
    subject: 'Published to {N} of {M} channels',
    body: '{N} of {M} portals are live; the rest are in review.',
  },
}

export function templateCodeForAggregate(aggregate) {
  return `${TEMPLATE_CODE_PREFIX}.${aggregate}`
}

/**
 * Substitute brief `{N}` `{M}` placeholders and `{{jobId}}` leftovers.
 */
export function substitutePlaceholders(text, { N, M, jobId } = {}) {
  if (text == null) return text
  return String(text)
    .replaceAll('{N}', String(N ?? ''))
    .replaceAll('{M}', String(M ?? ''))
    .replaceAll('{{N}}', String(N ?? ''))
    .replaceAll('{{M}}', String(M ?? ''))
    .replaceAll('{{jobId}}', String(jobId ?? ''))
    .replaceAll('{jobId}', String(jobId ?? ''))
}

export async function resolveCompletedCopy({ aggregate, N, M, jobId, listingShortRef, language } = {}) {
  const code = templateCodeForAggregate(aggregate)
  const ctx = { N, M, jobId, listing_short_ref: listingShortRef, variant: aggregate }
  let template = await resolveTemplate({ code, language: language || 'en' }).catch(() => null)
  if (!template) {
    template = await resolveTemplate({ code: TEMPLATE_CODE_PREFIX, language: language || 'en' }).catch(() => null)
  }
  const fallback = FALLBACK_COPY[aggregate] || FALLBACK_COPY[JOB_AGGREGATE.MIXED]
  const rendered = template
    ? renderTemplate(template, ctx)
    : { subject: fallback.subject, text_body: fallback.body, html_body: null }
  return {
    code: template?.code || code,
    subject: substitutePlaceholders(rendered.subject || fallback.subject, ctx),
    body: substitutePlaceholders(rendered.text_body || fallback.body, ctx),
    html: rendered.html_body ? substitutePlaceholders(rendered.html_body, ctx) : undefined,
  }
}

async function resolveRecipientUserId(payload) {
  const rows = await query(
    `SELECT COALESCE(a.user_id, a.id) AS user_id
       FROM public.publishing_jobs pj
       JOIN public.agents a ON a.id = pj.agent_id
      WHERE pj.id = $1
     UNION ALL
     SELECT COALESCE(a.user_id, a.id) AS user_id
       FROM public.distribution_jobs dj
       JOIN public.agents a ON a.id = dj.agent_id
      WHERE dj.id = $1 OR dj.publishing_job_id = $1
     LIMIT 1`,
    [payload.job.id],
  )
  return rows[0]?.user_id || null
}

/**
 * Dispatch in-app + push for a terminal publishing job. Idempotent on
 * publishing_jobs.data.completed_notified_at (legacy jobs skip the flag).
 */
export async function notifyPublishingJobCompleted(payload, { force = false } = {}) {
  if (!payload?.job?.id) return { skipped: true, reason: 'no_job' }
  const aggregate = payload.job.aggregate
  if (!aggregate) return { skipped: true, reason: 'no_aggregate' }

  const jobId = payload.job.id
  if (!force) {
    const flagged = await query(
      `SELECT 1 FROM public.publishing_jobs
        WHERE id = $1 AND COALESCE(data->>'completed_notified_at', '') <> ''`,
      [jobId],
    ).catch(() => [])
    if (flagged?.length) return { skipped: true, reason: 'already_notified' }
  }

  const N = payload.job.counts?.succeeded ?? 0
  const M = payload.job.counts?.total ?? 0
  const copy = await resolveCompletedCopy({
    aggregate,
    N,
    M,
    jobId,
    listingShortRef: payload.job.listing_short_ref,
  })
  const recipient = await resolveRecipientUserId(payload)
  if (!recipient) {
    logger.warn({ job_id: jobId }, 'publishing_job.completed: no recipient user')
    return { skipped: true, reason: 'no_recipient' }
  }

  const deepLink = PUBLISH_RECEIPT_DEEP_LINK(jobId)
  const metadata = {
    deep_link_url: deepLink,
    alert_type: TEMPLATE_CODE_PREFIX,
    tracking_token: jobId,
    skip_cooldown: true,
    job_id: jobId,
    variant: aggregate,
  }

  const inApp = await dispatchConsumerNotification({
    channel: 'in_app',
    recipient,
    subject: copy.subject,
    body: copy.body,
    metadata,
  })
  const push = await dispatchConsumerNotification({
    channel: 'push',
    recipient,
    subject: copy.subject,
    body: copy.body,
    metadata,
  })

  await query(
    `UPDATE public.publishing_jobs
        SET completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP,
            data = COALESCE(data, '{}'::jsonb) || jsonb_build_object(
              'completed_notified_at', CURRENT_TIMESTAMP::text,
              'completed_aggregate', $2::text
            )
      WHERE id = $1`,
    [jobId, aggregate],
  ).catch((err) => {
    logger.warn({ err: err.message, job_id: jobId }, 'publishing_job.completed: could not stamp completed_at')
  })

  return { skipped: false, in_app: inApp, push, copy }
}

/**
 * Documented hook for other publishers / tests.
 * Loads the job unscoped and notifies when an aggregate is available.
 */
export async function emitPublishingJobCompleted(jobId, { force = false } = {}) {
  const payload = await loadPublishingJobPayloadUnscoped(jobId)
  if (!payload) return { skipped: true, reason: 'not_found' }
  return notifyPublishingJobCompleted(payload, { force })
}
