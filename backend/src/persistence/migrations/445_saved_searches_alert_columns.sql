-- AGT-CMP-005 — Saved searches alert + ownership columns.

ALTER TABLE saved_searches
  ADD COLUMN IF NOT EXISTS user_id TEXT;

ALTER TABLE saved_searches
  ADD COLUMN IF NOT EXISTS alert_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE saved_searches
  ADD COLUMN IF NOT EXISTS alert_channel TEXT NOT NULL DEFAULT 'inapp';

ALTER TABLE saved_searches
  ADD COLUMN IF NOT EXISTS alert_frequency TEXT NOT NULL DEFAULT 'daily';

ALTER TABLE saved_searches
  ADD COLUMN IF NOT EXISTS last_alert_run_at TIMESTAMPTZ;

ALTER TABLE saved_searches
  ADD COLUMN IF NOT EXISTS last_match_count INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'saved_searches_alert_channel_check'
  ) THEN
    ALTER TABLE saved_searches
      ADD CONSTRAINT saved_searches_alert_channel_check
      CHECK (alert_channel IN ('email', 'whatsapp', 'inapp'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'saved_searches_alert_frequency_check'
  ) THEN
    ALTER TABLE saved_searches
      ADD CONSTRAINT saved_searches_alert_frequency_check
      CHECK (alert_frequency IN ('instant', 'daily', 'weekly'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id
  ON saved_searches (user_id);

CREATE INDEX IF NOT EXISTS idx_saved_searches_alert_enabled
  ON saved_searches (user_id, alert_enabled)
  WHERE alert_enabled = TRUE;

UPDATE saved_searches
SET user_id = agent_id
WHERE user_id IS NULL AND agent_id IS NOT NULL;

UPDATE saved_searches
SET alert_enabled = COALESCE((alert_settings->>'enabled')::boolean, alert_enabled)
WHERE alert_settings IS NOT NULL
  AND alert_settings ? 'enabled';

UPDATE saved_searches
SET alert_channel = COALESCE(alert_settings->>'channel', alert_channel)
WHERE alert_settings IS NOT NULL
  AND alert_settings ? 'channel'
  AND alert_settings->>'channel' IN ('email', 'whatsapp', 'inapp');

UPDATE saved_searches
SET alert_frequency = COALESCE(alert_settings->>'frequency', alert_frequency)
WHERE alert_settings IS NOT NULL
  AND alert_settings ? 'frequency'
  AND alert_settings->>'frequency' IN ('instant', 'daily', 'weekly');
