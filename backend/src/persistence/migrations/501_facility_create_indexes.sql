-- PA-FAC-003: facility index list + tenant-scoped create lookups.

CREATE INDEX IF NOT EXISTS idx_fin_credit_facilities_env_tenant_status
  ON fin.credit_facilities (environment, tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_fin_credit_facilities_env_created
  ON fin.credit_facilities (environment, created_at DESC);
