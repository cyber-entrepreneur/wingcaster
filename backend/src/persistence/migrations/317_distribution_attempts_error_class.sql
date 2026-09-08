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

-- Best-effort backfill from error_message. First match wins; keep aligned with
-- classifyProviderError() in backend/src/lib/publishing/error-classifier.js.
-- Leftover NULL rows (no message) are filled by the JS pass:
--   backend/src/lib/publishing/backfill-error-class.js
-- invoked from backend/scripts/start.js after migrate.
UPDATE public.distribution_attempts
   SET error_class = CASE
     WHEN error_message ~* '(token (is )?expired|expired token|session has expired|invalid (oauth |access )?token|oauthexception|unauthorized|unauthorised|\m401\M|authentication failed|access token)'
       THEN 'auth_expired'
     WHEN error_message ~* '(rate[- ]?limit|too many requests|\m429\M|quota|throttl|usage limit)'
       THEN 'quota_exceeded'
     WHEN error_message ~* '(timed? out|timeout|\m503\M|\m502\M|\m504\M|\m408\M|econnreset|econnrefused|etimedout|enotfound|service unavailable|bad gateway|temporarily unavailable)'
       THEN 'portal_down'
     WHEN error_message ~* '(\m403\M|forbidden|community standard|community guideline|policy violat|permission denied|not allowed|restricted)'
       THEN 'portal_rules_violation'
     WHEN error_message ~* '(invalid (parameter|content|media|image|video|caption)|validation|content rejected|unsupported (format|media)|caption too long|\m422\M|\m400\M)'
       THEN 'invalid_content'
     ELSE 'unknown_error'
   END
 WHERE error_class IS NULL
   AND error_message IS NOT NULL
   AND btrim(error_message) <> '';

DO $$
DECLARE
  classified int;
  unknown_count int;
BEGIN
  SELECT COUNT(*)::int INTO classified
    FROM public.distribution_attempts
   WHERE error_class IS NOT NULL;

  SELECT COUNT(*)::int INTO unknown_count
    FROM public.distribution_attempts
   WHERE error_class = 'unknown_error';

  RAISE NOTICE 'distribution_attempts error_class backfill: classified=% unknown_error=% (unclassified)',
    classified, unknown_count;
END $$;
