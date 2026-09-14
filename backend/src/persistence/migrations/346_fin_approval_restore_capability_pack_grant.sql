-- Wave-8 CI unblock / Week-7 follow-up:
-- Migration 343 (PACKAGE_PUBLISH) recreated chk_approval_requests_action_kind without
-- CAPABILITY_PACK_FINANCE_GRANT from 342_capability_packs. Restore both kinds.
-- Idempotent with a corrected 343 (see PR #156); safe if either lands first.

ALTER TABLE fin.approval_requests DROP CONSTRAINT IF EXISTS chk_approval_requests_action_kind;
ALTER TABLE fin.approval_requests ADD CONSTRAINT chk_approval_requests_action_kind CHECK (action_kind IN (
  'LARGE_GRANT', 'LARGE_REFUND', 'NEGATIVE_ADJUSTMENT', 'FACILITY_OPS',
  'BACKDATED_AMENDMENT', 'INVOICE_VOID', 'WRITE_OFF', 'RECONCILIATION_OVERRIDE',
  'MASS_OPERATION', 'PLATFORM_ADMIN_RECOVERY', 'AUDIT_RETENTION',
  'VENDOR_VARIANCE_OVERRIDE', 'VENDOR_RATE_CHANGE', 'COMPARABLE_REMOVE',
  'PRICE_REPORT_INCORPORATE', 'CAPABILITY_PACK_FINANCE_GRANT', 'PACKAGE_PUBLISH'
));
