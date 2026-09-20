-- Wave 2D — experiments + experiment_assignments (strict RLS, mirror mig 551 / 731).

CREATE TABLE IF NOT EXISTS public.experiments (
  id TEXT PRIMARY KEY,
  campaign_id TEXT,
  dimension TEXT NOT NULL,
  variants JSONB NOT NULL DEFAULT '[]'::jsonb,
  allocation TEXT NOT NULL DEFAULT 'even',
  holdout_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
  goal_event TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  agency_id TEXT REFERENCES public.agencies(id) ON DELETE SET NULL,
  agent_id TEXT REFERENCES public.agents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT experiments_dimension_check
    CHECK (public.growth_os_is_experiment_dimension(dimension)),
  CONSTRAINT experiments_allocation_check
    CHECK (public.growth_os_is_experiment_allocation(allocation)),
  CONSTRAINT experiments_status_check
    CHECK (public.growth_os_is_experiment_status(status)),
  CONSTRAINT experiments_holdout_pct_range
    CHECK (holdout_pct >= 0 AND holdout_pct <= 100)
);

CREATE INDEX IF NOT EXISTS idx_experiments_agency
  ON public.experiments (agency_id);
CREATE INDEX IF NOT EXISTS idx_experiments_agent
  ON public.experiments (agent_id);
CREATE INDEX IF NOT EXISTS idx_experiments_campaign
  ON public.experiments (campaign_id)
  WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_experiments_status
  ON public.experiments (status);
CREATE INDEX IF NOT EXISTS idx_experiments_dimension
  ON public.experiments (dimension);

CREATE TABLE IF NOT EXISTS public.experiment_assignments (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL
    REFERENCES public.experiments(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL
    REFERENCES public.contacts(id) ON DELETE CASCADE,
  variant TEXT NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  assignment_reason TEXT NOT NULL,
  model_version TEXT NOT NULL,
  agency_id TEXT REFERENCES public.agencies(id) ON DELETE SET NULL,
  agent_id TEXT REFERENCES public.agents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_experiment_assignments_exp_contact
  ON public.experiment_assignments (experiment_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_experiment_assignments_experiment
  ON public.experiment_assignments (experiment_id);
CREATE INDEX IF NOT EXISTS idx_experiment_assignments_contact
  ON public.experiment_assignments (contact_id);
CREATE INDEX IF NOT EXISTS idx_experiment_assignments_variant
  ON public.experiment_assignments (variant);
CREATE INDEX IF NOT EXISTS idx_experiment_assignments_agency
  ON public.experiment_assignments (agency_id);
CREATE INDEX IF NOT EXISTS idx_experiment_assignments_agent
  ON public.experiment_assignments (agent_id);

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

ALTER TABLE public.experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.experiment_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiment_assignments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS experiments_tenant_guc ON public.experiments;
CREATE POLICY experiments_tenant_guc ON public.experiments
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

DROP POLICY IF EXISTS experiment_assignments_tenant_guc ON public.experiment_assignments;
CREATE POLICY experiment_assignments_tenant_guc ON public.experiment_assignments
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.experiments TO growth_os_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.experiment_assignments TO growth_os_app_role;
