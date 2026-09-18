-- PA-NDL-001 — Notifications dead-letter queue.
--
-- A Platform Admin can dismiss a dead-lettered / failed consumer-notification
-- delivery without deleting the audit row: it moves to status `ignored`, which
-- drops it out of the default DLQ view but keeps history. Extend the status
-- CHECK (last set in 308) to allow the new terminal state.

ALTER TABLE public.consumer_notification_retries
  DROP CONSTRAINT IF EXISTS consumer_notification_retries_status_check;

ALTER TABLE public.consumer_notification_retries
  ADD CONSTRAINT consumer_notification_retries_status_check
  CHECK (status IS NULL OR status IN (
    'pending',
    'completed',
    'failed',
    'skipped',
    'dead_letter',
    'ignored'
  ));
