-- Growth-OS Wave 0 — forward-sync: legacy writes → canonical upserts.
-- AFTER INSERT OR UPDATE only. No reverse (canonical → legacy) triggers.
-- No application write-site edits in this wave.
--
-- Note: app collection `distributions` is a DAL alias for `distribution_jobs`;
-- the trigger on distribution_jobs covers both write paths.

-- Ensure definition exists for a platform (used by connection sync).
CREATE OR REPLACE FUNCTION public.growth_os_ensure_channel_definition(p_platform TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  def_id TEXT;
BEGIN
  IF p_platform IS NULL OR p_platform = '' THEN
    RETURN NULL;
  END IF;
  def_id := 'chnd_' || md5(lower(p_platform));
  INSERT INTO public.channel_definitions (
    id, platform, kind, global_capabilities, created_at, updated_at, data
  ) VALUES (
    def_id,
    p_platform,
    public.growth_os_infer_channel_kind(p_platform),
    '{}'::jsonb,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    jsonb_build_object('legacy_source', jsonb_build_object('derived_from', 'forward_sync'))
  )
  ON CONFLICT (id) DO UPDATE SET
    platform = EXCLUDED.platform,
    updated_at = CURRENT_TIMESTAMP;
  RETURN def_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.growth_os_sync_platform_account()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  def_id TEXT;
BEGIN
  def_id := public.growth_os_ensure_channel_definition(NEW.platform);
  IF def_id IS NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.channel_connections (
    id, channel_definition_id, agency_id, agent_id, integration_model,
    credentials_ref, provider_account_id, rate_limits, health,
    tenant_capabilities, created_at, updated_at, data
  ) VALUES (
    'chn_pa_' || NEW.id,
    def_id,
    NEW.agency_id,
    NEW.agent_id,
    'oauth_platform_account',
    'secret:platform_accounts:' || NEW.id,
    NEW.account_handle,
    '{}'::jsonb,
    public.growth_os_map_legacy_connection_health(NEW.status, NULL, NEW.expires_at),
    '{}'::jsonb,
    coalesce(NEW.created_at, CURRENT_TIMESTAMP),
    coalesce(NEW.updated_at, CURRENT_TIMESTAMP),
    jsonb_build_object(
      'legacy_source', jsonb_build_object('table', 'platform_accounts', 'id', NEW.id),
      'account_handle', NEW.account_handle
    )
  )
  ON CONFLICT (id) DO UPDATE SET
    channel_definition_id = EXCLUDED.channel_definition_id,
    agency_id = EXCLUDED.agency_id,
    agent_id = EXCLUDED.agent_id,
    credentials_ref = EXCLUDED.credentials_ref,
    provider_account_id = EXCLUDED.provider_account_id,
    health = EXCLUDED.health,
    updated_at = CURRENT_TIMESTAMP,
    data = public.channel_connections.data || EXCLUDED.data;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_growth_os_sync_platform_accounts ON public.platform_accounts;
CREATE TRIGGER trg_growth_os_sync_platform_accounts
  AFTER INSERT OR UPDATE ON public.platform_accounts
  FOR EACH ROW EXECUTE FUNCTION public.growth_os_sync_platform_account();

CREATE OR REPLACE FUNCTION public.growth_os_sync_marketplace_connection()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  def_id TEXT;
BEGIN
  def_id := public.growth_os_ensure_channel_definition(NEW.platform);
  IF def_id IS NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.channel_connections (
    id, channel_definition_id, agency_id, agent_id, integration_model,
    credentials_ref, provider_account_id, rate_limits, health,
    tenant_capabilities, created_at, updated_at, data
  ) VALUES (
    'chn_mc_' || NEW.id,
    def_id,
    NEW.agency_id,
    NEW.agent_id,
    'marketplace_connection',
    'secret:marketplace_connections:' || NEW.id,
    coalesce(NEW.handle, NEW.account_name),
    '{}'::jsonb,
    public.growth_os_map_legacy_connection_health(NEW.status, NEW.health, NULL),
    '{}'::jsonb,
    coalesce(NEW.created_at, CURRENT_TIMESTAMP),
    coalesce(NEW.updated_at, CURRENT_TIMESTAMP),
    jsonb_build_object(
      'legacy_source', jsonb_build_object('table', 'marketplace_connections', 'id', NEW.id),
      'account_name', NEW.account_name,
      'handle', NEW.handle,
      'is_primary', NEW.is_primary
    )
  )
  ON CONFLICT (id) DO UPDATE SET
    channel_definition_id = EXCLUDED.channel_definition_id,
    agency_id = EXCLUDED.agency_id,
    agent_id = EXCLUDED.agent_id,
    credentials_ref = EXCLUDED.credentials_ref,
    provider_account_id = EXCLUDED.provider_account_id,
    health = EXCLUDED.health,
    updated_at = CURRENT_TIMESTAMP,
    data = public.channel_connections.data || EXCLUDED.data;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_growth_os_sync_marketplace_connections ON public.marketplace_connections;
CREATE TRIGGER trg_growth_os_sync_marketplace_connections
  AFTER INSERT OR UPDATE ON public.marketplace_connections
  FOR EACH ROW EXECUTE FUNCTION public.growth_os_sync_marketplace_connection();

CREATE OR REPLACE FUNCTION public.growth_os_sync_distribution_job()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  conn_id TEXT;
  exec_kind TEXT;
BEGIN
  PERFORM public.growth_os_ensure_channel_definition(NEW.platform);

  SELECT cc.id INTO conn_id
  FROM public.channel_connections cc
  WHERE cc.id = 'chn_mc_' || nullif(NEW.data->>'connection_id', '')
  LIMIT 1;

  IF conn_id IS NULL THEN
    SELECT cc.id INTO conn_id
    FROM public.channel_connections cc
    JOIN public.channel_definitions cd ON cd.id = cc.channel_definition_id
    WHERE lower(cd.platform) = lower(NEW.platform)
      AND (cc.agent_id IS NOT DISTINCT FROM NEW.agent_id)
    ORDER BY cc.created_at ASC
    LIMIT 1;
  END IF;

  exec_kind := CASE
    WHEN public.growth_os_infer_channel_kind(NEW.platform) = 'organic_social' THEN 'social_post'
    WHEN public.growth_os_infer_channel_kind(NEW.platform) = 'owned_messaging' THEN 'message'
    WHEN public.growth_os_infer_channel_kind(NEW.platform) = 'paid' THEN 'paid_ad'
    ELSE 'portal_submit'
  END;

  INSERT INTO public.executions (
    id, agency_id, agent_id, kind, channel_connection_id,
    subject_type, subject_id, scheduled_at, status, provider_ref,
    published_at, completed_at, created_at, updated_at, data
  ) VALUES (
    'exec_dj_' || NEW.id,
    NEW.agency_id,
    NEW.agent_id,
    exec_kind,
    conn_id,
    CASE WHEN NEW.property_id IS NOT NULL THEN 'property' ELSE NULL END,
    NEW.property_id,
    NEW.scheduled_at,
    public.growth_os_map_legacy_execution_status(NEW.status),
    coalesce(NEW.provider_post_id, NEW.data->>'external_id'),
    NEW.published_at,
    CASE
      WHEN public.growth_os_map_legacy_execution_status(NEW.status)
           IN ('published', 'failed', 'cancelled')
        THEN coalesce(NEW.published_at, NEW.updated_at)
      ELSE NULL
    END,
    coalesce(NEW.created_at, CURRENT_TIMESTAMP),
    coalesce(NEW.updated_at, CURRENT_TIMESTAMP),
    jsonb_build_object(
      'legacy_source', jsonb_build_object(
        'table', 'distribution_jobs', 'id', NEW.id, 'alias', 'distributions'
      ),
      'platform', NEW.platform,
      'publishing_job_id', NEW.publishing_job_id,
      'payload', NEW.payload,
      'error_message', coalesce(NEW.error_message, NEW.data->>'error'),
      'retry_count', NEW.retry_count
    ) || coalesce(NEW.data, '{}'::jsonb)
  )
  ON CONFLICT (id) DO UPDATE SET
    agency_id = EXCLUDED.agency_id,
    agent_id = EXCLUDED.agent_id,
    kind = EXCLUDED.kind,
    channel_connection_id = COALESCE(EXCLUDED.channel_connection_id, public.executions.channel_connection_id),
    subject_type = EXCLUDED.subject_type,
    subject_id = EXCLUDED.subject_id,
    scheduled_at = EXCLUDED.scheduled_at,
    status = EXCLUDED.status,
    provider_ref = EXCLUDED.provider_ref,
    published_at = EXCLUDED.published_at,
    completed_at = EXCLUDED.completed_at,
    updated_at = CURRENT_TIMESTAMP,
    data = public.executions.data || EXCLUDED.data;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_growth_os_sync_distribution_jobs ON public.distribution_jobs;
CREATE TRIGGER trg_growth_os_sync_distribution_jobs
  AFTER INSERT OR UPDATE ON public.distribution_jobs
  FOR EACH ROW EXECUTE FUNCTION public.growth_os_sync_distribution_job();

CREATE OR REPLACE FUNCTION public.growth_os_sync_publishing_job()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.executions (
    id, agency_id, agent_id, kind, subject_type, subject_id,
    status, published_at, completed_at, created_at, updated_at, data
  ) VALUES (
    'exec_pj_' || NEW.id,
    NEW.agency_id,
    NEW.agent_id,
    'portal_submit',
    CASE WHEN NEW.property_id IS NOT NULL THEN 'property' ELSE NULL END,
    NEW.property_id,
    CASE WHEN NEW.completed_at IS NOT NULL THEN 'published' ELSE 'processing' END,
    NEW.completed_at,
    NEW.completed_at,
    coalesce(NEW.created_at, NEW.submitted_at, CURRENT_TIMESTAMP),
    coalesce(NEW.updated_at, CURRENT_TIMESTAMP),
    jsonb_build_object(
      'legacy_source', jsonb_build_object('table', 'publishing_jobs', 'id', NEW.id),
      'submitted_at', NEW.submitted_at
    ) || coalesce(NEW.data, '{}'::jsonb)
  )
  ON CONFLICT (id) DO UPDATE SET
    agency_id = EXCLUDED.agency_id,
    agent_id = EXCLUDED.agent_id,
    status = EXCLUDED.status,
    completed_at = EXCLUDED.completed_at,
    published_at = EXCLUDED.published_at,
    updated_at = CURRENT_TIMESTAMP,
    data = public.executions.data || EXCLUDED.data;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_growth_os_sync_publishing_jobs ON public.publishing_jobs;
CREATE TRIGGER trg_growth_os_sync_publishing_jobs
  AFTER INSERT OR UPDATE ON public.publishing_jobs
  FOR EACH ROW EXECUTE FUNCTION public.growth_os_sync_publishing_job();

CREATE OR REPLACE FUNCTION public.growth_os_sync_scheduled_publication()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.executions (
    id, agency_id, agent_id, kind, subject_type, subject_id,
    scheduled_at, recurrence, status, completed_at, created_at, updated_at, data
  ) VALUES (
    'exec_sp_' || NEW.id,
    NEW.agency_id,
    NEW.agent_id,
    'portal_submit',
    'property',
    NEW.property_id,
    NEW.scheduled_at,
    NEW.recurrence,
    CASE
      WHEN NEW.status = 'pending' THEN 'scheduled'
      ELSE public.growth_os_map_legacy_execution_status(NEW.status)
    END,
    CASE
      WHEN NEW.status IN ('published', 'failed', 'cancelled')
        THEN coalesce(NEW.last_fired_at, NEW.updated_at)
      ELSE NULL
    END,
    coalesce(NEW.created_at, CURRENT_TIMESTAMP),
    coalesce(NEW.updated_at, CURRENT_TIMESTAMP),
    jsonb_build_object(
      'legacy_source', jsonb_build_object('table', 'scheduled_publications', 'id', NEW.id),
      'portals', NEW.portals,
      'message', NEW.message,
      'timezone', NEW.timezone,
      'job_id', NEW.job_id,
      'attempts', NEW.attempts,
      'last_error', NEW.last_error,
      'last_fired_at', NEW.last_fired_at
    ) || coalesce(NEW.data, '{}'::jsonb)
  )
  ON CONFLICT (id) DO UPDATE SET
    agency_id = EXCLUDED.agency_id,
    agent_id = EXCLUDED.agent_id,
    scheduled_at = EXCLUDED.scheduled_at,
    recurrence = EXCLUDED.recurrence,
    status = EXCLUDED.status,
    completed_at = EXCLUDED.completed_at,
    updated_at = CURRENT_TIMESTAMP,
    data = public.executions.data || EXCLUDED.data;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_growth_os_sync_scheduled_publications ON public.scheduled_publications;
CREATE TRIGGER trg_growth_os_sync_scheduled_publications
  AFTER INSERT OR UPDATE ON public.scheduled_publications
  FOR EACH ROW EXECUTE FUNCTION public.growth_os_sync_scheduled_publication();

CREATE OR REPLACE FUNCTION public.growth_os_sync_distribution_attempt()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Parent execution must exist (created by distribution_jobs sync / backfill).
  IF NOT EXISTS (
    SELECT 1 FROM public.executions WHERE id = 'exec_dj_' || NEW.distribution_job_id
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.execution_attempts (
    id, execution_id, status, response, error_message, error_class,
    attempted_at, created_at, updated_at, data
  ) VALUES (
    'exa_' || NEW.id,
    'exec_dj_' || NEW.distribution_job_id,
    NEW.status,
    NEW.response,
    NEW.error_message,
    NEW.error_class,
    coalesce(NEW.attempted_at, CURRENT_TIMESTAMP),
    coalesce(NEW.created_at, NEW.attempted_at, CURRENT_TIMESTAMP),
    coalesce(NEW.updated_at, CURRENT_TIMESTAMP),
    jsonb_build_object(
      'legacy_source', jsonb_build_object(
        'table', 'distribution_attempts',
        'id', NEW.id,
        'distribution_job_id', NEW.distribution_job_id
      )
    ) || coalesce(NEW.data, '{}'::jsonb)
  )
  ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    response = EXCLUDED.response,
    error_message = EXCLUDED.error_message,
    error_class = EXCLUDED.error_class,
    attempted_at = EXCLUDED.attempted_at,
    updated_at = CURRENT_TIMESTAMP,
    data = public.execution_attempts.data || EXCLUDED.data;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_growth_os_sync_distribution_attempts ON public.distribution_attempts;
CREATE TRIGGER trg_growth_os_sync_distribution_attempts
  AFTER INSERT OR UPDATE ON public.distribution_attempts
  FOR EACH ROW EXECUTE FUNCTION public.growth_os_sync_distribution_attempt();
