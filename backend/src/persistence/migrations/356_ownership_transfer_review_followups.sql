-- WF-31 review follow-ups (post BE-BLOCKER-31):
-- 1. Restore CAPABILITY_PACK_FINANCE_GRANT after 343_fin_approval_package_publish_kind
--    overwrote chk_approval_requests_action_kind without it (BE-29 + BE-34 collision).
-- 2. Seed ownership_transfer.target-expired (expiry path must not reuse decline copy).
-- 3. Seed ownership_transfer.transfer-reversed (reverse notifies both parties).

ALTER TABLE fin.approval_requests
  DROP CONSTRAINT IF EXISTS chk_approval_requests_action_kind;

ALTER TABLE fin.approval_requests
  ADD CONSTRAINT chk_approval_requests_action_kind
  CHECK (action_kind IN (
    'LARGE_GRANT',
    'LARGE_REFUND',
    'NEGATIVE_ADJUSTMENT',
    'FACILITY_OPS',
    'BACKDATED_AMENDMENT',
    'INVOICE_VOID',
    'WRITE_OFF',
    'RECONCILIATION_OVERRIDE',
    'MASS_OPERATION',
    'PLATFORM_ADMIN_RECOVERY',
    'AUDIT_RETENTION',
    'VENDOR_VARIANCE_OVERRIDE',
    'VENDOR_RATE_CHANGE',
    'COMPARABLE_REMOVE',
    'PRICE_REPORT_INCORPORATE',
    'PACKAGE_PUBLISH',
    'CAPABILITY_PACK_FINANCE_GRANT'
  ));

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
  'ownership_transfer.target-expired',
  'Ownership transfer expired',
  'Push when a pending ownership transfer expires without accept/decline.',
  'push',
  'notification',
  'en',
  NULL,
  'Ownership transfer for {{agency_name}} expired',
  NULL,
  'The transfer request expired without a response. Start a new transfer if you still want to proceed.',
  'raw',
  '["agency_name"]'::jsonb,
  '["transfer_id"]'::jsonb,
  true, true, 1,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
  '{"deep_link":"wingcaster://agency/settings/ownership-transfer","web_path":"/agency/settings/ownership-transfer","priority":"urgent","event":"ownership_transfer.expired"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM platform_message_templates
   WHERE code = 'ownership_transfer.target-expired'
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
  'ownership_transfer.transfer-reversed',
  'Ownership transfer reversed',
  'Push to both parties when ownership is reversed within the 30-day window.',
  'push',
  'notification',
  'en',
  NULL,
  'Ownership of {{agency_name}} was reversed',
  NULL,
  '{{restored_owner_name}} is the owner again. {{demoted_owner_name}} is now an Admin.',
  'raw',
  '["agency_name", "restored_owner_name", "demoted_owner_name"]'::jsonb,
  '["transfer_id"]'::jsonb,
  true, true, 1,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
  '{"deep_link":"wingcaster://ownership-transfer/outcome/:transferId","web_path":"/agency/ownership-transfer/outcome/:transferId","priority":"urgent","event":"ownership_transfer.reversed"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM platform_message_templates
   WHERE code = 'ownership_transfer.transfer-reversed'
     AND language = 'en'
     AND territory_id IS NULL
);
