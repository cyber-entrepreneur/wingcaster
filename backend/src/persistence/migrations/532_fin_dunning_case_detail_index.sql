-- PA-DUN-002 — admin dunning case detail timeline index.

CREATE INDEX IF NOT EXISTS idx_dunning_steps_env_case_entered
  ON fin.dunning_steps (environment, case_id, entered_at DESC);
