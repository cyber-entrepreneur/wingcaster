-- BE-BLOCKER-06 — Promote agency_applications out of legacy_collections.
-- Idempotent: CREATE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, ON CONFLICT DO NOTHING.

CREATE TABLE IF NOT EXISTS public.agency_applications (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  applicant_user_id TEXT NULL REFERENCES public.users(id) ON DELETE SET NULL,
  agent_email TEXT,
  agent_name TEXT,
  agent_phone TEXT,
  message TEXT,
  current_listings_count INTEGER,
  portfolio_url TEXT,
  availability TEXT,
  referral_source TEXT,
  profile_share_consent BOOLEAN NOT NULL DEFAULT false,
  invitation_code TEXT NULL,
  expected_response_by TIMESTAMPTZ NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_at TIMESTAMPTZ NULL,
  approved_by TEXT NULL,
  approved_role TEXT NULL,
  affiliation_mode TEXT NULL,
  rejected_at TIMESTAMPTZ NULL,
  rejected_by TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Defensive column adds for environments that created an earlier stub table.
ALTER TABLE public.agency_applications
  ADD COLUMN IF NOT EXISTS agency_id TEXT,
  ADD COLUMN IF NOT EXISTS applicant_user_id TEXT,
  ADD COLUMN IF NOT EXISTS agent_email TEXT,
  ADD COLUMN IF NOT EXISTS agent_name TEXT,
  ADD COLUMN IF NOT EXISTS agent_phone TEXT,
  ADD COLUMN IF NOT EXISTS message TEXT,
  ADD COLUMN IF NOT EXISTS current_listings_count INTEGER,
  ADD COLUMN IF NOT EXISTS portfolio_url TEXT,
  ADD COLUMN IF NOT EXISTS availability TEXT,
  ADD COLUMN IF NOT EXISTS referral_source TEXT,
  ADD COLUMN IF NOT EXISTS profile_share_consent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invitation_code TEXT,
  ADD COLUMN IF NOT EXISTS expected_response_by TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by TEXT,
  ADD COLUMN IF NOT EXISTS approved_role TEXT,
  ADD COLUMN IF NOT EXISTS affiliation_mode TEXT,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_by TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_agency_applications_agency_id
  ON public.agency_applications(agency_id);

CREATE INDEX IF NOT EXISTS idx_agency_applications_status
  ON public.agency_applications(status);

CREATE INDEX IF NOT EXISTS idx_agency_applications_applicant_user_id
  ON public.agency_applications(applicant_user_id);

CREATE INDEX IF NOT EXISTS idx_agency_applications_agency_email_pending
  ON public.agency_applications(agency_id, agent_email)
  WHERE status = 'pending';

COMMENT ON TABLE public.agency_applications IS
  'Agent join applications (AGN-MEM-005). Promoted from legacy_collections in migration 324.';

COMMENT ON COLUMN public.agency_applications.availability IS
  'Enum-ish: immediately | within_2_weeks | within_a_month | just_exploring (validated in Zod).';

COMMENT ON COLUMN public.agency_applications.expected_response_by IS
  'SLA target: created_at + 2 calendar days (no business-day calendar in-repo yet).';

-- Backfill from legacy JSONB bucket. Skip rows whose agency_id is missing or
-- does not resolve (FK would fail). Preserve approve/reject writer fields.
INSERT INTO public.agency_applications (
  id,
  agency_id,
  applicant_user_id,
  agent_email,
  agent_name,
  agent_phone,
  message,
  current_listings_count,
  portfolio_url,
  availability,
  referral_source,
  profile_share_consent,
  invitation_code,
  expected_response_by,
  status,
  approved_at,
  approved_by,
  approved_role,
  affiliation_mode,
  rejected_at,
  rejected_by,
  created_at,
  updated_at,
  data
)
SELECT
  lc.id,
  lc.data->>'agency_id',
  NULLIF(lc.data->>'applicant_user_id', ''),
  NULLIF(lc.data->>'agent_email', ''),
  NULLIF(lc.data->>'agent_name', ''),
  NULLIF(lc.data->>'agent_phone', ''),
  NULLIF(lc.data->>'message', ''),
  CASE
    WHEN (lc.data ? 'current_listings_count')
      AND (lc.data->>'current_listings_count') ~ '^-?[0-9]+$'
    THEN (lc.data->>'current_listings_count')::integer
    ELSE NULL
  END,
  NULLIF(lc.data->>'portfolio_url', ''),
  NULLIF(lc.data->>'availability', ''),
  NULLIF(lc.data->>'referral_source', ''),
  COALESCE((lc.data->>'profile_share_consent')::boolean, false),
  NULLIF(lc.data->>'invitation_code', ''),
  CASE
    WHEN lc.data ? 'expected_response_by'
      AND NULLIF(lc.data->>'expected_response_by', '') IS NOT NULL
    THEN (lc.data->>'expected_response_by')::timestamptz
    ELSE NULL
  END,
  COALESCE(NULLIF(lc.data->>'status', ''), 'pending'),
  CASE
    WHEN NULLIF(lc.data->>'approved_at', '') IS NOT NULL
    THEN (lc.data->>'approved_at')::timestamptz
    ELSE NULL
  END,
  NULLIF(lc.data->>'approved_by', ''),
  NULLIF(lc.data->>'approved_role', ''),
  NULLIF(lc.data->>'affiliation_mode', ''),
  CASE
    WHEN NULLIF(lc.data->>'rejected_at', '') IS NOT NULL
    THEN (lc.data->>'rejected_at')::timestamptz
    ELSE NULL
  END,
  NULLIF(lc.data->>'rejected_by', ''),
  COALESCE(lc.created_at, CURRENT_TIMESTAMP),
  COALESCE(lc.updated_at, lc.created_at, CURRENT_TIMESTAMP),
  COALESCE(lc.data, '{}'::jsonb)
FROM public.legacy_collections lc
WHERE lc.collection = 'agency_applications'
  AND NULLIF(lc.data->>'agency_id', '') IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.agencies a WHERE a.id = lc.data->>'agency_id'
  )
ON CONFLICT (id) DO NOTHING;

-- Safe cleanup of successfully copied legacy rows (idempotent).
DELETE FROM public.legacy_collections lc
WHERE lc.collection = 'agency_applications'
  AND EXISTS (
    SELECT 1 FROM public.agency_applications aa WHERE aa.id = lc.id
  );
