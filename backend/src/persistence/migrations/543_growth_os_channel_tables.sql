-- Growth-OS Wave 0 — channel_definitions + channel_connections (RLS).
-- Expand-only. Global catalog (definitions) + tenant connections.

CREATE TABLE IF NOT EXISTS public.channel_definitions (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  kind TEXT NOT NULL,
  global_capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT channel_definitions_kind_check
    CHECK (public.growth_os_is_channel_definition_kind(kind))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_channel_definitions_platform
  ON public.channel_definitions (lower(platform));

CREATE INDEX IF NOT EXISTS idx_channel_definitions_kind
  ON public.channel_definitions (kind);

CREATE TABLE IF NOT EXISTS public.channel_connections (
  id TEXT PRIMARY KEY,
  channel_definition_id TEXT NOT NULL
    REFERENCES public.channel_definitions(id) ON DELETE RESTRICT,
  agency_id TEXT REFERENCES public.agencies(id) ON DELETE SET NULL,
  agent_id TEXT REFERENCES public.agents(id) ON DELETE SET NULL,
  integration_model TEXT,
  -- Pointer only (e.g. secret:marketplace_connections:<id>). NEVER raw tokens.
  credentials_ref TEXT,
  provider_account_id TEXT,
  rate_limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  health TEXT NOT NULL DEFAULT 'connected',
  tenant_capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT channel_connections_health_check
    CHECK (public.growth_os_is_channel_connection_health(health))
);

CREATE INDEX IF NOT EXISTS idx_channel_connections_definition
  ON public.channel_connections (channel_definition_id);
CREATE INDEX IF NOT EXISTS idx_channel_connections_agency
  ON public.channel_connections (agency_id);
CREATE INDEX IF NOT EXISTS idx_channel_connections_agent
  ON public.channel_connections (agent_id);
CREATE INDEX IF NOT EXISTS idx_channel_connections_provider_account
  ON public.channel_connections (provider_account_id);
CREATE INDEX IF NOT EXISTS idx_channel_connections_legacy_source
  ON public.channel_connections ((data #>> '{legacy_source,table}'), (data #>> '{legacy_source,id}'));

-- ---------------------------------------------------------------------------
-- RLS (306-style: trusted app role + GUC tenant gate; GUC unset → open)
-- GUCs: app.agency_id, app.agent_id (TEXT). No agency RLS existed in-repo;
-- this adapts 306's credits.tenant_id pattern to agency_id/agent_id.
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE ROLE growth_os_app_role NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.channel_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_definitions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.channel_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_connections FORCE ROW LEVEL SECURITY;

-- Catalog is global: readable when GUC unset or always for SELECT.
DROP POLICY IF EXISTS channel_definitions_read ON public.channel_definitions;
CREATE POLICY channel_definitions_read ON public.channel_definitions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS channel_definitions_write_open ON public.channel_definitions;
CREATE POLICY channel_definitions_write_open ON public.channel_definitions
  FOR ALL USING (
    NULLIF(current_setting('app.agency_id', true), '') IS NULL
    AND NULLIF(current_setting('app.agent_id', true), '') IS NULL
  ) WITH CHECK (true);

DROP POLICY IF EXISTS channel_connections_tenant_guc ON public.channel_connections;
CREATE POLICY channel_connections_tenant_guc ON public.channel_connections
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_definitions TO growth_os_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_connections TO growth_os_app_role;

-- Allow test/migrator sessions to SET ROLE growth_os_app_role.
DO $$ BEGIN
  GRANT growth_os_app_role TO CURRENT_USER;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
