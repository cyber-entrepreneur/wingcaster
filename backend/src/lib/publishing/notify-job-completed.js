/**
 * Emit publishing_job.completed in-app + push notification.
 *
 * Resolves seeded platform_message_templates variant by aggregate, then
 * dispatches via dispatchConsumerNotification. Safe to call from retry
 * handlers or the live publish pipeline (Agent 1).
 */

import { query } from '../../db.js'
import logger from '../logger.js'
import { dispatchConsumerNotification } from '../notifications/dispatch.js'
import { resolveTemplate } from '../../notifications/platform-templates/resolver.js'
import { getPublishingJob, computeAggregate } from './jobs.js'

const VARIANT_CODES = Object.freeze({
  all_succeeded: 'publishing_job.completed.all_succeeded',
  mixed: 'publishing_job.completed.mixed',
  all_failed: 'publishing_job.completed.all_failed',
  in_review_only: 'publishing_job.completed.in_review_only',
  partial: 'publishing_job.completed.partial',
})

function interpolate(template, ctx) {
  return String(template || '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const parts = key.split('.')
    let cur = ctx
    for (const part of parts) {
      if (cur == null) return ''
      cur = cur[part]
    }
    return cur == null ? '' : String(cur)
  })
}

export function templateCodeForAggregate(aggregate) {
  return VARIANT_CODES[aggregate] || VARIANT_CODES.mixed
}

export function buildDeepLink(jobId) {
  return `wingcaster://publish-receipt/${jobId}`
}

export function buildWebPath(jobId) {
  return `/publish/receipts/${jobId}`
}

/**
 * @param {string} jobId
 * @param {object} [opts]
 * @param {object} [opts.payload] - preloaded GET payload (avoids re-query)
 * @param {string} [opts.userId] - override recipient (defaults to job.agent_id)
 * @param {boolean} [opts.force] - notify even for non-terminal aggregates
 */
export async function emitPublishingJobCompleted(jobId, opts = {}) {
  if (!jobId) throw new Error('jobId is required')

  let payload = opts.payload || null
  if (!payload) {
    // Load without ownership filter for internal emitters — resolve agent from row.
    const meta = await query(
      `SELECT id, agent_id, agency_id FROM public.publishing_jobs WHERE id = $1`,
      [jobId],
    )
    const agentId = meta[0]?.agent_id
    if (!agentId) {
      // Legacy single distribution job id.
      const dj = await query(
        `SELECT id, agent_id, agency_id FROM public.distribution_jobs WHERE id = $1`,
        [jobId],
      )
      if (!dj[0]?.agent_id) {
        logger.warn({ jobId }, 'emitPublishingJobCompleted: job not found')
        return { ok: false, code: 'NOT_FOUND' }
      }
      payload = await getPublishingJob({
        jobId,
        agentId: dj[0].agent_id,
        agencyId: dj[0].agency_id,
      })
    } else {
      payload = await getPublishingJob({
        jobId,
        agentId,
        agencyId: meta[0].agency_id,
      })
    }
  }

  if (!payload?.job) {
    return { ok: false, code: 'NOT_FOUND' }
  }

  const { job, destinations } = payload
  const aggregate = job.aggregate || computeAggregate(job.counts || {})
  if (!opts.force && (aggregate === 'in_review_only' || aggregate === 'partial')) {
    return { ok: false, code: 'NOT_TERMINAL', aggregate }
  }

  const code = templateCodeForAggregate(aggregate)
  const template = await resolveTemplate({ code, language: 'en' })

  const deepLink = buildDeepLink(job.id)
  const webPath = buildWebPath(job.id)
  const ctx = {
    succeeded: job.counts?.succeeded ?? 0,
    in_review: job.counts?.in_review ?? 0,
    failed: job.counts?.failed ?? 0,
    total: job.counts?.total ?? destinations?.length ?? 0,
    job_id: job.id,
    deep_link_url: deepLink,
    web_path: webPath,
    listing_short_ref: job.listing_short_ref || '',
    N: job.counts?.succeeded ?? 0,
    M: job.counts?.total ?? 0,
  }

  const subject = template
    ? interpolate(template.subject, ctx)
    : `Publish update — ${aggregate}`
  const body = template
    ? interpolate(template.text_body, ctx)
    : `Published to ${ctx.succeeded} of ${ctx.total} channels.`

  const recipient = opts.userId || (await resolveRecipientUserId(job.id))
  if (!recipient) {
    return { ok: false, code: 'NO_RECIPIENT', aggregate }
  }

  const metadata = {
    event: 'publishing_job.completed',
    variant: aggregate,
    job_id: job.id,
    deep_link_url: deepLink,
    web_path: webPath,
    alert_type: 'publishing_job.completed',
    priority: aggregate === 'all_failed' ? 'high' : 'normal',
  }

  const results = {}
  results.in_app = await dispatchConsumerNotification({
    channel: 'in_app',
    recipient,
    subject,
    body,
    metadata,
  })
  results.push = await dispatchConsumerNotification({
    channel: 'push',
    recipient,
    subject,
    body,
    metadata,
  })

  return { ok: true, aggregate, template_code: code, results }
}

async function resolveRecipientUserId(jobId) {
  // Prefer publishing_jobs.agent_id; fall back to first destination agent.
  const rows = await query(
    `(SELECT agent_id FROM public.publishing_jobs WHERE id = $1 AND agent_id IS NOT NULL)
     UNION ALL
     (SELECT agent_id FROM public.distribution_jobs
       WHERE (publishing_job_id = $1 OR id = $1) AND agent_id IS NOT NULL
       LIMIT 1)
     LIMIT 1`,
    [jobId],
  )
  return rows[0]?.agent_id || null
}

export { VARIANT_CODES }
