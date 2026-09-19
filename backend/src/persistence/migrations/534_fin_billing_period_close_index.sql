-- PA-ACC-003 — admin billing period close eligibility lookups.

CREATE INDEX IF NOT EXISTS idx_billing_periods_close_eligible
  ON fin.billing_periods (environment, tenant_id, ends_at)
  WHERE status = 'OPEN';
