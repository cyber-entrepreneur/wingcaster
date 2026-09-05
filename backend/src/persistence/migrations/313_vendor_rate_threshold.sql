-- Vendor admin unstub (PA-VEN). Spec referred to this as 305c_vendor_rate_threshold.sql;
-- the runner skips NNN[letter]_*.sql (operator down-migrations). 307–312 were
-- taken on main after queue movement, so this is 313.
--
-- 1. CFG key VENDOR_RATE_APPROVAL_THRESHOLD_PCT (default 20.0).
-- 2. approval_requests.payload JSONB so PA-APR-002 can render impact_summary.
-- 3. action_kind VENDOR_RATE_CHANGE for WF-20 vendor rate additions/deprecations.

CREATE TABLE IF NOT EXISTS public.platform_configuration (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.platform_configuration (key, value, description)
VALUES (
  'VENDOR_RATE_APPROVAL_THRESHOLD_PCT',
  '{"value": 20.0}'::jsonb,
  'Vendor rate change % above which two-person approval is required'
)
ON CONFLICT (key) DO NOTHING;

GRANT SELECT ON public.platform_configuration TO fin_app_role, fin_finance_role, fin_auditor_role;
GRANT SELECT, INSERT, UPDATE ON public.platform_configuration TO fin_app_role;

ALTER TABLE fin.approval_requests
  ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE fin.approval_requests
  DROP CONSTRAINT IF EXISTS chk_approval_requests_action_kind;

ALTER TABLE fin.approval_requests
  ADD CONSTRAINT chk_approval_requests_action_kind
  CHECK (action_kind IN (
    'LARGE_GRANT', 'LARGE_REFUND', 'NEGATIVE_ADJUSTMENT', 'FACILITY_OPS',
    'BACKDATED_AMENDMENT', 'INVOICE_VOID', 'WRITE_OFF', 'RECONCILIATION_OVERRIDE',
    'MASS_OPERATION', 'PLATFORM_ADMIN_RECOVERY', 'AUDIT_RETENTION',
    'VENDOR_VARIANCE_OVERRIDE', 'VENDOR_RATE_CHANGE'
  ));
