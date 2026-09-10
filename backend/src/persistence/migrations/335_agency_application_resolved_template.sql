-- Wave 1 WF-02 / AGT-REC-004 — agency_application.resolved push templates.
-- File: 335_agency_application_resolved_template.sql
--
-- Idempotent: safe to re-run. Seeds three status-transition variants
-- (language=en, is_seed=true, channel=push). In-app copy lives in text_body;
-- subject is the push title.
--
-- Deep-link at send time: wingcaster://applications/:applicationId
-- Web path (Agent 4 / applications-routes redirect_to): /applications/:applicationId
--
-- Migration 335 chosen to sit after main's 329 and avoid open-PR collisions
-- on 330–334 (account-recovery cluster).

-- ---------------------------------------------------------------------------
-- Seed rows. Idempotent via WHERE NOT EXISTS on the global (code, language)
-- unique slot (territory_id IS NULL).
-- Copy from AGT-REC-004-application-outcome-brief.md §Notification hook.
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
  'agency_application.resolved.approved',
  'Agency application approved',
  'Push when an agency accepts an agent join application.',
  'push',
  'notification',
  'en',
  NULL,
  '{{agency_name}} accepted your application',
  NULL,
  'Welcome. Tap to switch to your new workspace.',
  'raw',
  '["agency_name"]'::jsonb,
  '["application_id"]'::jsonb,
  true, true, 1,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
  '{"deep_link":"wingcaster://applications/:applicationId","web_path":"/applications/:applicationId","priority":"urgent","event":"agency_application.resolved","variant":"approved"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM platform_message_templates
   WHERE code = 'agency_application.resolved.approved'
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
  'agency_application.resolved.rejected',
  'Agency application rejected',
  'Push when an agency declines an agent join application.',
  'push',
  'notification',
  'en',
  NULL,
  '{{agency_name}} responded to your application',
  NULL,
  'Your application was reviewed. Tap to see the outcome.',
  'raw',
  '["agency_name"]'::jsonb,
  '["application_id"]'::jsonb,
  true, true, 1,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
  '{"deep_link":"wingcaster://applications/:applicationId","web_path":"/applications/:applicationId","priority":"urgent","event":"agency_application.resolved","variant":"rejected"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM platform_message_templates
   WHERE code = 'agency_application.resolved.rejected'
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
  'agency_application.resolved.expired',
  'Agency application expired',
  'Push when a pending agency application times out after 30 days with no response.',
  'push',
  'notification',
  'en',
  NULL,
  'Your application to {{agency_name}} timed out',
  NULL,
  'No response after 30 days. Tap to re-apply or browse other agencies.',
  'raw',
  '["agency_name"]'::jsonb,
  '["application_id"]'::jsonb,
  true, true, 1,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
  '{"deep_link":"wingcaster://applications/:applicationId","web_path":"/applications/:applicationId","priority":"urgent","event":"agency_application.resolved","variant":"expired"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM platform_message_templates
   WHERE code = 'agency_application.resolved.expired'
     AND language = 'en'
     AND territory_id IS NULL
);
