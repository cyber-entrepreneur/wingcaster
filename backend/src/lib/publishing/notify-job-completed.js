/**
 * Emit publishing_job.completed in-app + push when a fan-out job hits a
 * terminal aggregate.
 *
 * Piggybacks dispatchConsumerNotification (no new dispatcher). Other
 * publishers (Agent 1 live pipeline) should call:
 *
 *   import { emitPublishingJobCompleted } from './lib/publishing/notify-job-completed.js'
 *   await emitPublishingJobCompleted(jobId)
 *
 * Retry handlers in this module also call it after a terminal transition.
 */

import { query } from '../../db.js'
import { resolveTemplate } from '../../notifications/platform-templates/resolver.js'
import { dispatchConsumerNotification } from '../notifications/dispatch.js'
import logger from '../logger.js'
import {
  isTerminalAggregate,
  receiptDeepLink,
  substitutePlaceholders,
  templateCodeForAggregate,
} from './aggregate.js'
import { loadPublishingJobPayload } from './job-query.js'

const TITLE_BY_AGG = {
  all_succeeded: 'Published to {N} of {M} channels',
  mixed: 'Published to {N} of {M} channels',
  all_failed: 'Publish failed on all {M} channels',
  in_review_only: 'Submitted to {M} channels for review',
  partial: 'Published to {N} of {M} channels',
}

const FALLBACK_COPY = {
  all_succeeded: 'Published to {N} of {M} channels. Your listing is live on all selected channels.',
  mixed: 'Published to {N} of {M} channels. Some channels failed — open the receipt to retry or fix.',
  all_failed: 'Could not publish to any of {M} channels. Open the receipt to see why and retry.',
  in_review_only: 'Submitted to {M} channels for review. We will notify you when they go live.',
  partial: 'Published to {N} of {M} channels. The rest are still in review.',
}

async function lookupAgentUserId(agentId) {
  if (!agentId) return null
  const rows = await query(
    `SELECT user_id FROM public.agents WHERE id = $1`,
    [agentId],
  )
  return rows[0]?.user_id || agentId
}

async function markCompleted(jobId, isLegacy) {
  if (isLegacy) {
    await query(
      `UPDATE public.distribution_jobs
          SET updated_at = NOW(),
              data = COALESCE(data, '{}'::jsonb)
                || jsonb_build_object('completed_notified_at', NOW()::text)
        WHERE id = $1
          AND COALESCE(data->>'completed_notified_at', '') = ''`,
      [jobId],
    )
    return
  }
  await query(
    `UPDATE public.publishing_jobs
        SET completed_at = COALESCE(completed_at, NOW()),
            updated_at = NOW(),
            data = COALESCE(data, '{}'::jsonb)
              || jsonb_build_object('completed_notified_at', NOW()::text)
      WHERE id = $1
        AND COALESCE(data->>'completed_notified_at', '') = ''`,
    [jobId],
  )
}

async function alreadyNotified(jobId) {
  const rows = await query(
    `SELECT 1
       FROM public.publishing_jobs
      WHERE id = $1
        AND COALESCE(data->>'completed_notified_at', '') <> ''
     UNION ALL
     SELECT 1
       FROM public.distribution_jobs
      WHERE id = $1
        AND publishing_job_id IS NULL
        AND COALESCE(data->>'completed_notified_at', '') <> ''
      LIMIT 1`,
    [jobId],
  )
  return rows.length > 0
}

/**
 * Resolve template, substitute {N}/{M}, dispatch in-app + push.
 *
 * @param {string} jobId publishing_jobs.id or legacy distribution_jobs.id
 * @param {{ payload?: object, userId?: string, force?: boolean }} [opts]
 */
export async function emitPublishingJobCompleted(jobId, opts = {}) {
  if (!jobId) return { skipped: true, reason: 'missing_job_id' }

  let payload = opts.payload || null
  if (!payload) {
    const header = await query(
      `SELECT id, agent_id, agency_id, false AS is_legacy
         FROM public.publishing_jobs WHERE id = $1
       UNION ALL
       SELECT id, agent_id, agency_id, true AS is_legacy
         FROM public.distribution_jobs
        WHERE id = $1 AND publishing_job_id IS NULL
       LIMIT 1`,
      [jobId],
    )
    const row = header[0]
    if (!row?.agent_id) return { skipped: true, reason: 'not_found' }
    payload = await loadPublishingJobPayload({
      jobId,
      agentId: row.agent_id,
      agencyId: row.agency_id,
    })
  }
  if (!payload) return { skipped: true, reason: 'not_found' }

  const aggregate = payload.job.aggregate
  if (!isTerminalAggregate(aggregate)) {
    return { skipped: true, reason: 'not_terminal', aggregate }
  }

  if (!opts.force && await alreadyNotified(payload.job.id)) {
    return { skipped: true, reason: 'already_notified' }
  }

  const N = payload.job.counts.succeeded
  const M = payload.job.counts.total
  const deepLink = receiptDeepLink(payload.job.id)
  const code = templateCodeForAggregate(aggregate)

  let title = substitutePlaceholders(TITLE_BY_AGG[aggregate] || 'Publish update', {
    N, M, jobId: payload.job.id, deepLink,
  })
  let body = substitutePlaceholders(FALLBACK_COPY[aggregate] || FALLBACK_COPY.mixed, {
    N, M, jobId: payload.job.id, deepLink,
  })

  try {
    const template = await resolveTemplate({ code, language: 'en' })
    if (template) {
      title = substitutePlaceholders(template.subject || title, { N, M, jobId: payload.job.id, deepLink })
      body = substitutePlaceholders(template.text_body || template.html_body || body, {
        N, M, jobId: payload.job.id, deepLink,
      })
    }
  } catch (err) {
    logger.warn({ err: err.message, code, job_id: jobId }, 'publishing completed template resolve failed; using fallback copy')
  }

  const recipient = opts.userId || await lookupAgentUserId(payload.job.agent_id)
  if (!recipient) {
    logger.warn({ job_id: payload.job.id }, 'publishing completed notify skipped: no recipient')
    await markCompleted(payload.job.id, Boolean(payload.job.is_legacy))
    return { skipped: true, reason: 'no_recipient' }
  }

  const metadata = {
    deep_link_url: deepLink,
    alert_type: code,
    tracking_token: payload.job.id,
    job_id: payload.job.id,
    variant: aggregate,
    skip_cooldown: true,
  }

  const inApp = await dispatchConsumerNotification({
    channel: 'in_app',
    recipient,
    subject: title,
    body,
    metadata,
  })
  const push = await dispatchConsumerNotification({
    channel: 'push',
    recipient,
    subject: title,
    body,
    metadata,
  })

  await markCompleted(payload.job.id, Boolean(payload.job.is_legacy))

  return {
    ok: true,
    aggregate,
    template_code: code,
    in_app: inApp,
    push,
  }
}

/**
 * After retry, notify if the job is now terminal and not yet notified.
 */
export async function maybeEmitPublishingJobCompleted(jobId, opts = {}) {
  try {
    return await emitPublishingJobCompleted(jobId, opts)
  } catch (err) {
    logger.warn({ err: err.message, job_id: jobId }, 'emitPublishingJobCompleted failed')
    return { skipped: true, reason: 'error', error: err.message }
  }
}
