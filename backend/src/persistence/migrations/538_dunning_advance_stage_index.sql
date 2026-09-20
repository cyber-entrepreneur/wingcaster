-- PA-DUN-003 — index open dunning cases for admin advance-stage reads.
CREATE INDEX IF NOT EXISTS idx_dunning_cases_env_open_updated
  ON fin.dunning_cases (environment, updated_at DESC)
  WHERE status NOT IN ('CURED', 'WRITTEN_OFF', 'CANCELED');
