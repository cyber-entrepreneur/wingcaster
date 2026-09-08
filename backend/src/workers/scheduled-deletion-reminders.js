/**
 * Daily scheduled-deletion reminder worker.
 *
 * For each `deletion_requests` row in status=scheduled:
 *   - T-7 calendar day → send `scheduled_deletion_reminder_tminus7`
 *   - T-1 calendar day → send `scheduled_deletion_reminder_tminus1`
 *
 * Idempotency (spec): array contains-check BEFORE send; append AFTER a
 * successful Graph/email send. A failed send is left unrecorded so the
 * next tick retries. Concurrent ticks still use the atomic append so a
 * key cannot be recorded twice.
 */

import logger from '../lib/logger.js'
import {
  REMINDER_KEYS,
  recordReminderSend,
  findDueReminders,
  sendDeletionReminderEmail,
} from '../auth-scheduled-deletion.js'

function alreadyRecorded(row, reminderKey) {
  const sent = Array.isArray(row.reminders_sent) ? row.reminders_sent : []
  return sent.includes(reminderKey)
}

async function processReminderKey({ reminderKey, now, send }) {
  const due = await findDueReminders({ reminderKey, now })
  let sent = 0
  let skipped = 0
  let failed = 0

  for (const row of due) {
    if (alreadyRecorded(row, reminderKey)) {
      skipped += 1
      continue
    }
    try {
      await sendDeletionReminderEmail({ row, reminderKey, send })
      const recorded = await recordReminderSend(row.id, reminderKey)
      if (!recorded) {
        skipped += 1
        continue
      }
      sent += 1
      logger.info(
        { deletion_request_id: row.id, user_id: row.user_id, reminderKey },
        'scheduled deletion reminder sent',
      )
    } catch (err) {
      failed += 1
      logger.error(
        { err: err.message || String(err), deletion_request_id: row.id, reminderKey },
        'scheduled deletion reminder send failed; not recorded for retry',
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
