-- Wave 2A — register paid ads metered features (flags OFF until Meta/Google approval).
-- Codes exist in metered_features for future package attachment; intentionally NOT
-- attached to any package_version here (absence = disabled, same as Free-tier pattern).
-- Expand category CHECK for publishing.paid (expand-contract; no destructive drop of rows).

ALTER TABLE public.metered_features
  DROP CONSTRAINT IF EXISTS metered_features_category_check;

ALTER TABLE public.metered_features
  ADD CONSTRAINT metered_features_category_check
  CHECK (category IN (
    'publishing.social',
    'publishing.realestate',
    'publishing.paid',
    'communication.whatsapp',
    'communication.sms',
    'ai.content',
    'ai.intelligence',
    'assets.render',
    'other'
  ));

INSERT INTO public.metered_features (
  id, code, display_name, category, meter_unit, cost_source,
  credits_per_unit, cost_per_unit_micro_usd, active, data
) VALUES
  (
    '70100000-0000-4000-8000-000000000001',
    'publishing.paid.meta_ads',
    'Meta Ads campaign delivery',
    'publishing.paid',
    'campaign',
    'platform_bulk',
    100,
    NULL,
    true,
    '{"channel":"meta_ads","kind":"paid","gate":"PROVIDER_NOT_APPROVED until Meta app review","source":"domain/paid-ads"}'::jsonb
  ),
  (
    '70100000-0000-4000-8000-000000000002',
    'publishing.paid.google_ads',
    'Google Ads campaign delivery (incl. Demand Gen / Gmail)',
    'publishing.paid',
    'campaign',
    'platform_bulk',
    100,
    NULL,
    true,
    '{"channel":"google_ads","kind":"paid","formats":["search","display","demand_gen","demand_gen_gmail"],"gate":"PROVIDER_NOT_APPROVED until Google Ads API approval","source":"domain/paid-ads"}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- Idempotent by code if ids already differ across environments.
INSERT INTO public.metered_features (
  id, code, display_name, category, meter_unit, cost_source,
  credits_per_unit, cost_per_unit_micro_usd, active, data
)
SELECT
  gen_random_uuid(),
  v.code,
  v.display_name,
  v.category,
  v.meter_unit,
  v.cost_source,
  v.credits_per_unit,
  v.cost_per_unit_micro_usd,
  v.active,
  v.data
FROM (
  VALUES
    (
      'publishing.paid.meta_ads',
      'Meta Ads campaign delivery',
      'publishing.paid',
      'campaign',
      'platform_bulk',
      100,
      NULL::bigint,
      true,
      '{"channel":"meta_ads","kind":"paid","gate":"PROVIDER_NOT_APPROVED until Meta app review","source":"domain/paid-ads"}'::jsonb
    ),
    (
      'publishing.paid.google_ads',
      'Google Ads campaign delivery (incl. Demand Gen / Gmail)',
      'publishing.paid',
      'campaign',
      'platform_bulk',
      100,
      NULL::bigint,
      true,
      '{"channel":"google_ads","kind":"paid","formats":["search","display","demand_gen","demand_gen_gmail"],"gate":"PROVIDER_NOT_APPROVED until Google Ads API approval","source":"domain/paid-ads"}'::jsonb
    )
) AS v(code, display_name, category, meter_unit, cost_source, credits_per_unit, cost_per_unit_micro_usd, active, data)
WHERE NOT EXISTS (
  SELECT 1 FROM public.metered_features mf WHERE mf.code = v.code
);
