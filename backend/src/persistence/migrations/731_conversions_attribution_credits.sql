-- Wave 2C — conversions + attribution_credits (strict RLS, mirror mig 551).

CREATE TABLE IF NOT EXISTS public.conversions (
  id TEXT PRIMARY KEY,
  contact_id TEXT REFERENCES public.contacts(id) ON DELETE SET NULL,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  value_micros BIGINT,
  currency TEXT,
  source_event_id TEXT NOT NULL,
  agency_id TEXT REFERENCES public.agencies(id) ON DELETE SET NULL,
  agent_id TEXT REFERENCES public.agents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT conversions_from_stage_check
    CHECK (public.growth_os_is_funnel_stage(from_stage)),
  CONSTRAINT conversions_to_stage_check
    CHECK (public.growth_os_is_funnel_stage(to_stage)),
  CONSTRAINT conversions_source_event_unique UNIQUE (source_event_id)
);

CREATE INDEX IF NOT EXISTS idx_conversions_agency
  ON public.conversions (agency_id);
CREATE INDEX IF NOT EXISTS idx_conversions_agent
  ON public.conversions (agent_id);
CREATE INDEX IF NOT EXISTS idx_conversions_contact
  ON public.conversions (contact_id);
CREATE INDEX IF NOT EXISTS idx_conversions_to_stage
  ON public.conversions (to_stage);
CREATE INDEX IF NOT EXISTS idx_conversions_occurred_at
  ON public.conversions (occurred_at);

CREATE TABLE IF NOT EXISTS public.attribution_credits (
  id TEXT PRIMARY KEY,
  conversion_id TEXT NOT NULL
    REFERENCES public.conversions(id) ON DELETE CASCADE,
  execution_id TEXT NOT NULL,
  model TEXT NOT NULL,
  credit_weight NUMERIC(12, 8) NOT NULL,
  agency_id TEXT REFERENCES public.agencies(id) ON DELETE SET NULL,
  agent_id TEXT REFERENCES public.agents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT attribution_credits_model_check
    CHECK (public.growth_os_is_attribution_model(model)),
  CONSTRAINT attribution_credits_weight_nonneg
    CHECK (credit_weight >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_attribution_credits_conv_exec_model
  ON public.attribution_credits (conversion_id, execution_id, model);
CREATE INDEX IF NOT EXISTS idx_attribution_credits_conversion
  ON public.attribution_credits (conversion_id);
CREATE INDEX IF NOT EXISTS idx_attribution_credits_execution
  ON public.attribution_credits (execution_id);
CREATE INDEX IF NOT EXISTS idx_attribution_credits_model
  ON public.attribution_credits (model);
CREATE INDEX IF NOT EXISTS idx_attribution_credits_agency
  ON public.attribution_credits (agency_id);
CREATE INDEX IF NOT EXISTS idx_attribution_credits_agent
  ON public.attribution_credits (agent_id);

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

ALTER TABLE public.conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.attribution_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attribution_credits FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conversions_tenant_guc ON public.conversions;
CREATE POLICY conversions_tenant_guc ON public.conversions
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

DROP POLICY IF EXISTS attribution_credits_tenant_guc ON public.attribution_credits;
CREATE POLICY attribution_credits_tenant_guc ON public.attribution_credits
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversions TO growth_os_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attribution_credits TO growth_os_app_role;
