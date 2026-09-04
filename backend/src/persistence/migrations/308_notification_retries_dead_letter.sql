-- Retry-queue status includes dead_letter so PA-NDL-001 can surface
-- exhausted / stale consumer notification deliveries.
--
-- Brief name was 305e_*; lettered files are skipped by runner.js (see 307).
--
-- Existing column is `attempts` (not attempt_count). We keep that name and
-- constrain status. next_retry_at and created_at already exist from 008.

-- Normalize any unexpected historical status before tightening the CHECK.
UPDATE public.consumer_notification_retries
SET status = 'failed'
WHERE status IS NOT NULL
  AND status NOT IN ('pending', 'completed', 'failed', 'skipped', 'dead_letter');

ALTER TABLE public.consumer_notification_retries
  DROP CONSTRAINT IF EXISTS consumer_notification_retries_status_check;

ALTER TABLE public.consumer_notification_retries
  ADD CONSTRAINT consumer_notification_retries_status_check
  CHECK (status IS NULL OR status IN (
    'pending',
    'completed',
    'failed',
    'skipped',
    'dead_letter'
  ));

CREATE INDEX IF NOT EXISTS idx_consumer_notification_retries_pending
  ON public.consumer_notification_retries (status, next_retry_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_consumer_notification_retries_dead_letter
  ON public.consumer_notification_retries (status, created_at DESC)
  WHERE status IN ('dead_letter', 'failed');
