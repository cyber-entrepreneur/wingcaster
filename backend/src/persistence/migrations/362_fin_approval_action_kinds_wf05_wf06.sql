-- Extracted shared CHECK expansion for WF-05 / WF-06 approval action kinds.
-- Lands BEFORE feat/wave-5-e2e (#132) so that branch keeps only fixture/table
-- remainder (pricing_benchmark_snapshots.updated_at) and does not rewrite this
-- shared constraint.
--
-- History: 336 added PRICE_REPORT_INCORPORATE; 337 rewrote with COMPARABLE_REMOVE
-- alone; 356/360 reconciled the full union. This migration re-asserts the full
-- expanded list (idempotent DROP + ADD) as the formal Wave 5 extract PR so
-- later parallel landings cannot silently drop WF-05/WF-06 kinds.

ALTER TABLE fin.approval_requests
  DROP CONSTRAINT IF EXISTS chk_approval_requests_action_kind;

ALTER TABLE fin.approval_requests
  ADD CONSTRAINT chk_approval_requests_action_kind
  CHECK (action_kind IN (
    'LARGE_GRANT', 'LARGE_REFUND', 'NEGATIVE_ADJUSTMENT', 'FACILITY_OPS',
    'BACKDATED_AMENDMENT', 'INVOICE_VOID', 'WRITE_OFF', 'RECONCILIATION_OVERRIDE',
    'MASS_OPERATION', 'PLATFORM_ADMIN_RECOVERY', 'AUDIT_RETENTION',
    'VENDOR_VARIANCE_OVERRIDE', 'VENDOR_RATE_CHANGE',
    'COMPARABLE_REMOVE',
    'PRICE_REPORT_INCORPORATE',
    'PACKAGE_PUBLISH',
    'CAPABILITY_PACK_FINANCE_GRANT'
  ));
