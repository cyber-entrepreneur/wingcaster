-- Wave 5 Agent 6 e2e harness fixes (idempotent).
-- 1. DAL always stamps updated_at; pricing_benchmark_snapshots was missing it (336).
-- 2. Migration 337 re-asserted chk_approval_requests_action_kind without
--    PRICE_REPORT_INCORPORATE from 336 — restore both WF-05 + WF-06 kinds.

ALTER TABLE market_pricing.pricing_benchmark_snapshots
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE market_pricing.pricing_benchmark_snapshots
   SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
 WHERE updated_at IS NULL;

ALTER TABLE fin.approval_requests
  DROP CONSTRAINT IF EXISTS chk_approval_requests_action_kind;

ALTER TABLE fin.approval_requests
  ADD CONSTRAINT chk_approval_requests_action_kind
  CHECK (action_kind IN (
    'LARGE_GRANT', 'LARGE_REFUND', 'NEGATIVE_ADJUSTMENT', 'FACILITY_OPS',
    'BACKDATED_AMENDMENT', 'INVOICE_VOID', 'WRITE_OFF', 'RECONCILIATION_OVERRIDE',
    'MASS_OPERATION', 'PLATFORM_ADMIN_RECOVERY', 'AUDIT_RETENTION',
    'VENDOR_VARIANCE_OVERRIDE', 'VENDOR_RATE_CHANGE',
    'PRICE_REPORT_INCORPORATE',
    'COMPARABLE_REMOVE'
  ));
