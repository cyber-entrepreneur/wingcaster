-- PA-CRD-003: credit lots index filters (tenant, status, expiring-soon).

CREATE INDEX IF NOT EXISTS idx_fin_lots_env_tenant_status
  ON fin.lots (environment, tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_fin_lots_env_expires_active
  ON fin.lots (environment, expires_at)
  WHERE status = 'ACTIVE' AND expires_at IS NOT NULL;
