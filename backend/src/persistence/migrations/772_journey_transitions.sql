-- Wave 2E — journey_transitions (explainability: why each edge was taken).

CREATE TABLE IF NOT EXISTS public.journey_transitions (
  id TEXT PRIMARY KEY,
  journey_run_id TEXT NOT NULL
    REFERENCES public.journey_runs(id) ON DELETE CASCADE,
  from_node TEXT,
  to_node TEXT,
  reason JSONB NOT NULL DEFAULT '{}'::jsonb,
  agency_id TEXT REFERENCES public.agencies(id) ON DELETE SET NULL,
  agent_id TEXT REFERENCES public.agents(id) ON DELETE SET NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_journey_transitions_run
  ON public.journey_transitions (journey_run_id);
CREATE INDEX IF NOT EXISTS idx_journey_transitions_agency
  ON public.journey_transitions (agency_id);
CREATE INDEX IF NOT EXISTS idx_journey_transitions_agent
  ON public.journey_transitions (agent_id);
CREATE INDEX IF NOT EXISTS idx_journey_transitions_occurred
  ON public.journey_transitions (occurred_at);

DO $$ BEGIN
  CREATE ROLE growth_os_app_role NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.journey_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_transitions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS journey_transitions_tenant_guc ON public.journey_transitions;
CREATE POLICY journey_transitions_tenant_guc ON public.journey_transitions
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.journey_transitions TO growth_os_app_role;
