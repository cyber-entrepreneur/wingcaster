/**
 * Daily scheduled-deletion reminder worker.
 *
 * For each `deletion_requests` row in status=scheduled:
 *   - T-7 calendar day → send `scheduled_deletion_reminder_tminus7`
 *   - T-1 calendar day → send `scheduled_deletion_reminder_tminus1`
 *
 * Idempotency: `reminders_sent TEXT[]` is claimed atomically before the
 * Graph send is considered durable. If the send fails after claim, the
 * key stays recorded so we do not spam; ops can clear the key to retry.
 */

import logger from '../lib/logger.js'
import {
  REMINDER_KEYS,
  claimReminderSend,
  findDueReminders,
  sendDeletionReminderEmail,
} from '../auth-scheduled-deletion.js'

async function processReminderKey({ reminderKey, now, send }) {
  const due = await findDueReminders({ reminderKey, now })
  let sent = 0
  let skipped = 0
  let failed = 0

  for (const row of due) {
    const claimed = await claimReminderSend(row.id, reminderKey)
    if (!claimed) {
      skipped += 1
      continue
    }
    try {
      await sendDeletionReminderEmail({ row, reminderKey, send })
      sent += 1
      logger.info(
        { deletion_request_id: row.id, user_id: row.user_id, reminderKey },
        'scheduled deletion reminder sent',
      )
    } catch (err) {
      failed += 1
      logger.error(
        { err: err.message || String(err), deletion_request_id: row.id, reminderKey },
        'scheduled deletion reminder send failed after claim',
      )
    }
  }

  return { reminderKey, due: due.length, sent, skipped, failed }
}

/**
 * Run one daily tick for T-7 and T-1 reminders.
 *
 * @param {{ now?: Date|string|number, send?: Function }} [opts]
 */
export async function runScheduledDeletionReminderTick(opts = {}) {
  const now = opts.now ? new Date(opts.now) : new Date()
  const send = opts.send

  const t7 = await processReminderKey({ reminderKey: REMINDER_KEYS.tminus7, now, send })
  const t1 = await processReminderKey({ reminderKey: REMINDER_KEYS.tminus1, now, send })

  return {
    now: now.toISOString(),
    tminus7: t7,
    tminus1: t1,
    sent: t7.sent + t1.sent,
    skipped: t7.skipped + t1.skipped,
    failed: t7.failed + t1.failed,
  }
}
