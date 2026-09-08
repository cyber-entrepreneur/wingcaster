-- WF-05 / BE-BLOCKER-28 part B — comparable report decision vocab + two-person remove.
-- Expands comparable_reports.status CHECK to PA-PVA-008 decision statuses,
-- adds decision metadata columns, allows external comparable quarantine,
-- and registers COMPARABLE_REMOVE on fin.approval_requests.action_kind.

-- ---------------------------------------------------------------------------
-- comparable_reports status vocab (legacy statuses retained for existing rows)
-- ---------------------------------------------------------------------------
ALTER TABLE market_pricing.comparable_reports
  DROP CONSTRAINT IF EXISTS comparable_reports_status_check;

ALTER TABLE market_pricing.comparable_reports
  ADD CONSTRAINT comparable_reports_status_check
  CHECK (status IN (
    'pending',
    'reviewed',
    'dismissed',
    'actioned',
    'confirmed_removed',
    'confirmed_quarantined',
    'rejected',
    'awaiting_info',
    'expired',
    'remove_proposed'
  ));

ALTER TABLE market_pricing.comparable_reports
  ADD COLUMN IF NOT EXISTS decision_reason_code TEXT,
  ADD COLUMN IF NOT EXISTS decision_notes TEXT,
  ADD COLUMN IF NOT EXISTS quarantine_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_request_id UUID,
  ADD COLUMN IF NOT EXISTS requested_evidence JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_comparable_reports_approval_request
  ON market_pricing.comparable_reports(approval_request_id)
  WHERE approval_request_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- external_comparables: quarantine holds the row out of the active pricing pool
-- ---------------------------------------------------------------------------
ALTER TABLE market_pricing.external_comparables
  DROP CONSTRAINT IF EXISTS external_comparables_status_check;

ALTER TABLE market_pricing.external_comparables
  ADD CONSTRAINT external_comparables_status_check
  CHECK (status IN ('active', 'removed', 'sold', 'expired', 'quarantined'));

-- ---------------------------------------------------------------------------
-- Two-person remove proposals appear in PA-APR-001 via fin.approval_requests
-- ---------------------------------------------------------------------------
ALTER TABLE fin.approval_requests
  DROP CONSTRAINT IF EXISTS chk_approval_requests_action_kind;

ALTER TABLE fin.approval_requests
  ADD CONSTRAINT chk_approval_requests_action_kind
  CHECK (action_kind IN (
    'LARGE_GRANT', 'LARGE_REFUND', 'NEGATIVE_ADJUSTMENT', 'FACILITY_OPS',
    'BACKDATED_AMENDMENT', 'INVOICE_VOID', 'WRITE_OFF', 'RECONCILIATION_OVERRIDE',
    'MASS_OPERATION', 'PLATFORM_ADMIN_RECOVERY', 'AUDIT_RETENTION',
    'VENDOR_VARIANCE_OVERRIDE', 'VENDOR_RATE_CHANGE', 'COMPARABLE_REMOVE'
  ));
