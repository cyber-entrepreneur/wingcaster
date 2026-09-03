-- PR D — tenant quota query index + RLS on public.credit_*.
-- No new advisory locks. No new packages.
--
-- Deviation: fin_app_role is trusted (USING true). Engine connections do not
-- SET credits.tenant_id; forcing tenant GUC would break reserve/consume.
-- HTTP tenant routes still filter tenant_id = req.tenantId explicitly.
-- RLS is defense-in-depth for future non-app roles that set the GUC.

CREATE INDEX IF NOT EXISTS idx_credit_consumptions_tenant_feature_consumed
  ON public.credit_consumptions (tenant_id, feature, consumed_at DESC)
  INCLUDE (credits_amount);

INSERT INTO public.metered_features (
  id, code, display_name, category, meter_unit, cost_source,
  credits_per_unit, cost_per_unit_micro_usd, active, data
) VALUES (
  '30200000-0000-4000-8000-000000000099',
  'whatsapp-listings',
  'WhatsApp listings intake (legacy alias)',
  'other',
  'call',
  'ai_provider',
  100,
  5000,
  true,
  '{"legacy":true,"alias_of":"ai.listings_describe","reason":"PR A pipeline feature key; keeps R122 green for historical rows"}'::jsonb
)
ON CONFLICT (code) DO NOTHING;


ALTER TABLE public.credit_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_spend_caps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS credit_wallets_app ON public.credit_wallets;
CREATE POLICY credit_wallets_app ON public.credit_wallets
  FOR ALL TO fin_app_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS credit_grants_app ON public.credit_grants;
CREATE POLICY credit_grants_app ON public.credit_grants
  FOR ALL TO fin_app_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS credit_consumptions_app ON public.credit_consumptions;
CREATE POLICY credit_consumptions_app ON public.credit_consumptions
  FOR ALL TO fin_app_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS credit_reservations_app ON public.credit_reservations;
CREATE POLICY credit_reservations_app ON public.credit_reservations
  FOR ALL TO fin_app_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS credit_spend_caps_app ON public.credit_spend_caps;
CREATE POLICY credit_spend_caps_app ON public.credit_spend_caps
  FOR ALL TO fin_app_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS credit_wallets_tenant_guc ON public.credit_wallets;
CREATE POLICY credit_wallets_tenant_guc ON public.credit_wallets
  FOR SELECT
  USING (
    NULLIF(current_setting('credits.tenant_id', true), '') IS NULL
    OR tenant_id = NULLIF(current_setting('credits.tenant_id', true), '')::uuid
  );

DROP POLICY IF EXISTS credit_grants_tenant_guc ON public.credit_grants;
CREATE POLICY credit_grants_tenant_guc ON public.credit_grants
  FOR SELECT
  USING (
    NULLIF(current_setting('credits.tenant_id', true), '') IS NULL
    OR tenant_id = NULLIF(current_setting('credits.tenant_id', true), '')::uuid
  );

DROP POLICY IF EXISTS credit_consumptions_tenant_guc ON public.credit_consumptions;
CREATE POLICY credit_consumptions_tenant_guc ON public.credit_consumptions
  FOR SELECT
  USING (
    NULLIF(current_setting('credits.tenant_id', true), '') IS NULL
    OR tenant_id = NULLIF(current_setting('credits.tenant_id', true), '')::uuid
  );

DROP POLICY IF EXISTS credit_reservations_tenant_guc ON public.credit_reservations;
CREATE POLICY credit_reservations_tenant_guc ON public.credit_reservations
  FOR SELECT
  USING (
    NULLIF(current_setting('credits.tenant_id', true), '') IS NULL
    OR tenant_id = NULLIF(current_setting('credits.tenant_id', true), '')::uuid
  );
