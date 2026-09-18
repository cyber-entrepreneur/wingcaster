-- AGN-SET-006 — Agency deletion workflow (WF-32).
--
-- Owners can schedule agency deletion after a 30-day cool-down. Requests are
-- tracked separately from user account deletion_requests.

CREATE TABLE IF NOT EXISTS public.agency_deletion_requests (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  requested_by TEXT NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'cancelled', 'completed')),
  liveness_word_hash TEXT,
  reason TEXT,
  notes TEXT,
  typed_agency_name TEXT,
  scheduled_for TIMESTAMPTZ,
  draft_expires_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_agency_deletion_requests_agency_status
  ON public.agency_deletion_requests(agency_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agency_deletion_requests_scheduled
  ON public.agency_deletion_requests(scheduled_for)
  WHERE status = 'scheduled';

ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS deletion_scheduled_for TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
