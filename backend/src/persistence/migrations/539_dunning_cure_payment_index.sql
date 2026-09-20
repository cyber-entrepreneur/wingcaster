-- PA-DUN-004 — index tenant payments for cure-case payment picker.
CREATE INDEX IF NOT EXISTS idx_fin_payments_env_tenant_received
  ON fin.payments (environment, tenant_id, received_at DESC);
