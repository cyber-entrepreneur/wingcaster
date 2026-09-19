-- Growth-OS Wave 0 — events + consent (RLS).
--
-- Partitioning note: monthly RANGE partitioning on occurred_at cannot host a
-- table-level UNIQUE(provider_event_id) in Postgres (unique indexes on
-- partitioned tables must include the partition key). Event ingest idempotency
-- requires UNIQUE(provider_event_id). Therefore events is a single table with
-- the same columns + indexes; a helper remains to document future partition
-- strategy once a composite uniqueness model is adopted.

CREATE TABLE IF NOT EXISTS public.events (
  id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  event_category TEXT NOT NULL,
  schema_version TEXT NOT NULL DEFAULT '1',
  source TEXT,
  actor TEXT,
  object_ref TEXT,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  contact_id TEXT,
  execution_id TEXT REFERENCES public.executions(id) ON DELETE SET NULL,
  campaign_id TEXT,
  channel_connection_id TEXT
    REFERENCES public.channel_connections(id) ON DELETE SET NULL,
  -- Money: BIGINT minor units (micros) + currency TEXT
  value_micros BIGINT,
  currency TEXT,
  provider_event_id TEXT,
  correlation_id TEXT,
  causation_event_id TEXT,
  agency_id TEXT REFERENCES public.agencies(id) ON DELETE SET NULL,
  agent_id TEXT REFERENCES public.agents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT events_event_category_check
    CHECK (public.growth_os_is_event_category(event_category))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_events_provider_event_id
  ON public.events (provider_event_id)
  WHERE provider_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_occurred_at ON public.events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_event_name ON public.events (event_name);
CREATE INDEX IF NOT EXISTS idx_events_contact ON public.events (contact_id);
CREATE INDEX IF NOT EXISTS idx_events_execution ON public.events (execution_id);
CREATE INDEX IF NOT EXISTS idx_events_campaign ON public.events (campaign_id);
CREATE INDEX IF NOT EXISTS idx_events_channel_connection
  ON public.events (channel_connection_id);
CREATE INDEX IF NOT EXISTS idx_events_correlation ON public.events (correlation_id);
CREATE INDEX IF NOT EXISTS idx_events_agency ON public.events (agency_id);
CREATE INDEX IF NOT EXISTS idx_events_agent ON public.events (agent_id);

-- Helper retained for operators who later adopt partitioning with a composite
-- uniqueness model (provider_event_id, occurred_at). No-op for the single table.
CREATE OR REPLACE FUNCTION public.growth_os_ensure_events_partition(p_month DATE)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  -- Single-table fallback: nothing to create. Returns the live relation name.
  RETURN 'public.events';
END;
$$;

-- Consent: upsert current-state per (contact_id, channel, purpose).
-- Prior states are appended into data.prior_states (lightweight history).
CREATE TABLE IF NOT EXISTS public.consent (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  purpose TEXT NOT NULL,
  status TEXT NOT NULL,
  legal_basis TEXT,
  source TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ,
  jurisdiction TEXT,
  proof_ref TEXT,
  agency_id TEXT REFERENCES public.agencies(id) ON DELETE SET NULL,
  agent_id TEXT REFERENCES public.agents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT consent_status_check
    CHECK (public.growth_os_is_consent_status(status)),
  CONSTRAINT consent_purpose_check
    CHECK (public.growth_os_is_consent_purpose(purpose))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_consent_contact_channel_purpose
  ON public.consent (contact_id, channel, purpose);

CREATE INDEX IF NOT EXISTS idx_consent_contact ON public.consent (contact_id);
CREATE INDEX IF NOT EXISTS idx_consent_agency ON public.consent (agency_id);
CREATE INDEX IF NOT EXISTS idx_consent_agent ON public.consent (agent_id);
CREATE INDEX IF NOT EXISTS idx_consent_status ON public.consent (status);
CREATE INDEX IF NOT EXISTS idx_consent_expires_at ON public.consent (expires_at);

CREATE OR REPLACE VIEW public.consent_current AS
  SELECT *
  FROM public.consent;

DO $$ BEGIN
  CREATE ROLE growth_os_app_role NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS events_tenant_guc ON public.events;
CREATE POLICY events_tenant_guc ON public.events
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

DROP POLICY IF EXISTS consent_tenant_guc ON public.consent;
CREATE POLICY consent_tenant_guc ON public.consent
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO growth_os_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consent TO growth_os_app_role;
GRANT SELECT ON public.consent_current TO growth_os_app_role;

DO $$ BEGIN
  GRANT growth_os_app_role TO CURRENT_USER;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
