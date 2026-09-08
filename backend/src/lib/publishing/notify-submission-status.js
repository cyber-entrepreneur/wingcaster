/**
 * BE-BLOCKER-12 — emit portal_submission.status_changed in-app + push.
 *
 * Resolves platform_message_templates rows seeded by
 * 327_portal_submission_status_changed_template.sql, then dispatches via
 * dispatchConsumerNotification. Tracker / job-aggregation endpoints are out
 * of scope.
 *
 * in_review is batched (max 1/hour per user) via dispatch `alert_type` +
 * metadata.priority=normal (default cooldown). Other statuses are
 * immediate (priority=urgent skips cooldown).
 */

import { resolveTemplate } from '../../notifications/platform-templates/resolver.js'
import { renderTemplate, renderText } from '../../notifications/platform-templates/variables.js'
import { dispatchConsumerNotification } from '../notifications/dispatch.js'
import logger from '../logger.js'

export const STATUS_TEMPLATE_CODES = Object.freeze({
  live: 'portal_submission.status_changed.live',
  rejected: 'portal_submission.status_changed.rejected',
  failed: 'portal_submission.status_changed.failed',
  expired: 'portal_submission.status_changed.expired',
  in_review: 'portal_submission.status_changed.in_review',
})

const STATUS_ALIASES = Object.freeze({
  live: 'live',
  accepted: 'live',
  published: 'live',
  rejected: 'rejected',
  failed: 'failed',
  expired: 'expired',
  timeout: 'expired',
  timed_out: 'expired',
  timedout: 'expired',
  in_review: 'in_review',
  inreview: 'in_review',
  reviewing: 'in_review',
})

/** Hardcoded AGT-PUB-006 copy used when the seed row is missing. */
export const FALLBACK_COPY = Object.freeze({
  live: {
    subject: '{{portal_name}} accepted your listing',
    text_body: '{{listing_address}} is now live on {{portal_name}}.',
  },
  rejected: {
    subject: "{{portal_name}} didn't accept your listing",
    text_body: 'See the reason and fix it — tap to review.',
  },
  failed: {
    subject: 'Delivery to {{portal_name}} failed',
    text_body: 'Retry or contact support — tap to see details.',
  },
  expired: {
    subject: 'Submission to {{portal_name}} timed out',
    text_body: 'No portal response after {{sla_days}} days. Tap to see options.',
  },
  in_review: {
    subject: '{{portal_name}} started reviewing your listing',
    text_body: "You'll get another update when they decide.",
  },
})

export const IN_REVIEW_ALERT_TYPE = 'portal_submission.status_changed.in_review'

export function normalizeSubmissionStatus(newStatus) {
  const raw = String(newStatus || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  return STATUS_ALIASES[raw] || (STATUS_TEMPLATE_CODES[raw] ? raw : null)
}

export function submissionReceiptDeepLink(distributionAttemptId) {
  return `wingcaster://publishing/receipts/${distributionAttemptId}`
}

function buildVariables({ portalName, listingAddress, slaDays, distributionAttemptId }) {
  return {
    portal_name: portalName ?? '',
    listing_address: listingAddress ?? '',
    sla_days: slaDays == null ? '' : String(slaDays),
    distribution_attempt_id: distributionAttemptId ?? '',
  }
}

async function renderCopy(status, variables) {
  const code = STATUS_TEMPLATE_CODES[status]
  const fallback = FALLBACK_COPY[status]
  let template = null
  try {
    template = await resolveTemplate({ code, language: 'en' })
  } catch (err) {
    logger.warn(
      { err: err.message, code },
      'portal_submission.status_changed: template resolve failed; using fallback copy',
    )
  }
  if (template) {
    const rendered = renderTemplate(template, variables)
    return {
      subject: rendered.subject || renderText(fallback.subject, variables),
      body: rendered.text_body || renderText(fallback.text_body, variables),
      used_template_id: template.id,
      used_fallback: false,
      template_code: code,
    }
  }
  return {
    subject: renderText(fallback.subject, variables),
    body: renderText(fallback.text_body, variables),
    used_template_id: null,
    used_fallback: true,
    template_code: code,
  }
}

function dispatchMetadata({ status, distributionAttemptId, extra }) {
  const isInReview = status === 'in_review'
  return {
    deep_link_url: submissionReceiptDeepLink(distributionAttemptId),
    tracking_token: distributionAttemptId || undefined,
    alert_type: isInReview ? IN_REVIEW_ALERT_TYPE : STATUS_TEMPLATE_CODES[status],
    // in_review = normal (cooldown, max 1/hour per user); others immediate.
    priority: isInReview ? 'normal' : 'urgent',
    ...extra,
  }
}

/**
 * Emit in-app + push for a portal submission status transition.
 *
 * @param {object} args
 * @param {string} args.userId
 * @param {string} args.portalName
 * @param {string} [args.listingAddress]
 * @param {number|string} [args.slaDays]
 * @param {string} args.distributionAttemptId
 * @param {string} args.newStatus  live | rejected | failed | expired | in_review
 * @param {object} [args.metadata] extra dispatch metadata
 * @param {object} [deps]
 * @param {typeof dispatchConsumerNotification} [deps.dispatch] injectable for tests
 */
export async function emitPortalSubmissionStatusChanged({
  userId,
  portalName,
  listingAddress,
  slaDays,
  distributionAttemptId,
  newStatus,
  metadata,
} = {}, { dispatch = dispatchConsumerNotification } = {}) {
  const status = normalizeSubmissionStatus(newStatus)
  if (!status) {
    return {
      ok: false,
      status: 'skipped',
      code: 'UNKNOWN_STATUS',
      error: `Unsupported portal submission status: ${newStatus}`,
    }
  }
  if (!userId) {
    return {
      ok: false,
      status: 'skipped',
      code: 'MISSING_USER',
      error: 'userId is required',
    }
  }

  const variables = buildVariables({
    portalName,
    listingAddress,
    slaDays,
    distributionAttemptId,
  })
  const copy = await renderCopy(status, variables)
  const meta = dispatchMetadata({
    status,
    distributionAttemptId,
    extra: metadata && typeof metadata === 'object' ? metadata : {},
  })

  const payload = {
    recipient: userId,
    subject: copy.subject,
    body: copy.body,
    metadata: meta,
  }

  // Parallel so in_review's cooldown is recorded once for the event, not
  // between the two channels of the same emit.
  const [in_app, push] = await Promise.all([
    dispatch({ ...payload, channel: 'in_app' }),
    dispatch({ ...payload, channel: 'push' }),
  ])

  return {
    ok: Boolean(in_app?.ok || push?.ok),
    template_code: copy.template_code,
    used_fallback: copy.used_fallback,
    used_template_id: copy.used_template_id,
    deep_link_url: meta.deep_link_url,
    alert_type: meta.alert_type,
    priority: meta.priority,
    in_app,
    push,
  }
}
