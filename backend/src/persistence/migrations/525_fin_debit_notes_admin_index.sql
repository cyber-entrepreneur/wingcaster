-- PA-INV-004 — debit note admin list and audit lookups.
-- Additive only: fin.debit_notes exists from migration 204.

CREATE INDEX IF NOT EXISTS idx_debit_notes_env_tenant_status_created_at
  ON fin.debit_notes (environment, tenant_id, status, created_at DESC);
