# Credit engine + package management — implementation design

**Status:** Design, not implementation. Every subsequent PR (A → D) is checked against this doc.
**Written:** 2026-09-02. Supersedes: `docs/design/CREDIT_SYSTEM_DESIGN.md` where they conflict (that doc gave the shape; this one is the concrete build).
**Verified against:** `origin/main` commit `eb34ee1` (post-strip, post-schema-backfill, post-AI-usage-logging).

## The arc

Four sequenced PRs. Each has enterprise-grade acceptance criteria, not MVP-grade. No feature ships to a real customer until all four land.

| PR | Ships | Depends on |
|---|---|---|
| **A** — Enterprise credit engine | Extracted, hardened credit + entitlement engine at platform level. All 11 hardening items. Every existing whatsapp-listings caller migrated to it. | Nothing new. |
| **B** — Package data model | New `fin.packages` + `fin.package_features` schema. Compiler that turns a subscribed package into `fin.contract_components`. Property-count as first-class. Full versioning + lifecycle state machine. | PR A merged. |
| **C** — PA package admin surface | Backend routes at `/api/admin/fin/packages/*` + web pages under `web/src/pages/admin/fin/packages/`. Create, edit, publish, deprecate, version, approve. Approval workflow for publish. | PR B merged. |
| **D** — Feature wiring + tenant UI | Wire every paid feature (publish-social, listings-ai, market-pricing, area-intelligence, whatsapp-listings) to the credit engine via a single instrumentation pattern. Rebuild tenant billing pages the strip deleted. | PR C merged. |

## Confirmed state on `main` (verified by grep, not from .md docs)

- `fin.credit_products` exists (mig 171). Single-currency flat credit pack. No admin route, no admin UI.
- `fin.contracts` + `fin.contract_components` exist (mig 116). Component kinds cover `ENTITLEMENT`, `USAGE_LIMIT`, `PROMOTIONAL_GRANT`, `OVERAGE_PRICE`, `CREDIT_FACILITY`, `ROLLOVER`, `BILLING_RULE`, `MINIMUM_SPEND` — the shape supports what we need for packages, but nothing composes them from a package template.
- `public.ai_credit_balances`, `public.feature_entitlements`, `public.ai_credit_transactions` exist (mig 010). Whatsapp-listings-scoped credit engine. Zero idempotency, zero concurrency locks, zero cost pass-through, zero reconciliation, zero spend caps, zero hanging-reservation janitor, zero append-only enforcement, zero fin.* mirroring.
- `public.ai_call_usage` exists (mig 291, PR #27). Per-provider per-tenant token usage log. Not yet consumed by any pricing logic.
- ContractsPage.tsx is a 15-line read-only table. No compose-from-components UI. No package concept.
- Tenant-facing billing UI does not exist on `main` (strip removed the legacy commercial pages; nothing replaced them).

---

## PR A — Enterprise credit engine

### Location

Move + rebuild the credit engine as a new top-level module. Not under `whatsapp-listings/` any more.

- `backend/src/lib/credits/` — the engine (services, DAL wrapper, DB helpers)
- `backend/src/lib/credits/routes.js` — platform-level `/api/agent/credits/*` and `/api/agency/credits/*`
- `backend/src/lib/credits/admin-routes.js` — platform-admin routes for grants/refunds/adjustments
- `backend/src/persistence/migrations/300_credits_hardening.sql` — new schema (see below); does NOT drop the old whatsapp-listings tables (data migration follows in the same PR)
- `backend/src/persistence/migrations/301_credits_backfill_from_wa.sql` — migrates existing whatsapp-listings rows into the new tables, preserves history
- `backend/src/modules/whatsapp-listings/application/credits.js` → deprecated, becomes a thin re-export wrapper around the new module during transition, deleted at PR end

### New schema

```sql
-- New credits engine tables. All under public.* (hot-path); fin.* mirrors from
-- these via triggers or async worker (see "Fin.* double-entry mirroring" below).

CREATE TABLE public.credit_wallets (
  tenant_id UUID PRIMARY KEY,
  currency CHAR(3) NOT NULL,
  credits_remaining BIGINT NOT NULL DEFAULT 0 CHECK (credits_remaining >= 0),
  credits_reserved BIGINT NOT NULL DEFAULT 0 CHECK (credits_reserved >= 0),
  billing_period_start TIMESTAMPTZ,
  billing_period_end TIMESTAMPTZ,
  version BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (credits_reserved <= credits_remaining)
);

-- Append-only. Every grant creates one row. Every UPDATE and DELETE is REVOKED.
CREATE TABLE public.credit_grants (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  source TEXT NOT NULL CHECK (source IN (
    'subscription_cycle', 'topup.stripe', 'topup.paddle',
    'topup.manual_receipt_omt', 'topup.manual_receipt_whish',
    'topup.manual_receipt_monty', 'topup.manual_receipt_bank_transfer',
    'topup.manual_receipt_paypal', 'promo', 'goodwill',
    'migration', 'facility_draw', 'adjustment.correction'
  )),
  amount BIGINT NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL,
  grant_ref JSONB NOT NULL DEFAULT '{}'::jsonb,  -- structured provenance
  package_id UUID,                                -- FK filled at PR B
  billing_period_start TIMESTAMPTZ,
  billing_period_end TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  granted_by_actor_type TEXT,
  granted_by_actor_id UUID,
  approval_request_id UUID REFERENCES fin.approval_requests(id),  -- required for grants > threshold
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Append-only. Every debit creates one row.
CREATE TABLE public.credit_consumptions (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  feature TEXT NOT NULL,
  call_type TEXT NOT NULL,
  request_id TEXT NOT NULL,          -- idempotency key from the caller
  credits_amount BIGINT NOT NULL CHECK (credits_amount > 0),
  actual_cost_micro_usd BIGINT,      -- from ai_call_usage.cost_estimate_micro_usd when applicable
  provider TEXT,
  model TEXT,
  related_entity_type TEXT,
  related_entity_id TEXT,
  reservation_id UUID,               -- FK to credit_reservations, resolved
  consumed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, request_id, feature, call_type)  -- idempotency guard
);

-- Reservations. Auto-released by janitor after N minutes if not resolved.
CREATE TABLE public.credit_reservations (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  feature TEXT NOT NULL,
  request_id TEXT NOT NULL,
  credits_amount BIGINT NOT NULL CHECK (credits_amount > 0),
  status TEXT NOT NULL DEFAULT 'HELD' CHECK (status IN ('HELD', 'CONSUMED', 'RELEASED', 'EXPIRED')),
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL,   -- reserved_at + reservation_ttl_minutes
  resolved_at TIMESTAMPTZ,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, request_id, feature)
);

-- Configurable per-tenant spend caps (velocity limits). Enforced at reserve time.
CREATE TABLE public.credit_spend_caps (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  feature TEXT,                       -- NULL = applies across all features
  window_kind TEXT NOT NULL CHECK (window_kind IN ('MINUTE', 'HOUR', 'DAY', 'WEEK', 'MONTH')),
  max_credits BIGINT NOT NULL CHECK (max_credits > 0),
  active BOOLEAN NOT NULL DEFAULT true,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_credit_grants_tenant_granted ON public.credit_grants (tenant_id, granted_at DESC);
CREATE INDEX idx_credit_consumptions_tenant_consumed ON public.credit_consumptions (tenant_id, consumed_at DESC);
CREATE INDEX idx_credit_consumptions_feature ON public.credit_consumptions (feature, consumed_at DESC);
CREATE INDEX idx_credit_reservations_expiring ON public.credit_reservations (status, expires_at) WHERE status = 'HELD';

-- Append-only enforcement
REVOKE UPDATE, DELETE, TRUNCATE ON public.credit_grants FROM PUBLIC, wingcaster_app, wingcaster_admin;
REVOKE UPDATE, DELETE, TRUNCATE ON public.credit_consumptions FROM PUBLIC, wingcaster_app, wingcaster_admin;
-- Only wingcaster_migrator can ever mutate history; that role is used only by migrations.

-- Wallet has controlled UPDATE (balance changes on grant/consume via trigger). No DELETE.
REVOKE DELETE, TRUNCATE ON public.credit_wallets FROM PUBLIC, wingcaster_app, wingcaster_admin;
```

### Concurrency + idempotency

Every mutation goes through one of these three helpers, all in `lib/credits/engine.js`:

**`reserve(tenantId, feature, request_id, credits, ttlMinutes)`**
1. `BEGIN`
2. `SELECT * FROM credit_wallets WHERE tenant_id = $1 FOR UPDATE` — row lock
3. Check spend caps: for each active cap, `SELECT COALESCE(SUM(credits_amount), 0) FROM credit_consumptions WHERE tenant_id=$1 AND (feature=$2 OR feature IS NULL from cap) AND consumed_at > NOW() - window` + reservations HELD in same window. If sum + new credits > max_credits, throw `SPEND_CAP_EXCEEDED`.
4. If `credits_remaining - credits_reserved < credits`, throw `INSUFFICIENT_CREDITS`.
5. `INSERT INTO credit_reservations (tenant_id, feature, request_id, credits_amount, expires_at) ON CONFLICT (tenant_id, request_id, feature) DO NOTHING RETURNING id`. If nothing inserted, `SELECT` the existing row and return it (idempotent replay).
6. `UPDATE credit_wallets SET credits_reserved = credits_reserved + $1, version = version + 1 WHERE tenant_id = $2`.
7. `COMMIT`. Return reservation id.

**`consume(reservation_id, actualCredits, actualCostMicroUsd, provider, model, relatedEntity)`**
1. `BEGIN`
2. `SELECT * FROM credit_reservations WHERE id = $1 FOR UPDATE`. Assert status HELD (else return the existing consumption row if status=CONSUMED — replay).
3. `SELECT * FROM credit_wallets WHERE tenant_id = $1 FOR UPDATE`.
4. `INSERT INTO credit_consumptions (...) ON CONFLICT (tenant_id, request_id, feature, call_type) DO NOTHING RETURNING id`. If nothing inserted → replay, return the existing row.
5. `UPDATE credit_reservations SET status = 'CONSUMED', resolved_at = NOW()`.
6. `UPDATE credit_wallets SET credits_remaining = credits_remaining - actualCredits, credits_reserved = credits_reserved - reservation.credits_amount, version = version + 1`. If `actualCredits < reservation.credits_amount`, the difference is released back automatically.
7. `COMMIT`.

**`release(reservation_id, reason)`**
1. `BEGIN`
2. `SELECT * FROM credit_reservations WHERE id = $1 FOR UPDATE`. Assert status HELD.
3. `UPDATE credit_reservations SET status = 'RELEASED', resolved_at = NOW()`.
4. `UPDATE credit_wallets SET credits_reserved = credits_reserved - reservation.credits_amount, version = version + 1`.
5. `COMMIT`.

**Grants** are single-row inserts with a `FOR UPDATE` on the wallet followed by `credits_remaining += amount`. Idempotent by `grant_ref` unique index (see below).

### Reservation janitor

Worker at `backend/src/lib/credits/janitor.js`. Runs every 60 seconds. In one transaction:

```
SELECT id, tenant_id, credits_amount
  FROM credit_reservations
 WHERE status = 'HELD' AND expires_at < NOW()
   FOR UPDATE SKIP LOCKED
 LIMIT 200
```

For each, mark `status = 'EXPIRED'` and decrement `credit_wallets.credits_reserved`. Emits a `credits.reservation_expired` event to the outbox for observability. Uses advisory lock class `1020` so only one worker instance runs at a time.

### Cost pass-through

`consume()` accepts `actualCostMicroUsd` — the true dollar cost from `ai_call_usage` (or `null` for non-AI features). This is recorded on the consumption row for later reconciliation and margin analysis. Consumption `credits_amount` is derived from `actualCostMicroUsd` via the pricing table on features where cost-plus is enabled; otherwise it's a flat rate per call_type from the package. See PR B for package-driven credit prices.

### Reconciliation

Two nightly checks, added to `fin.reconciliation` runner (extends the existing R-check pattern from Stages 1-13):

- **R110 — wallet balance sanity**: for every wallet, `credits_remaining == SUM(grants.amount) - SUM(consumptions.credits_amount)`. DRIFT if not.
- **R111 — reserved balance sanity**: for every wallet, `credits_reserved == SUM(reservations.credits_amount WHERE status = 'HELD')`. DRIFT if not.
- **R112 — no orphan reservations**: no reservations with status HELD older than max(reservation_ttl_minutes) + 10 min. WARN if any (should be zero — janitor should catch them).
- **R113 — grants approval integrity**: every grant with `source IN ('adjustment.correction', 'goodwill')` above the threshold has `approval_request_id NOT NULL` and the referenced approval is in status APPROVED. FAIL if not.

### Approval workflow

New env var `CREDITS_ADJUSTMENT_APPROVAL_THRESHOLD_MICRO_USD` (default: 10000000 = $1000). Grants of `source = 'adjustment.correction'` or `source = 'goodwill'` above the threshold require an `fin.approval_requests` row in status APPROVED. Enforced by CHECK-adjacent trigger:

```sql
CREATE FUNCTION public.trg_credit_grants_require_approval() RETURNS trigger AS $$
DECLARE
  threshold BIGINT := COALESCE(current_setting('credits.approval_threshold_micro_usd', true)::bigint, 10000000);
  cost_micro_usd BIGINT := (NEW.amount * COALESCE(current_setting('credits.per_credit_micro_usd', true)::bigint, 100));
BEGIN
  IF NEW.source IN ('adjustment.correction', 'goodwill')
     AND cost_micro_usd > threshold
     AND NEW.approval_request_id IS NULL THEN
    RAISE EXCEPTION 'CREDIT_GRANT_APPROVAL_REQUIRED: source=% amount=% micro_usd=% threshold=%',
      NEW.source, NEW.amount, cost_micro_usd, threshold;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_credit_grants_require_approval
  BEFORE INSERT ON public.credit_grants
  FOR EACH ROW EXECUTE FUNCTION public.trg_credit_grants_require_approval();
```

### Fin.* double-entry mirroring

Every grant + consumption mirrors into `fin.ledger_transactions` + `fin.ledger_postings` via an async worker (`backend/src/lib/credits/fin-mirror-worker.js`, advisory lock 1021, runs every 30s). Batched: 500 rows at a time.

**On grant:** DR `AVAILABLE` (customer wallet book), CR `DEFERRED_REVENUE` (platform book). Cost proxy in credits × per-credit price.
**On consumption:** DR `DEFERRED_REVENUE`, CR `RECOGNIZED_REVENUE`. Recognition drives the invoice line items on billing period close (already handled by Stage 10 invoicing).

The worker is idempotent by `credit_grants.id` / `credit_consumptions.id` → `fin.ledger_transactions.economic_source_id`. A separate reconciliation check (R114) verifies every credit_grants and credit_consumptions row has a matching mirrored ledger transaction older than 5 minutes.

### Data migration (whatsapp-listings → credits engine)

Migration 301 does:
1. `INSERT INTO public.credit_wallets (tenant_id, currency, credits_remaining, credits_reserved) SELECT ... FROM ai_credit_balances` — one row per (scope, scope_id), mapped to tenant_id via existing `fin.tenants.public_tenant_id` lookup. Log rows that can't map.
2. `INSERT INTO public.credit_grants (id, tenant_id, source, amount, ...) SELECT ... FROM ai_credit_transactions WHERE type = 'top_up'`
3. `INSERT INTO public.credit_consumptions (id, tenant_id, feature, call_type, request_id, credits_amount, ...) SELECT ... FROM ai_credit_transactions WHERE type = 'consumption'`. `feature = 'whatsapp-listings'`, `call_type = 'draft'`, `request_id = COALESCE(related_draft_id::text, 'legacy:' || id::text)`.
4. `ai_credit_balances` and `ai_credit_transactions` are renamed to `_deprecated_*` for one release cycle, then dropped in a follow-up.

### Multi-currency

`credit_wallets.currency` and `credit_grants.currency`. All grants for a given wallet must match the wallet's currency (CHECK). Cross-currency top-ups require an explicit FX pathway (deferred to a follow-up PR; documented as not-yet-supported). Consumptions do not carry currency — they're always in the wallet's unit.

### Testing

- Concurrency: property-based test that fires 100 parallel `reserve/consume` calls at one wallet and asserts final `credits_remaining` matches expected end-state.
- Idempotency: replay every mutation with the same request_id and assert byte-identical response.
- Janitor: create a HELD reservation with expired timestamp, run janitor, assert EXPIRED + wallet reserved decrements.
- Reconciliation: mutate a `credit_wallets.credits_remaining` directly (bypassing engine), run R110, assert DRIFT.
- Approval: attempt grant with `source = 'adjustment.correction'` and `amount * per_credit > threshold` and no approval id, assert `CREDIT_GRANT_APPROVAL_REQUIRED`.
- Mirror: create grant, wait for mirror worker to run once, assert `fin.ledger_transactions` row exists with matching amount and correct debit/credit accounts.

### Definition of done (PR A)

- All 11 hardening items from the audit are addressed:
  1. Idempotency via `UNIQUE(tenant_id, request_id, feature, call_type)` on consumptions and `UNIQUE(tenant_id, request_id, feature)` on reservations ✓
  2. Concurrency via `SELECT ... FOR UPDATE` row locks on wallet + reservation ✓
  3. Cost pass-through via `actual_cost_micro_usd` column ✓
  4. Reconciliation checks R110-R114 ✓
  5. Spend caps via `credit_spend_caps` table + enforcement in `reserve()` ✓
  6. Hanging-reservation janitor ✓
  7. Multi-currency via `currency` on wallets and grants ✓
  8. Structured grant provenance via `grant_ref JSONB` ✓
  9. Approval workflow via `approval_request_id` FK + trigger ✓
  10. Append-only enforcement via REVOKE UPDATE/DELETE + trigger tests ✓
  11. `fin.*` double-entry mirroring via async worker ✓
- Every existing `whatsapp-listings/application/credits.js` call site migrated to the new engine.
- Data migration preserves every existing balance + transaction; reconciliation R110 passes end-to-end on the migrated data.
- Fast + Real-Postgres + Web suites all green.
- Concurrency test simulates 100 parallel operations without lost updates.

---

## PR B — Package data model

### New schema

```sql
-- A package is a subscription tier the PA offers. Versioned: publishing
-- creates an immutable version, tenants subscribe to a specific version.
CREATE TABLE fin.packages (
  id UUID PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('DRAFT', 'PUBLISHED', 'DEPRECATED')),
  current_version_id UUID,             -- FK to package_versions, filled when a version is PUBLISHED
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by_actor_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by_actor_id UUID,
  version BIGINT NOT NULL DEFAULT 1,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE fin.package_versions (
  id UUID PRIMARY KEY,
  package_id UUID NOT NULL REFERENCES fin.packages(id),
  version_number INTEGER NOT NULL,     -- 1, 2, 3...
  status TEXT NOT NULL CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'DEPRECATED')),
  properties_covered INTEGER NOT NULL CHECK (properties_covered > 0),
  billing_cadence TEXT NOT NULL CHECK (billing_cadence IN ('MONTHLY', 'QUARTERLY', 'ANNUAL')),
  price_minor BIGINT NOT NULL CHECK (price_minor > 0),
  currency CHAR(3) NOT NULL,
  effective_from TIMESTAMPTZ,          -- filled at publish
  effective_to TIMESTAMPTZ,            -- filled at deprecate
  approval_request_id UUID REFERENCES fin.approval_requests(id),
  published_at TIMESTAMPTZ,
  published_by_actor_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (package_id, version_number)
);

-- Per-feature per-property quota rules within a package version.
CREATE TABLE fin.package_features (
  id UUID PRIMARY KEY,
  package_version_id UUID NOT NULL REFERENCES fin.package_versions(id),
  feature TEXT NOT NULL,               -- e.g. 'publishing.social.instagram'
  credits_per_property BIGINT NOT NULL CHECK (credits_per_property >= 0),
  overage_price_minor BIGINT,          -- per-credit overage price; NULL = overage not allowed, tenant hits INSUFFICIENT_CREDITS
  overage_currency CHAR(3),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (package_version_id, feature)
);

-- Tenant subscribes to a specific package version.
CREATE TABLE fin.tenant_subscriptions (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES fin.tenants(id),
  package_version_id UUID NOT NULL REFERENCES fin.package_versions(id),
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'PAUSED', 'CANCELED', 'EXPIRED')),
  current_billing_period_start TIMESTAMPTZ NOT NULL,
  current_billing_period_end TIMESTAMPTZ NOT NULL,
  auto_renew BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);
```

### Feature identifiers

Feature strings are namespaced, dot-separated, versioned by convention:

- `whatsapp.intake` — WhatsApp listing intake (photo/video/voice → draft)
- `whatsapp.send.utility` — outbound WhatsApp utility conversation
- `whatsapp.send.marketing` — outbound WhatsApp marketing conversation
- `publishing.social.instagram` — publish to Instagram
- `publishing.social.tiktok` — publish to TikTok
- `publishing.social.facebook` — publish to Facebook
- `publishing.social.linkedin` — publish to LinkedIn
- `publishing.social.x` — publish to X
- `publishing.realestate.olx` — publish to OLX
- `publishing.realestate.<portal>` — extensible
- `ai.post_creation` — generate a social post via AI
- `ai.social_card_render` — generate a branded social card image (BannerBear)
- `market_pricing.analysis` — price benchmarking on a property
- `area_intelligence.rating` — property rating via area intelligence
- `lead_gen.ai_activation` — activate the qualified lead-gen AI
- `contact_ai.lead_score` — AI-driven lead scoring
- `contact_ai.lead_summary` — AI-generated lead summary
- `comment_classifier.classify` — AI-driven social comment classification

Registered in `backend/src/lib/credits/features.js` as a constant map. Adding a feature = one code change + a package_features row on any package that offers it.

### The package → contract compiler

At subscription time, `packageToContract(tenantId, packageVersion)` inserts:
1. One `fin.contracts` row for the tenant.
2. One `fin.contract_components` row per `package_features` row, kind = `ENTITLEMENT`, with metadata `{ feature: '...', credits_per_property, properties_covered }`.
3. One `fin.contract_components` row per `package_features` row where `overage_price_minor IS NOT NULL`, kind = `OVERAGE_PRICE`.

At each billing period start, `grantSubscriptionCycle(tenantSubscription)`:
1. For each `package_features` row: `INSERT INTO public.credit_grants (tenant_id, source='subscription_cycle', amount = credits_per_property × properties_covered, ...)`.
2. Idempotent by `grant_ref = { subscription_id, period_start, feature }`.
3. Runs as a worker (`backend/src/lib/credits/subscription-worker.js`, advisory lock 1022).

### Property-count changes

If a tenant's `properties_covered` changes mid-cycle (subscription upgrade/downgrade), pro-rated: mint an additional grant equal to `(added_properties × credits_per_property × (days_remaining_in_cycle / cycle_days))`. Recorded with `source = 'subscription_cycle'` and `grant_ref.reason = 'proration'`.

### Package lifecycle state machine

```
DRAFT ──(save)──> DRAFT
DRAFT ──(submit_for_approval)──> PENDING_APPROVAL
PENDING_APPROVAL ──(approve)──> PUBLISHED
PENDING_APPROVAL ──(reject)──> DRAFT
PUBLISHED ──(deprecate)──> DEPRECATED    -- existing subscriptions continue on their version; new subscriptions blocked
```

New package version creation: cloning a PUBLISHED version into a fresh DRAFT. Never edit a PUBLISHED version.

### Data migration (fin.credit_products → packages)

Not needed — `fin.credit_products` becomes a "legacy flat credit pack" that continues to work for auto-topup. No packages exist on migration; PA seeds them via the admin UI in PR C.

### Definition of done (PR B)

- All four tables created with append-only or version-controlled semantics.
- Compiler `packageToContract` + `grantSubscriptionCycle` implemented and tested.
- Subscription worker runs, is idempotent, grants correct amounts on cycle roll-over.
- No admin UI yet — PR C.
- Reconciliation check R115 added: for every ACTIVE `fin.tenant_subscriptions`, the current billing period has a matching grant per package_feature.

---

## PR C — PA package admin surface

### Routes

All under `/api/admin/fin/packages/*`. All require `platform_admin` role and `requireElevated` (per DL-076 pattern).

- `GET /api/admin/fin/packages` — list all packages with current status + subscriber count
- `POST /api/admin/fin/packages` — create a package (starts as DRAFT with an initial DRAFT version)
- `GET /api/admin/fin/packages/:id` — package detail + all versions
- `PATCH /api/admin/fin/packages/:id` — update package metadata (name, description) — allowed even for PUBLISHED
- `POST /api/admin/fin/packages/:id/versions` — create a new DRAFT version (typically clone of current)
- `GET /api/admin/fin/packages/:id/versions/:vid` — version detail + features
- `PATCH /api/admin/fin/packages/:id/versions/:vid` — update DRAFT version (blocked once PENDING_APPROVAL or PUBLISHED)
- `PUT /api/admin/fin/packages/:id/versions/:vid/features` — replace package_features rows (blocked once PENDING_APPROVAL or PUBLISHED)
- `POST /api/admin/fin/packages/:id/versions/:vid/submit-for-approval` — DRAFT → PENDING_APPROVAL, creates `fin.approval_requests` row
- `POST /api/admin/fin/packages/:id/versions/:vid/approve` — PENDING_APPROVAL → PUBLISHED (requires SECOND platform admin, enforced by approval workflow)
- `POST /api/admin/fin/packages/:id/versions/:vid/reject` — PENDING_APPROVAL → DRAFT
- `POST /api/admin/fin/packages/:id/versions/:vid/deprecate` — PUBLISHED → DEPRECATED

Every mutation goes through `insertAudit` (`fin.financial_audit_events`) with reasonCode and actor. Every write uses `If-Match` per DL-004 optimistic concurrency.

### Admin UI

New pages under `web/src/pages/admin/fin/packages/`:

- **`PackagesListPage.tsx`** — table of packages (code, name, current version, subscribers, status). Add row → new package. Click row → detail.
- **`PackageDetailPage.tsx`** — package header + version list. Actions: create version (clones current), publish version (requires second approver), deprecate.
- **`PackageVersionEditPage.tsx`** — edit DRAFT version. Header fields (properties_covered, cadence, price, currency). Feature quota editor:
  - Table with columns: Feature (dropdown from FEATURES map), Credits per property, Overage price, Overage currency.
  - Add row / edit row / delete row.
  - "Preview" panel shows: monthly grant computation ("N properties × X credits/prop × 8 features = Y total credits"), monthly revenue, effective per-credit rate.
- **`PackageVersionApprovalPage.tsx`** — for a version in PENDING_APPROVAL, second admin reviews diff-against-current-version + full features list, approves or rejects.

All wired into `web/src/pages/admin/fin/shell.tsx` navbar under "Packages".

### Approval workflow

Publishing a package version requires TWO different platform admins. Enforced:
- `submitForApproval` creates a `fin.approval_requests` row with `requester_actor_id = submitter`.
- `approve` checks that `req.user.id != approval.requester_actor_id`. Rejected with `APPROVAL_SELF_APPROVAL_FORBIDDEN` if equal.
- Same actor CAN create a package + submit for approval; they just can't approve their own submission.

### Definition of done (PR C)

- Every admin route above implemented with tests (fast + real-postgres).
- Every admin page rendered, editable, with quota preview panel.
- Approval workflow tested: submitter cannot self-approve, second admin can.
- Package versioning respects immutability (PUBLISHED versions cannot be edited).
- Audit trail: every mutation creates a `fin.financial_audit_events` row.
- Rate-limited via `adminMutationLimiter`.

---

## PR D — Feature wiring + tenant UI

### Wiring pattern

Every paid feature call site adopts the same wrapper:

```js
import { withCredits } from '../../lib/credits/withCredits.js'

async function handler(req, res) {
  const result = await withCredits({
    tenantId: req.user.tenantId,
    feature: 'publishing.social.instagram',
    callType: 'publish',
    requestId: req.headers['idempotency-key'] || generateFromRequest(req),
    creditsEstimate: 1,                  // may be overridden per package
    relatedEntity: { type: 'listing', id: req.params.listingId },
  }, async ({ reservation }) => {
    // do the actual work here — publish to instagram
    const publishResult = await instagramClient.publish(...)
    return {
      credits: 1,                         // actual credits consumed (may differ from estimate)
      cost_micro_usd: publishResult.provider_cost,
      provider: 'meta',
      model: 'instagram-api',
      result: publishResult,
    }
  })
  res.json(result.result)
}
```

`withCredits` does reserve → work → consume (or release on error). One function, applies uniformly to all N features.

### Features to wire in PR D

Every route in the fin admin, `publish-social`, `listings-ai`, `market-pricing`, `area-intelligence`, `whatsapp-listings` (now via the new engine, not its old local wrapper). Full inventory from the earlier audit (Tier A + B capabilities).

### Tenant UI

Under `web/src/pages/subscription/`:

- **`MySubscriptionPage.tsx`** — current subscription card: package name, price, cadence, next billing date, properties covered. Actions: change plan (upgrade/downgrade), cancel.
- **`MyQuotasPage.tsx`** — per-feature quota display: for each package_feature, show "used X of ~Y expected this month" as an advisory bar plus the overall remaining credit balance as the hard cap. Sorted by consumption rate.
- **`MyTopUpPage.tsx`** — buy additional credits. Flat credit purchase (any feature can spend). Pays through Stripe/Paddle (dispatched separately).
- **`MyInvoicesPage.tsx`** — list of past invoices from `fin.invoices`, download link to PDF (once object storage is wired).
- **`MyCreditHistoryPage.tsx`** — timeline of grants + consumptions, filterable by feature.

All wired into `web/src/App.tsx` under authenticated routes.

### Definition of done (PR D)

- Every paid feature site instrumented with `withCredits`.
- Free tier remains free (no wallet, no metered gating — feature call for a tenant with no `fin.tenant_subscriptions` row hits `SUBSCRIPTION_REQUIRED` with a clear error).
- Tenant pages render live data; upgrade/downgrade flow works.
- Integration tests: subscribing to a package grants correct credits; consuming a feature debits correctly; exhausting a package's quota-derived credit amount fails with `INSUFFICIENT_CREDITS`.
- Reconciliation check R116: every metered feature call produces one `credit_consumptions` row AND (if AI) one `ai_call_usage` row; if either is missing, DRIFT.

---

## Explicitly out of scope

- **Payment gateway integration** (Stripe / Paddle live checkout, webhook handling). Documented as a separate build in `docs/design/CREDIT_SYSTEM_DESIGN.md` — needed for PR D top-up flow but treated as a distinct workstream.
- **Object storage for invoice PDFs.** Blocks `MyInvoicesPage.tsx`'s PDF download; separate infra decision.
- **FX / cross-currency top-ups.** Wallets are single-currency in this design.
- **Delegated admin scoping.** All package admin requires `platform_admin`; per-tenant delegated admin (e.g. an agency admin managing their agents' subscriptions) is a follow-up.
- **Legacy `commercial.*` re-integration.** Strip stands.

---

## Risks + mitigations

- **Data migration correctness.** Migration 301 must preserve every existing balance. Mitigation: run reconciliation R110 in the same PR that ships the migration; fail the migration if drift is detected.
- **Concurrency test flakiness.** Real database race conditions are hard to test deterministically. Mitigation: use PostgreSQL `pg_sleep` in test path to force overlap; assert on final balance + row-count invariants rather than timing.
- **Approval workflow bypass.** A malicious platform admin could try to bypass the trigger. Mitigation: the trigger is on `INSERT` (not just app-level), so any path that inserts into `credit_grants` — including direct SQL — is enforced by the DB.
- **Fin.* mirror worker lag.** If the worker is down, `credit_grants` and `credit_consumptions` land but `fin.ledger_transactions` doesn't. Mitigation: R114 reconciliation FAILS after 5-minute lag, paging the operator.

---

## Dependencies + sequencing recap

```
PR A ─────────► PR B ─────────► PR C ─────────► PR D
(engine)        (packages)       (admin UI)      (wiring + tenant UI)
```

No PR can start until the previous is merged. Each is ~2-4 days of Cursor work at enterprise-grade quality. Total: ~2-3 weeks. This is not a rush; the point is to build once, correctly.

---

_End of implementation design._
