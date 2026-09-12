-- BE-BLOCKER-31 / WF-31 — ownership-transfer notification templates.
-- File: 341_ownership_transfer_templates.sql
--
-- Seeds 5 templates (language=en, is_seed=true, channel=push):
--   ownership_transfer.initiator-accepted
--   ownership_transfer.target-invited
--   ownership_transfer.target-declined
--   ownership_transfer.transfer-executed
--   ownership_transfer.reversal-window-expiring
--
-- Idempotent via WHERE NOT EXISTS on (code, language, territory_id IS NULL).

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
  'ownership_transfer.initiator-accepted',
  'Ownership transfer accepted (initiator)',
  'Push to the former owner when the target accepts ownership.',
  'push',
  'notification',
  'en',
  NULL,
  '{{target_name}} accepted ownership of {{agency_name}}',
  NULL,
  'You are now an Admin. Tap to review the outcome and the 30-day reversal window.',
  'raw',
  '["agency_name", "target_name"]'::jsonb,
  '["transfer_id"]'::jsonb,
  true, true, 1,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
  '{"deep_link":"wingcaster://ownership-transfer/outcome/:transferId","web_path":"/agency/ownership-transfer/outcome/:transferId","priority":"urgent","event":"ownership_transfer.accepted"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM platform_message_templates
   WHERE code = 'ownership_transfer.initiator-accepted'
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
  'ownership_transfer.target-invited',
  'Ownership transfer invitation (target)',
  'Push to the target admin when an owner initiates a transfer.',
  'push',
  'notification',
  'en',
  NULL,
  'You''ve been offered ownership of {{agency_name}}',
  NULL,
  '{{initiator_name}} wants you to become the owner. Tap to review and accept or decline.',
  'raw',
  '["agency_name", "initiator_name"]'::jsonb,
  '["transfer_id"]'::jsonb,
  true, true, 1,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
  '{"deep_link":"wingcaster://ownership-transfer/incoming/:transferId","web_path":"/agency/ownership-transfer/incoming/:transferId","priority":"urgent","event":"ownership_transfer.initiated"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM platform_message_templates
   WHERE code = 'ownership_transfer.target-invited'
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
  'ownership_transfer.target-declined',
  'Ownership transfer declined (initiator)',
  'Push to the initiator when the target declines ownership.',
  'push',
  'notification',
  'en',
  NULL,
  '{{target_name}} declined ownership of {{agency_name}}',
  NULL,
  'Reason: {{decline_reason}}. Tap to start a new transfer or contact them.',
  'raw',
  '["agency_name", "target_name", "decline_reason"]'::jsonb,
  '["transfer_id"]'::jsonb,
  true, true, 1,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
  '{"deep_link":"wingcaster://agency/settings/ownership-transfer","web_path":"/agency/settings/ownership-transfer","priority":"urgent","event":"ownership_transfer.declined"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM platform_message_templates
   WHERE code = 'ownership_transfer.target-declined'
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
  'ownership_transfer.transfer-executed',
  'Ownership transfer executed',
  'Push confirming ownership has flipped after accept.',
  'push',
  'notification',
  'en',
  NULL,
  'Ownership of {{agency_name}} has transferred',
  NULL,
  '{{new_owner_name}} is now the owner. The 30-day reversal window is open until {{reversal_deadline}}.',
  'raw',
  '["agency_name", "new_owner_name", "reversal_deadline"]'::jsonb,
  '["transfer_id", "former_owner_name"]'::jsonb,
  true, true, 1,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
  '{"deep_link":"wingcaster://ownership-transfer/outcome/:transferId","web_path":"/agency/ownership-transfer/outcome/:transferId","priority":"urgent","event":"ownership_transfer.executed"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM platform_message_templates
   WHERE code = 'ownership_transfer.transfer-executed'
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
  'ownership_transfer.reversal-window-expiring',
  'Ownership transfer reversal window expiring',
  'Push warning when the 30-day reversal window is nearly closed.',
  'push',
  'notification',
  'en',
  NULL,
  'Reversal window for {{agency_name}} closes soon',
  NULL,
  'You have until {{reversal_deadline}} to reverse ownership from within the app.',
  'raw',
  '["agency_name", "reversal_deadline"]'::jsonb,
  '["transfer_id", "days_remaining"]'::jsonb,
  true, true, 1,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
  '{"deep_link":"wingcaster://ownership-transfer/outcome/:transferId","web_path":"/agency/ownership-transfer/outcome/:transferId","priority":"normal","event":"ownership_transfer.reversal_window_expiring"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM platform_message_templates
   WHERE code = 'ownership_transfer.reversal-window-expiring'
     AND language = 'en'
     AND territory_id IS NULL
);
