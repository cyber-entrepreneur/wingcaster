-- PA-PAY-001 — admin payments index lookups.

CREATE INDEX IF NOT EXISTS idx_payments_env_received_admin
  ON fin.payments (environment, received_at DESC);
