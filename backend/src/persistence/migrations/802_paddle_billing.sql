-- Paddle billing foundation (money path).
--
-- WingCaster sells DB-driven SaaS packages and consumption via Paddle (merchant
-- of record). Paddle is the source of truth for money/invoices/tax; these tables
-- are the local mirror needed to (a) map a WingCaster tenant to its Paddle
-- customer, (b) correlate Paddle subscription/transaction webhooks back to a
-- tenant subscription, and (c) resolve which Paddle price to open checkout with.
--
-- Consistency: the credits subsystem (public.credit_wallets/credit_grants/…) is
-- NOT RLS-guarded — it relies on strict WHERE tenant_id = <authed> scoping in the
-- app layer and grants to fin_app_role. These tables follow the same posture.

-- ---------------------------------------------------------------------------
-- Tenant → Paddle customer mapping. Keyed by the CREDIT tenant id (the same
-- synthetic UUID public.tenant_subscriptions.tenant_id and public.credit_wallets
-- use — see creditTenantIdForScope), so the portal endpoint can resolve the
-- Paddle customer from the authenticated session without a Paddle API
-- round-trip. Populated by customer.created / customer.updated webhooks.
--
-- No FK to credit_wallets: a customer.created webhook can arrive before the
-- wallet row exists, and the mapping does not need referential coupling.
-- scope/scope_id mirror credit_wallets' addressing (agent|agency, id).
-- ---------------------------------------------------------------------------
CREATE TABLE public.tenant_billing_customers (
  tenant_id UUID PRIMARY KEY,
  scope TEXT,
  scope_id TEXT,
  paddle_customer_id TEXT NOT NULL,
  email TEXT,
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One Paddle customer maps to at most one tenant (per environment).
CREATE UNIQUE INDEX uq_tenant_billing_customers_paddle
  ON public.tenant_billing_customers (paddle_customer_id, environment);

CREATE INDEX idx_tenant_billing_customers_scope
  ON public.tenant_billing_customers (scope, scope_id)
  WHERE scope IS NOT NULL AND scope_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- External billing references on the subscription. No economic fields here, so
-- the product_package_versions immutability trigger is not involved (that
-- trigger is on product_package_versions, not tenant_subscriptions). The unique
-- partial index lets the webhook look a subscription up by its Paddle id.
-- ---------------------------------------------------------------------------
ALTER TABLE public.tenant_subscriptions
  ADD COLUMN IF NOT EXISTS paddle_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS paddle_customer_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_subscriptions_paddle_sub
  ON public.tenant_subscriptions (paddle_subscription_id)
  WHERE paddle_subscription_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Catalog map: which Paddle price backs a given billable thing. Single lookup
-- for both checkout (open the overlay/inline with paddle_price_id) and the
-- webhook (reverse-map a price back to what was bought). Extensible to
-- feature unlocks and template purchases without a schema change.
--   kind='subscription'   ref_id = product_package_versions.id (UUID as text)
--   kind='credit_unit'    ref_id = 'credit_unit'
--   kind='feature_unlock' ref_id = feature code   (future)
--   kind='template'       ref_id = template id     (future)
-- ---------------------------------------------------------------------------
CREATE TABLE public.paddle_price_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('subscription', 'credit_unit', 'feature_unlock', 'template')),
  ref_id TEXT NOT NULL,
  billing_cadence TEXT CHECK (billing_cadence IN ('monthly', 'annual')),
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  paddle_price_id TEXT NOT NULL,
  paddle_product_id TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One active price per (thing, cadence, environment). NULLS NOT DISTINCT so the
-- one-off kinds (billing_cadence IS NULL) still collide on duplicates.
CREATE UNIQUE INDEX uq_paddle_price_map_lookup
  ON public.paddle_price_map (kind, ref_id, billing_cadence, environment)
  NULLS NOT DISTINCT;

CREATE UNIQUE INDEX uq_paddle_price_map_price
  ON public.paddle_price_map (paddle_price_id, environment);

-- ---------------------------------------------------------------------------
-- Grants — mirror the credits subsystem (fin_app_role is the app role).
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.tenant_billing_customers TO fin_app_role;
GRANT SELECT, INSERT, UPDATE ON public.paddle_price_map TO fin_app_role;

GRANT SELECT ON public.tenant_billing_customers, public.paddle_price_map
  TO fin_recon_role, fin_finance_role, fin_auditor_role, fin_migrate_role;
