-- Wave 1A — journeys, journey_versions, journey_runs, journey_node_runs (strict RLS).

CREATE TABLE IF NOT EXISTS public.journeys (
  id TEXT PRIMARY KEY,
  agency_id TEXT REFERENCES public.agencies(id) ON DELETE SET NULL,
  agent_id TEXT REFERENCES public.agents(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  trigger TEXT,
  entry_audience_id TEXT,
  goal_event TEXT,
  suppression JSONB NOT NULL DEFAULT '{}'::jsonb,
  legacy_campaign_id TEXT,
  tags_filter JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_channel TEXT,
  audience_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT journeys_status_check
    CHECK (public.growth_os_is_journey_status(status))
);

CREATE INDEX IF NOT EXISTS idx_journeys_agency ON public.journeys (agency_id);
CREATE INDEX IF NOT EXISTS idx_journeys_agent ON public.journeys (agent_id);
CREATE INDEX IF NOT EXISTS idx_journeys_status ON public.journeys (status);
CREATE INDEX IF NOT EXISTS idx_journeys_legacy_campaign
  ON public.journeys (legacy_campaign_id);
CREATE INDEX IF NOT EXISTS idx_journeys_entry_audience
  ON public.journeys (entry_audience_id);

CREATE TABLE IF NOT EXISTS public.journey_versions (
  id TEXT PRIMARY KEY,
  journey_id TEXT NOT NULL
    REFERENCES public.journeys(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  graph JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT journey_versions_version_positive CHECK (version > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_journey_versions_journey_version
  ON public.journey_versions (journey_id, version);
CREATE INDEX IF NOT EXISTS idx_journey_versions_journey
  ON public.journey_versions (journey_id);

CREATE TABLE IF NOT EXISTS public.journey_runs (
  id TEXT PRIMARY KEY,
  journey_version_id TEXT NOT NULL
    REFERENCES public.journey_versions(id) ON DELETE RESTRICT,
  contact_id TEXT REFERENCES public.contacts(id) ON DELETE SET NULL,
  agency_id TEXT REFERENCES public.agencies(id) ON DELETE SET NULL,
  agent_id TEXT REFERENCES public.agents(id) ON DELETE SET NULL,
  current_node_id TEXT,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  entered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  exited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT journey_runs_status_check
    CHECK (public.growth_os_is_journey_run_status(status))
);

CREATE INDEX IF NOT EXISTS idx_journey_runs_version
  ON public.journey_runs (journey_version_id);
CREATE INDEX IF NOT EXISTS idx_journey_runs_contact
  ON public.journey_runs (contact_id);
CREATE INDEX IF NOT EXISTS idx_journey_runs_agency
  ON public.journey_runs (agency_id);
CREATE INDEX IF NOT EXISTS idx_journey_runs_agent
  ON public.journey_runs (agent_id);
CREATE INDEX IF NOT EXISTS idx_journey_runs_status
  ON public.journey_runs (status);

CREATE TABLE IF NOT EXISTS public.journey_node_runs (
  id TEXT PRIMARY KEY,
  journey_run_id TEXT NOT NULL
    REFERENCES public.journey_runs(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  node_type TEXT NOT NULL,
  agency_id TEXT REFERENCES public.agencies(id) ON DELETE SET NULL,
  agent_id TEXT REFERENCES public.agents(id) ON DELETE SET NULL,
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  execution_id TEXT,
  creative_id TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT journey_node_runs_type_check
    CHECK (public.growth_os_is_journey_node_type(node_type))
);

CREATE INDEX IF NOT EXISTS idx_journey_node_runs_run
  ON public.journey_node_runs (journey_run_id);
CREATE INDEX IF NOT EXISTS idx_journey_node_runs_execution
  ON public.journey_node_runs (execution_id);
CREATE INDEX IF NOT EXISTS idx_journey_node_runs_creative
  ON public.journey_node_runs (creative_id);
CREATE INDEX IF NOT EXISTS idx_journey_node_runs_agency
  ON public.journey_node_runs (agency_id);
CREATE INDEX IF NOT EXISTS idx_journey_node_runs_agent
  ON public.journey_node_runs (agent_id);

-- ---------------------------------------------------------------------------
-- Strict RLS (mirror migration 551)
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE ROLE growth_os_app_role NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journeys FORCE ROW LEVEL SECURITY;
ALTER TABLE public.journey_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.journey_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.journey_node_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_node_runs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS journeys_tenant_guc ON public.journeys;
CREATE POLICY journeys_tenant_guc ON public.journeys
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

DROP POLICY IF EXISTS journey_versions_tenant_guc ON public.journey_versions;
CREATE POLICY journey_versions_tenant_guc ON public.journey_versions
  FOR ALL
  TO growth_os_app_role
  USING (
    EXISTS (
      SELECT 1 FROM public.journeys j
      WHERE j.id = journey_id
        AND (
          (
            NULLIF(current_setting('app.agency_id', true), '') IS NOT NULL
            AND j.agency_id = NULLIF(current_setting('app.agency_id', true), '')
          )
          OR (
            NULLIF(current_setting('app.agent_id', true), '') IS NOT NULL
            AND j.agent_id = NULLIF(current_setting('app.agent_id', true), '')
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.journeys j
      WHERE j.id = journey_id
        AND (
          (
            NULLIF(current_setting('app.agency_id', true), '') IS NOT NULL
            AND j.agency_id = NULLIF(current_setting('app.agency_id', true), '')
          )
          OR (
            NULLIF(current_setting('app.agent_id', true), '') IS NOT NULL
            AND j.agent_id = NULLIF(current_setting('app.agent_id', true), '')
          )
        )
    )
  );

DROP POLICY IF EXISTS journey_runs_tenant_guc ON public.journey_runs;
CREATE POLICY journey_runs_tenant_guc ON public.journey_runs
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

DROP POLICY IF EXISTS journey_node_runs_tenant_guc ON public.journey_node_runs;
CREATE POLICY journey_node_runs_tenant_guc ON public.journey_node_runs
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.journeys TO growth_os_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journey_versions TO growth_os_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journey_runs TO growth_os_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journey_node_runs TO growth_os_app_role;
