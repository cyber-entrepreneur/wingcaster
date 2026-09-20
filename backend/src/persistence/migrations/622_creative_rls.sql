-- Wave 1C — strict tenant RLS for creative tables (mirror mig 551).

DO $$ BEGIN
  CREATE ROLE growth_os_app_role NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  GRANT growth_os_app_role TO CURRENT_USER;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.creatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creatives FORCE ROW LEVEL SECURITY;
ALTER TABLE public.creative_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_variants FORCE ROW LEVEL SECURITY;
ALTER TABLE public.creative_renditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_renditions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests FORCE ROW LEVEL SECURITY;

-- creatives
DROP POLICY IF EXISTS creatives_tenant_guc ON public.creatives;
CREATE POLICY creatives_tenant_guc ON public.creatives
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

-- creative_variants
DROP POLICY IF EXISTS creative_variants_tenant_guc ON public.creative_variants;
CREATE POLICY creative_variants_tenant_guc ON public.creative_variants
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

-- creative_renditions
DROP POLICY IF EXISTS creative_renditions_tenant_guc ON public.creative_renditions;
CREATE POLICY creative_renditions_tenant_guc ON public.creative_renditions
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

-- approval_requests
DROP POLICY IF EXISTS approval_requests_tenant_guc ON public.approval_requests;
CREATE POLICY approval_requests_tenant_guc ON public.approval_requests
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.creatives TO growth_os_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creative_variants TO growth_os_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creative_renditions TO growth_os_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.approval_requests TO growth_os_app_role;
