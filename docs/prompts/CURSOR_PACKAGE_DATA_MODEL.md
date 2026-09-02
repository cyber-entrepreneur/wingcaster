# Cursor prompt — PR B: package data model + compiler + subscription lifecycle

This is PR B of the 4-PR arc (A ✅ → **B** → C → D). Data model + backend workers only. Do NOT ship any PR C (admin UI) or PR D (feature wiring / tenant UI) scope here. Enterprise-grade only — every hardening principle from PR A carries forward.

## Verified state on `main` after PR #31

- `public.credit_wallets`, `public.credit_grants`, `public.credit_consumptions`, `public.credit_reservations`, `public.credit_spend_caps` (mig 300) — the engine you built onto in PR A
- `backend/src/lib/credits/engine.js` — the `grant`, `reserve`, `consume`, `release` primitives
- `backend/src/lib/credits/wallets.js` — `ensureWallet`, `lockWallet`, `syntheticTenantId`
- `backend/src/lib/credits/fin-mirror-worker.js`, `janitor.js` — the two workers you'll be pattern-matching
- `backend/src/fin/reconciliation/checks.js` — R110-R114 are yours to add R115+ next to
- `fin.approval_requests`, `fin.financial_audit_events`, `fin.outbox_events` — for approval workflow + audit + async messaging
- `public.ai_call_usage` (mig 291) — the actual-cost source; already integrated in mirror worker for cost pass-through

## Goal

Ship the schema, seed the feature registry, build the compiler, and wire the billing-cycle worker so tenants on a subscription package receive their monthly credit grants automatically. Free tier + paid tiers both modeled. Zero admin UI (PR C) and zero feature-side wiring / tenant UI (PR D).

## New location

- `backend/src/lib/packages/registry.js` — feature registry query + seed helpers
- `backend/src/lib/packages/compiler.js` — `compileSubscriptionCycleGrant(subscription, cycleStart) → { total_credits, grant_ref, breakdown }`
- `backend/src/lib/packages/lifecycle.js` — subscription state transitions (start / pause / resume / cancel / end)
- `backend/src/lib/packages/billing-cycle-worker.js` — advances due subscriptions, emits cycle grants via the credit engine
- `backend/src/lib/packages/property-tracker.js` — mark listing active/inactive, cap at `properties_committed`
- `backend/src/persistence/migrations/302_packages_data_model.sql` — schema
- `backend/src/persistence/migrations/303_packages_feature_registry_seed.sql` — seed the feature registry with the 20-ish features the platform meters today
- `backend/src/persistence/migrations/304_packages_free_tier_seed.sql` — seed the free-tier package + version so unsubscribed tenants have a lawful state

## New schema (migration 302)

```sql
-- ---------------------------------------------------------------------------
-- Feature registry — master list of features that CAN be metered.
-- Packages reference these; PR D wires each to actual feature call sites.
-- ---------------------------------------------------------------------------
CREATE TABLE public.metered_features (
  id UUID PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,                    -- 'publishing.social.instagram'
  display_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'publishing.social', 'publishing.realestate', 'communication.whatsapp',
    'communication.sms', 'ai.content', 'ai.intelligence', 'assets.render',
    'other'
  )),
  meter_unit TEXT NOT NULL,                     -- 'post', 'conversation_window_24h', 'call', 'render', 'activation'
  cost_source TEXT NOT NULL CHECK (cost_source IN (
    'external_passthrough', 'ai_provider', 'platform_bulk', 'none'
  )),
  credits_per_unit BIGINT NOT NULL CHECK (credits_per_unit > 0),  -- the price per feature call, in centi-credits (scale 100)
  cost_per_unit_micro_usd BIGINT,               -- best current estimate of external cost, if known
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
  code TEXT UNIQUE NOT NULL,                    -- 'monthly-agent-starter'
  display_name TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN (
    'free', 'starter', 'growth', 'pro', 'enterprise', 'custom'
  )),
  target_audience TEXT NOT NULL CHECK (target_audience IN ('agent', 'agency')),
  currency CHAR(3) NOT NULL,
  billing_cadence TEXT NOT NULL CHECK (billing_cadence IN ('monthly', 'quarterly', 'annual')),
  active BOOLEAN NOT NULL DEFAULT false,        -- flipped true by publish; controls tenant-facing visibility
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

-- Per-feature per-property quota allocation within a package version.
-- Compiler multiplies credits_per_property × subscription.properties_committed
-- to derive the monthly grant totals per feature.
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

-- Non-metered tier-gated features (yes/no). Referenced by feature_entitlements
-- for the actual gate at feature call time.
CREATE TABLE public.package_feature_flags (
  id UUID PRIMARY KEY,
  package_version_id UUID NOT NULL REFERENCES public.product_package_versions(id) ON DELETE CASCADE,
  feature_code TEXT NOT NULL,                   -- 'white-label', 'command-center', 'xml-feed', 'inspector', 'multi-agent'
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
  next_grant_at TIMESTAMPTZ,                    -- when the billing-cycle worker will fire the next grant
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

-- Only one non-ended subscription per tenant at a time.
CREATE UNIQUE INDEX uq_tenant_subscription_active
  ON public.tenant_subscriptions (tenant_id)
  WHERE status IN ('PENDING_START', 'ACTIVE', 'PAUSED', 'CANCELED_AT_PERIOD_END');

-- ---------------------------------------------------------------------------
-- Property tracker: track which properties are counted as "active" against
-- the subscription's properties_committed cap. Independent of listing status.
-- ---------------------------------------------------------------------------
CREATE TABLE public.tenant_active_properties (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  property_id UUID NOT NULL,                    -- the listing/property id from listings.id
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deactivated_at TIMESTAMPTZ,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, property_id, activated_at)
);

-- Fast lookup of currently-active count per tenant.
CREATE INDEX idx_tenant_active_properties_open
  ON public.tenant_active_properties (tenant_id)
  WHERE deactivated_at IS NULL;

-- ---------------------------------------------------------------------------
-- APPEND-ONLY discipline (matches PR A pattern).
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
GRANT SELECT, INSERT, UPDATE ON public.tenant_subscriptions TO fin_app_role;
GRANT SELECT, INSERT, UPDATE ON public.tenant_active_properties TO fin_app_role;
GRANT UPDATE ON public.metered_features TO fin_app_role;

-- product_packages.active CAN be updated (activate/deactivate visibility);
-- but the immutable version snapshot cannot be edited once published.
CREATE OR REPLACE FUNCTION public.trg_package_version_immutable_after_publish()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.state IN ('PUBLISHED', 'DEPRECATED')
     AND (
       NEW.properties_covered <> OLD.properties_covered
       OR NEW.monthly_price_minor <> OLD.monthly_price_minor
       OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
       OR NEW.version_number <> OLD.version_number
     ) THEN
    RAISE EXCEPTION 'PACKAGE_VERSION_IMMUTABLE: published/deprecated versions cannot mutate economic fields';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_package_version_immutable
  BEFORE UPDATE ON public.product_package_versions
  FOR EACH ROW EXECUTE FUNCTION public.trg_package_version_immutable_after_publish();
```

## Feature registry seeding (migration 303)

Seed rows for every feature the platform meters today. Verified from the codebase — do NOT invent categories that don't map to real call sites:

- **Publishing / social** (per active-property post): `publishing.social.instagram`, `publishing.social.facebook`, `publishing.social.tiktok`, `publishing.social.x`, `publishing.social.linkedin`, `publishing.social.whatsapp`
- **Publishing / real-estate portals** (per active-property post): `publishing.realestate.olx`, `publishing.realestate.property_finder`, `publishing.realestate.bayut`, `publishing.realestate.dubizzle` — seed the ones known to be MENA-relevant; PR D wires the ones that have adapters
- **Communication**: `communication.whatsapp.conversation_window_24h` (Meta pricing), `communication.sms.per_message`
- **AI content**: `ai.post_creation`, `ai.contact_lead_score`, `ai.contact_lead_summary`, `ai.comment_classifier`
- **AI intelligence**: `ai.area_scoring`, `ai.market_pricing_analysis`, `ai.property_rating`, `ai.lead_gen_activation`
- **Assets**: `assets.render.social_card` (BannerBear-backed)

Every row must have:
- `credits_per_unit` — a defensible price (start at 100 = 1 full credit at scale 100; refine later)
- `cost_per_unit_micro_usd` — best current estimate (from PR #27's ai_pricing.js for AI features; from Meta / Twilio / BannerBear pricing for others; NULL if unknown)
- `cost_source` — `'external_passthrough'` for WhatsApp/SMS, `'ai_provider'` for AI, `'platform_bulk'` for BannerBear/Maps

Include a comment in the migration header referencing the source URL for each cost figure so future audits can trace pricing.

## Free-tier seed (migration 304)

Insert one package `code='free-agent'`, tier `'free'`, `active=true`, currency `USD`, cadence `monthly`. One published version with `properties_covered=0`, `monthly_price_minor=0`. Zero `package_feature_quotas` rows (no metered features). `package_feature_flags` rows for the free-tier gate-lifted features: `crm.contacts`, `crm.tasks`, `crm.opportunities`, `listings.crud` — i.e., anything the free tier includes.

The seed is important: PR D's tenant-provisioning code will attach a `PENDING_START` subscription pointing at this free-tier version for every new tenant with no paid selection. Without this seed, PR D has nothing to attach to.

## Package compiler (`compiler.js`)

```js
/**
 * Given an ACTIVE tenant_subscription and a target cycle start timestamp,
 * compute the total credit grant + a per-feature breakdown for the tenant UI.
 *
 * Returns:
 *   {
 *     total_credits: bigint,
 *     grant_ref: {
 *       subscription_id, package_version_id, cycle_start, cycle_end,
 *       properties_committed, idempotency_key
 *     },
 *     breakdown: [
 *       { feature_id, feature_code, credits_per_property,
 *         properties, total_credits }
 *     ]
 *   }
 *
 * Idempotency key format: `subscription_cycle:{subscription_id}:{cycle_start_iso}`.
 * If the credit engine's grant path sees this key with source='subscription_cycle',
 * it returns the original grant — replays are safe.
 */
export async function compileSubscriptionCycleGrant(client, { subscriptionId, cycleStart })
```

- Load subscription + package_version + package_feature_quotas + metered_features in one query
- Compute per-feature credits = `credits_per_property × properties_committed`
- Sum → total_credits
- Build grant_ref with idempotency_key = `subscription_cycle:{subscription_id}:{cycle_start_iso}`
- Return the tuple

The compiler is a PURE FUNCTION over the schema. It does NOT call the credit engine. The billing-cycle worker calls the compiler THEN calls `grant()`.

## Billing-cycle worker (`billing-cycle-worker.js`)

```js
export async function runBillingCycleWorkerTick({ pool, now = new Date().toISOString(), limit = 100 })
```

- Advisory lock `FIN_PACKAGE_BILLING_CYCLE = 1024` (add to advisory-locks.js)
- Batch 100 rows
- For each `tenant_subscriptions WHERE status = 'ACTIVE' AND next_grant_at <= now`:
  - Open tx, `SELECT ... FOR UPDATE` on the subscription row
  - Call `compileSubscriptionCycleGrant(client, ...)`
  - Call the credit engine's `grant()` with the compiled amount + grant_ref (idempotent via `grant_ref->>'idempotency_key'`)
  - Advance `billing_cycle_start` + `billing_cycle_end` by the package's `billing_cadence`
  - Set `next_grant_at = new_cycle_end` (grant fires AT the start of a cycle by convention; or at end depending on prepay/postpay — for prepaid subscriptions, `next_grant_at = billing_cycle_start` of the NEW cycle)
  - Bump `version`, `updated_at`
  - Insert `fin.outbox_events` topic `subscription.cycle_granted`
- Handle expiring subscriptions (`billing_cycle_end <= now AND auto_renew = false`): transition to `ENDED`, do NOT grant

Wire this in server.js the same way PR A wired the janitor + mirror worker (`CREDITS_BILLING_CYCLE_ENABLED` env toggle, default `true`; interval env var default 60_000ms).

## Subscription lifecycle (`lifecycle.js`)

State machine:

```
PENDING_START --(activate at billing_cycle_start)--> ACTIVE
ACTIVE --(pause admin action)--> PAUSED --(resume)--> ACTIVE
ACTIVE --(cancel end-of-period)--> CANCELED_AT_PERIOD_END --(cycle ends)--> ENDED
ACTIVE --(cancel immediate)--> ENDED
PAUSED --(cancel)--> ENDED
```

Provide functions:
- `startSubscription(client, { tenantId, packageVersionId, propertiesCommitted, billingCycleStart, autoRenew })` — inserts PENDING_START or ACTIVE row; enforces `uq_tenant_subscription_active`
- `pauseSubscription(client, { subscriptionId, actorId, reason })` — PAUSED; grants held during pause
- `resumeSubscription(client, { subscriptionId, actorId })` — back to ACTIVE
- `cancelAtPeriodEnd(client, { subscriptionId, actorId, reason })` — sets status; ENDs at cycle end
- `cancelImmediate(client, { subscriptionId, actorId, reason })` — ENDs now
- `changePlan(client, { subscriptionId, newPackageVersionId, prorate })` — ends current, creates new subscription for same tenant; if `prorate`, computes remaining-cycle credit grant/refund via the compiler

Every transition writes a `fin.financial_audit_events` row and a `fin.outbox_events` row for downstream (email notifications, invoicing).

## Property tracker (`property-tracker.js`)

- `activateProperty(client, { tenantId, propertyId })` — inserts `tenant_active_properties`; ensures active count ≤ `subscription.properties_committed`; throws `PROPERTY_LIMIT_EXCEEDED` if over
- `deactivateProperty(client, { tenantId, propertyId })` — sets `deactivated_at`
- `countActive(client, tenantId)` — returns integer

PR D calls these from listing status changes. This PR just ships the primitives.

## Reconciliation checks R115-R118

Add to `backend/src/fin/reconciliation/checks.js`:

- **R115** — package_version state invariant: `PENDING_APPROVAL` versions have `approval_request_id NOT NULL` referencing an active `fin.approval_requests`
- **R116** — subscription integrity: every ACTIVE subscription has a valid `package_version_id` referencing a PUBLISHED version whose `effective_from <= NOW() AND (effective_to IS NULL OR effective_to > NOW())`
- **R117** — property-limit sanity: for every ACTIVE subscription, `COUNT(tenant_active_properties WHERE deactivated_at IS NULL) <= properties_committed`
- **R118** — cycle grant coverage: every `tenant_subscriptions` past its first `billing_cycle_start` has at least one matching `credit_grants` row with `source='subscription_cycle'` and `grant_ref->>'subscription_id' = subscription.id`

Each with a GREEN test and a seeded-drift DRIFT test, matching the PR A R110-R114 pattern.

## Testing (all required)

- **Unit tests** for the compiler: known inputs → known totals; per-feature breakdown correct
- **Integration test** for the billing-cycle worker: seed an ACTIVE subscription with `next_grant_at <= now`, run one worker tick, assert `credit_grants` row appears with correct amount + grant_ref, next_grant_at advanced by the cadence
- **Idempotency test**: run the worker twice; assert no double-grant
- **Migration test**: apply 302 + 303 + 304 on a fresh DB, insert a tenant + attach the free-tier subscription, assert lifecycle works (start → paid tier → cancel end-of-period → ended)
- **Immutability test**: after publishing a package version, attempt to UPDATE `properties_covered`, assert trigger blocks with `PACKAGE_VERSION_IMMUTABLE`
- **Lifecycle test**: full state-machine coverage including `changePlan` prorating
- **Property-limit test**: `activateProperty` refuses when count == `properties_committed`; allows after `deactivateProperty`
- **Reconciliation tests** R115-R118 each: GREEN + DRIFT
- **R110 regression**: after a cycle grant lands via the compiler, R110 remains GREEN (wallet balance = SUM(grants) - SUM(consumptions))

## Scope guardrails (do NOT exceed)

- Do NOT build `/api/admin/fin/packages/*` routes or admin UI. PR C.
- Do NOT wire feature call sites (publish-social, listings-ai, market-pricing, area-intelligence) to check subscription entitlements or debit credits. PR D.
- Do NOT rebuild tenant-facing billing pages. PR D.
- Do NOT integrate Stripe / Paddle / manual-receipt payment flows. Separate workstream.
- Do NOT modify `feature_entitlements` semantics from PR A (still governed by the whatsapp-listings entitlement service today).
- Do NOT drop `fin.credit_products` — auto-topup still uses it.
- Do NOT delete `ai_credit_balances_deprecated_20260902` / `ai_credit_transactions_deprecated_20260902` — those stay for one more release cycle.

## Branch + PR

Branch: `feat/packages-data-model`
Base: `main`
PR title: `Package data model + compiler + subscription lifecycle + billing-cycle worker (PR B)`

## Definition of done

- Migrations 302 + 303 + 304 apply cleanly on a fresh test DB
- Free-tier package seeded and readable
- Feature registry seeded with every metered feature currently in the platform (cross-check `backend/src/lib/ai-pricing.js` + AI adapters + publish call sites; do NOT miss any)
- Compiler implemented + unit tested
- Billing-cycle worker implemented, wired in server.js with env toggle, exercised by integration test
- Property tracker + subscription lifecycle functions implemented + tested
- Reconciliation R115-R118 implemented + tested with GREEN + DRIFT
- All existing tests still pass (Fast + Real-Postgres + Web)
- No changes to PR A engine internals

## Deviations from spec

If any part of this spec looks wrong given what actually landed in PR A, or a design choice needs adjustment (locks already taken, column shapes need tweaks for existing DAL patterns, migration ordering constraints), do it and document under "Deviations from spec" in the PR body — following the same discipline PR A used. Do not silently narrow scope.

## Follow-ups NOT in this PR

- PR C — PA admin surface for packages: CRUD routes + admin UI pages + publish-approval workflow
- PR D — feature wiring: instrument publish-social, listings-ai, market-pricing, area-intelligence, whatsapp-listings extra callers, comment-classifier, etc.; rebuild tenant billing pages; per-feature quota display; overage top-up UI
