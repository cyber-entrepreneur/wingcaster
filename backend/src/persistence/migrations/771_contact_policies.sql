-- Wave 2E — contact_policies (global frequency / quiet-hours / do-not-contact layer).
-- Strict tenant RLS mirrors migration 551 / 601.

CREATE TABLE IF NOT EXISTS public.contact_policies (
  id TEXT PRIMARY KEY,
  agency_id TEXT REFERENCES public.agencies(id) ON DELETE SET NULL,
  agent_id TEXT REFERENCES public.agents(id) ON DELETE SET NULL,
  scope TEXT NOT NULL DEFAULT 'agency',
  name TEXT NOT NULL DEFAULT 'Default contact policy',
  rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT contact_policies_scope_check
    CHECK (public.growth_os_is_contact_policy_scope(scope))
);

CREATE INDEX IF NOT EXISTS idx_contact_policies_agency
  ON public.contact_policies (agency_id);
CREATE INDEX IF NOT EXISTS idx_contact_policies_agent
  ON public.contact_policies (agent_id);
CREATE INDEX IF NOT EXISTS idx_contact_policies_scope
  ON public.contact_policies (scope);

-- One active agency-scoped policy per agency (expand-contract; unique when agency scope).
CREATE UNIQUE INDEX IF NOT EXISTS uq_contact_policies_agency_scope
  ON public.contact_policies (agency_id)
  WHERE scope = 'agency' AND agency_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_contact_policies_agent_scope
  ON public.contact_policies (agent_id)
  WHERE scope = 'agent' AND agent_id IS NOT NULL;

DO $$ BEGIN
  CREATE ROLE growth_os_app_role NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.contact_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_policies FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contact_policies_tenant_guc ON public.contact_policies;
CREATE POLICY contact_policies_tenant_guc ON public.contact_policies
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_policies TO growth_os_app_role;
