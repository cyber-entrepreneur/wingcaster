-- Wave 5 Agent 6 e2e harness fix (idempotent).
-- pricing_benchmark_snapshots.updated_at was missing (336); DAL always stamps it.
-- CHECK expansion for COMPARABLE_REMOVE / PRICE_REPORT_INCORPORATE lives in
-- 362_fin_approval_action_kinds_wf05_wf06.sql (#178) — do not rewrite it here.

ALTER TABLE market_pricing.pricing_benchmark_snapshots
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE market_pricing.pricing_benchmark_snapshots
   SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
 WHERE updated_at IS NULL;
