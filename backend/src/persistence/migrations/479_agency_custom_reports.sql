-- AGN-REP-008 — Agency custom report definitions.

CREATE TABLE IF NOT EXISTS public.agency_custom_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  definition JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.users(id),
  updated_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agency_custom_reports_agency_updated
  ON public.agency_custom_reports (agency_id, updated_at DESC);

COMMENT ON TABLE public.agency_custom_reports IS
  'Saved custom report definitions for AGN-REP-008 (metrics, dimensions, filters).';
