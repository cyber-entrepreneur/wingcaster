# Cursor dispatch — Packages: marketing-display fields + public pricing endpoint

**PR title:** `feat(packages): marketing-display fields per tier + public /api/public/pricing-tiers endpoint`

**Base branch:** `main`

**Estimated effort:** ~3 days of Cursor work + review.

**Rev 1 — 2026-09-06.** Superseded pricing values: pricing model was locked 2026-09-06 (no permanent Free tier, trial-first for Semsar/Boutique/Small Team, sales-led for Agency/Brokerage/Enterprise). This PR ships the backend that makes those tiers PA-editable AND publishes a public endpoint the marketing site reads at build time.

---

## 1. Why this PR

The `packages/*` module (PRs #33-#39) already models tiers as `product_packages + product_package_versions`. Today those rows carry billing-relevant fields (`tier`, `code`, `credits_per_month`, etc.) but no marketing-display fields — no per-tier caps, no per-feature quota display, no portal-group tiering, no support-level metadata. The marketing site (`wingcaster-www`) reads a static `src/config/pricing.ts` file that duplicates this data with drift risk.

This PR:
1. Extends `product_package_versions` with the marketing-display fields the PA + the marketing site need.
2. Adds a `portal_groups` table so tier-to-portal-inclusion is a first-class concept, not hardcoded.
3. Ships `GET /api/public/pricing-tiers` — no auth, cached, ISR-friendly. Marketing site reads it. Removes the static `pricing.ts` as source of truth (see companion PR `CURSOR_WWW_PRICING_FROM_API.md`).
4. Seeds placeholder values for all 6 self-serve + sales-led tiers so the marketing site renders correctly at deploy time. PA can override every value via the admin UI later (companion PR `CURSOR_PA_PACKAGE_EDIT_UI.md`).

**Do NOT modify the billing behavior of packages.** This PR is additive on the display layer only. Existing entitlement checks, credit metering, and subscription provisioning stay untouched.

---

## 2. Scope

### 2.1 Read the existing packages module FIRST

Before writing any code, read:
- `backend/src/persistence/migrations/302_packages_data_model.sql` — original schema
- `backend/src/persistence/migrations/303_packages_feature_registry_seed.sql` — feature registry
- `backend/src/persistence/migrations/304_packages_free_tier_seed.sql` — the current free-tier row (which this PR REPLACES with the new tier definitions)
- `backend/src/lib/packages/*` — the module code (schema, admin routes, onboarding)
- `backend/src/lib/credits/features.js` — the 22 FEATURES constants

Understand the existing shape. Extend, don't fork.

### 2.2 Migration 316 — schema extension + portal_groups + seed replacement

**Verify migration number at branch time.** Main is at 315 as of PR #50 merge. Read `backend/src/persistence/migrations/` and use the next unused integer >= 316.

**`NNN_packages_marketing_fields.sql`:**

```sql
-- 1. Extend product_package_versions with marketing-display fields.
ALTER TABLE public.product_package_versions
  ADD COLUMN IF NOT EXISTS display_name TEXT,           -- e.g. "Semsar" (customer-facing)
  ADD COLUMN IF NOT EXISTS tagline TEXT,                -- e.g. "For solo agents starting out"
  ADD COLUMN IF NOT EXISTS agent_cap INTEGER,           -- NULL = unlimited
  ADD COLUMN IF NOT EXISTS property_cap INTEGER,        -- required for every tier
  ADD COLUMN IF NOT EXISTS price_usd_monthly_minor INTEGER,  -- USD cents, e.g. 1500 for $15
  ADD COLUMN IF NOT EXISTS price_usd_annual_minor INTEGER,   -- typically monthly × 10 (2 months free)
  ADD COLUMN IF NOT EXISTS trial_days INTEGER DEFAULT 0,     -- 0 = no trial, 30 = one-month
  ADD COLUMN IF NOT EXISTS sales_led BOOLEAN DEFAULT false,  -- true = "Book a demo" CTA, no self-serve checkout
  ADD COLUMN IF NOT EXISTS portal_group_id TEXT REFERENCES portal_groups(id),
  ADD COLUMN IF NOT EXISTS feature_quotas JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS feature_toggles JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS support_level TEXT
    CHECK (support_level IN ('email', 'email_chat', 'dedicated', 'dedicated_slack')),
  ADD COLUMN IF NOT EXISTS sort_order INTEGER;

-- 2. portal_groups — tier-to-portal-inclusion mapping.
CREATE TABLE IF NOT EXISTS public.portal_groups (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,           -- e.g. "Your #1 portal", "Top 3 in your market"
  description TEXT,                     -- customer-facing explanation
  portal_scope TEXT NOT NULL CHECK (portal_scope IN (
    'single_pick',                      -- Semsar: agent picks 1 portal in their market
    'top_three_in_market',              -- Boutique: top-3 portals in agent's primary market
    'all_in_market',                    -- Small Team: all portals in primary market
    'primary_plus_secondary',           -- Agency: primary market + 1 secondary market
    'all_mena_phase_1',                 -- Brokerage: all Phase-1 portals across MENA
    'all_plus_priority'                 -- Enterprise: all + priority queue
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

-- 3. Seed the six locked tiers as the new canonical product_packages set.
-- The old 'free' package from migration 304 gets superseded (mark as inactive; keep row for referential integrity of any historical subscriptions).
UPDATE public.product_packages
   SET is_active = false, deactivated_at = NOW()
 WHERE tier = 'free';

-- Insert the new tier packages.
INSERT INTO public.product_packages (id, code, tier, is_active) VALUES
  ('pkg_semsar',     'semsar',     'starter',    true),
  ('pkg_boutique',   'boutique',   'small',      true),
  ('pkg_small_team', 'small_team', 'growth',     true),
  ('pkg_agency',     'agency',     'agency',     true),
  ('pkg_brokerage',  'brokerage',  'brokerage',  true),
  ('pkg_enterprise', 'enterprise', 'enterprise', true)
ON CONFLICT (id) DO NOTHING;

-- Insert version 1 rows for each tier with the locked marketing-display values.
-- All quotas are PLACEHOLDER values — PA overrides via the admin UI.
INSERT INTO public.product_package_versions (
  id, package_id, version, status, effective_from,
  display_name, tagline, agent_cap, property_cap,
  price_usd_monthly_minor, price_usd_annual_minor,
  trial_days, sales_led, portal_group_id,
  feature_quotas, feature_toggles, support_level, sort_order
) VALUES
  (
    'ppv_semsar_v1', 'pkg_semsar', 1, 'ACTIVE', NOW(),
    'Semsar', 'For solo agents starting out',
    1, 3,
    1500, 15000,                       -- $15/mo, $150/yr (2 months free = pay 10)
    30, false, 'single_pick',
    '{"ai_post_creation": 20, "ai_property_rating": 10, "pricing_benchmark": 10, "property_scoring": 10, "push_notifications": 500, "sms": 50, "whatsapp_messages": 200, "email_sends": 1000, "design_credits": 0}'::jsonb,
    '{"ootb_social_cards": true, "open_design_template": false, "crm_pipeline": true, "unified_inbox": true, "whatsapp_intake": true}'::jsonb,
    'email', 1
  ),
  (
    'ppv_boutique_v1', 'pkg_boutique', 1, 'ACTIVE', NOW(),
    'Boutique', 'For small teams cutting their teeth',
    5, 10,
    4000, 40000,                       -- $40/mo, $400/yr
    30, false, 'top_three_in_market',
    '{"ai_post_creation": 100, "ai_property_rating": 50, "pricing_benchmark": 50, "property_scoring": 50, "push_notifications": 2000, "sms": 200, "whatsapp_messages": 800, "email_sends": 5000, "design_credits": 0}'::jsonb,
    '{"ootb_social_cards": true, "open_design_template": false, "crm_pipeline": true, "unified_inbox": true, "whatsapp_intake": true}'::jsonb,
    'email', 2
  ),
  (
    'ppv_small_team_v1', 'pkg_small_team', 1, 'ACTIVE', NOW(),
    'Small Team', 'For growing agencies with a real book',
    10, 30,
    9900, 99000,                       -- $99/mo, $990/yr
    30, false, 'all_in_market',
    '{"ai_post_creation": 300, "ai_property_rating": 150, "pricing_benchmark": 150, "property_scoring": 150, "push_notifications": 5000, "sms": 500, "whatsapp_messages": 2000, "email_sends": 15000, "design_credits": 50}'::jsonb,
    '{"ootb_social_cards": true, "open_design_template": true, "crm_pipeline": true, "unified_inbox": true, "whatsapp_intake": true}'::jsonb,
    'email_chat', 3
  ),
  (
    'ppv_agency_v1', 'pkg_agency', 1, 'ACTIVE', NOW(),
    'Agency', 'Multi-market agencies with structured operations',
    25, 75,
    19000, 190000,                     -- $190/mo, $1900/yr
    0, true, 'primary_plus_secondary',
    '{"ai_post_creation": 750, "ai_property_rating": 375, "pricing_benchmark": 375, "property_scoring": 375, "push_notifications": 12500, "sms": 1250, "whatsapp_messages": 5000, "email_sends": 40000, "design_credits": 200}'::jsonb,
    '{"ootb_social_cards": true, "open_design_template": true, "crm_pipeline": true, "unified_inbox": true, "whatsapp_intake": true}'::jsonb,
    'email_chat', 4
  ),
  (
    'ppv_brokerage_v1', 'pkg_brokerage', 1, 'ACTIVE', NOW(),
    'Brokerage', 'Regional brokerages across MENA',
    NULL, 250,                        -- NULL agent_cap = unlimited
    50000, 500000,                     -- $500/mo, $5000/yr
    0, true, 'all_mena_phase_1',
    '{"ai_post_creation": 2500, "ai_property_rating": 1000, "pricing_benchmark": 1000, "property_scoring": 1000, "push_notifications": -1, "sms": 3000, "whatsapp_messages": -1, "email_sends": -1, "design_credits": 500}'::jsonb,
    '{"ootb_social_cards": true, "open_design_template": true, "crm_pipeline": true, "unified_inbox": true, "whatsapp_intake": true}'::jsonb,
    'dedicated', 5
  ),
  (
    'ppv_enterprise_v1', 'pkg_enterprise', 1, 'ACTIVE', NOW(),
    'Enterprise', 'Multi-country operators + white-glove support',
    NULL, 1000,                       -- NULL agent_cap = unlimited
    100000, 1000000,                   -- $1000/mo, $10000/yr
    0, true, 'all_plus_priority',
    '{"ai_post_creation": 5000, "ai_property_rating": 2000, "pricing_benchmark": 2000, "property_scoring": 2000, "push_notifications": -1, "sms": 5000, "whatsapp_messages": -1, "email_sends": -1, "design_credits": 1000}'::jsonb,
    '{"ootb_social_cards": true, "open_design_template": true, "crm_pipeline": true, "unified_inbox": true, "whatsapp_intake": true}'::jsonb,
    'dedicated_slack', 6
  )
ON CONFLICT (id) DO NOTHING;
```

**`-1` in a quota column means "unlimited"** — established convention, marketing site renders as "Unlimited".

**All quotas + prices are PLACEHOLDER values.** PA overrides every value via the admin UI once `CURSOR_PA_PACKAGE_EDIT_UI.md` ships. Do NOT treat them as final.

**Grant statements:** add `GRANT SELECT ON portal_groups TO PUBLIC;` (the marketing endpoint is unauthenticated) plus whatever grants the existing packages tables need.

### 2.3 Schema helper: `TierConfigResolver`

New module `backend/src/lib/packages/tier-config.js`:

```js
// Aggregates the marketing-display view of the active tier catalog.
// Called by the public endpoint (§2.4) and by any internal consumer that
// needs "what does the customer see for tier X" — e.g. the trial signup
// flow, the entitlement upgrade prompt, etc.

export async function getActiveTierCatalog(client) {
  // Returns the ordered list of ACTIVE package versions with joined
  // portal_group data.
  // Shape per row:
  //   {
  //     id: 'pkg_semsar',
  //     code: 'semsar',
  //     display_name: 'Semsar',
  //     tagline: 'For solo agents starting out',
  //     agent_cap: 1 | null,
  //     property_cap: 3,
  //     price: { monthly_usd: 15.00, annual_usd: 150.00, currency: 'USD' },
  //     trial_days: 30,
  //     sales_led: false,
  //     portal_group: { id, display_name, description, portal_scope },
  //     feature_quotas: { ai_post_creation: 20, ... },
  //     feature_toggles: { ootb_social_cards: true, ... },
  //     support_level: 'email',
  //     sort_order: 1,
  //   }
  //
  // Only returns tiers where product_packages.is_active = true AND the
  // version has status = 'ACTIVE' AND effective_from <= NOW().
}
```

Zod schema for the return shape lives in the same file, exported for the endpoint handler to reuse.

### 2.4 Public endpoint `GET /api/public/pricing-tiers`

New file: `backend/src/lib/packages/public-pricing-routes.js`:

```js
// GET /api/public/pricing-tiers
// - No auth.
// - Returns { tiers: [...], currency: 'USD', generated_at: ISO }.
// - Cache-Control: public, s-maxage=300, stale-while-revalidate=600
//   (5-minute edge cache; 10-minute stale window while revalidating).
// - Supports ETag for conditional GETs.
// - Rate-limited (existing IP-based limiter is sufficient — this is public
//   read data, but we don't want abuse).
```

Register the route from `server.js` alongside the other public routes (health check, robots, etc.).

The endpoint response is the exact shape the marketing site (`wingcaster-www`) needs — no post-processing on the client. Match the shape to the `TierConfigResolver` output at §2.3.

### 2.5 On-demand invalidation hook

When PA saves a package version change (companion PR `CURSOR_PA_PACKAGE_EDIT_UI.md`), the backend should POST to a webhook that tells `wingcaster-www` to revalidate its `/pricing` ISR page. Scaffold the webhook trigger here but leave the actual dispatch to the PA PR — this PR just exposes the hook mechanism:

```js
// backend/src/lib/packages/marketing-revalidate.js
export async function triggerMarketingRevalidate(reason = 'tier_updated') {
  const url = process.env.MARKETING_REVALIDATE_URL
  const secret = process.env.MARKETING_REVALIDATE_SECRET
  if (!url || !secret) {
    logger.info({ reason }, 'marketing revalidate skipped — env not configured')
    return { skipped: true, reason: 'env_missing' }
  }
  // POST to the marketing site's /api/revalidate endpoint with an HMAC signature.
  // Non-blocking — failures logged but don't break the PA save.
}
```

Env vars documented in `docs/deployment/RAILWAY_ENV_VARS.md`:
- `MARKETING_REVALIDATE_URL` — e.g. `https://wingcaster.com/api/revalidate`
- `MARKETING_REVALIDATE_SECRET` — shared HMAC secret

### 2.6 Zod schemas + tests

- `TierConfigSchema` in `tier-config.js` — validates each returned tier row.
- `PricingTiersResponseSchema` in `public-pricing-routes.js` — validates the full endpoint response.
- Fast tests: schema validation on placeholder data.
- Real-Postgres tests:
  - Migration applies cleanly on a fresh DB.
  - `getActiveTierCatalog` returns the 6 seeded tiers in `sort_order`.
  - The old `free` package is marked `is_active = false`.
  - Endpoint returns 200 with the expected shape.
  - Endpoint respects `Cache-Control` header.
  - Inactive packages are excluded.
  - `NULL` agent_cap serializes as `agent_cap: null` (marketing site renders as "Unlimited").
  - `-1` in feature_quotas rendered as the raw `-1` (marketing site renders as "Unlimited" per the -1 convention).

---

## 3. Non-negotiables

1. **Do NOT modify billing behavior.** Existing entitlement checks, credit metering, subscription provisioning stay untouched. This PR adds display-layer fields only.
2. **Old `free` package is deactivated, not deleted.** Any legacy subscriptions still reference it; row must stay for referential integrity.
3. **All quotas + prices are placeholder.** PA overrides every value. Do NOT ship marketing-final numbers via this migration.
4. **Public endpoint is unauthenticated** but rate-limited via the existing IP limiter.
5. **`-1` = unlimited in numeric quota columns.** Established convention. Marketing site renders accordingly.
6. **Migration number verified at branch time.** Main is at 315 as of PR #50; use next unused integer >= 316.
7. **Fast + Real-Postgres CI green.**

---

## 4. Test discipline

- **Fast tests** (`tier-config.test.js`, `public-pricing-routes.test.js`):
  - Zod schemas accept/reject expected shapes.
  - Endpoint handler returns correct headers.
- **Real-Postgres tests** (`packages-marketing-fields.postgres.test.js`):
  - Migration applies + seeds 6 tiers + 6 portal_groups.
  - Old free package deactivated.
  - `getActiveTierCatalog` returns 6 tiers in sort_order.
  - Endpoint returns 200 with correct shape.
  - After manually updating a package version's `price_usd_monthly_minor`, endpoint reflects the change (no stale cache in-process).
  - Setting a package's `is_active = false` removes it from the endpoint.
  - Setting a version's `status = 'DRAFT'` removes it from the endpoint (only ACTIVE serves).

---

## 5. Definition of done

1. Migration 316 (or next available) applies cleanly + seeds 6 tiers + 6 portal_groups + deactivates old free.
2. `TierConfigResolver` module + Zod schemas.
3. `GET /api/public/pricing-tiers` live under public routes.
4. `triggerMarketingRevalidate` scaffolded (dispatch call comes from PA PR).
5. Env vars documented in `RAILWAY_ENV_VARS.md`.
6. Fast + Real-Postgres CI green.
7. PR body includes:
   - Example curl of the public endpoint response with the seeded 6 tiers.
   - Note that quotas + prices are placeholders and PA can override.
   - Confirmation that no billing behavior changed (entitlement checks + credit metering + subscription provisioning tested unaffected).

---

## 6. Follow-ups (do NOT include in this PR)

- **Marketing site refactor:** companion PR `CURSOR_WWW_PRICING_FROM_API.md` deletes `wingcaster-www/src/config/pricing.ts` and fetches from this endpoint.
- **PA edit UI:** companion PR `CURSOR_PA_PACKAGE_EDIT_UI.md` builds the admin surface for editing tier fields. Slots into the Screen Matrix implementation workstream.
- **Real quota + price values:** PA fills them in via the admin UI once available; interim, ops can manually UPDATE the seeded rows.
- **Actual on-demand marketing revalidation dispatch:** PA PR wires the HTTP POST with HMAC signature.
- **Currency localization:** endpoint returns USD only in v1. Multi-currency (AED, SAR, EGP, LBP) is a Phase-2 concern with a currency-conversion table.

---

## 7. Out of scope

- Any change to billing behavior, credit metering, or subscription provisioning.
- Multi-currency display (USD only in v1).
- Real-time cache invalidation on every save (5-minute edge cache is acceptable for v1).
- Frontend rendering of the tier catalog (companion PR handles it).
- PA edit UI (companion PR handles it).
- Removing legacy free-tier code paths from other modules (the old free package stays deactivated for referential integrity).
