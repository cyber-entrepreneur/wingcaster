-- BE-BLOCKER-03 / Wave 0.5 Agent 1
-- Add typed error_class on distribution_attempts for publish retry policy.
-- Idempotent: safe to re-run; CHECK added only when missing.
--
-- Also add created_at: the DAL always names created_at/updated_at on mapped
-- tables (see 042_missing_updated_at.sql). 042 patched updated_at but left
-- created_at absent, so every DAL INSERT into this table failed. Required for
-- the publishing pipeline to record attempts.

ALTER TABLE public.distribution_attempts
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public.distribution_attempts
  ADD COLUMN IF NOT EXISTS error_class TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'public.distribution_attempts'::regclass
       AND conname = 'distribution_attempts_error_class_check'
  ) THEN
    ALTER TABLE public.distribution_attempts
      ADD CONSTRAINT distribution_attempts_error_class_check
      CHECK (
        error_class IS NULL
        OR error_class IN (
          'auth_expired',
          'portal_rules_violation',
          'portal_down',
          'quota_exceeded',
          'invalid_content',
          'unknown_error'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_distribution_attempts_error_class
  ON public.distribution_attempts(error_class)
  WHERE error_class IS NOT NULL;

COMMENT ON COLUMN public.distribution_attempts.error_class IS
  'Normalized publish failure class: auth_expired | portal_rules_violation | portal_down | quota_exceeded | invalid_content | unknown_error';
