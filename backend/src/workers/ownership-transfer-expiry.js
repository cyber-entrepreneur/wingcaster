/**
 * Ownership-transfer expiry / reversal-window workers (BE-BLOCKER-31).
 *
 * 1. Pending requests past expires_at → expired (14-day request TTL)
 * 2. T-1 day before reversal_deadline_at → fire reversal-window-expiring
 * 3. Executed transfers past reversal_deadline_at → mark data.reversal_permanent
 *    (endpoint already returns 410 after the deadline; this cron stamps permanence)
 */

import logger from '../lib/logger.js'
import { query } from '../db.js'
import { safeEmitOwnershipTransferNotification } from '../lib/agencies/notify-ownership-transfer.js'

async function agencyNamesByIds(agencyIds) {
  const ids = [...new Set((agencyIds || []).filter(Boolean))]
  if (!ids.length) return new Map()
  const rows = await query(
    `SELECT id, name FROM public.agencies WHERE id = ANY($1::text[])`,
    [ids],
  )
  return new Map(rows.map((r) => [r.id, r.name]))
}

/**
 * Flip due pending ownership transfers to expired.
 * @param {{ now?: Date|string|number }} [opts]
 */
export async function runOwnershipTransferExpiryTick(opts = {}) {
  const now = opts.now ? new Date(opts.now) : new Date()
  const nowIso = now.toISOString()

  let expired = 0
  let skipped = 0

  try {
    const due = await query(
      `SELECT id, status, agency_id, initiator_user_id, target_user_id
         FROM public.ownership_transfer_requests
        WHERE status = 'pending'
          AND expires_at IS NOT NULL
          AND expires_at <= $1::timestamptz`,
      [nowIso],
    )

    if (due.length) {
      const updated = await query(
        `UPDATE public.ownership_transfer_requests
            SET status = 'expired',
                decided_at = $1::timestamptz,
                updated_at = $1::timestamptz
          WHERE status = 'pending'
            AND expires_at IS NOT NULL
            AND expires_at <= $1::timestamptz
          RETURNING id, agency_id, initiator_user_id, target_user_id`,
        [nowIso],
      )
      expired = updated.length
      const names = await agencyNamesByIds(updated.map((r) => r.agency_id))
      for (const row of updated) {
        const agencyName = names.get(row.agency_id) || 'the agency'
        for (const userId of [row.initiator_user_id, row.target_user_id]) {
          await safeEmitOwnershipTransferNotification({
            userId,
            variant: 'target-expired',
            transferId: row.id,
            variables: {
              agency_name: agencyName,
              transfer_id: row.id,
            },
          })
        }
      }
    }
  } catch (err) {
    logger.error(
      { err: err.message || String(err) },
      'ownership transfer expiry tick failed',
    )
    throw err
  }

  if (expired > 0) {
    logger.info({ expired, skipped, now: nowIso }, 'ownership transfer expiry tick')
  }

  return { now: nowIso, expired, skipped }
}

/**
 * Fire reversal-window-expiring when deadline is within the next 24h (T-1 day).
 * Idempotent via data.reversal_expiring_notified.
 * @param {{ now?: Date|string|number }} [opts]
 */
export async function runOwnershipTransferReversalExpiringTick(opts = {}) {
  const now = opts.now ? new Date(opts.now) : new Date()
  const nowIso = now.toISOString()
  const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()

  let notified = 0
  try {
    const due = await query(
      `UPDATE public.ownership_transfer_requests
          SET data = COALESCE(data, '{}'::jsonb)
                || jsonb_build_object(
                     'reversal_expiring_notified', true,
                     'reversal_expiring_notified_at', $1::text
                   ),
              updated_at = $1::timestamptz
        WHERE status = 'executed'
          AND reversal_deadline_at IS NOT NULL
          AND reversal_deadline_at > $1::timestamptz
          AND reversal_deadline_at <= $2::timestamptz
          AND COALESCE((data->>'reversal_permanent')::boolean, false) = false
          AND COALESCE((data->>'reversal_expiring_notified')::boolean, false) = false
        RETURNING id, agency_id, initiator_user_id, target_user_id, reversal_deadline_at`,
      [nowIso, windowEnd],
    )
    notified = due.length
    if (due.length) {
      const names = await agencyNamesByIds(due.map((r) => r.agency_id))
      for (const row of due) {
        const agencyName = names.get(row.agency_id) || 'the agency'
        const deadline = row.reversal_deadline_at
          ? new Date(row.reversal_deadline_at).toISOString()
          : ''
        for (const userId of [row.initiator_user_id, row.target_user_id]) {
          await safeEmitOwnershipTransferNotification({
            userId,
            variant: 'reversal-window-expiring',
            transferId: row.id,
            variables: {
              agency_name: agencyName,
              reversal_deadline: deadline,
              days_remaining: '1',
              transfer_id: row.id,
            },
          })
        }
      }
    }
  } catch (err) {
    logger.error(
      { err: err.message || String(err) },
      'ownership transfer reversal-expiring tick failed',
    )
    throw err
  }

  if (notified > 0) {
    logger.info({ notified, now: nowIso }, 'ownership transfer reversal-expiring tick')
  }

  return { now: nowIso, notified }
}

/**
 * Mark executed transfers whose reversal window has closed as permanent.
 * Does not change status (stays `executed`); sets data.reversal_permanent.
 * @param {{ now?: Date|string|number }} [opts]
 */
export async function runOwnershipTransferReversalCloseTick(opts = {}) {
  const now = opts.now ? new Date(opts.now) : new Date()
  const nowIso = now.toISOString()

  let closed = 0
  try {
    const updated = await query(
      `UPDATE public.ownership_transfer_requests
          SET data = COALESCE(data, '{}'::jsonb)
                || jsonb_build_object(
                     'reversal_permanent', true,
                     'reversal_closed_at', $1::text
                   ),
              updated_at = $1::timestamptz
        WHERE status = 'executed'
          AND reversal_deadline_at IS NOT NULL
          AND reversal_deadline_at <= $1::timestamptz
          AND COALESCE((data->>'reversal_permanent')::boolean, false) = false
        RETURNING id`,
      [nowIso],
    )
    closed = updated.length
  } catch (err) {
    logger.error(
      { err: err.message || String(err) },
      'ownership transfer reversal-close tick failed',
    )
    throw err
  }

  if (closed > 0) {
    logger.info({ closed, now: nowIso }, 'ownership transfer reversal-close tick')
  }

  return { now: nowIso, closed }
}
