-- BE-ACR-05 / PA-ACR-001 — env-scope account_recovery_cases (LIVE ≠ TEST).
-- Idempotent. Do not renumber. Migration 332 reserved for Agent 4 (tier + env).

ALTER TABLE public.account_recovery_cases
  ADD COLUMN IF NOT EXISTS environment TEXT;

UPDATE public.account_recovery_cases
   SET environment = 'LIVE'
 WHERE environment IS NULL;

ALTER TABLE public.account_recovery_cases
  ALTER COLUMN environment SET DEFAULT 'LIVE';

ALTER TABLE public.account_recovery_cases
  ALTER COLUMN environment SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'chk_account_recovery_cases_environment'
       AND conrelid = 'public.account_recovery_cases'::regclass
  ) THEN
    ALTER TABLE public.account_recovery_cases
      ADD CONSTRAINT chk_account_recovery_cases_environment
      CHECK (environment IN ('LIVE', 'TEST'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_account_recovery_cases_environment_status_created
  ON public.account_recovery_cases (environment, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_recovery_cases_environment_id
  ON public.account_recovery_cases (environment, id);
