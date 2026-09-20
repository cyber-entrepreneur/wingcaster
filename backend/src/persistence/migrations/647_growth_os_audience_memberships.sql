-- Wave 1D — audience_memberships (consent-aware membership rows; strict RLS).
-- contact_id is nullable TEXT without FK (Wave 1 cross-module rule).

CREATE TABLE IF NOT EXISTS public.audience_memberships (
  id TEXT PRIMARY KEY,
  audience_id TEXT NOT NULL,
  contact_id TEXT,
  state TEXT NOT NULL DEFAULT 'matched',
  qualified_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ,
  inclusion TEXT NOT NULL DEFAULT 'include',
  agency_id TEXT REFERENCES public.agencies(id) ON DELETE SET NULL,
  agent_id TEXT REFERENCES public.agents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT audience_memberships_state_check
    CHECK (public.growth_os_is_audience_membership_state(state)),
  CONSTRAINT audience_memberships_inclusion_check
    CHECK (public.growth_os_is_audience_inclusion(inclusion))
);

CREATE INDEX IF NOT EXISTS idx_audience_memberships_audience_id
  ON public.audience_memberships (audience_id);
CREATE INDEX IF NOT EXISTS idx_audience_memberships_contact_id
  ON public.audience_memberships (contact_id);
CREATE INDEX IF NOT EXISTS idx_audience_memberships_agency_id
  ON public.audience_memberships (agency_id);
CREATE INDEX IF NOT EXISTS idx_audience_memberships_agent_id
  ON public.audience_memberships (agent_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_audience_memberships_audience_contact
  ON public.audience_memberships (audience_id, contact_id)
  WHERE contact_id IS NOT NULL;

ALTER TABLE public.audience_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audience_memberships FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audience_memberships_tenant_guc ON public.audience_memberships;
CREATE POLICY audience_memberships_tenant_guc ON public.audience_memberships
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.audience_memberships TO growth_os_app_role;
