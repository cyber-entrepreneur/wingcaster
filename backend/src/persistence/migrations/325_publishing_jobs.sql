-- BE-BLOCKER-10 / WF-03 Agent 2
-- Additive publishing_jobs grouping table for fan-out publish (listing × N portals).
-- Idempotent. Do NOT rewrite 007_distribution.sql.
-- Reserved migration 325 only (326 is Agent 3 tracker indexes).

-- ---------------------------------------------------------------------------
-- publishing_jobs: one row per fan-out publish (listing × N destinations)
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

-- Defensive ADD COLUMN for databases that received an older draft of this table.
ALTER TABLE public.publishing_jobs ADD COLUMN IF NOT EXISTS property_id TEXT;
ALTER TABLE public.publishing_jobs ADD COLUMN IF NOT EXISTS agent_id TEXT;
ALTER TABLE public.publishing_jobs ADD COLUMN IF NOT EXISTS agency_id TEXT;
ALTER TABLE public.publishing_jobs ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE public.publishing_jobs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE public.publishing_jobs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE public.publishing_jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE public.publishing_jobs ADD COLUMN IF NOT EXISTS data JSONB;

UPDATE public.publishing_jobs
   SET submitted_at = COALESCE(submitted_at, created_at, CURRENT_TIMESTAMP)
 WHERE submitted_at IS NULL;

ALTER TABLE public.publishing_jobs
  ALTER COLUMN submitted_at SET DEFAULT CURRENT_TIMESTAMP;

UPDATE public.publishing_jobs
   SET created_at = COALESCE(created_at, submitted_at, CURRENT_TIMESTAMP)
 WHERE created_at IS NULL;
ALTER TABLE public.publishing_jobs
  ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.publishing_jobs
  ALTER COLUMN created_at SET NOT NULL;

UPDATE public.publishing_jobs
   SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
 WHERE updated_at IS NULL;
ALTER TABLE public.publishing_jobs
  ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.publishing_jobs
  ALTER COLUMN updated_at SET NOT NULL;

UPDATE public.publishing_jobs
   SET data = '{}'::jsonb
 WHERE data IS NULL;
ALTER TABLE public.publishing_jobs
  ALTER COLUMN data SET DEFAULT '{}'::jsonb;
ALTER TABLE public.publishing_jobs
  ALTER COLUMN data SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_publishing_jobs_agent_submitted
  ON public.publishing_jobs (agent_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_publishing_jobs_agent_id
  ON public.publishing_jobs (agent_id, id);

-- ---------------------------------------------------------------------------
-- distribution_jobs.publishing_job_id — nullable FK for legacy one-row-per-platform jobs
-- ---------------------------------------------------------------------------
ALTER TABLE public.distribution_jobs
  ADD COLUMN IF NOT EXISTS publishing_job_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'public.distribution_jobs'::regclass
       AND conname = 'distribution_jobs_publishing_job_id_fkey'
  ) THEN
    ALTER TABLE public.distribution_jobs
      ADD CONSTRAINT distribution_jobs_publishing_job_id_fkey
      FOREIGN KEY (publishing_job_id)
      REFERENCES public.publishing_jobs(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_distribution_jobs_publishing_job_id
  ON public.distribution_jobs (publishing_job_id);

-- ---------------------------------------------------------------------------
-- platform_message_templates.channel CHECK — add 'push' (and 'in_app' so a
-- sibling Wave-2 agent that seeds a different channel cannot clobber us, and
-- vice versa). Drop/re-add only when 'push' is missing.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  def text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO def
    FROM pg_constraint
   WHERE conrelid = 'public.platform_message_templates'::regclass
     AND conname = 'platform_msg_templates_channel_check';

  IF def IS NULL OR position('''push''' in def) = 0 THEN
    ALTER TABLE public.platform_message_templates
      DROP CONSTRAINT IF EXISTS platform_msg_templates_channel_check;
    ALTER TABLE public.platform_message_templates
      ADD CONSTRAINT platform_msg_templates_channel_check
      CHECK (channel IN ('email', 'whatsapp', 'sms', 'push', 'in_app'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Push templates: publishing_job.completed.<aggregate>
-- Distinct codes (resolver key) + data.variant for grouping.
-- Deep link: wingcaster://publish-receipt/:jobId
-- Placeholders: {N}/{M} (brief) and {{N}}/{{M}} (platform renderer).
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
  '32500000-0000-4000-8000-000000000001',
  'publishing_job.completed.all_succeeded',
  'Publish completed (all succeeded)',
  'Push when every destination on a publishing job succeeded.',
  'push',
  'notification',
  'en',
  NULL,
  'Published to {N} of {M} channels',
  NULL,
  'Your listing is live on all {M} selected portals. Open the receipt: wingcaster://publish-receipt/{{jobId}}',
  'raw',
  '["N", "M", "jobId"]'::jsonb,
  '["listing_short_ref"]'::jsonb,
  true, true, 1,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
  '{"variant":"all_succeeded","event":"publishing_job.completed","deep_link":"wingcaster://publish-receipt/:jobId"}'::jsonb
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
  '32500000-0000-4000-8000-000000000002',
  'publishing_job.completed.mixed',
  'Publish completed (mixed)',
  'Push when a publishing job has a mix of successes and failures.',
  'push',
  'notification',
  'en',
  NULL,
  'Published to {N} of {M} channels',
  NULL,
  '{N} of {M} portals succeeded; some failed. Open the receipt to retry: wingcaster://publish-receipt/{{jobId}}',
  'raw',
  '["N", "M", "jobId"]'::jsonb,
  '["listing_short_ref"]'::jsonb,
  true, true, 1,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
  '{"variant":"mixed","event":"publishing_job.completed","deep_link":"wingcaster://publish-receipt/:jobId"}'::jsonb
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
  '32500000-0000-4000-8000-000000000003',
  'publishing_job.completed.all_failed',
  'Publish completed (all failed)',
  'Push when every destination on a publishing job failed.',
  'push',
  'notification',
  'en',
  NULL,
  'Publish failed for all {M} channels',
  NULL,
  'Nothing went live. Open the receipt to see why and retry: wingcaster://publish-receipt/{{jobId}}',
  'raw',
  '["N", "M", "jobId"]'::jsonb,
  '["listing_short_ref"]'::jsonb,
  true, true, 1,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
  '{"variant":"all_failed","event":"publishing_job.completed","deep_link":"wingcaster://publish-receipt/:jobId"}'::jsonb
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
  '32500000-0000-4000-8000-000000000004',
  'publishing_job.completed.in_review_only',
  'Publish submitted (in review)',
  'Push when every destination is waiting on portal moderation.',
  'push',
  'notification',
  'en',
  NULL,
  'Submitted {M} channels for review',
  NULL,
  'Waiting on portal moderation for all {M} channels. Receipt: wingcaster://publish-receipt/{{jobId}}',
  'raw',
  '["N", "M", "jobId"]'::jsonb,
  '["listing_short_ref"]'::jsonb,
  true, true, 1,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
  '{"variant":"in_review_only","event":"publishing_job.completed","deep_link":"wingcaster://publish-receipt/:jobId"}'::jsonb
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
  '32500000-0000-4000-8000-000000000005',
  'publishing_job.completed.partial',
  'Publish completed (partial)',
  'Push when some destinations succeeded and others are still in review (no failures).',
  'push',
  'notification',
  'en',
  NULL,
  'Published to {N} of {M} channels',
  NULL,
  '{N} of {M} portals are live; the rest are in review. Receipt: wingcaster://publish-receipt/{{jobId}}',
  'raw',
  '["N", "M", "jobId"]'::jsonb,
  '["listing_short_ref"]'::jsonb,
  true, true, 1,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
  '{"variant":"partial","event":"publishing_job.completed","deep_link":"wingcaster://publish-receipt/:jobId"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.platform_message_templates
   WHERE code = 'publishing_job.completed.partial'
     AND language = 'en'
     AND territory_id IS NULL
);

-- Parent code (data.variant grouping). Resolver prefers the distinct codes above.
INSERT INTO public.platform_message_templates (
  id, code, display_name, description, channel, category,
  language, territory_id,
  subject, html_body, text_body,
  editor_mode, required_variables, optional_variables,
  is_active, is_seed, version,
  created_at, updated_at, data
)
SELECT
  '32500000-0000-4000-8000-000000000000',
  'publishing_job.completed',
  'Publish completed',
  'Parent push template for publishing job outcomes. Variants live on publishing_job.completed.<aggregate>.',
  'push',
  'notification',
  'en',
  NULL,
  'Published to {N} of {M} channels',
  NULL,
  'Publish finished. Open the receipt: wingcaster://publish-receipt/{{jobId}}',
  'raw',
  '["N", "M", "jobId"]'::jsonb,
  '["listing_short_ref", "variant"]'::jsonb,
  true, true, 1,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
  '{"event":"publishing_job.completed","deep_link":"wingcaster://publish-receipt/:jobId"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.platform_message_templates
   WHERE code = 'publishing_job.completed'
     AND language = 'en'
     AND territory_id IS NULL
);
