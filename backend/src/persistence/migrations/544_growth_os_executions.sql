-- Growth-OS Wave 0 — executions + execution_attempts (RLS).
-- campaign_id / creative_id / audience_id / journey_node_run_id are plain TEXT
-- (nullable, indexed). FK constraints land when those tables exist in later waves.

CREATE TABLE IF NOT EXISTS public.executions (
  id TEXT PRIMARY KEY,
  campaign_id TEXT,                 -- FK added when campaigns land
  journey_node_run_id TEXT,         -- FK added when journey_node_runs land
  agency_id TEXT REFERENCES public.agencies(id) ON DELETE SET NULL,
  agent_id TEXT REFERENCES public.agents(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  channel_connection_id TEXT
    REFERENCES public.channel_connections(id) ON DELETE SET NULL,
  creative_id TEXT,                 -- FK added when creatives land
  audience_id TEXT,                 -- FK added when audiences land
  subject_type TEXT,
  subject_id TEXT,
  scheduled_at TIMESTAMPTZ,
  recurrence TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  provider_ref TEXT,
  published_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT executions_kind_check
    CHECK (public.growth_os_is_execution_kind(kind)),
  CONSTRAINT executions_status_check
    CHECK (public.growth_os_is_execution_status(status))
);

CREATE INDEX IF NOT EXISTS idx_executions_agency ON public.executions (agency_id);
CREATE INDEX IF NOT EXISTS idx_executions_agent ON public.executions (agent_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON public.executions (status);
CREATE INDEX IF NOT EXISTS idx_executions_kind ON public.executions (kind);
CREATE INDEX IF NOT EXISTS idx_executions_channel_connection
  ON public.executions (channel_connection_id);
CREATE INDEX IF NOT EXISTS idx_executions_campaign ON public.executions (campaign_id);
CREATE INDEX IF NOT EXISTS idx_executions_scheduled_at ON public.executions (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_executions_subject
  ON public.executions (subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_executions_legacy_source
  ON public.executions ((data #>> '{legacy_source,table}'), (data #>> '{legacy_source,id}'));

CREATE TABLE IF NOT EXISTS public.execution_attempts (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL
    REFERENCES public.executions(id) ON DELETE CASCADE,
  status TEXT,
  response JSONB,
  error_message TEXT,
  error_class TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_execution_attempts_execution
  ON public.execution_attempts (execution_id);
CREATE INDEX IF NOT EXISTS idx_execution_attempts_attempted_at
  ON public.execution_attempts (attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_attempts_legacy_source
  ON public.execution_attempts ((data #>> '{legacy_source,table}'), (data #>> '{legacy_source,id}'));

DO $$ BEGIN
  CREATE ROLE growth_os_app_role NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.executions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.execution_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_attempts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS executions_tenant_guc ON public.executions;
CREATE POLICY executions_tenant_guc ON public.executions
  FOR ALL
  USING (
    NULLIF(current_setting('app.agency_id', true), '') IS NULL
    OR agency_id = NULLIF(current_setting('app.agency_id', true), '')
    OR (
      NULLIF(current_setting('app.agent_id', true), '') IS NOT NULL
      AND agent_id = NULLIF(current_setting('app.agent_id', true), '')
    )
  )
  WITH CHECK (
    NULLIF(current_setting('app.agency_id', true), '') IS NULL
    OR agency_id = NULLIF(current_setting('app.agency_id', true), '')
    OR (
      NULLIF(current_setting('app.agent_id', true), '') IS NOT NULL
      AND agent_id = NULLIF(current_setting('app.agent_id', true), '')
    )
  );

-- Attempts inherit tenancy via parent execution.
DROP POLICY IF EXISTS execution_attempts_tenant_guc ON public.execution_attempts;
CREATE POLICY execution_attempts_tenant_guc ON public.execution_attempts
  FOR ALL
  USING (
    NULLIF(current_setting('app.agency_id', true), '') IS NULL
    OR EXISTS (
      SELECT 1 FROM public.executions e
      WHERE e.id = execution_id
        AND (
          e.agency_id = NULLIF(current_setting('app.agency_id', true), '')
          OR (
            NULLIF(current_setting('app.agent_id', true), '') IS NOT NULL
            AND e.agent_id = NULLIF(current_setting('app.agent_id', true), '')
          )
        )
    )
  )
  WITH CHECK (
    NULLIF(current_setting('app.agency_id', true), '') IS NULL
    OR EXISTS (
      SELECT 1 FROM public.executions e
      WHERE e.id = execution_id
        AND (
          e.agency_id = NULLIF(current_setting('app.agency_id', true), '')
          OR (
            NULLIF(current_setting('app.agent_id', true), '') IS NOT NULL
            AND e.agent_id = NULLIF(current_setting('app.agent_id', true), '')
          )
        )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.executions TO growth_os_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.execution_attempts TO growth_os_app_role;

DO $$ BEGIN
  GRANT growth_os_app_role TO CURRENT_USER;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
