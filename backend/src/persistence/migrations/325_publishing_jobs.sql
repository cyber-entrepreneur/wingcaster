-- BE-BLOCKER-10 / WF-03 Agent 2
-- Additive publishing_jobs grouping table (fan-out: listing × N portals).
-- Idempotent. Do NOT rewrite 007_distribution.sql.
-- Reserved migration 325 only (326 is Agent 3 tracker indexes).

-- ---------------------------------------------------------------------------
-- publishing_jobs groups a fan-out publish (listing × N portals)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.publishing_jobs (
  id TEXT PRIMARY KEY,
  property_id TEXT REFERENCES public.properties(id) ON DELETE SET NULL,
  agent_id TEXT REFERENCES public.agents(id) ON DELETE SET NULL,
  agency_id TEXT REFERENCES public.agencies(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_publishing_jobs_agent_submitted
  ON public.publishing_jobs (agent_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_publishing_jobs_agent_id
  ON public.publishing_jobs (agent_id, id);

-- Nullable FK so legacy distribution_jobs rows remain valid.
ALTER TABLE public.distribution_jobs
  ADD COLUMN IF NOT EXISTS publishing_job_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.distribution_jobs'::regclass
       AND conname = 'distribution_jobs_publishing_job_id_fkey'
  ) THEN
    ALTER TABLE public.distribution_jobs
      ADD CONSTRAINT distribution_jobs_publishing_job_id_fkey
      FOREIGN KEY (publishing_job_id) REFERENCES public.publishing_jobs(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_distribution_jobs_publishing_job_id
  ON public.distribution_jobs (publishing_job_id);

CREATE INDEX IF NOT EXISTS idx_distribution_jobs_agent_id
  ON public.distribution_jobs (agent_id, id);

-- Speeds GET latest-attempt LATERAL (007 only indexes distribution_job_id).
CREATE INDEX IF NOT EXISTS idx_distribution_attempts_job_attempted
  ON public.distribution_attempts (distribution_job_id, attempted_at DESC);

COMMENT ON TABLE public.publishing_jobs IS
  'Fan-out publish grouping: one row per listing × N portal destinations (distribution_jobs).';
COMMENT ON COLUMN public.distribution_jobs.publishing_job_id IS
  'Parent publishing_jobs.id for fan-out. NULL on legacy one-row-per-platform jobs.';

-- ---------------------------------------------------------------------------
-- platform_message_templates.channel CHECK: add 'push' (Agent 4 does the same
-- for a different template — both must be idempotent so merge order is free).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  def text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO def
    FROM pg_constraint
   WHERE conrelid = 'public.platform_message_templates'::regclass
     AND conname = 'platform_msg_templates_channel_check';

  IF def IS NULL OR def NOT ILIKE '%''push''%' THEN
    ALTER TABLE public.platform_message_templates
      DROP CONSTRAINT IF EXISTS platform_msg_templates_channel_check;
    ALTER TABLE public.platform_message_templates
      ADD CONSTRAINT platform_msg_templates_channel_check
      CHECK (channel IN ('email', 'whatsapp', 'sms', 'push'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- publishing_job.completed push templates (AGT-PUB-003 notification hook).
-- Distinct codes + data.variant. Deep link: wingcaster://publish-receipt/:jobId
-- Placeholders {N} (succeeded) and {M} (total) are substituted in JS.
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
  'Publish completed — all succeeded',
  'Push when every destination of a publishing job succeeded.',
  'push',
  'notification',
  'en',
  NULL,
  NULL,
  NULL,
  'Published to {N} of {M} channels. Your listing is live on all selected channels.',
  'raw',
  '["N","M","jobId"]'::jsonb,
  '["deep_link"]'::jsonb,
  true, true, 1,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
  '{"variant":"all_succeeded","deep_link":"wingcaster://publish-receipt/{jobId}"}'::jsonb
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
  'Publish completed — mixed results',
  'Push when a publishing job has both successes and failures.',
  'push',
  'notification',
  'en',
  NULL,
  NULL,
  NULL,
  'Published to {N} of {M} channels. Some channels failed — open the receipt to retry or fix.',
  'raw',
  '["N","M","jobId"]'::jsonb,
  '["deep_link"]'::jsonb,
  true, true, 1,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
  '{"variant":"mixed","deep_link":"wingcaster://publish-receipt/{jobId}"}'::jsonb
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
  'Publish completed — all failed',
  'Push when every destination of a publishing job failed.',
  'push',
  'notification',
  'en',
  NULL,
  NULL,
  NULL,
  'Could not publish to any of {M} channels. Open the receipt to see why and retry.',
  'raw',
  '["N","M","jobId"]'::jsonb,
  '["deep_link"]'::jsonb,
  true, true, 1,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
  '{"variant":"all_failed","deep_link":"wingcaster://publish-receipt/{jobId}"}'::jsonb
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
  'Publish completed — in review',
  'Push when every destination is waiting on portal / PA review.',
  'push',
  'notification',
  'en',
  NULL,
  NULL,
  NULL,
  'Submitted to {M} channels for review. We will notify you when they go live.',
  'raw',
  '["N","M","jobId"]'::jsonb,
  '["deep_link"]'::jsonb,
  true, true, 1,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
  '{"variant":"in_review_only","deep_link":"wingcaster://publish-receipt/{jobId}"}'::jsonb
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
  'Publish completed — partial',
  'Push when some destinations succeeded and the rest are in review (none failed).',
  'push',
  'notification',
  'en',
  NULL,
  NULL,
  NULL,
  'Published to {N} of {M} channels. The rest are still in review.',
  'raw',
  '["N","M","jobId"]'::jsonb,
  '["deep_link"]'::jsonb,
  true, true, 1,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
  '{"variant":"partial","deep_link":"wingcaster://publish-receipt/{jobId}"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.platform_message_templates
   WHERE code = 'publishing_job.completed.partial'
     AND language = 'en'
     AND territory_id IS NULL
);
