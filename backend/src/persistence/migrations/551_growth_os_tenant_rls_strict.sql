-- Growth-OS Wave 0 — tighten tenant RLS (306-style, not open when GUC unset).
-- growth_os_app_role requires app.agency_id or app.agent_id; migrator/superuser unchanged.

DO $$ BEGIN
  CREATE ROLE growth_os_app_role NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  GRANT growth_os_app_role TO CURRENT_USER;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- channel_connections
DROP POLICY IF EXISTS channel_connections_tenant_guc ON public.channel_connections;
CREATE POLICY channel_connections_tenant_guc ON public.channel_connections
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

-- executions
DROP POLICY IF EXISTS executions_tenant_guc ON public.executions;
CREATE POLICY executions_tenant_guc ON public.executions
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

-- execution_attempts (inherit via parent execution)
DROP POLICY IF EXISTS execution_attempts_tenant_guc ON public.execution_attempts;
CREATE POLICY execution_attempts_tenant_guc ON public.execution_attempts
  FOR ALL
  TO growth_os_app_role
  USING (
    EXISTS (
      SELECT 1 FROM public.executions e
      WHERE e.id = execution_id
        AND (
          (
            NULLIF(current_setting('app.agency_id', true), '') IS NOT NULL
            AND e.agency_id = NULLIF(current_setting('app.agency_id', true), '')
          )
          OR (
            NULLIF(current_setting('app.agent_id', true), '') IS NOT NULL
            AND e.agent_id = NULLIF(current_setting('app.agent_id', true), '')
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.executions e
      WHERE e.id = execution_id
        AND (
          (
            NULLIF(current_setting('app.agency_id', true), '') IS NOT NULL
            AND e.agency_id = NULLIF(current_setting('app.agency_id', true), '')
          )
          OR (
            NULLIF(current_setting('app.agent_id', true), '') IS NOT NULL
            AND e.agent_id = NULLIF(current_setting('app.agent_id', true), '')
          )
        )
    )
  );

-- events
DROP POLICY IF EXISTS events_tenant_guc ON public.events;
CREATE POLICY events_tenant_guc ON public.events
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

-- consent
DROP POLICY IF EXISTS consent_tenant_guc ON public.consent;
CREATE POLICY consent_tenant_guc ON public.consent
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

-- metric_observations
DROP POLICY IF EXISTS metric_observations_tenant_guc ON public.metric_observations;
CREATE POLICY metric_observations_tenant_guc ON public.metric_observations
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
