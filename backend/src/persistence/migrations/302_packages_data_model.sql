-- PR B — package data model (feature registry, versions, subscriptions,
-- property tracker). Compiler / lifecycle / billing-cycle worker land in
-- backend/src/lib/packages/.
--
-- Deviations from CURSOR_PACKAGE_DATA_MODEL.md are commented inline.

-- ---------------------------------------------------------------------------
-- Feature registry — master list of features that CAN be metered.
-- Packages reference these; PR D wires each to actual feature call sites.
-- ---------------------------------------------------------------------------
CREATE TABLE public.metered_features (
  id UUID PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'publishing.social', 'publishing.realestate', 'communication.whatsapp',
    'communication.sms', 'ai.content', 'ai.intelligence', 'assets.render',
    'other'
  )),
  meter_unit TEXT NOT NULL,
  cost_source TEXT NOT NULL CHECK (cost_source IN (
    'external_passthrough', 'ai_provider', 'platform_bulk', 'none'
  )),
  credits_per_unit BIGINT NOT NULL CHECK (credits_per_unit > 0),
  cost_per_unit_micro_usd BIGINT,
  active BOOLEAN NOT NULL DEFAULT true,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Package templates. A package is a NAMED subscription tier.
-- Versions are immutable; edits create new versions.
-- ---------------------------------------------------------------------------
CREATE TABLE public.product_packages (
  id UUID PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN (
    'free', 'starter', 'growth', 'pro', 'enterprise', 'custom'
  )),
  target_audience TEXT NOT NULL CHECK (target_audience IN ('agent', 'agency')),
  currency CHAR(3) NOT NULL,
  billing_cadence TEXT NOT NULL CHECK (billing_cadence IN ('monthly', 'quarterly', 'annual')),
  active BOOLEAN NOT NULL DEFAULT false,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_actor_id UUID,
  updated_by_actor_id UUID
);

CREATE TABLE public.product_package_versions (
  id UUID PRIMARY KEY,
  package_id UUID NOT NULL REFERENCES public.product_packages(id),
  version_number INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'DRAFT' CHECK (state IN (
    'DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'DEPRECATED'
  )),
  properties_covered INTEGER NOT NULL CHECK (properties_covered >= 0),
  monthly_price_minor BIGINT NOT NULL CHECK (monthly_price_minor >= 0),
  effective_from TIMESTAMPTZ,
  effective_to TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  published_by_actor_id UUID,
  deprecated_at TIMESTAMPTZ,
  deprecated_by_actor_id UUID,
  approval_request_id UUID REFERENCES fin.approval_requests(id),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (package_id, version_number),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE TABLE public.package_feature_quotas (
  id UUID PRIMARY KEY,
  package_version_id UUID NOT NULL REFERENCES public.product_package_versions(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES public.metered_features(id),
  credits_per_property BIGINT NOT NULL CHECK (credits_per_property >= 0),
  rollover_policy TEXT NOT NULL DEFAULT 'expire' CHECK (rollover_policy IN ('expire', 'carry')),
  overage_credit_price_micro_usd BIGINT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (package_version_id, feature_id)
);

CREATE TABLE public.package_feature_flags (
  id UUID PRIMARY KEY,
  package_version_id UUID NOT NULL REFERENCES public.product_package_versions(id) ON DELETE CASCADE,
  feature_code TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (package_version_id, feature_code)
);

-- ---------------------------------------------------------------------------
-- Tenant subscription state.
-- ---------------------------------------------------------------------------
CREATE TABLE public.tenant_subscriptions (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.credit_wallets(tenant_id),
  package_version_id UUID NOT NULL REFERENCES public.product_package_versions(id),
  status TEXT NOT NULL DEFAULT 'PENDING_START' CHECK (status IN (
    'PENDING_START', 'ACTIVE', 'PAUSED', 'CANCELED_AT_PERIOD_END', 'ENDED'
  )),
  billing_cycle_start TIMESTAMPTZ NOT NULL,
  billing_cycle_end TIMESTAMPTZ NOT NULL,
  next_grant_at TIMESTAMPTZ,
  properties_committed INTEGER NOT NULL CHECK (properties_committed >= 0),
  auto_renew BOOLEAN NOT NULL DEFAULT true,
  paused_at TIMESTAMPTZ,
  paused_by_actor_id UUID,
  canceled_at TIMESTAMPTZ,
  canceled_by_actor_id UUID,
  ended_at TIMESTAMPTZ,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version BIGINT NOT NULL DEFAULT 1,
  CHECK (billing_cycle_end > billing_cycle_start)
);

CREATE UNIQUE INDEX uq_tenant_subscription_active
  ON public.tenant_subscriptions (tenant_id)
  WHERE status IN ('PENDING_START', 'ACTIVE', 'PAUSED', 'CANCELED_AT_PERIOD_END');

CREATE INDEX idx_tenant_subscriptions_due
  ON public.tenant_subscriptions (status, next_grant_at)
  WHERE status IN ('PENDING_START', 'ACTIVE') AND next_grant_at IS NOT NULL;

CREATE INDEX idx_tenant_subscriptions_end
  ON public.tenant_subscriptions (status, billing_cycle_end)
  WHERE status IN ('ACTIVE', 'CANCELED_AT_PERIOD_END');

-- ---------------------------------------------------------------------------
-- Property tracker: active properties counted against properties_committed.
-- Independent of listing status.
-- ---------------------------------------------------------------------------
CREATE TABLE public.tenant_active_properties (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  property_id UUID NOT NULL,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deactivated_at TIMESTAMPTZ,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, property_id, activated_at)
);

CREATE INDEX idx_tenant_active_properties_open
  ON public.tenant_active_properties (tenant_id)
  WHERE deactivated_at IS NULL;

-- Deviation: spec UNIQUE (tenant_id, property_id, activated_at) still allows
-- two concurrently-open activations of the same property. Partial unique
-- index enforces one open row per (tenant, property).
CREATE UNIQUE INDEX uq_tenant_active_property_open
  ON public.tenant_active_properties (tenant_id, property_id)
  WHERE deactivated_at IS NULL;

-- Cadence arithmetic in SQL so JS Date month-overflow cannot drift cycle ends.
CREATE OR REPLACE FUNCTION public.package_add_cadence(start_at timestamptz, cadence text)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT $1 + CASE $2
    WHEN 'monthly' THEN interval '1 month'
    WHEN 'quarterly' THEN interval '3 months'
    WHEN 'annual' THEN interval '1 year'
    ELSE NULL
  END
$$;

-- ---------------------------------------------------------------------------
-- APPEND-ONLY discipline (matches PR A pattern).
-- Deviation: GRANT UPDATE on product_package_versions to fin_app_role so
-- publish/deprecate can mutate state fields. Economic fields are blocked by
-- the immutability trigger below. Spec REVOKEd UPDATE on versions entirely,
-- which would make PR C's publish path impossible without a SECURITY DEFINER
-- function (that function is PR C's to add if they want stricter grants).
-- ---------------------------------------------------------------------------
REVOKE UPDATE, DELETE, TRUNCATE ON public.product_package_versions FROM PUBLIC;
REVOKE UPDATE, DELETE, TRUNCATE ON public.package_feature_quotas FROM PUBLIC;
REVOKE UPDATE, DELETE, TRUNCATE ON public.package_feature_flags FROM PUBLIC;

GRANT SELECT, INSERT ON
  public.product_packages, public.product_package_versions,
  public.package_feature_quotas, public.package_feature_flags,
  public.metered_features
  TO fin_app_role, fin_migrate_role;
GRANT UPDATE ON public.product_packages TO fin_app_role;
GRANT UPDATE ON public.product_package_versions TO fin_app_role;
GRANT UPDATE ON public.metered_features TO fin_app_role;
GRANT SELECT, INSERT, UPDATE ON public.tenant_subscriptions TO fin_app_role;
GRANT SELECT, INSERT, UPDATE ON public.tenant_active_properties TO fin_app_role;

REVOKE UPDATE, DELETE, TRUNCATE ON public.package_feature_quotas FROM fin_app_role;
REVOKE UPDATE, DELETE, TRUNCATE ON public.package_feature_flags FROM fin_app_role;
REVOKE DELETE, TRUNCATE ON public.product_package_versions FROM fin_app_role;

GRANT SELECT ON
  public.product_packages, public.product_package_versions,
  public.package_feature_quotas, public.package_feature_flags,
  public.metered_features, public.tenant_subscriptions,
  public.tenant_active_properties
  TO fin_recon_role, fin_finance_role, fin_auditor_role, fin_migrate_role;

CREATE OR REPLACE FUNCTION public.trg_package_version_immutable_after_publish()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.state IN ('PUBLISHED', 'DEPRECATED')
     AND (
       NEW.properties_covered <> OLD.properties_covered
       OR NEW.monthly_price_minor <> OLD.monthly_price_minor
       OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
       OR NEW.version_number <> OLD.version_number
       OR NEW.package_id <> OLD.package_id
     ) THEN
    RAISE EXCEPTION 'PACKAGE_VERSION_IMMUTABLE: published/deprecated versions cannot mutate economic fields'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_package_version_immutable
  BEFORE UPDATE ON public.product_package_versions
  FOR EACH ROW EXECUTE FUNCTION public.trg_package_version_immutable_after_publish();

-- Deviation: block INSERT/UPDATE/DELETE on quotas and flags once the parent
-- version is published, so economics cannot be mutated via child-row inserts
-- (REVOKE UPDATE alone does not stop INSERT).
CREATE OR REPLACE FUNCTION public.trg_package_children_immutable_after_publish()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  parent_state TEXT;
  version_id UUID;
BEGIN
  version_id := COALESCE(NEW.package_version_id, OLD.package_version_id);
  SELECT v.state INTO parent_state
    FROM public.product_package_versions v
   WHERE v.id = version_id;
  IF parent_state IN ('PUBLISHED', 'DEPRECATED') THEN
    RAISE EXCEPTION 'PACKAGE_VERSION_IMMUTABLE: published/deprecated versions cannot mutate quotas or flags'
      USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_package_quotas_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON public.package_feature_quotas
  FOR EACH ROW EXECUTE FUNCTION public.trg_package_children_immutable_after_publish();

CREATE TRIGGER trg_package_flags_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON public.package_feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.trg_package_children_immutable_after_publish();
