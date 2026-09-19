-- PA-DUN-001 — dunning cases admin list lookups.
-- Additive only: fin.dunning_cases exists from migration 182.

CREATE INDEX IF NOT EXISTS idx_dunning_cases_env_status_created_at
  ON fin.dunning_cases (environment, status, created_at DESC);
