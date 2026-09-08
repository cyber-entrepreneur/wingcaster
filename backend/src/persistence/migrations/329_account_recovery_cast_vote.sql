-- BE-BLOCKER-22 / PA-ACR-002 — two-person cast-vote state for account recovery.
-- Idempotent. Do not renumber.

ALTER TABLE public.account_recovery_cases
  ADD COLUMN IF NOT EXISTS first_vote_reviewer_id TEXT,
  ADD COLUMN IF NOT EXISTS first_vote TEXT,
  ADD COLUMN IF NOT EXISTS first_vote_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_vote_notes TEXT,
  ADD COLUMN IF NOT EXISTS second_vote_reviewer_id TEXT,
  ADD COLUMN IF NOT EXISTS second_vote TEXT,
  ADD COLUMN IF NOT EXISTS second_vote_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS second_vote_notes TEXT,
  ADD COLUMN IF NOT EXISTS approval_request_id UUID,
  ADD COLUMN IF NOT EXISTS escalation_approval_request_id UUID,
  ADD COLUMN IF NOT EXISTS account_value_tier TEXT,
  ADD COLUMN IF NOT EXISTS requires_two_person BOOLEAN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'chk_account_recovery_cases_first_vote'
       AND conrelid = 'public.account_recovery_cases'::regclass
  ) THEN
    ALTER TABLE public.account_recovery_cases
      ADD CONSTRAINT chk_account_recovery_cases_first_vote
      CHECK (first_vote IS NULL OR first_vote IN ('approve', 'reject'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'chk_account_recovery_cases_second_vote'
       AND conrelid = 'public.account_recovery_cases'::regclass
  ) THEN
    ALTER TABLE public.account_recovery_cases
      ADD CONSTRAINT chk_account_recovery_cases_second_vote
      CHECK (second_vote IS NULL OR second_vote IN ('approve', 'reject'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'chk_account_recovery_cases_account_value_tier'
       AND conrelid = 'public.account_recovery_cases'::regclass
  ) THEN
    ALTER TABLE public.account_recovery_cases
      ADD CONSTRAINT chk_account_recovery_cases_account_value_tier
      CHECK (
        account_value_tier IS NULL
        OR account_value_tier IN ('standard', 'elevated', 'high_value')
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'fk_account_recovery_cases_approval_request'
       AND conrelid = 'public.account_recovery_cases'::regclass
  ) THEN
    ALTER TABLE public.account_recovery_cases
      ADD CONSTRAINT fk_account_recovery_cases_approval_request
      FOREIGN KEY (approval_request_id) REFERENCES fin.approval_requests(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'fk_account_recovery_cases_escalation_approval_request'
       AND conrelid = 'public.account_recovery_cases'::regclass
  ) THEN
    ALTER TABLE public.account_recovery_cases
      ADD CONSTRAINT fk_account_recovery_cases_escalation_approval_request
      FOREIGN KEY (escalation_approval_request_id) REFERENCES fin.approval_requests(id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_account_recovery_cases_approval_request_id
  ON public.account_recovery_cases (approval_request_id)
  WHERE approval_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_account_recovery_cases_first_vote_reviewer
  ON public.account_recovery_cases (first_vote_reviewer_id)
  WHERE first_vote_reviewer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_account_recovery_cases_requires_two_person
  ON public.account_recovery_cases (requires_two_person)
  WHERE requires_two_person IS TRUE;
