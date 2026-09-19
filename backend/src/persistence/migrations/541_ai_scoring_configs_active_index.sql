-- PA-SCR-002 — index active AI scoring configs for admin console reads.
CREATE INDEX IF NOT EXISTS idx_ai_scoring_configs_active_updated
  ON area_intelligence.ai_scoring_configs (is_active, updated_at DESC);
