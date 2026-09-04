-- In-app consumer notifications land on public.notifications.
--
-- The table did not exist (only consumer_notifications, the dispatch-state
-- inbox, was created in 008). The brief named this 305d_* but lettered
-- NNN[a-z]_ files are operator down-migrations and are skipped by runner.js;
-- 307 is the auto-applied equivalent.
--
-- type CHECK includes 'consumer' from the start so dispatchInApp can write
-- { type: 'consumer', user_id, title, body, metadata }.

CREATE TABLE IF NOT EXISTS public.notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  type TEXT NOT NULL DEFAULT 'consumer',
  title TEXT,
  body TEXT,
  metadata JSONB,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT notifications_type_check
    CHECK (type IN ('system', 'consumer', 'workflow', 'billing'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON public.notifications (user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

-- Idempotent if a later environment already created the table without
-- 'consumer' in the CHECK — drop + recreate with the full set.
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('system', 'consumer', 'workflow', 'billing'));
