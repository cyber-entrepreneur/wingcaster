/**
 * Wave 1 WF-02 — emit agency_application.resolved in-app + push.
 *
 * Resolves platform_message_templates rows seeded by
 * 335_agency_application_resolved_template.sql, then dispatches via
 * dispatchConsumerNotification. Variants: approved / rejected / expired.
 *
 * Deep-link (AGT-REC-004 / Agent 4): wingcaster://applications/:applicationId
 * Web path (applications-routes redirect_to): /applications/:applicationId
 */

import { resolveTemplate } from '../../notifications/platform-templates/resolver.js'
import { renderTemplate, renderText } from '../../notifications/platform-templates/variables.js'
import { dispatchConsumerNotification } from '../notifications/dispatch.js'
import logger from '../logger.js'

export const RESOLVED_TEMPLATE_CODES = Object.freeze({
  approved: 'agency_application.resolved.approved',
  rejected: 'agency_application.resolved.rejected',
  expired: 'agency_application.resolved.expired',
})

const STATUS_ALIASES = Object.freeze({
  approved: 'approved',
  accepted: 'approved',
  rejected: 'rejected',
  declined: 'rejected',
  expired: 'expired',
  timed_out: 'expired',
  timeout: 'expired',
})

/** Hardcoded AGT-REC-004 copy used when the seed row is missing. */
export const FALLBACK_COPY = Object.freeze({
  approved: {
    subject: '{{agency_name}} accepted your application',
    text_body: 'Welcome. Tap to switch to your new workspace.',
  },
  rejected: {
    subject: '{{agency_name}} responded to your application',
    text_body: 'Your application was reviewed. Tap to see the outcome.',
  },
  expired: {
    subject: 'Your application to {{agency_name}} timed out',
    text_body: 'No response after 30 days. Tap to re-apply or browse other agencies.',
  },
})

export function normalizeResolvedStatus(newStatus) {
  const raw = String(newStatus || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  return STATUS_ALIASES[raw] || (RESOLVED_TEMPLATE_CODES[raw] ? raw : null)
}

export function applicationOutcomeDeepLink(applicationId) {
  return `wingcaster://applications/${applicationId}`
}

export function applicationOutcomeWebPath(applicationId) {
  return `/applications/${applicationId}`
}

function buildVariables({ agencyName, applicationId }) {
  return {
    agency_name: agencyName ?? '',
    application_id: applicationId ?? '',
  }
}

async function renderCopy(status, variables) {
  const code = RESOLVED_TEMPLATE_CODES[status]
  const fallback = FALLBACK_COPY[status]
  let template = null
  try {
    template = await resolveTemplate({ code, language: 'en' })
  } catch (err) {
    logger.warn(
      { err: err.message, code },
      'agency_application.resolved: template resolve failed; using fallback copy',
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

function dispatchMetadata({ status, applicationId, extra }) {
  return {
    deep_link_url: applicationOutcomeDeepLink(applicationId),
    web_path: applicationOutcomeWebPath(applicationId),
    tracking_token: applicationId || undefined,
    alert_type: RESOLVED_TEMPLATE_CODES[status],
    priority: 'urgent',
    event: 'agency_application.resolved',
    variant: status,
    application_id: applicationId,
    ...extra,
  }
}

/**
 * Emit in-app + push for an agency application status resolution.
 *
 * @param {object} args
 * @param {string} args.userId  applicant recipient
 * @param {string} args.agencyName
 * @param {string} args.applicationId
 * @param {string} args.newStatus  approved | rejected | expired
 * @param {object} [args.metadata] extra dispatch metadata
 * @param {object} [deps]
 * @param {typeof dispatchConsumerNotification} [deps.dispatch] injectable for tests
 */
export async function emitAgencyApplicationResolved({
  userId,
  agencyName,
  applicationId,
  newStatus,
  metadata,
} = {}, { dispatch = dispatchConsumerNotification } = {}) {
  const status = normalizeResolvedStatus(newStatus)
  if (!status) {
    return {
      ok: false,
      status: 'skipped',
      code: 'UNKNOWN_STATUS',
      error: `Unsupported agency application status: ${newStatus}`,
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
  if (!applicationId) {
    return {
      ok: false,
      status: 'skipped',
      code: 'MISSING_APPLICATION',
      error: 'applicationId is required',
    }
  }

  const variables = buildVariables({ agencyName, applicationId })
  const copy = await renderCopy(status, variables)
  const meta = dispatchMetadata({
    status,
    applicationId,
    extra: metadata && typeof metadata === 'object' ? metadata : {},
  })

  const payload = {
    recipient: userId,
    subject: copy.subject,
    body: copy.body,
    metadata: meta,
  }

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
    web_path: meta.web_path,
    alert_type: meta.alert_type,
    priority: meta.priority,
    in_app,
    push,
  }
}

/**
 * Non-blocking wrapper: log + continue on failure (call-site pattern).
 */
export async function safeEmitAgencyApplicationResolved(args, deps) {
  try {
    return await emitAgencyApplicationResolved(args, deps)
  } catch (err) {
    logger.warn(
      {
        err: err?.message || String(err),
        applicationId: args?.applicationId,
        newStatus: args?.newStatus,
      },
      'agency_application.resolved notify skipped',
    )
    return {
      ok: false,
      status: 'skipped',
      code: 'EMIT_FAILED',
      error: err?.message || String(err),
    }
  }
}
