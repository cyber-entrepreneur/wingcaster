-- BE-BLOCKER-27 — seed valuation.price_reports.submit on Pro-tier agent packages.
-- Boolean capability flag (same pattern as crm.contacts / listings.crud in 304/319);
-- NOT a metered_features row — AGT-APR-005 gates on package_feature_flags presence.
--
-- Seeds Pro + Pro Elite (target_audience=agent, tier=pro) when missing, attaches
-- the flag while DRAFT, then publishes. Also backfills any other pro/agent
-- package versions (PA-authored). Free / lower tiers are intentionally omitted
-- (absence = disabled).
--
-- Child-immutability trigger blocks flag inserts on PUBLISHED versions, so the
-- backfill briefly disables trg_package_flags_immutable (re-enabled after).

-- ---------------------------------------------------------------------------
-- 1. Pro Agent package + v1
-- ---------------------------------------------------------------------------
INSERT INTO public.product_packages (
  id, code, display_name, tier, target_audience, currency, billing_cadence,
  active, data, created_at, updated_at
) VALUES (
  '33000000-0000-4000-8000-000000000001',
  'pro-agent',
  'Pro',
  'pro',
  'agent',
  'USD',
  'monthly',
  true,
  '{"seed":"be-blocker-27","notes":"AGT-APR-005 price-report submit gate"}'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_package_versions (
  id, package_id, version_number, state,
  properties_covered, monthly_price_minor,
  effective_from, effective_to, published_at, data, created_at
) VALUES (
  '33000000-0000-4000-8000-000000000002',
  '33000000-0000-4000-8000-000000000001',
  1,
  'DRAFT',
  0,
  0,
  TIMESTAMPTZ '2020-01-01 00:00:00+00',
  NULL,
  NULL,
  '{"seed":"be-blocker-27"}'::jsonb,
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Pro Elite Agent package + v1
-- ---------------------------------------------------------------------------
INSERT INTO public.product_packages (
  id, code, display_name, tier, target_audience, currency, billing_cadence,
  active, data, created_at, updated_at
) VALUES (
  '33000000-0000-4000-8000-000000000003',
  'pro-elite-agent',
  'Pro Elite',
  'pro',
  'agent',
  'USD',
  'monthly',
  true,
  '{"seed":"be-blocker-27","notes":"AGT-APR-005 price-report submit gate (elite)"}'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_package_versions (
  id, package_id, version_number, state,
  properties_covered, monthly_price_minor,
  effective_from, effective_to, published_at, data, created_at
) VALUES (
  '33000000-0000-4000-8000-000000000004',
  '33000000-0000-4000-8000-000000000003',
  1,
  'DRAFT',
  0,
  0,
  TIMESTAMPTZ '2020-01-01 00:00:00+00',
  NULL,
  NULL,
  '{"seed":"be-blocker-27"}'::jsonb,
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Attach flags only while seed versions are still DRAFT (re-runs skip when PUBLISHED).
INSERT INTO public.package_feature_flags (
  id, package_version_id, feature_code, enabled, data
)
SELECT *
FROM (
  VALUES
    (
      '33000000-0000-4000-8000-000000000011'::uuid,
      '33000000-0000-4000-8000-000000000002'::uuid,
      'valuation.price_reports.submit',
      true,
      '{"seed":"be-blocker-27","category":"valuation"}'::jsonb
    ),
    (
      '33000000-0000-4000-8000-000000000012'::uuid,
      '33000000-0000-4000-8000-000000000004'::uuid,
      'valuation.price_reports.submit',
      true,
      '{"seed":"be-blocker-27","category":"valuation"}'::jsonb
    )
) AS seed(id, package_version_id, feature_code, enabled, data)
WHERE EXISTS (
  SELECT 1
    FROM public.product_package_versions ppv
   WHERE ppv.id = seed.package_version_id
     AND ppv.state = 'DRAFT'
)
ON CONFLICT (package_version_id, feature_code) DO NOTHING;

UPDATE public.product_package_versions
   SET state = 'PUBLISHED',
       published_at = COALESCE(published_at, NOW())
 WHERE id IN (
   '33000000-0000-4000-8000-000000000002',
   '33000000-0000-4000-8000-000000000004'
 )
   AND state = 'DRAFT';

-- ---------------------------------------------------------------------------
-- 3. Backfill any other pro/agent package versions (e.g. PA-authored PUBLISHED).
-- ---------------------------------------------------------------------------
ALTER TABLE public.package_feature_flags
  DISABLE TRIGGER trg_package_flags_immutable;

INSERT INTO public.package_feature_flags (
  id, package_version_id, feature_code, enabled, data
)
SELECT gen_random_uuid(),
       v.id,
       'valuation.price_reports.submit',
       true,
       '{"seed":"be-blocker-27","category":"valuation"}'::jsonb
  FROM public.product_package_versions v
  JOIN public.product_packages p ON p.id = v.package_id
 WHERE p.tier = 'pro'
   AND p.target_audience = 'agent'
   AND v.state IN ('DRAFT', 'PENDING_APPROVAL', 'PUBLISHED')
ON CONFLICT (package_version_id, feature_code) DO NOTHING;

ALTER TABLE public.package_feature_flags
  ENABLE TRIGGER trg_package_flags_immutable;
