-- PA-REC-002: reconciliation run detail lookups (checks + drift timeline).

CREATE INDEX IF NOT EXISTS idx_fin_reconciliation_checks_run_code
  ON fin.reconciliation_checks (run_id, check_code);

CREATE INDEX IF NOT EXISTS idx_fin_reconciliation_drift_check_created
  ON fin.reconciliation_drift (check_id, created_at DESC);
