-- BE-BLOCKER-10 / AGT-PUB-003 â€” publishing_jobs fan-out grouping +
-- publishing_job.completed push templates.
--
-- Idempotent. Migration number 328 (325=agency invitations, 326=tracker indexes, 327=status_changed templates).

-- ---------------------------------------------------------------------------
-- publishing_jobs â€” one row per fan-out publish (listing Ã— N portals)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.publishing_jobs (
  id TEXT PRIMARY KEY,
  property_id TEXT REFERENCES public.properties(id) ON DELETE SET NULL,
  agent_id TEXT REFERENCES public.agents(id) ON DELETE SET NULL,
  agency_id TEXT REFERENCES public.agencies(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_publishing_jobs_agent_submitted
  ON public.publishing_jobs (agent_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_publishing_jobs_agency_submitted
  ON public.publishing_jobs (agency_id, submitted_at DESC)
  WHERE agency_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_publishing_jobs_property
  ON public.publishing_jobs (property_id)
  WHERE property_id IS NOT NULL;

-- Nullable FK so legacy single-platform distribution_jobs rows still work.
ALTER TABLE public.distribution_jobs
  ADD COLUMN IF NOT EXISTS publishing_job_id TEXT
    REFERENCES public.publishing_jobs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_distribution_jobs_publishing_job_id
  ON public.distribution_jobs (publishing_job_id)
  WHERE publishing_job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_distribution_jobs_agent_id_created
  ON public.distribution_jobs (agent_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- platform_message_templates: extend channel CHECK to include push
-- (Agent 4 will do the same for a different template â€” both idempotent.)
-- ---------------------------------------------------------------------------

ALTER TABLE public.platform_message_templates
  DROP CONSTRAINT IF EXISTS platform_msg_templates_channel_check;
ALTER TABLE public.platform_message_templates
  ADD CONSTRAINT platform_msg_templates_channel_check
  CHECK (channel IN ('email', 'whatsapp', 'sms', 'push'));

-- ---------------------------------------------------------------------------
-- Seed publishing_job.completed.* push templates (5 aggregate variants)
-- Deep link: wingcaster://publish-receipt/:jobId  (+ web /publish/receipts/:jobId)
-- ---------------------------------------------------------------------------

INSERT INTO public.platform_message_templates (
  id, code, display_name, description, channel, category,
  language, territory_id,
  subject, html_body, text_body,
  editor_mode, required_variables, optional_variables,
  is_active, is_seed, version,
  created_at, updated_at, data
)
SELECT
  gen_random_uuid()::text,
  'publishing_job.completed.all_succeeded',
  'Publish receipt â€” all succeeded',
  'Push when every destination in a publishing job succeeded.',
  'push',
  'notification',
  'en',
  NULL,
  'Published to {{succeeded}} of {{total}} channels',
  NULL,
  'All {{total}} channels published successfully. Open your receipt for live links.',
  'raw',
  '["succeeded", "total", "job_id", "deep_link_url"]'::jsonb,
  '["failed", "in_review", "listing_short_ref", "web_path"]'::jsonb,
  true, true, 1,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
  jsonb_build_object(
    'variant', 'all_succeeded',
    'event', 'publishing_job.completed',
    'deep_link_template', 'wingcaster://publish-receipt/{{job_id}}',
    'web_path_template', '/publish/receipts/{{job_id}}'
  )
WHERE NOT EXISTS (
  SELECT 1 FROM public.platform_message_templates
   WHERE code = 'publishing_job.completed.all_succeeded'
     AND language = 'en'
     AND territory_id IS NULL
);

INSERT INTO public.platform_message_templates (
  id, code, display_name, description, channel, category,
  language, territory_id,
  subject, html_body, text_body,
  editor_mode, required_variables, optional_variables,
  is_active, is_seed, version,
  created_at, updated_at, data
)
SELECT
  gen_random_uuid()::text,
  'publishing_job.completed.mixed',
  'Publish receipt â€” mixed',
  'Push when a publishing job has both successes and failures.',
  'push',
  'notification',
  'en',
  NULL,
  'Published to {{succeeded}} of {{total}} channels',
  NULL,
  '{{succeeded}} succeeded, {{failed}} failed. Retry failed channels from your receipt.',
  'raw',
  '["succeeded", "failed", "total", "job_id", "deep_link_url"]'::jsonb,
  '["in_review", "listing_short_ref", "web_path"]'::jsonb,
  true, true, 1,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
  jsonb_build_object(
    'variant', 'mixed',
    'event', 'publishing_job.completed',
    'deep_link_template', 'wingcaster://publish-receipt/{{job_id}}',
    'web_path_template', '/publish/receipts/{{job_id}}'
  )
WHERE NOT EXISTS (
  SELECT 1 FROM public.platform_message_templates
   WHERE code = 'publishing_job.completed.mixed'
     AND language = 'en'
     AND territory_id IS NULL
);

INSERT INTO public.platform_message_templates (
  id, code, display_name, description, channel, category,
  language, territory_id,
  subject, html_body, text_body,
  editor_mode, required_variables, optional_variables,
  is_active, is_seed, version,
  created_at, updated_at, data
)
SELECT
  gen_random_uuid()::text,
  'publishing_job.completed.all_failed',
  'Publish receipt â€” all failed',
  'Push when every destination in a publishing job failed.',
  'push',
  'notification',
  'en',
  NULL,
  'Publish failed on all {{total}} channels',
  NULL,
  'Nothing went live. Open your receipt for reasons and retry options.',
  'raw',
  '["failed", "total", "job_id", "deep_link_url"]'::jsonb,
  '["succeeded", "in_review", "listing_short_ref", "web_path"]'::jsonb,
  true, true, 1,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
  jsonb_build_object(
    'variant', 'all_failed',
    'event', 'publishing_job.completed',
    'deep_link_template', 'wingcaster://publish-receipt/{{job_id}}',
    'web_path_template', '/publish/receipts/{{job_id}}'
  )
WHERE NOT EXISTS (
  SELECT 1 FROM public.platform_message_templates
   WHERE code = 'publishing_job.completed.all_failed'
     AND language = 'en'
     AND territory_id IS NULL
);

INSERT INTO public.platform_message_templates (
  id, code, display_name, description, channel, category,
  language, territory_id,
  subject, html_body, text_body,
  editor_mode, required_variables, optional_variables,
  is_active, is_seed, version,
  created_at, updated_at, data
)
SELECT
  gen_random_uuid()::text,
  'publishing_job.completed.in_review_only',
  'Publish receipt â€” in review',
  'Push when every destination is awaiting portal/PA review.',
  'push',
  'notification',
  'en',
  NULL,
  '{{total}} channel(s) submitted for review',
  NULL,
  'Your listings are with portal reviewers. We will update the receipt when they decide.',
  'raw',
  '["in_review", "total", "job_id", "deep_link_url"]'::jsonb,
  '["succeeded", "failed", "listing_short_ref", "web_path"]'::jsonb,
  true, true, 1,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
  jsonb_build_object(
    'variant', 'in_review_only',
    'event', 'publishing_job.completed',
    'deep_link_template', 'wingcaster://publish-receipt/{{job_id}}',
    'web_path_template', '/publish/receipts/{{job_id}}'
  )
WHERE NOT EXISTS (
  SELECT 1 FROM public.platform_message_templates
   WHERE code = 'publishing_job.completed.in_review_only'
     AND language = 'en'
     AND territory_id IS NULL
);

INSERT INTO public.platform_message_templates (
  id, code, display_name, description, channel, category,
  language, territory_id,
  subject, html_body, text_body,
  editor_mode, required_variables, optional_variables,
  is_active, is_seed, version,
  created_at, updated_at, data
)
SELECT
  gen_random_uuid()::text,
  'publishing_job.completed.partial',
  'Publish receipt â€” partial (no failures)',
  'Push when some destinations succeeded and others are still in review (no failures).',
  'push',
  'notification',
  'en',
  NULL,
  'Published to {{succeeded}} of {{total}} â€” {{in_review}} still in review',
  NULL,
  '{{succeeded}} live, {{in_review}} awaiting review. Open your receipt for details.',
  'raw',
  '["succeeded", "in_review", "total", "job_id", "deep_link_url"]'::jsonb,
  '["failed", "listing_short_ref", "web_path"]'::jsonb,
  true, true, 1,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
  jsonb_build_object(
    'variant', 'partial',
    'event', 'publishing_job.completed',
    'deep_link_template', 'wingcaster://publish-receipt/{{job_id}}',
    'web_path_template', '/publish/receipts/{{job_id}}'
  )
WHERE NOT EXISTS (
  SELECT 1 FROM public.platform_message_templates
   WHERE code = 'publishing_job.completed.partial'
     AND language = 'en'
     AND territory_id IS NULL
);

