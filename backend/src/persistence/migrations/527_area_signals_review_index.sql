-- PA-ARE-003 — area signal review queue lookups.
-- Additive only: area_intelligence.area_signals exists from migration 023.

CREATE INDEX IF NOT EXISTS idx_area_signals_area_status_fetched_at
  ON area_intelligence.area_signals (area_id, status, fetched_at DESC);
