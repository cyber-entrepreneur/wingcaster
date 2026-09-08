-- BE-BLOCKER-05 / Wave 0.5 Agent 3 — agency free-tier package seed.
-- Mirrors 304_packages_free_tier_seed.sql for target_audience='agency'.
-- Used when an agency owner registers a new agency (path c): createAgencyWithOwner
-- provisions a PENDING_START/ACTIVE subscription at this version.
--
-- Zero metered quotas. Gate-lifted flags match agent free-tier baseline:
-- CRM contacts/tasks/opportunities and listing CRUD.
--
-- Insert version as DRAFT, attach flags, then publish — the child-immutability
-- trigger blocks flag inserts on already-PUBLISHED versions.
-- Idempotent: ON CONFLICT DO NOTHING; flag attach only while DRAFT.

INSERT INTO public.product_packages (
  id, code, display_name, tier, target_audience, currency, billing_cadence,
  active, data, created_at, updated_at
) VALUES (
  '31900000-0000-4000-8000-000000000001',
  'free-agency',
  'Free Agency',
  'free',
  'agency',
  'USD',
  'monthly',
  true,
  '{"seed":"be-blocker-05","notes":"lawful state for unsubscribed agency tenants"}'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_package_versions (
  id, package_id, version_number, state,
  properties_covered, monthly_price_minor,
  effective_from, effective_to, published_at, data, created_at
) VALUES (
  '31900000-0000-4000-8000-000000000002',
  '31900000-0000-4000-8000-000000000001',
  1,
  'DRAFT',
  0,
  0,
  TIMESTAMPTZ '2020-01-01 00:00:00+00',
  NULL,
  NULL,
  '{"seed":"be-blocker-05"}'::jsonb,
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Attach flags only while the seed version is still DRAFT (re-runs skip when PUBLISHED).
INSERT INTO public.package_feature_flags (
  id, package_version_id, feature_code, enabled, data
)
SELECT *
FROM (
  VALUES
    ('31900000-0000-4000-8000-000000000011'::uuid,
     '31900000-0000-4000-8000-000000000002'::uuid,
     'crm.contacts',
     true,
     '{"free_tier":true}'::jsonb),
    ('31900000-0000-4000-8000-000000000012'::uuid,
     '31900000-0000-4000-8000-000000000002'::uuid,
     'crm.tasks',
     true,
     '{"free_tier":true}'::jsonb),
    ('31900000-0000-4000-8000-000000000013'::uuid,
     '31900000-0000-4000-8000-000000000002'::uuid,
     'crm.opportunities',
     true,
     '{"free_tier":true}'::jsonb),
    ('31900000-0000-4000-8000-000000000014'::uuid,
     '31900000-0000-4000-8000-000000000002'::uuid,
     'listings.crud',
     true,
     '{"free_tier":true}'::jsonb)
) AS seed(id, package_version_id, feature_code, enabled, data)
WHERE EXISTS (
  SELECT 1
    FROM public.product_package_versions ppv
   WHERE ppv.id = '31900000-0000-4000-8000-000000000002'
     AND ppv.state = 'DRAFT'
)
ON CONFLICT (id) DO NOTHING;

UPDATE public.product_package_versions
   SET state = 'PUBLISHED',
       published_at = COALESCE(published_at, NOW())
 WHERE id = '31900000-0000-4000-8000-000000000002'
   AND state = 'DRAFT';
