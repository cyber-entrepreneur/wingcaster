/**
 * WF-31 / BE-BLOCKER-31 — ownership transfer notifications.
 *
 * Template codes seeded by 341_ownership_transfer_templates.sql (+ 356 follow-ups).
 * Best-effort: missing templates / dispatch failures must not roll back
 * the ownership flip transaction (callers invoke after commit or via
 * safe wrappers).
 */

import { resolveTemplate } from '../../notifications/platform-templates/resolver.js'
import { renderTemplate, renderText } from '../../notifications/platform-templates/variables.js'
import { dispatchConsumerNotification } from '../notifications/dispatch.js'
import logger from '../logger.js'

export const OWNERSHIP_TRANSFER_TEMPLATE_CODES = Object.freeze({
  'initiator-accepted': 'ownership_transfer.initiator-accepted',
  'target-invited': 'ownership_transfer.target-invited',
  'target-declined': 'ownership_transfer.target-declined',
  'target-expired': 'ownership_transfer.target-expired',
  'transfer-executed': 'ownership_transfer.transfer-executed',
  'transfer-reversed': 'ownership_transfer.transfer-reversed',
  'reversal-window-expiring': 'ownership_transfer.reversal-window-expiring',
})

const FALLBACK_COPY = Object.freeze({
  'initiator-accepted': {
    subject: '{{target_name}} accepted ownership of {{agency_name}}',
    text_body: 'You are now an Admin. Review the outcome and the 30-day reversal window.',
  },
  'target-invited': {
    subject: "You've been offered ownership of {{agency_name}}",
    text_body: '{{initiator_name}} wants you to become the owner. Review to accept or decline.',
  },
  'target-declined': {
    subject: '{{target_name}} declined ownership of {{agency_name}}',
    text_body: 'Reason: {{decline_reason}}',
  },
  'target-expired': {
    subject: 'Ownership transfer for {{agency_name}} expired',
    text_body: 'The transfer request expired without a response. Start a new transfer if you still want to proceed.',
  },
  'transfer-executed': {
    subject: 'Ownership of {{agency_name}} has transferred',
    text_body: '{{new_owner_name}} is now the owner. Reversal open until {{reversal_deadline}}.',
  },
  'transfer-reversed': {
    subject: 'Ownership of {{agency_name}} was reversed',
    text_body: '{{restored_owner_name}} is the owner again. {{demoted_owner_name}} is now an Admin.',
  },
  'reversal-window-expiring': {
    subject: 'Reversal window for {{agency_name}} closes soon',
    text_body: 'You have until {{reversal_deadline}} to reverse ownership from within the app.',
  },
})

function deepLinkFor(variant, transferId) {
  if (variant === 'target-invited') {
    return `wingcaster://ownership-transfer/incoming/${transferId}`
  }
  if (variant === 'target-declined' || variant === 'target-expired') {
    return 'wingcaster://agency/settings/ownership-transfer'
  }
  return `wingcaster://ownership-transfer/outcome/${transferId}`
}

async function renderCopy(variant, variables) {
  const code = OWNERSHIP_TRANSFER_TEMPLATE_CODES[variant]
  const fallback = FALLBACK_COPY[variant]
  let template = null
  try {
    template = await resolveTemplate({ code, language: 'en' })
  } catch (err) {
    logger.warn(
      { err: err.message, code },
      'ownership_transfer notify: template resolve failed; using fallback',
    )
  }
  if (template) {
    const rendered = renderTemplate(template, variables)
    return {
      subject: rendered.subject || renderText(fallback.subject, variables),
      body: rendered.text_body || renderText(fallback.text_body, variables),
    }
  }
  return {
    subject: renderText(fallback.subject, variables),
    body: renderText(fallback.text_body, variables),
  }
}

/**
 * @param {object} args
 * @param {string} args.userId
 * @param {string} args.variant - key of OWNERSHIP_TRANSFER_TEMPLATE_CODES
 * @param {string} args.transferId
 * @param {Record<string, string>} [args.variables]
 */
export async function safeEmitOwnershipTransferNotification({
  userId,
  variant,
  transferId,
  variables = {},
}) {
  if (!userId || !variant || !OWNERSHIP_TRANSFER_TEMPLATE_CODES[variant]) {
    return { ok: false, reason: 'invalid_args' }
  }
  try {
    const copy = await renderCopy(variant, variables)
    await dispatchConsumerNotification({
      channel: 'in_app',
      recipient: userId,
      subject: copy.subject,
      body: copy.body,
      metadata: {
        alert_type: OWNERSHIP_TRANSFER_TEMPLATE_CODES[variant],
        priority: variant === 'reversal-window-expiring' ? 'normal' : 'urgent',
        deep_link_url: deepLinkFor(variant, transferId),
        tracking_token: transferId,
        transfer_id: transferId,
      },
    })
    return { ok: true }
  } catch (err) {
    logger.warn(
      { err: err.message || String(err), userId, variant, transferId },
      'ownership_transfer notification dispatch failed',
    )
    return { ok: false, reason: err.message || String(err) }
  }
}
