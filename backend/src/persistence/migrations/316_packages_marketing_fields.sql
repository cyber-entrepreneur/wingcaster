-- Marketing-display fields for product packages + portal_groups catalog.
--
-- Display-layer only. Does NOT change billing / entitlement behavior:
--   * properties_covered and monthly_price_minor stay 0 on seeded versions
--   * feature_quotas / feature_toggles here are JSONB for the marketing site
--     and PA UI; they are NOT wired to package_feature_quotas / flags
--   * the free-agent package is deactivated (active=false), not deleted
--
-- All prices and quotas are PLACEHOLDERS. PA overrides via the admin UI.
-- Convention: -1 in a numeric quota = unlimited (marketing renders accordingly).
--
-- Schema notes vs the original dispatch SQL:
--   product_packages uses UUID ids, `active` (not is_active), and a closed
--   `tier` CHECK. product_package_versions uses version_number + state
--   (PUBLISHED, not ACTIVE). This migration extends that shape.

-- ---------------------------------------------------------------------------
-- 1. portal_groups — tier-to-portal-inclusion mapping (created first so the
--    version FK can reference it).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portal_groups (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT,
  portal_scope TEXT NOT NULL CHECK (portal_scope IN (
    'single_pick',
    'top_three_in_market',
    'all_in_market',
    'primary_plus_secondary',
    'all_mena_phase_1',
    'all_plus_priority'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.portal_groups (id, display_name, description, portal_scope) VALUES
  ('single_pick', 'Your #1 portal', 'Pick your primary listing channel — Bayut, Property Finder, Dubizzle, Aqar, or whichever leads your market.', 'single_pick'),
  ('top_three_in_market', 'Top 3 in your market', 'The three highest-traffic portals in your primary market.', 'top_three_in_market'),
  ('all_in_market', 'All portals in your market', 'Every integrated portal serving your primary market.', 'all_in_market'),
  ('primary_plus_secondary', 'Your market + 1 more', 'Every portal in your primary market plus the top 3 in one secondary market.', 'primary_plus_secondary'),
  ('all_mena_phase_1', 'All MENA Phase-1 portals', 'Every integrated portal across UAE, KSA, Egypt, and Lebanon.', 'all_mena_phase_1'),
  ('all_plus_priority', 'All portals + priority queue', 'Every integrated portal plus priority publishing queue and per-portal onboarding support.', 'all_plus_priority')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Extend product_packages (deactivated_at) and the closed tier CHECK so
--    Boutique/Agency/Brokerage can be first-class tiers without forking.
-- ---------------------------------------------------------------------------
ALTER TABLE public.product_packages
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

ALTER TABLE public.product_packages DROP CONSTRAINT IF EXISTS product_packages_tier_check;

DO $$
DECLARE
  rec record;
BEGIN
  -- Column CHECKs are stored as `tier = ANY (ARRAY[...])`, not `tier IN (...)`.
  FOR rec IN
    SELECT c.conname
      FROM pg_constraint c
     WHERE c.conrelid = 'public.product_packages'::regclass
       AND c.contype = 'c'
       AND pg_get_constraintdef(c.oid) ILIKE '%tier%'
       AND pg_get_constraintdef(c.oid) ILIKE '%starter%'
       AND pg_get_constraintdef(c.oid) NOT ILIKE '%brokerage%'
  LOOP
    EXECUTE format('ALTER TABLE public.product_packages DROP CONSTRAINT %I', rec.conname);
  END LOOP;
END $$;

ALTER TABLE public.product_packages
  ADD CONSTRAINT product_packages_tier_check CHECK (tier IN (
    'free', 'starter', 'small', 'growth', 'pro', 'agency', 'brokerage', 'enterprise', 'custom'
  ));

-- ---------------------------------------------------------------------------
-- 3. Extend product_package_versions with marketing-display fields.
--    Existing billing columns (properties_covered, monthly_price_minor)
--    are left untouched. Legacy published versions get NULLs / defaults.
-- ---------------------------------------------------------------------------
ALTER TABLE public.product_package_versions
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS tagline TEXT,
  ADD COLUMN IF NOT EXISTS agent_cap INTEGER,
  ADD COLUMN IF NOT EXISTS property_cap INTEGER,
  ADD COLUMN IF NOT EXISTS price_usd_monthly_minor INTEGER,
  ADD COLUMN IF NOT EXISTS price_usd_annual_minor INTEGER,
  ADD COLUMN IF NOT EXISTS trial_days INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sales_led BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS portal_group_id TEXT REFERENCES public.portal_groups(id),
  ADD COLUMN IF NOT EXISTS feature_quotas JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS feature_toggles JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS support_level TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.product_package_versions'::regclass
       AND conname = 'product_package_versions_support_level_check'
  ) THEN
    ALTER TABLE public.product_package_versions
      ADD CONSTRAINT product_package_versions_support_level_check
      CHECK (support_level IS NULL OR support_level IN (
        'email', 'email_chat', 'dedicated', 'dedicated_slack'
      ));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Deactivate the old free package. Keep the row for referential integrity
--    of historical subscriptions and free-tier onboarding lookups by code.
-- ---------------------------------------------------------------------------
UPDATE public.product_packages
   SET active = false,
       deactivated_at = NOW(),
       updated_at = NOW()
 WHERE tier = 'free'
   AND active = true;

-- ---------------------------------------------------------------------------
-- 5. Insert the six locked marketing tiers.
--    Billing economics (properties_covered, monthly_price_minor) stay 0.
-- ---------------------------------------------------------------------------
INSERT INTO public.product_packages (
  id, code, display_name, tier, target_audience, currency, billing_cadence,
  active, data, created_at, updated_at
) VALUES
  ('31600000-0000-4000-8000-000000000001', 'semsar',     'Semsar',     'starter',    'agent',  'USD', 'monthly', true, '{"seed":"marketing-placeholder"}'::jsonb, NOW(), NOW()),
  ('31600000-0000-4000-8000-000000000002', 'boutique',   'Boutique',   'small',      'agent',  'USD', 'monthly', true, '{"seed":"marketing-placeholder"}'::jsonb, NOW(), NOW()),
  ('31600000-0000-4000-8000-000000000003', 'small_team', 'Small Team', 'growth',     'agency', 'USD', 'monthly', true, '{"seed":"marketing-placeholder"}'::jsonb, NOW(), NOW()),
  ('31600000-0000-4000-8000-000000000004', 'agency',     'Agency',     'agency',     'agency', 'USD', 'monthly', true, '{"seed":"marketing-placeholder"}'::jsonb, NOW(), NOW()),
  ('31600000-0000-4000-8000-000000000005', 'brokerage',  'Brokerage',  'brokerage',  'agency', 'USD', 'monthly', true, '{"seed":"marketing-placeholder"}'::jsonb, NOW(), NOW()),
  ('31600000-0000-4000-8000-000000000006', 'enterprise', 'Enterprise', 'enterprise', 'agency', 'USD', 'monthly', true, '{"seed":"marketing-placeholder"}'::jsonb, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_package_versions (
  id, package_id, version_number, state,
  properties_covered, monthly_price_minor,
  effective_from, published_at, data,
  display_name, tagline, agent_cap, property_cap,
  price_usd_monthly_minor, price_usd_annual_minor,
  trial_days, sales_led, portal_group_id,
  feature_quotas, feature_toggles, support_level, sort_order
) VALUES
  (
    '31600000-0000-4000-8000-000000000011',
    '31600000-0000-4000-8000-000000000001',
    1, 'PUBLISHED',
    0, 0,
    NOW(), NOW(), '{"seed":"marketing-placeholder"}'::jsonb,
    'Semsar', 'For solo agents starting out',
    1, 3,
    1500, 15000,
    30, false, 'single_pick',
    '{"ai_post_creation": 20, "ai_property_rating": 10, "pricing_benchmark": 10, "property_scoring": 10, "push_notifications": 500, "sms": 50, "whatsapp_messages": 200, "email_sends": 1000, "design_credits": 0}'::jsonb,
    '{"ootb_social_cards": true, "open_design_template": false, "crm_pipeline": true, "unified_inbox": true, "whatsapp_intake": true}'::jsonb,
    'email', 1
  ),
  (
    '31600000-0000-4000-8000-000000000012',
    '31600000-0000-4000-8000-000000000002',
    1, 'PUBLISHED',
    0, 0,
    NOW(), NOW(), '{"seed":"marketing-placeholder"}'::jsonb,
    'Boutique', 'For small teams cutting their teeth',
    5, 10,
    4000, 40000,
    30, false, 'top_three_in_market',
    '{"ai_post_creation": 100, "ai_property_rating": 50, "pricing_benchmark": 50, "property_scoring": 50, "push_notifications": 2000, "sms": 200, "whatsapp_messages": 800, "email_sends": 5000, "design_credits": 0}'::jsonb,
    '{"ootb_social_cards": true, "open_design_template": false, "crm_pipeline": true, "unified_inbox": true, "whatsapp_intake": true}'::jsonb,
    'email', 2
  ),
  (
    '31600000-0000-4000-8000-000000000013',
    '31600000-0000-4000-8000-000000000003',
    1, 'PUBLISHED',
    0, 0,
    NOW(), NOW(), '{"seed":"marketing-placeholder"}'::jsonb,
    'Small Team', 'For growing agencies with a real book',
    10, 30,
    9900, 99000,
    30, false, 'all_in_market',
    '{"ai_post_creation": 300, "ai_property_rating": 150, "pricing_benchmark": 150, "property_scoring": 150, "push_notifications": 5000, "sms": 500, "whatsapp_messages": 2000, "email_sends": 15000, "design_credits": 50}'::jsonb,
    '{"ootb_social_cards": true, "open_design_template": true, "crm_pipeline": true, "unified_inbox": true, "whatsapp_intake": true}'::jsonb,
    'email_chat', 3
  ),
  (
    '31600000-0000-4000-8000-000000000014',
    '31600000-0000-4000-8000-000000000004',
    1, 'PUBLISHED',
    0, 0,
    NOW(), NOW(), '{"seed":"marketing-placeholder"}'::jsonb,
    'Agency', 'Multi-market agencies with structured operations',
    25, 75,
    19000, 190000,
    0, true, 'primary_plus_secondary',
    '{"ai_post_creation": 750, "ai_property_rating": 375, "pricing_benchmark": 375, "property_scoring": 375, "push_notifications": 12500, "sms": 1250, "whatsapp_messages": 5000, "email_sends": 40000, "design_credits": 200}'::jsonb,
    '{"ootb_social_cards": true, "open_design_template": true, "crm_pipeline": true, "unified_inbox": true, "whatsapp_intake": true}'::jsonb,
    'email_chat', 4
  ),
  (
    '31600000-0000-4000-8000-000000000015',
    '31600000-0000-4000-8000-000000000005',
    1, 'PUBLISHED',
    0, 0,
    NOW(), NOW(), '{"seed":"marketing-placeholder"}'::jsonb,
    'Brokerage', 'Regional brokerages across MENA',
    NULL, 250,
    50000, 500000,
    0, true, 'all_mena_phase_1',
    '{"ai_post_creation": 2500, "ai_property_rating": 1000, "pricing_benchmark": 1000, "property_scoring": 1000, "push_notifications": -1, "sms": 3000, "whatsapp_messages": -1, "email_sends": -1, "design_credits": 500}'::jsonb,
    '{"ootb_social_cards": true, "open_design_template": true, "crm_pipeline": true, "unified_inbox": true, "whatsapp_intake": true}'::jsonb,
    'dedicated', 5
  ),
  (
    '31600000-0000-4000-8000-000000000016',
    '31600000-0000-4000-8000-000000000006',
    1, 'PUBLISHED',
    0, 0,
    NOW(), NOW(), '{"seed":"marketing-placeholder"}'::jsonb,
    'Enterprise', 'Multi-country operators + white-glove support',
    NULL, 1000,
    100000, 1000000,
    0, true, 'all_plus_priority',
    '{"ai_post_creation": 5000, "ai_property_rating": 2000, "pricing_benchmark": 2000, "property_scoring": 2000, "push_notifications": -1, "sms": 5000, "whatsapp_messages": -1, "email_sends": -1, "design_credits": 1000}'::jsonb,
    '{"ootb_social_cards": true, "open_design_template": true, "crm_pipeline": true, "unified_inbox": true, "whatsapp_intake": true}'::jsonb,
    'dedicated_slack', 6
  )
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. Grants. The HTTP endpoint is unauthenticated; the DB role still needs
--    SELECT. PUBLIC SELECT is for the unauthenticated marketing read path.
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.portal_groups
  TO fin_app_role, fin_migrate_role;
GRANT SELECT ON public.portal_groups
  TO fin_recon_role, fin_finance_role, fin_auditor_role, fin_migrate_role;
GRANT SELECT ON public.portal_groups TO PUBLIC;
