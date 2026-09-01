# Cursor prompt — PR A: extract + fully harden the credit engine to enterprise grade

This is PR A of a 4-PR arc (A → B → C → D). Do NOT ship any of PR B/C/D scope here. Enterprise-grade only — every hardening item is required, none are deferred.

## Verified state on `main` (do not re-audit unless you find divergence)

- `public.ai_credit_balances`, `public.feature_entitlements`, `public.ai_credit_transactions` (mig 010, whatsapp-listings-scoped).
- `backend/src/modules/whatsapp-listings/application/credits.js` — the current CreditService. No idempotency, no locks, no janitor, no reconciliation, no fin.* mirroring.
- `backend/src/modules/whatsapp-listings/application/entitlements.js` — hierarchy resolver (agent → agency → platform), single feature (`WHATSAPP_LISTINGS_FEATURE`).
- `backend/src/modules/whatsapp-listings/interface/{admin,agency,agent}-routes.js` — the routes registering `/api/admin/entitlements`, `/api/{agency,agent}/credits/*`.
- `fin.credit_products` (mig 171), `fin.auto_topup_policies`, `fin.approval_requests`, `fin.financial_audit_events`, `fin.ledger_transactions`, `fin.ledger_postings`, `fin.reconciliation_checks`, `fin.outbox_events` — all exist; you'll integrate against them.
- `public.ai_call_usage` (mig 291) — per-call cost log. You'll read `cost_estimate_micro_usd` from here on consumption.

## Goal

Move the credit + entitlement engine out of `whatsapp-listings/` to a platform-level module. Rebuild every mutation to enterprise-grade. Migrate existing data. Every downstream whatsapp-listings caller updated to use the new engine. Zero behavior regression for the whatsapp-listings feature; every improvement is additive.

## New location

- `backend/src/lib/credits/engine.js` — the reserve/consume/release/grant primitives
- `backend/src/lib/credits/entitlements.js` — the hierarchy resolver, generalized to any feature
- `backend/src/lib/credits/routes.js` — `/api/agent/credits/*` and `/api/agency/credits/*`
- `backend/src/lib/credits/admin-routes.js` — platform-admin credit routes
- `backend/src/lib/credits/janitor.js` — hanging-reservation janitor worker
- `backend/src/lib/credits/fin-mirror-worker.js` — double-entry mirror worker
- `backend/src/lib/credits/features.js` — const map of registered feature identifiers
- `backend/src/lib/credits/pricing.js` — per-credit unit pricing (for approval threshold math + margin reporting)
- `backend/src/persistence/migrations/300_credits_hardening.sql` — new schema
- `backend/src/persistence/migrations/301_credits_backfill_from_wa.sql` — data migration from `ai_credit_*` tables

## New schema (migration 300)

```sql
-- Enterprise credit engine. All under public.* (hot-path); fin.* mirrors
-- via async worker for accounting.

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

-- Append-only. Every grant creates one row.
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
  grant_ref JSONB NOT NULL DEFAULT '{}'::jsonb,
  package_id UUID,                                -- PR B populates this
  billing_period_start TIMESTAMPTZ,
  billing_period_end TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  granted_by_actor_type TEXT,
  granted_by_actor_id UUID,
  approval_request_id UUID REFERENCES fin.approval_requests(id),
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX uq_credit_grants_ref_source
  ON public.credit_grants ((grant_ref->>'idempotency_key'), source)
  WHERE grant_ref->>'idempotency_key' IS NOT NULL;

-- Append-only. Every debit creates one row.
CREATE TABLE public.credit_consumptions (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  feature TEXT NOT NULL,
  call_type TEXT NOT NULL,
  request_id TEXT NOT NULL,
  credits_amount BIGINT NOT NULL CHECK (credits_amount > 0),
  actual_cost_micro_usd BIGINT,
  provider TEXT,
  model TEXT,
  related_entity_type TEXT,
  related_entity_id TEXT,
  reservation_id UUID,
  consumed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, request_id, feature, call_type)
);

CREATE TABLE public.credit_reservations (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  feature TEXT NOT NULL,
  request_id TEXT NOT NULL,
  credits_amount BIGINT NOT NULL CHECK (credits_amount > 0),
  status TEXT NOT NULL DEFAULT 'HELD' CHECK (status IN ('HELD', 'CONSUMED', 'RELEASED', 'EXPIRED')),
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, request_id, feature)
);

CREATE TABLE public.credit_spend_caps (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  feature TEXT,                       -- NULL = global to tenant
  window_kind TEXT NOT NULL CHECK (window_kind IN ('MINUTE', 'HOUR', 'DAY', 'WEEK', 'MONTH')),
  max_credits BIGINT NOT NULL CHECK (max_credits > 0),
  active BOOLEAN NOT NULL DEFAULT true,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Retained: feature_entitlements (mig 010). Adapt in-place to serve any feature —
-- do NOT drop/rewrite. The scope hierarchy (agent → agency → platform) is
-- already correct; extend the resolver in the new entitlements.js to accept
-- any feature name.

CREATE INDEX idx_credit_grants_tenant_granted ON public.credit_grants (tenant_id, granted_at DESC);
CREATE INDEX idx_credit_consumptions_tenant_consumed ON public.credit_consumptions (tenant_id, consumed_at DESC);
CREATE INDEX idx_credit_consumptions_feature ON public.credit_consumptions (feature, consumed_at DESC);
CREATE INDEX idx_credit_reservations_expiring ON public.credit_reservations (status, expires_at) WHERE status = 'HELD';

-- APPEND-ONLY enforcement. Only wingcaster_migrator can UPDATE/DELETE, and
-- migrations are the only path that runs as that role.
REVOKE UPDATE, DELETE, TRUNCATE ON public.credit_grants FROM PUBLIC;
REVOKE UPDATE, DELETE, TRUNCATE ON public.credit_consumptions FROM PUBLIC;
REVOKE DELETE, TRUNCATE ON public.credit_wallets FROM PUBLIC;

-- Approval-threshold trigger (see approval workflow section below)
CREATE OR REPLACE FUNCTION public.trg_credit_grants_require_approval()
  RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  threshold_micro_usd BIGINT :=
    COALESCE(NULLIF(current_setting('credits.approval_threshold_micro_usd', true), '')::bigint, 10000000);
  per_credit_micro_usd BIGINT :=
    COALESCE(NULLIF(current_setting('credits.per_credit_micro_usd', true), '')::bigint, 100);
  cost_micro_usd BIGINT := NEW.amount * per_credit_micro_usd;
BEGIN
  IF NEW.source IN ('adjustment.correction', 'goodwill')
     AND cost_micro_usd > threshold_micro_usd
     AND NEW.approval_request_id IS NULL THEN
    RAISE EXCEPTION 'CREDIT_GRANT_APPROVAL_REQUIRED: source=% amount=% micro_usd=% threshold=%',
      NEW.source, NEW.amount, cost_micro_usd, threshold_micro_usd;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_credit_grants_require_approval
  BEFORE INSERT ON public.credit_grants
  FOR EACH ROW EXECUTE FUNCTION public.trg_credit_grants_require_approval();
```

## The 11 hardening items (all required)

### 1. Idempotency
Every `reserve`, `consume`, `release`, and `grant` accepts an idempotency key. UNIQUE constraints (in the schema above) enforce single-write. Replay returns the original result byte-identical.

### 2. Concurrency
Every mutation acquires `SELECT ... FOR UPDATE` on the affected wallet row inside a transaction. Test with a property-based concurrency test that fires 100 parallel operations on one wallet and asserts final balance matches the deterministic expected value.

### 3. Auto-release janitor
`janitor.js` runs every 60s. Holds advisory lock 1020. For each `credit_reservations WHERE status = 'HELD' AND expires_at < NOW()`, mark EXPIRED and decrement `credit_wallets.credits_reserved` in a single tx (`FOR UPDATE SKIP LOCKED`, batched 200 rows). Emits `credits.reservation_expired` outbox events.

### 4. Cost pass-through
`consume()` accepts `actual_cost_micro_usd` and stores it. `withCredits` helper (introduced here, wired in PR D) pulls this from `ai_call_usage` when the call was AI-driven.

### 5. Reconciliation checks R110-R114 (add to `backend/src/fin/reconciliation/checks.js`)
- **R110** — wallet balance sanity: `credits_remaining == SUM(grants) - SUM(consumptions)` per wallet
- **R111** — wallet reserved sanity: `credits_reserved == SUM(HELD reservations)` per wallet
- **R112** — no orphan reservations older than `max(reservation_ttl) + 10 min`
- **R113** — grants above approval threshold with source in ('adjustment.correction','goodwill') have `approval_request_id NOT NULL` and referenced approval status = APPROVED
- **R114** — every `credit_grants` and `credit_consumptions` row has a matching `fin.ledger_transactions` mirror within 5 minutes; FAIL after 5-minute lag

### 6. Spend caps
`credit_spend_caps` table (in schema). Enforced in `reserve()` before wallet check: for each active cap that matches the tenant + feature (or is feature-null), sum consumptions + HELD reservations in the window, reject with `SPEND_CAP_EXCEEDED` if adding new reservation would exceed `max_credits`.

### 7. Multi-currency
`credit_wallets.currency` and `credit_grants.currency`. All grants for a wallet must match the wallet's currency (add a trigger to enforce). Consumptions inherit wallet currency implicitly. Cross-currency FX handling is explicitly out of scope for this PR; a grant in a mismatched currency raises `CURRENCY_MISMATCH`.

### 8. Structured grant provenance
`credit_grants.grant_ref JSONB` — every grant carries structured provenance. Shape by source:
- `topup.stripe`: `{ payment_intent_id, stripe_event_id, idempotency_key }`
- `topup.paddle`: `{ transaction_id, paddle_event_id, idempotency_key }`
- `topup.manual_receipt_*`: `{ receipt_reference, receipt_uploaded_by, admin_note }`
- `subscription_cycle`: `{ subscription_id, package_version_id, period_start, feature }` (PR B populates)
- `promo`, `goodwill`, `adjustment.correction`: `{ reason, admin_actor_id, note }`
- `migration`: `{ legacy_transaction_id }`

UNIQUE partial index on `(grant_ref->>'idempotency_key', source)` enforces top-up idempotency across retries.

### 9. Approval workflow
Env var `CREDITS_ADJUSTMENT_APPROVAL_THRESHOLD_MICRO_USD` (default 10000000 = $1000) and `CREDITS_PER_CREDIT_MICRO_USD` (default 100 = $0.0001/credit; adjust to realistic conversion). Trigger in schema above rejects grants above threshold without `approval_request_id`. Two-person rule: `approve` route in admin-routes.js checks `req.user.id != approval.requester_actor_id`, rejects with `APPROVAL_SELF_APPROVAL_FORBIDDEN`.

### 10. Append-only enforcement
`REVOKE UPDATE, DELETE, TRUNCATE` on `credit_grants` and `credit_consumptions` from `PUBLIC`. Test: attempt `UPDATE credit_grants SET amount = 999 WHERE id = ...` as `wingcaster_app` role, assert permission denied.

### 11. Fin.* double-entry mirroring
`fin-mirror-worker.js` runs every 30s, advisory lock 1021. Batched 500 rows.

- **On grant:** insert `fin.ledger_transactions (shape='GRANT_MIRROR', economic_source_type='credit_grants', economic_source_id=grants.id, ...)` + two `fin.ledger_postings`: DR `AVAILABLE` (customer wallet book), CR `DEFERRED_REVENUE` (platform book). Amount in wallet-currency minor units, converted via `CREDITS_PER_CREDIT_MICRO_USD`.
- **On consumption:** insert `fin.ledger_transactions (shape='CONSUME_MIRROR', economic_source_type='credit_consumptions', economic_source_id=consumptions.id, ...)` + two postings: DR `DEFERRED_REVENUE`, CR `RECOGNIZED_REVENUE`. Amount from `actual_cost_micro_usd` if present, else derived from `credits_amount`.

Idempotent by `economic_source_id`. Reconciliation R114 checks the worker's lag.

## Data migration (migration 301)

```sql
-- Wallets: one per (scope, scope_id). Map scope_id to tenant_id via
-- fin.tenants.public_tenant_id.
INSERT INTO public.credit_wallets (tenant_id, currency, credits_remaining, credits_reserved, updated_at)
SELECT
  t.id AS tenant_id,
  'USD' AS currency,      -- default; PR B may introduce per-package currency
  b.credits_remaining::bigint,
  b.credits_reserved::bigint,
  b.updated_at
FROM public.ai_credit_balances b
JOIN fin.tenants t ON t.public_tenant_id = b.scope_id
WHERE b.scope IN ('agent', 'agency')
ON CONFLICT (tenant_id) DO NOTHING;

-- Log unmappable rows (scope_id has no matching fin.tenants) so the operator can hand-migrate.
INSERT INTO fin.reconciliation_notes (id, note, data, created_at)
SELECT gen_random_uuid(), 'credits migration: unmapped wallet',
       jsonb_build_object('scope', scope, 'scope_id', scope_id), NOW()
FROM public.ai_credit_balances b
WHERE NOT EXISTS (SELECT 1 FROM fin.tenants t WHERE t.public_tenant_id = b.scope_id);

-- Grants: from top_up transactions
INSERT INTO public.credit_grants (id, tenant_id, source, amount, currency, grant_ref, granted_at, data)
SELECT
  x.id::uuid,
  t.id,
  'migration',
  x.amount::bigint,
  'USD',
  jsonb_build_object('legacy_transaction_id', x.id, 'legacy_description', x.description),
  x.created_at,
  x.data
FROM public.ai_credit_transactions x
JOIN fin.tenants t ON t.public_tenant_id = x.scope_id
WHERE x.type = 'top_up';

-- Consumptions: from consumption transactions
INSERT INTO public.credit_consumptions (id, tenant_id, feature, call_type, request_id, credits_amount, consumed_at, data)
SELECT
  x.id::uuid,
  t.id,
  'whatsapp-listings',
  'draft',
  COALESCE(x.related_draft_id, 'legacy:' || x.id),
  ABS(x.amount)::bigint,
  x.created_at,
  x.data
FROM public.ai_credit_transactions x
JOIN fin.tenants t ON t.public_tenant_id = x.scope_id
WHERE x.type = 'consumption';

-- Rename legacy tables (keep for one release cycle for rollback / audit)
ALTER TABLE public.ai_credit_balances RENAME TO ai_credit_balances_deprecated_20260902;
ALTER TABLE public.ai_credit_transactions RENAME TO ai_credit_transactions_deprecated_20260902;
```

After the migration, run reconciliation R110 in the same PR's post-migration step. If R110 shows DRIFT, the migration FAILS the deploy — do not go live with drift.

## Whatsapp-listings caller migration

Every import of `../application/credits.js` in `backend/src/modules/whatsapp-listings/` is replaced with an import from `backend/src/lib/credits/engine.js`. The old file is deleted (not renamed). Call sites updated:

- `application/pipeline.js` — reserve/consume/release now via new engine
- `application/entitlements.js` — kept as a thin re-export of `lib/credits/entitlements.js` for the whatsapp-listings feature
- `interface/admin-routes.js`, `agency-routes.js`, `agent-routes.js` — route handlers delegate to the new engine's routes

## Testing (all required)

- **Unit tests** for engine: reserve/consume/release/grant happy paths + every edge case (INSUFFICIENT_CREDITS, SPEND_CAP_EXCEEDED, CURRENCY_MISMATCH, replay of consumed reservation, replay of released reservation)
- **Concurrency test** — property-based: fire 100 parallel `reserve+consume` operations against one wallet, assert final balance matches deterministic expected end-state
- **Janitor test** — insert HELD reservation with expired timestamp, run janitor tick, assert EXPIRED status + wallet reserved decremented
- **Approval test** — attempt grant above threshold without approval, assert `CREDIT_GRANT_APPROVAL_REQUIRED`; then with approval, assert success
- **Mirror worker test** — create grant, run mirror worker once, assert `fin.ledger_transactions` + two `fin.ledger_postings` created with balanced amounts
- **Reconciliation tests** — R110/R111/R112/R113/R114 each: seed a drifted state, run the check, assert DRIFT with correct entity_id
- **Migration test** — seed `ai_credit_balances` + `ai_credit_transactions` with test data, run migration 300 + 301 on a fresh DB, assert every row lands in `credit_wallets`/`credit_grants`/`credit_consumptions` correctly, run R110, assert GREEN
- **Whatsapp-listings regression** — every existing whatsapp-listings test continues to pass. No behavior change for that feature.
- **Append-only enforcement** — attempt UPDATE + DELETE on `credit_grants` + `credit_consumptions` as `wingcaster_app` role, assert permission denied

## Scope guardrails (do NOT exceed)

- Do NOT introduce the `fin.packages` / `fin.package_features` / `fin.tenant_subscriptions` tables. Those are PR B.
- Do NOT introduce `/api/admin/fin/packages/*` routes or admin UI. PR C.
- Do NOT wire other features (publish-social, listings-ai, market-pricing, area-intelligence) to the engine. PR D.
- Do NOT rebuild tenant-facing billing pages. PR D.
- Do NOT integrate Stripe / Paddle / manual-receipt flows. Deferred workstream.
- Do NOT drop `fin.credit_products` — the auto-topup worker still uses it.
- Do NOT modify `fin.*` billing/accounting migrations beyond adding the mirror worker's write path.

## Branch + PR

Branch: `feat/credits-engine-extract-and-harden`
Base: `main`
PR title: `Extract + fully harden credit engine to enterprise grade (all 11 hardening items)`

## Definition of done (must be true before requesting review)

- All 11 hardening items implemented and covered by their named test.
- Every whatsapp-listings caller migrated. `backend/src/modules/whatsapp-listings/application/credits.js` deleted.
- Migration 300 + 301 apply cleanly on a fresh test DB and reconciliation R110 passes on migrated data.
- Fast + Real-Postgres + Web suites all green.
- Concurrency test simulates 100 parallel operations and asserts zero lost updates.
- Approval trigger + append-only REVOKEs verified end-to-end.
- Fin.* mirror worker exercised in an integration test; R114 passes after worker runs.
- No new lint errors, no TypeScript errors, no changes to CreditService reserve/consume public surface beyond what the whatsapp-listings caller migration requires.

## What to do if something's ambiguous

Prefer enterprise-grade correctness over speed. If a design choice below the spec seems wrong or a table shape needs adjustment, DO IT and document the deviation in the PR body under a "Deviations from spec" section. Do not silently narrow scope.

## Follow-ups NOT in this PR

- PR B: fin.packages + package_features + tenant_subscriptions + the compiler
- PR C: PA admin surface for packages
- PR D: feature wiring + tenant UI + rebuild deleted billing pages
