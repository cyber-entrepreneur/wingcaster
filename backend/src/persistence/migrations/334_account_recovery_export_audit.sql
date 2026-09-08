-- BE-BLOCKER-21 / [BE-ACR-08] — durable bulk-reveal audit for unmasked CSV export
-- + discoverability index for account-recovery escalations (PA-APR-005 surfaces).
-- Idempotent. Migration number locked at 334 — do not renumber.

CREATE TABLE IF NOT EXISTS public.account_recovery_export_audits (
  id UUID PRIMARY KEY,
  exported_by TEXT NOT NULL,
  masked BOOLEAN NOT NULL DEFAULT false,
  query_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  case_ids TEXT[] NOT NULL DEFAULT '{}',
  fields_exported TEXT[] NOT NULL DEFAULT '{}',
  row_count INTEGER NOT NULL DEFAULT 0,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_account_recovery_export_audits_exported_by_created
  ON public.account_recovery_export_audits (exported_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_recovery_export_audits_created
  ON public.account_recovery_export_audits (created_at DESC);

-- PA-APR-005 / approval queue surfaces look up PLATFORM_ADMIN_RECOVERY by
-- subject (recovery case) + status. Parent votes and disagreement escalations
-- both use subject_type = 'account_recovery_case'.
CREATE INDEX IF NOT EXISTS idx_approval_requests_acr_subject
  ON fin.approval_requests (action_kind, subject_type, subject_id, status)
  WHERE action_kind = 'PLATFORM_ADMIN_RECOVERY';

CREATE INDEX IF NOT EXISTS idx_account_recovery_cases_escalation_request
  ON public.account_recovery_cases (escalation_approval_request_id)
  WHERE escalation_approval_request_id IS NOT NULL;
