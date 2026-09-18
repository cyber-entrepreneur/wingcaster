-- PA-GOO-001 — Google Maps usage dashboard.
--
-- The monthly budget used to live only in an env var
-- (GOOGLE_MAPS_BUDGET_USD_MONTHLY). This table makes the budget and an alert
-- threshold editable by a Platform Admin. A single row (id = 'default') holds
-- the platform config; the usage dashboard reads it to compute headroom,
-- projected month-end spend, and the over-budget / near-threshold banners.

CREATE TABLE IF NOT EXISTS public.google_maps_budget_config (
  id TEXT PRIMARY KEY,
  budget_usd_monthly NUMERIC(12,2) NOT NULL DEFAULT 500,
  alert_threshold_pct INTEGER NOT NULL DEFAULT 80,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT google_budget_nonnegative CHECK (budget_usd_monthly >= 0 AND budget_usd_monthly <= 10000000),
  CONSTRAINT google_alert_threshold_bounds CHECK (alert_threshold_pct BETWEEN 1 AND 100)
);
