-- Wave 2F — seo_pages + seo_target_preferences (strict RLS, mirror mig 551).

CREATE TABLE IF NOT EXISTS public.seo_pages (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  agency_id TEXT REFERENCES public.agencies(id) ON DELETE SET NULL,
  agent_id TEXT REFERENCES public.agents(id) ON DELETE SET NULL,
  slug TEXT NOT NULL,
  title TEXT,
  meta_description TEXT,
  canonical_url TEXT,
  og_tags JSONB NOT NULL DEFAULT '{}'::jsonb,
  schema_jsonld JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  indexed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT seo_pages_status_check
    CHECK (public.growth_os_is_seo_page_status(status))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_seo_pages_property
  ON public.seo_pages (property_id);
CREATE INDEX IF NOT EXISTS idx_seo_pages_agency
  ON public.seo_pages (agency_id);
CREATE INDEX IF NOT EXISTS idx_seo_pages_agent
  ON public.seo_pages (agent_id);
CREATE INDEX IF NOT EXISTS idx_seo_pages_status
  ON public.seo_pages (status);
CREATE INDEX IF NOT EXISTS idx_seo_pages_slug
  ON public.seo_pages (slug);

CREATE TABLE IF NOT EXISTS public.seo_target_preferences (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  property_id TEXT REFERENCES public.properties(id) ON DELETE CASCADE,
  agency_id TEXT REFERENCES public.agencies(id) ON DELETE SET NULL,
  target_surface TEXT NOT NULL,
  external_site_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT seo_target_preferences_surface_check
    CHECK (public.growth_os_is_seo_target_surface(target_surface))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_seo_target_preferences_agent_property
  ON public.seo_target_preferences (agent_id, COALESCE(property_id, ''));
CREATE INDEX IF NOT EXISTS idx_seo_target_preferences_agency
  ON public.seo_target_preferences (agency_id);

-- ---------------------------------------------------------------------------
-- Strict RLS (mirror migration 551)
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE ROLE growth_os_app_role NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  GRANT growth_os_app_role TO CURRENT_USER;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.seo_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_pages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.seo_target_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_target_preferences FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS seo_pages_tenant_guc ON public.seo_pages;
CREATE POLICY seo_pages_tenant_guc ON public.seo_pages
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

DROP POLICY IF EXISTS seo_target_preferences_tenant_guc ON public.seo_target_preferences;
CREATE POLICY seo_target_preferences_tenant_guc ON public.seo_target_preferences
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_pages TO growth_os_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_target_preferences TO growth_os_app_role;
