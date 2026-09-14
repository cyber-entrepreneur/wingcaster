-- BE-BLOCKER-31 / WF-31 — ownership_transfer_requests + OTP purpose extension.
-- File: 340_ownership_transfer_requests.sql
--
-- Status enum (Week 7 prompt authoritative):
--   pending | accepted | declined | cancelled | expired | executed | reversed
-- UX aliases such as pending_recipient_accept map to `pending` in DB/API.
--
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- Extend auth_challenges.purpose to include ownership_transfer_initiate
-- without clobbering any values another migration may have added.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  def text;
  purposes text[];
BEGIN
  SELECT pg_get_constraintdef(c.oid)
    INTO def
    FROM pg_constraint c
   WHERE c.conname = 'auth_challenges_purpose_check'
     AND c.conrelid = 'public.auth_challenges'::regclass;

  IF def IS NOT NULL AND def ILIKE '%''ownership_transfer_initiate''%' THEN
    RETURN;
  END IF;

  IF def IS NOT NULL THEN
    SELECT array_agg(match[1] ORDER BY ordinality)
      INTO purposes
      FROM regexp_matches(def, '''([^'']+)''', 'g') WITH ORDINALITY AS t(match, ordinality);
  END IF;

  IF purposes IS NULL OR array_length(purposes, 1) IS NULL THEN
    purposes := ARRAY['signin', 'stepup'];
  END IF;

  IF NOT ('ownership_transfer_initiate' = ANY (purposes)) THEN
    purposes := array_append(purposes, 'ownership_transfer_initiate');
  END IF;

  ALTER TABLE public.auth_challenges
    DROP CONSTRAINT IF EXISTS auth_challenges_purpose_check;

  EXECUTE format(
    'ALTER TABLE public.auth_challenges
       ADD CONSTRAINT auth_challenges_purpose_check
       CHECK (purpose IN (%s))',
    (SELECT string_agg(quote_literal(p), ', ') FROM unnest(purposes) AS p)
  );
END $$;

-- ---------------------------------------------------------------------------
-- ownership_transfer_requests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ownership_transfer_requests (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  initiator_user_id TEXT NOT NULL REFERENCES public.users(id),
  target_user_id TEXT NOT NULL REFERENCES public.users(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',
      'accepted',
      'declined',
      'cancelled',
      'expired',
      'executed',
      'reversed'
    )),
  rationale TEXT NOT NULL CHECK (char_length(btrim(rationale)) >= 20),
  decline_reason TEXT,
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '14 days'),
  decided_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  reversed_at TIMESTAMPTZ,
  reversal_deadline_at TIMESTAMPTZ,
  acknowledged_by_initiator BOOLEAN NOT NULL DEFAULT FALSE,
  acknowledged_by_target BOOLEAN NOT NULL DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT ownership_transfer_requests_parties_distinct
    CHECK (initiator_user_id <> target_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ownership_transfer_one_pending_per_agency
  ON public.ownership_transfer_requests(agency_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_ownership_transfer_agency_status
  ON public.ownership_transfer_requests(agency_id, status);

CREATE INDEX IF NOT EXISTS idx_ownership_transfer_target_pending
  ON public.ownership_transfer_requests(target_user_id, status);

CREATE INDEX IF NOT EXISTS idx_ownership_transfer_expires_at
  ON public.ownership_transfer_requests(expires_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_ownership_transfer_reversal_deadline
  ON public.ownership_transfer_requests(reversal_deadline_at)
  WHERE status = 'executed';
