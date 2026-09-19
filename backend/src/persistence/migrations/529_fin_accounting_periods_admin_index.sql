-- PA-ACC-001 — admin list index for fin.accounting_periods (environment-scoped status browse).

CREATE INDEX IF NOT EXISTS idx_accounting_periods_env_status_period
  ON fin.accounting_periods (environment, status, period_key DESC);
