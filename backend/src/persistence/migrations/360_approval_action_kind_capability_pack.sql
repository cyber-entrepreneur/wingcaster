-- Restore CAPABILITY_PACK_FINANCE_GRANT on fin.approval_requests.action_kind.
-- 342_capability_packs.sql added it; 343_fin_approval_package_publish_kind.sql
-- recreated the CHECK without it. Additive DROP + ADD (355–359 reserved).

ALTER TABLE fin.approval_requests
  DROP CONSTRAINT IF EXISTS chk_approval_requests_action_kind;

ALTER TABLE fin.approval_requests
  ADD CONSTRAINT chk_approval_requests_action_kind
  CHECK (action_kind IN (
    'LARGE_GRANT', 'LARGE_REFUND', 'NEGATIVE_ADJUSTMENT', 'FACILITY_OPS',
    'BACKDATED_AMENDMENT', 'INVOICE_VOID', 'WRITE_OFF', 'RECONCILIATION_OVERRIDE',
    'MASS_OPERATION', 'PLATFORM_ADMIN_RECOVERY', 'AUDIT_RETENTION',
    'VENDOR_VARIANCE_OVERRIDE', 'VENDOR_RATE_CHANGE', 'COMPARABLE_REMOVE',
    'PRICE_REPORT_INCORPORATE', 'PACKAGE_PUBLISH',
    'CAPABILITY_PACK_FINANCE_GRANT'
  ));
