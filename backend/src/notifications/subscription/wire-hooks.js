/**
 * Wire-hooks: glue between a subscription lifecycle engine and the
 * notification dispatcher.
 *
 * Callers in the retired product catalog (lifecycle.js,
 * renewal-scanner.js) are gone. Exports stay so a future control-plane
 * can reattach them. Unused exports are OK.
 */

import logger from '../../lib/logger.js'
import { dispatch } from './dispatcher.js'
import { EVENT_KINDS, eventKindForHistory } from './events.js'

function shortDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function priceDisplay(minor, currency) {
  if (minor == null) return ''
  const val = Number(minor) / 100
  const digits = Math.abs(val) < 1 ? 4 : 2
  return `${currency || 'USD'} ${val.toFixed(digits)}`
}

function buildPlanContext(subscription) {
  if (!subscription) return {}
  return {
    plan: {
      name: subscription.plan_name || 'your plan',
      code: subscription.product_code || '',
      version: subscription.product_version || '',
      cadence: String(subscription.billing_cadence || 'month').replace('_', ' '),
      price_display: priceDisplay(subscription.resolved_plan_price_minor, subscription.resolved_plan_currency),
    },
  }
}

/**
 * Fire notification for a subscription history event. Never throws.
 */
export async function notifyForHistoryEvent(subscription, historyEvent, { actorId = null } = {}) {
  if (!subscription) return
  const eventKind = eventKindForHistory(historyEvent)
  if (!eventKind) return

  try {
    const planCtx = buildPlanContext(subscription)
    const context = {
      ...planCtx,
      tenant: { id: subscription.tenant_id },
      trial_ends_at_short: shortDate(subscription.trial_ends_at),
      period_end_short: shortDate(subscription.billing_period_end),
      next_renewal_short: shortDate(subscription.next_renewal_at),
    }
    await dispatch({
      eventKind,
      tenantId: subscription.tenant_id,
      subscriptionId: subscription.id,
      context,
      actorId,
    })
  } catch (err) {
    logger.warn({ err: err.message, historyEvent, subscriptionId: subscription.id }, 'notify wire-hook failed')
  }
}

/**
 * Fire the credit-note-issued notification. Skipped for proration
 * types (they're a side effect of a migration event, which already
 * notifies).
 */
export async function notifyCreditNoteIssued(note, { subscription = null, actorId = null } = {}) {
  if (!note) return
  if (note.type === 'proration_credit' || note.type === 'proration_debit') return
  try {
    const planCtx = subscription ? buildPlanContext(subscription) : {}
    const amountDisplay = priceDisplay(note.amount_minor, note.currency)
    const typeLabelMap = {
      refund: 'refund',
      courtesy: 'courtesy credit',
      promo: 'promo credit',
      manual_adjustment: 'account adjustment',
    }
    await dispatch({
      eventKind: EVENT_KINDS.CREDIT_NOTE_ISSUED,
      tenantId: note.tenant_id,
      subscriptionId: note.subscription_id || subscription?.id || null,
      context: {
        ...planCtx,
        tenant: { id: note.tenant_id },
        credit: {
          amount_display: amountDisplay,
          type_label: typeLabelMap[note.type] || note.type,
          reason_line: note.reason ? `Reason: ${note.reason}` : '',
        },
      },
      actorId,
    })
  } catch (err) {
    logger.warn({ err: err.message, noteId: note?.id }, 'notify credit note failed')
  }
}

/**
 * Trial-ending sweep previously scanned legacy billing subscriptions.
 * That table is gone; keep the export as a no-op until a fin control-plane
 * caller is wired.
 */
export async function sweepTrialEndingNotifications() {
  return { notified: 0 }
}
