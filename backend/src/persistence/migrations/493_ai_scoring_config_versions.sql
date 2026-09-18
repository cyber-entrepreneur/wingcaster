-- PA-SCR-002 — versioned AI scoring prompts.

ALTER TABLE area_intelligence.ai_scoring_configs
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1
    CHECK (version > 0);

CREATE TABLE IF NOT EXISTS area_intelligence.ai_scoring_config_versions (
  id TEXT PRIMARY KEY,
  config_id TEXT NOT NULL
    REFERENCES area_intelligence.ai_scoring_configs(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  snapshot JSONB NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (config_id, version)
);

CREATE INDEX IF NOT EXISTS idx_ai_scoring_config_versions_config
  ON area_intelligence.ai_scoring_config_versions (config_id, version DESC);

INSERT INTO area_intelligence.ai_scoring_config_versions (
  id, config_id, version, snapshot, created_at
)
SELECT
  gen_random_uuid()::text,
  config.id,
  config.version,
  to_jsonb(config),
  COALESCE(config.updated_at, config.created_at, CURRENT_TIMESTAMP)
FROM area_intelligence.ai_scoring_configs AS config
ON CONFLICT (config_id, version) DO NOTHING;
