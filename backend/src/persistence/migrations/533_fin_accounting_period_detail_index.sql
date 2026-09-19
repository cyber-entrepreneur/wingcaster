-- PA-ACC-002 — admin accounting period close checklist queries.

CREATE INDEX IF NOT EXISTS idx_reconciliation_resolution_unresolved
  ON fin.reconciliation_resolution (drift_id)
  WHERE resolved_at IS NULL;
