-- Wave 1D — audiences (first-class segments; strict tenant RLS).

CREATE TABLE IF NOT EXISTS public.audiences (
  id TEXT PRIMARY KEY,
  agency_id TEXT REFERENCES public.agencies(id) ON DELETE SET NULL,
  agent_id TEXT REFERENCES public.agents(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'dynamic',
  rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  member_source TEXT NOT NULL DEFAULT 'crm',
  estimated_size INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT audiences_type_check
    CHECK (public.growth_os_is_audience_type(type)),
  CONSTRAINT audiences_member_source_check
    CHECK (public.growth_os_is_audience_member_source(member_source))
);

CREATE INDEX IF NOT EXISTS idx_audiences_agency_id ON public.audiences (agency_id);
CREATE INDEX IF NOT EXISTS idx_audiences_agent_id ON public.audiences (agent_id);
CREATE INDEX IF NOT EXISTS idx_audiences_type ON public.audiences (type);

ALTER TABLE public.audiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audiences FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audiences_tenant_guc ON public.audiences;
CREATE POLICY audiences_tenant_guc ON public.audiences
  FOR ALL
  TO growth_os_app_role
  USING (
    (
      NULLIF(current_setting('app.agency_id', true), '') IS NOT NULL
      AND agency_id = NULLIF(current_setting('app.agency_id', true), '')
    )
    OR (
      NULLIF(current_setting('app.agent_id', true), '') IS NOT NULL
      AND agent_id = NULLIF(current_setting('app.agent_id', true), '')
    )
  )
  WITH CHECK (
    (
      NULLIF(current_setting('app.agency_id', true), '') IS NOT NULL
      AND agency_id = NULLIF(current_setting('app.agency_id', true), '')
    )
    OR (
      NULLIF(current_setting('app.agent_id', true), '') IS NOT NULL
      AND agent_id = NULLIF(current_setting('app.agent_id', true), '')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.audiences TO growth_os_app_role;
