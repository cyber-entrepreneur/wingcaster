-- AGN-REP-008 — Agency custom report definitions.
-- IDs are TEXT to match public.agencies / public.users (002_identity_org).

CREATE TABLE IF NOT EXISTS public.agency_custom_reports (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  agency_id TEXT NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  definition JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agency_custom_reports_agency_updated
  ON public.agency_custom_reports (agency_id, updated_at DESC);

COMMENT ON TABLE public.agency_custom_reports IS
  'Saved custom report definitions for AGN-REP-008 (metrics, dimensions, filters).';
