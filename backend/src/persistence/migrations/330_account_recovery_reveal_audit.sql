-- BE-BLOCKER-21 / [BE-ACR-06] — immutable PII reveal-audit + rate-limit storage.
-- Idempotent. Do not renumber (migration 330 is locked for Agent 2).

CREATE TABLE IF NOT EXISTS public.account_recovery_reveal_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id TEXT NOT NULL,
  reviewer_id TEXT NOT NULL,
  field TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Append-only table still carries updated_at so the generic DAL insert path
-- (which always writes created_at/updated_at) succeeds without forking.
ALTER TABLE public.account_recovery_reveal_audit
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'fk_account_recovery_reveal_audit_case'
       AND conrelid = 'public.account_recovery_reveal_audit'::regclass
  ) THEN
    ALTER TABLE public.account_recovery_reveal_audit
      ADD CONSTRAINT fk_account_recovery_reveal_audit_case
      FOREIGN KEY (case_id) REFERENCES public.account_recovery_cases(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'chk_account_recovery_reveal_audit_field'
       AND conrelid = 'public.account_recovery_reveal_audit'::regclass
  ) THEN
    ALTER TABLE public.account_recovery_reveal_audit
      ADD CONSTRAINT chk_account_recovery_reveal_audit_field
      CHECK (field IN (
        'email', 'phone', 'username', 'ip', 'row', 'name', 'contact', 'user_agent'
      ));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_account_recovery_reveal_audit_reviewer_created
  ON public.account_recovery_reveal_audit (reviewer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_recovery_reveal_audit_case_created
  ON public.account_recovery_reveal_audit (case_id, created_at DESC);

-- Append-only intent: revoke UPDATE/DELETE from common app roles when present.
DO $$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['fin_app_role', 'app_role', 'wingcaster']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'REVOKE UPDATE, DELETE ON public.account_recovery_reveal_audit FROM %I',
        role_name
      );
      EXECUTE format(
        'GRANT SELECT, INSERT ON public.account_recovery_reveal_audit TO %I',
        role_name
      );
    END IF;
  END LOOP;
END
$$;
