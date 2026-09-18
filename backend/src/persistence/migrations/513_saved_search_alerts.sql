-- AGT-CMP-005 — align saved_searches with alert-aware API fields.

ALTER TABLE public.saved_searches
  ADD COLUMN IF NOT EXISTS user_id TEXT,
  ADD COLUMN IF NOT EXISTS alert_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS alert_channel TEXT NOT NULL DEFAULT 'inapp'
    CHECK (alert_channel IN ('email', 'whatsapp', 'inapp')),
  ADD COLUMN IF NOT EXISTS alert_frequency TEXT NOT NULL DEFAULT 'daily'
    CHECK (alert_frequency IN ('instant', 'daily', 'weekly')),
  ADD COLUMN IF NOT EXISTS last_alert_run_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_match_count INTEGER NOT NULL DEFAULT 0;

UPDATE public.saved_searches
SET user_id = COALESCE(user_id, agent_id)
WHERE user_id IS NULL AND agent_id IS NOT NULL;

UPDATE public.saved_searches
SET alert_enabled = COALESCE((alert_settings->>'enabled')::boolean, TRUE)
WHERE alert_settings IS NOT NULL
  AND alert_settings ? 'enabled';

UPDATE public.saved_searches
SET alert_channel = COALESCE(alert_settings->>'channel', alert_channel)
WHERE alert_settings IS NOT NULL
  AND alert_settings ? 'channel'
  AND alert_settings->>'channel' IN ('email', 'whatsapp', 'inapp');

UPDATE public.saved_searches
SET alert_frequency = COALESCE(alert_settings->>'frequency', alert_frequency)
WHERE alert_settings IS NOT NULL
  AND alert_settings ? 'frequency'
  AND alert_settings->>'frequency' IN ('instant', 'daily', 'weekly');

CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id
  ON public.saved_searches (user_id);
