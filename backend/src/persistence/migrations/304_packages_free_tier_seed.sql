-- PR B — free-tier package so unsubscribed tenants have a lawful state.
-- PR D attaches a PENDING_START subscription at this version on provision.
--
-- Zero metered quotas. Gate-lifted flags: CRM contacts/tasks/opportunities
-- and listing CRUD. No publishing, no AI, no WhatsApp send.
--
-- Insert version as DRAFT, attach flags, then publish — the child-immutability
-- trigger blocks flag inserts on already-PUBLISHED versions.

INSERT INTO public.product_packages (
  id, code, display_name, tier, target_audience, currency, billing_cadence,
  active, data, created_at, updated_at
) VALUES (
  '30400000-0000-4000-8000-000000000001',
  'free-agent',
  'Free Agent',
  'free',
  'agent',
  'USD',
  'monthly',
  true,
  '{"seed":"pr-b","notes":"lawful state for unsubscribed tenants"}'::jsonb,
  NOW(),
  NOW()
);

INSERT INTO public.product_package_versions (
  id, package_id, version_number, state,
  properties_covered, monthly_price_minor,
  effective_from, effective_to, published_at, data, created_at
) VALUES (
  '30400000-0000-4000-8000-000000000002',
  '30400000-0000-4000-8000-000000000001',
  1,
  'DRAFT',
  0,
  0,
  TIMESTAMPTZ '2020-01-01 00:00:00+00',
  NULL,
  NULL,
  '{"seed":"pr-b"}'::jsonb,
  NOW()
);

INSERT INTO public.package_feature_flags (
  id, package_version_id, feature_code, enabled, data
) VALUES
  ('30400000-0000-4000-8000-000000000011',
   '30400000-0000-4000-8000-000000000002',
   'crm.contacts', true, '{"free_tier":true}'::jsonb),
  ('30400000-0000-4000-8000-000000000012',
   '30400000-0000-4000-8000-000000000002',
   'crm.tasks', true, '{"free_tier":true}'::jsonb),
  ('30400000-0000-4000-8000-000000000013',
   '30400000-0000-4000-8000-000000000002',
   'crm.opportunities', true, '{"free_tier":true}'::jsonb),
  ('30400000-0000-4000-8000-000000000014',
   '30400000-0000-4000-8000-000000000002',
   'listings.crud', true, '{"free_tier":true}'::jsonb);

UPDATE public.product_package_versions
   SET state = 'PUBLISHED',
       published_at = NOW()
 WHERE id = '30400000-0000-4000-8000-000000000002';
