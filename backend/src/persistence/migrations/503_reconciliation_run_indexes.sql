-- PA-REC-003: reconciliation runs index filters (scope + recency).

CREATE INDEX IF NOT EXISTS idx_fin_reconciliation_runs_env_started
  ON fin.reconciliation_runs (environment, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_fin_reconciliation_runs_env_scope
  ON fin.reconciliation_runs (environment, scope);
