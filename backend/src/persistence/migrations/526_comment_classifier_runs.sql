-- PA-CLS-001 — comment classifier admin run history.

CREATE TABLE IF NOT EXISTS comment_classifier_runs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  triggered_by_agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
  batched INTEGER NOT NULL DEFAULT 0 CHECK (batched >= 0),
  updated_count INTEGER NOT NULL DEFAULT 0 CHECK (updated_count >= 0),
  skipped_reason TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_comment_classifier_runs_created_at
  ON comment_classifier_runs (created_at DESC);
