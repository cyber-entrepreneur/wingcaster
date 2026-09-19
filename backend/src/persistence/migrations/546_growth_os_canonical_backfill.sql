-- Growth-OS Wave 0 — idempotent lossless backfill from legacy tables.
-- Re-runnable: deterministic IDs derived from source row ids.
-- Produces NO Events (historical events out of scope).
--
-- Naming fact: there is no physical `distributions` table; app collection
-- `distributions` maps to `distribution_jobs`. Backfill reads distribution_jobs.

-- 1) channel_definitions from distinct platforms
INSERT INTO public.channel_definitions (
  id, platform, kind, global_capabilities, created_at, updated_at, data
)
SELECT
  'chnd_' || md5(lower(p.platform)),
  p.platform,
  public.growth_os_infer_channel_kind(p.platform),
  '{}'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  jsonb_build_object('legacy_source', jsonb_build_object('derived_from', 'platform_union'))
FROM (
  SELECT DISTINCT platform FROM public.platform_accounts WHERE platform IS NOT NULL AND platform <> ''
  UNION
  SELECT DISTINCT platform FROM public.marketplace_connections WHERE platform IS NOT NULL AND platform <> ''
  UNION
  SELECT DISTINCT platform FROM public.distribution_jobs WHERE platform IS NOT NULL AND platform <> ''
) p
ON CONFLICT (id) DO UPDATE SET
  platform = EXCLUDED.platform,
  kind = EXCLUDED.kind,
  updated_at = CURRENT_TIMESTAMP;

-- 2) channel_connections from platform_accounts (credentials_ref pointer only)
INSERT INTO public.channel_connections (
  id, channel_definition_id, agency_id, agent_id, integration_model,
  credentials_ref, provider_account_id, rate_limits, health,
  tenant_capabilities, created_at, updated_at, data
)
SELECT
  'chn_pa_' || pa.id,
  'chnd_' || md5(lower(pa.platform)),
  pa.agency_id,
  pa.agent_id,
  'oauth_platform_account',
  'secret:platform_accounts:' || pa.id,
  pa.account_handle,
  '{}'::jsonb,
  public.growth_os_map_legacy_connection_health(pa.status, NULL, pa.expires_at),
  '{}'::jsonb,
  coalesce(pa.created_at, CURRENT_TIMESTAMP),
  coalesce(pa.updated_at, CURRENT_TIMESTAMP),
  jsonb_build_object(
    'legacy_source', jsonb_build_object('table', 'platform_accounts', 'id', pa.id),
    'account_handle', pa.account_handle
  )
FROM public.platform_accounts pa
WHERE pa.platform IS NOT NULL AND pa.platform <> ''
ON CONFLICT (id) DO UPDATE SET
  channel_definition_id = EXCLUDED.channel_definition_id,
  agency_id = EXCLUDED.agency_id,
  agent_id = EXCLUDED.agent_id,
  credentials_ref = EXCLUDED.credentials_ref,
  provider_account_id = EXCLUDED.provider_account_id,
  health = EXCLUDED.health,
  updated_at = CURRENT_TIMESTAMP,
  data = public.channel_connections.data || EXCLUDED.data;

-- 3) channel_connections from marketplace_connections
INSERT INTO public.channel_connections (
  id, channel_definition_id, agency_id, agent_id, integration_model,
  credentials_ref, provider_account_id, rate_limits, health,
  tenant_capabilities, created_at, updated_at, data
)
SELECT
  'chn_mc_' || mc.id,
  'chnd_' || md5(lower(mc.platform)),
  mc.agency_id,
  mc.agent_id,
  'marketplace_connection',
  'secret:marketplace_connections:' || mc.id,
  coalesce(mc.handle, mc.account_name),
  '{}'::jsonb,
  public.growth_os_map_legacy_connection_health(mc.status, mc.health, NULL),
  '{}'::jsonb,
  coalesce(mc.created_at, CURRENT_TIMESTAMP),
  coalesce(mc.updated_at, CURRENT_TIMESTAMP),
  jsonb_build_object(
    'legacy_source', jsonb_build_object('table', 'marketplace_connections', 'id', mc.id),
    'account_name', mc.account_name,
    'handle', mc.handle,
    'is_primary', mc.is_primary
  )
FROM public.marketplace_connections mc
WHERE mc.platform IS NOT NULL AND mc.platform <> ''
ON CONFLICT (id) DO UPDATE SET
  channel_definition_id = EXCLUDED.channel_definition_id,
  agency_id = EXCLUDED.agency_id,
  agent_id = EXCLUDED.agent_id,
  credentials_ref = EXCLUDED.credentials_ref,
  provider_account_id = EXCLUDED.provider_account_id,
  health = EXCLUDED.health,
  updated_at = CURRENT_TIMESTAMP,
  data = public.channel_connections.data || EXCLUDED.data;

-- 4) executions from distribution_jobs (= app "distributions")
INSERT INTO public.executions (
  id, campaign_id, journey_node_run_id, agency_id, agent_id, kind,
  channel_connection_id, creative_id, audience_id,
  subject_type, subject_id, scheduled_at, recurrence, status,
  provider_ref, published_at, completed_at, created_at, updated_at, data
)
SELECT
  'exec_dj_' || dj.id,
  NULL,
  NULL,
  dj.agency_id,
  dj.agent_id,
  CASE
    WHEN public.growth_os_infer_channel_kind(dj.platform) = 'organic_social' THEN 'social_post'
    WHEN public.growth_os_infer_channel_kind(dj.platform) = 'owned_messaging' THEN 'message'
    WHEN public.growth_os_infer_channel_kind(dj.platform) = 'paid' THEN 'paid_ad'
    ELSE 'portal_submit'
  END,
  COALESCE(
    (
      SELECT cc.id FROM public.channel_connections cc
      WHERE cc.id = 'chn_mc_' || nullif(dj.data->>'connection_id', '')
      LIMIT 1
    ),
    (
      SELECT cc.id FROM public.channel_connections cc
      JOIN public.channel_definitions cd ON cd.id = cc.channel_definition_id
      WHERE lower(cd.platform) = lower(dj.platform)
        AND (cc.agent_id IS NOT DISTINCT FROM dj.agent_id)
      ORDER BY cc.created_at ASC
      LIMIT 1
    )
  ),
  NULL,
  NULL,
  CASE WHEN dj.property_id IS NOT NULL THEN 'property' ELSE NULL END,
  dj.property_id,
  dj.scheduled_at,
  NULL,
  public.growth_os_map_legacy_execution_status(dj.status),
  coalesce(dj.provider_post_id, dj.data->>'external_id'),
  dj.published_at,
  CASE
    WHEN public.growth_os_map_legacy_execution_status(dj.status) IN ('published', 'failed', 'cancelled')
      THEN coalesce(dj.published_at, dj.updated_at)
    ELSE NULL
  END,
  coalesce(dj.created_at, CURRENT_TIMESTAMP),
  coalesce(dj.updated_at, CURRENT_TIMESTAMP),
  jsonb_build_object(
    'legacy_source', jsonb_build_object(
      'table', 'distribution_jobs',
      'id', dj.id,
      'alias', 'distributions'
    ),
    'platform', dj.platform,
    'publishing_job_id', dj.publishing_job_id,
    'payload', dj.payload,
    'error_message', coalesce(dj.error_message, dj.data->>'error'),
    'retry_count', dj.retry_count
  ) || coalesce(dj.data, '{}'::jsonb)
FROM public.distribution_jobs dj
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

-- 5) executions from publishing_jobs (aggregate parent — no status column)
INSERT INTO public.executions (
  id, agency_id, agent_id, kind, subject_type, subject_id,
  status, published_at, completed_at, created_at, updated_at, data
)
SELECT
  'exec_pj_' || pj.id,
  pj.agency_id,
  pj.agent_id,
  'portal_submit',
  CASE WHEN pj.property_id IS NOT NULL THEN 'property' ELSE NULL END,
  pj.property_id,
  CASE
    WHEN pj.completed_at IS NOT NULL THEN 'published'
    ELSE 'processing'
  END,
  pj.completed_at,
  pj.completed_at,
  coalesce(pj.created_at, pj.submitted_at, CURRENT_TIMESTAMP),
  coalesce(pj.updated_at, CURRENT_TIMESTAMP),
  jsonb_build_object(
    'legacy_source', jsonb_build_object('table', 'publishing_jobs', 'id', pj.id),
    'submitted_at', pj.submitted_at
  ) || coalesce(pj.data, '{}'::jsonb)
FROM public.publishing_jobs pj
ON CONFLICT (id) DO UPDATE SET
  agency_id = EXCLUDED.agency_id,
  agent_id = EXCLUDED.agent_id,
  status = EXCLUDED.status,
  completed_at = EXCLUDED.completed_at,
  published_at = EXCLUDED.published_at,
  updated_at = CURRENT_TIMESTAMP,
  data = public.executions.data || EXCLUDED.data;

-- 6) executions from scheduled_publications
INSERT INTO public.executions (
  id, agency_id, agent_id, kind, subject_type, subject_id,
  scheduled_at, recurrence, status, completed_at, created_at, updated_at, data
)
SELECT
  'exec_sp_' || sp.id,
  sp.agency_id,
  sp.agent_id,
  'portal_submit',
  'property',
  sp.property_id,
  sp.scheduled_at,
  sp.recurrence,
  CASE
    WHEN sp.status = 'pending' THEN 'scheduled'
    ELSE public.growth_os_map_legacy_execution_status(sp.status)
  END,
  CASE
    WHEN sp.status IN ('published', 'failed', 'cancelled') THEN coalesce(sp.last_fired_at, sp.updated_at)
    ELSE NULL
  END,
  coalesce(sp.created_at, CURRENT_TIMESTAMP),
  coalesce(sp.updated_at, CURRENT_TIMESTAMP),
  jsonb_build_object(
    'legacy_source', jsonb_build_object('table', 'scheduled_publications', 'id', sp.id),
    'portals', sp.portals,
    'message', sp.message,
    'timezone', sp.timezone,
    'job_id', sp.job_id,
    'attempts', sp.attempts,
    'last_error', sp.last_error,
    'last_fired_at', sp.last_fired_at
  ) || coalesce(sp.data, '{}'::jsonb)
FROM public.scheduled_publications sp
ON CONFLICT (id) DO UPDATE SET
  agency_id = EXCLUDED.agency_id,
  agent_id = EXCLUDED.agent_id,
  scheduled_at = EXCLUDED.scheduled_at,
  recurrence = EXCLUDED.recurrence,
  status = EXCLUDED.status,
  completed_at = EXCLUDED.completed_at,
  updated_at = CURRENT_TIMESTAMP,
  data = public.executions.data || EXCLUDED.data;

-- 7) execution_attempts from distribution_attempts
INSERT INTO public.execution_attempts (
  id, execution_id, status, response, error_message, error_class,
  attempted_at, created_at, updated_at, data
)
SELECT
  'exa_' || da.id,
  'exec_dj_' || da.distribution_job_id,
  da.status,
  da.response,
  da.error_message,
  da.error_class,
  coalesce(da.attempted_at, CURRENT_TIMESTAMP),
  coalesce(da.created_at, da.attempted_at, CURRENT_TIMESTAMP),
  coalesce(da.updated_at, CURRENT_TIMESTAMP),
  jsonb_build_object(
    'legacy_source', jsonb_build_object(
      'table', 'distribution_attempts',
      'id', da.id,
      'distribution_job_id', da.distribution_job_id
    )
  ) || coalesce(da.data, '{}'::jsonb)
FROM public.distribution_attempts da
WHERE EXISTS (
  SELECT 1 FROM public.executions e WHERE e.id = 'exec_dj_' || da.distribution_job_id
)
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  response = EXCLUDED.response,
  error_message = EXCLUDED.error_message,
  error_class = EXCLUDED.error_class,
  attempted_at = EXCLUDED.attempted_at,
  updated_at = CURRENT_TIMESTAMP,
  data = public.execution_attempts.data || EXCLUDED.data;
