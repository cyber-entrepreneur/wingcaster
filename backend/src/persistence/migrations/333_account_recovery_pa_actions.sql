-- BE-BLOCKER-21 / Agent 5 — PA action columns for request-info / undo / withdraw.
-- Migration number 333 is locked. Idempotent. Do not renumber.

ALTER TABLE public.account_recovery_cases
  ADD COLUMN IF NOT EXISTS requested_evidence JSONB,
  ADD COLUMN IF NOT EXISTS info_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS info_requested_by TEXT,
  ADD COLUMN IF NOT EXISTS info_request_reason_code TEXT,
  ADD COLUMN IF NOT EXISTS info_request_notes TEXT,
  ADD COLUMN IF NOT EXISTS info_request_canceled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS info_request_canceled_by TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'chk_account_recovery_cases_info_request_reason'
       AND conrelid = 'public.account_recovery_cases'::regclass
  ) THEN
    ALTER TABLE public.account_recovery_cases
      ADD CONSTRAINT chk_account_recovery_cases_info_request_reason
      CHECK (
        info_request_reason_code IS NULL
        OR info_request_reason_code IN (
          'missing_government_id',
          'selfie_required',
          'tenancy_record_required',
          'agency_letterhead_required',
          'contact_unreachable',
          'other'
        )
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_account_recovery_cases_awaiting_info
  ON public.account_recovery_cases (status)
  WHERE status = 'awaiting_info';

CREATE INDEX IF NOT EXISTS idx_account_recovery_cases_info_requested_by
  ON public.account_recovery_cases (info_requested_by)
  WHERE info_requested_by IS NOT NULL;
