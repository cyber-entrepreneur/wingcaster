-- BE-BLOCKER-12 — portal_submission.status_changed push templates.
-- File: 327_portal_submission_status_changed_template.sql
--
-- Idempotent: safe to re-run, and safe if Agent 2's 325 already extended
-- platform_message_templates.channel to include 'push' (drop/re-add only
-- when 'push' is missing; existing extra channels are preserved).
--
-- Seeds five status-transition variants (language=en, is_seed=true,
-- channel=push). In-app copy lives in text_body; subject is the push title.
-- Deep-link at send time: wingcaster://publishing/receipts/:distributionAttemptId

-- ---------------------------------------------------------------------------
-- Extend channel CHECK to include 'push' without clobbering extra values
-- another migration may have already added (e.g. 325).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  def text;
  channels text[];
BEGIN
  SELECT pg_get_constraintdef(c.oid)
    INTO def
    FROM pg_constraint c
   WHERE c.conname = 'platform_msg_templates_channel_check'
     AND c.conrelid = 'public.platform_message_templates'::regclass;

  IF def IS NOT NULL AND def ILIKE '%''push''%' THEN
    RETURN;
  END IF;

  IF def IS NOT NULL THEN
    SELECT array_agg(match[1] ORDER BY ordinality)
      INTO channels
      FROM regexp_matches(def, '''([^'']+)''', 'g') WITH ORDINALITY AS t(match, ordinality);
  END IF;

  IF channels IS NULL OR array_length(channels, 1) IS NULL THEN
    channels := ARRAY['email', 'whatsapp', 'sms'];
  END IF;

  IF NOT ('push' = ANY (channels)) THEN
    channels := array_append(channels, 'push');
  END IF;

  ALTER TABLE public.platform_message_templates
    DROP CONSTRAINT IF EXISTS platform_msg_templates_channel_check;

  EXECUTE format(
    'ALTER TABLE public.platform_message_templates
       ADD CONSTRAINT platform_msg_templates_channel_check
       CHECK (channel IN (%s))',
    (SELECT string_agg(quote_literal(ch), ', ') FROM unnest(channels) AS ch)
  );
END $$;

-- ---------------------------------------------------------------------------
-- Seed rows. Idempotent via WHERE NOT EXISTS on the global (code, language)
-- unique slot (territory_id IS NULL).
-- Copy from AGT-PUB-006-portal-tracker-brief.md notification hook.
-- ---------------------------------------------------------------------------

INSERT INTO platform_message_templates (
  id, code, display_name, description, channel, category,
  language, territory_id,
  subject, html_body, text_body,
  editor_mode, required_variables, optional_variables,
  is_active, is_seed, version,
  created_at, updated_at, data
)
SELECT
  gen_random_uuid()::text,
  'portal_submission.status_changed.live',
  'Portal listing went live',
  'Push when a portal accepts a listing and it is now live.',
  'push',
  'notification',
  'en',
  NULL,
  '{{portal_name}} accepted your listing',
  NULL,
  '{{listing_address}} is now live on {{portal_name}}.',
  'raw',
  '["portal_name", "listing_address"]'::jsonb,
  '["sla_days", "distribution_attempt_id"]'::jsonb,
  true, true, 1,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
  '{"deep_link":"wingcaster://publishing/receipts/:distributionAttemptId","priority":"urgent"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM platform_message_templates
   WHERE code = 'portal_submission.status_changed.live'
     AND language = 'en'
     AND territory_id IS NULL
);

INSERT INTO platform_message_templates (
  id, code, display_name, description, channel, category,
  language, territory_id,
  subject, html_body, text_body,
  editor_mode, required_variables, optional_variables,
  is_active, is_seed, version,
  created_at, updated_at, data
)
SELECT
  gen_random_uuid()::text,
  'portal_submission.status_changed.rejected',
  'Portal listing rejected',
  'Push when a portal does not accept a listing.',
  'push',
  'notification',
  'en',
  NULL,
  '{{portal_name}} didn''t accept your listing',
  NULL,
  'See the reason and fix it — tap to review.',
  'raw',
  '["portal_name"]'::jsonb,
  '["listing_address", "sla_days", "distribution_attempt_id"]'::jsonb,
  true, true, 1,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
  '{"deep_link":"wingcaster://publishing/receipts/:distributionAttemptId","priority":"urgent"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM platform_message_templates
   WHERE code = 'portal_submission.status_changed.rejected'
     AND language = 'en'
     AND territory_id IS NULL
);

INSERT INTO platform_message_templates (
  id, code, display_name, description, channel, category,
  language, territory_id,
  subject, html_body, text_body,
  editor_mode, required_variables, optional_variables,
  is_active, is_seed, version,
  created_at, updated_at, data
)
SELECT
  gen_random_uuid()::text,
  'portal_submission.status_changed.failed',
  'Portal delivery failed',
  'Push when delivery to a portal fails.',
  'push',
  'notification',
  'en',
  NULL,
  'Delivery to {{portal_name}} failed',
  NULL,
  'Retry or contact support — tap to see details.',
  'raw',
  '["portal_name"]'::jsonb,
  '["listing_address", "sla_days", "distribution_attempt_id"]'::jsonb,
  true, true, 1,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
  '{"deep_link":"wingcaster://publishing/receipts/:distributionAttemptId","priority":"urgent"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM platform_message_templates
   WHERE code = 'portal_submission.status_changed.failed'
     AND language = 'en'
     AND territory_id IS NULL
);

INSERT INTO platform_message_templates (
  id, code, display_name, description, channel, category,
  language, territory_id,
  subject, html_body, text_body,
  editor_mode, required_variables, optional_variables,
  is_active, is_seed, version,
  created_at, updated_at, data
)
SELECT
  gen_random_uuid()::text,
  'portal_submission.status_changed.expired',
  'Portal submission timed out',
  'Push when a portal submission times out with no response after SLA days.',
  'push',
  'notification',
  'en',
  NULL,
  'Submission to {{portal_name}} timed out',
  NULL,
  'No portal response after {{sla_days}} days. Tap to see options.',
  'raw',
  '["portal_name", "sla_days"]'::jsonb,
  '["listing_address", "distribution_attempt_id"]'::jsonb,
  true, true, 1,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
  '{"deep_link":"wingcaster://publishing/receipts/:distributionAttemptId","priority":"urgent"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM platform_message_templates
   WHERE code = 'portal_submission.status_changed.expired'
     AND language = 'en'
     AND territory_id IS NULL
);

INSERT INTO platform_message_templates (
  id, code, display_name, description, channel, category,
  language, territory_id,
  subject, html_body, text_body,
  editor_mode, required_variables, optional_variables,
  is_active, is_seed, version,
  created_at, updated_at, data
)
SELECT
  gen_random_uuid()::text,
  'portal_submission.status_changed.in_review',
  'Portal started reviewing listing',
  'Push when a portal starts reviewing a listing. Batched: max 1/hour per user via dispatch alert_type + priority=normal.',
  'push',
  'notification',
  'en',
  NULL,
  '{{portal_name}} started reviewing your listing',
  NULL,
  'You''ll get another update when they decide.',
  'raw',
  '["portal_name"]'::jsonb,
  '["listing_address", "sla_days", "distribution_attempt_id"]'::jsonb,
  true, true, 1,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
  '{"deep_link":"wingcaster://publishing/receipts/:distributionAttemptId","priority":"normal","alert_type":"portal_submission.status_changed.in_review"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM platform_message_templates
   WHERE code = 'portal_submission.status_changed.in_review'
     AND language = 'en'
     AND territory_id IS NULL
);
