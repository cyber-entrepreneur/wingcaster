-- PA-FIN-003 — tenant detail admin lookups.

CREATE INDEX IF NOT EXISTS idx_fin_tenants_env_status
  ON fin.tenants (environment, status);
