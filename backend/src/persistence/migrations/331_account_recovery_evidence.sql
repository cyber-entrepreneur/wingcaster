-- BE-BLOCKER-21 / [BE-ACR-03] + [BE-ACR-11] — account-recovery evidence files.
-- Private storage metadata only; bytes live behind authenticated proxy.
-- Migration number 331 is locked. Idempotent. Do not renumber.

CREATE TABLE IF NOT EXISTS public.account_recovery_evidence_files (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES public.account_recovery_cases(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  storage_key TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  uploaded_by_kind TEXT NOT NULL DEFAULT 'applicant',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'chk_account_recovery_evidence_uploaded_by_kind'
       AND conrelid = 'public.account_recovery_evidence_files'::regclass
  ) THEN
    ALTER TABLE public.account_recovery_evidence_files
      ADD CONSTRAINT chk_account_recovery_evidence_uploaded_by_kind
      CHECK (uploaded_by_kind IN ('applicant', 'system', 'admin'));
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_account_recovery_evidence_storage_key
  ON public.account_recovery_evidence_files (storage_key);

CREATE INDEX IF NOT EXISTS idx_account_recovery_evidence_case_id
  ON public.account_recovery_evidence_files (case_id);

CREATE INDEX IF NOT EXISTS idx_account_recovery_evidence_case_uploaded_at
  ON public.account_recovery_evidence_files (case_id, uploaded_at ASC);

COMMENT ON TABLE public.account_recovery_evidence_files IS
  'WF-04 account-recovery evidence metadata. Bytes are private; PA serves via authenticated proxy only.';

COMMENT ON COLUMN public.account_recovery_evidence_files.storage_key IS
  'Opaque private-store key. NEVER expose in API JSON or unsigned URLs.';

COMMENT ON COLUMN public.account_recovery_evidence_files.uploaded_by_kind IS
  'applicant (public multipart upload), system, or admin.';
