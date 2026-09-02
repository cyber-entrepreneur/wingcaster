# Cursor prompt — PR D: feature wiring + tenant billing UI + rebuild deleted pages

This is PR D of the 4-PR arc (A ✅ → B ✅ → C 🟡 in progress → **D**). Enterprise-grade discipline continues. This PR is the customer-facing revenue-generating surface: every metered feature actually checks entitlements and debits credits before running, and tenants can see their subscription + quota + top up + view invoices.

**New in this dispatch (elevated bar):** four enterprise-grade sections that were missing from PR A/B/C prompts — **Threat model**, **Failure modes**, **Regulatory readiness**, and **Scale target**. Every future dispatch will include them.

## Verified state on `main` after PR #33 (PR C assumed merged before this PR is dispatched)

- `public.credit_wallets/grants/consumptions/reservations/spend_caps` — PR A engine
- `backend/src/lib/credits/{engine, entitlements, routes, admin-routes, janitor, fin-mirror-worker, with-credits}.js` — PR A
- `public.metered_features/product_packages/product_package_versions/package_feature_quotas/package_feature_flags/tenant_subscriptions/tenant_active_properties` — PR B
- `backend/src/lib/packages/{compiler, lifecycle, property-tracker, billing-cycle-worker, registry}.js` — PR B
- PR C admin routes + admin UI (assumed merged): `/api/admin/fin/packages/*`, `/api/admin/fin/subscriptions/*`, PackagesPage / PackageVersionEditor / etc.
- `web/src/pages` — App.tsx does NOT contain the tenant-facing billing pages that were deleted in the strip; you'll rebuild them
- `public.ai_call_usage` — PR #27; cost pass-through source

## Goal

1. **Wire every metered feature call site** to check entitlements + reserve → do work → consume via the PR A engine + PR B feature registry. Every AI call, every WhatsApp send, every social publish, every real-estate portal push, every social-card render.
2. **Rebuild the deleted tenant billing UI** on the new stack: My Subscription, My Credits, My Invoices, My Top-Up, Plans / Upgrade.
3. **Per-feature quota display** — the hybrid model: single-balance backend, per-feature "you've used N of your ~M typical monthly X" display frontend.
4. **Overage top-up flow** at the tenant level.
5. **Free-tier onboarding** — every new tenant gets a `PENDING_START` subscription pointing at the free-tier package version seeded in migration 304.

## Enterprise-grade sections

### 4.1 Threat model

Attackers, vectors, mitigations:

| Attacker | Vector | Mitigation |
|---|---|---|
| Compromised tenant credentials | Trigger high-cost AI calls to drain platform | Spend caps (already in PR A) — verify tenant caps are actively enforced on hot path in PR D. Alert threshold on spend cap breaches. |
| Malicious tenant | Race between check-entitlement and consume-credits to double-spend | Every feature call uses the `withCredits` helper (PR A) which wraps reserve → work → consume in one idempotent unit; UNIQUE(request_id, feature, call_type) at DB level enforces single-consume. |
| Malicious tenant | Fake WhatsApp webhook to trigger paid AI processing without cost | Webhook signature verification must be enforced before entering the WhatsApp intake path; PR D must verify every webhook path routes through the existing HMAC verification before touching the credit engine. |
| Compromised admin | Grant infinite credits to a specific tenant | PR A approval trigger fires on `source in ('adjustment.correction','goodwill') AND cost > threshold AND approval_request_id IS NULL`. Verify threshold is set to a business-appropriate default (recommend $10 = 10_000_000 µUSD) and cannot be bypassed via env var manipulation on hot path. |
| Rogue tenant admin (agency scope) | Deplete agency-level credits to zero after being terminated | Agency admin de-provisioning revokes their auth session AND their entitlement to top up. Verify session revocation is synchronous. |
| Cross-tenant read | View another tenant's wallet or credit history via crafted API request | RLS on `credit_wallets/grants/consumptions/reservations` (add to PR D scope if missing; PR A only did REVOKE, not RLS on public.credit_*). Every read route explicitly filters `tenant_id = req.tenantId`, never relies on RLS alone. |
| Cross-agent read within an agency | Agent A views agent B's private consumption within the same agency | Tenant billing pages scope to `req.user.tenantId` derived from JWT, not client-supplied query param. |
| Timing / race attack | Consume without a reservation, or consume from a released reservation | Engine already handles: reservation status check is `FOR UPDATE`; release then consume returns `RESERVATION_NOT_HELD`. Verify in tests. |
| Replay attack on top-up | Repost a top-up webhook to double-credit | Idempotency key in `grant_ref` — PR D top-up route must set `grant_ref.idempotency_key = webhook_event_id` for provider webhooks. UNIQUE index on `((grant_ref->>'idempotency_key'), source)` catches replays. |
| SQL injection in the tenant billing UI | Craft input to arbitrary SQL | Parameterized queries throughout — audit every new route added in PR D uses `$1, $2` placeholders, never string interpolation. |
| CSRF on top-up form | Trick logged-in tenant into topping up more than intended | The elevated-action pattern from Stage 12 (`requireElevated`) applies to top-up flows — top-up above $50 requires elevated re-auth in the 5-minute window. |

Every mitigation above is a required test in this PR — either an existing test extended, or a new test that specifically exercises the attack vector.

### 4.2 Failure modes

For each dependency this PR takes on, name what happens when it fails and how the system recovers:

| Dependency | Failure mode | System behavior | Recovery |
|---|---|---|---|
| Credit engine `consume` fails DB write | Tx aborts; feature call sees error | Return 503 with `CREDIT_ENGINE_UNAVAILABLE`; feature does NOT run; tenant sees a "try again in a moment" toast, not a crash. `withCredits` release path fires. |
| `ai_call_usage` insert fails (from PR #27) | Best-effort log fails | Call already succeeded; only observability lost. Existing PR #27 pattern. |
| Fin-mirror worker down for hours | Grants/consumptions accumulate in public.* without fin.* mirror rows | R114 fires DRIFT within 5 min; on-call sees alert; worker recovers on restart, catches up idempotently via 23505. Data integrity intact throughout. |
| Billing-cycle worker down | Subscriptions with `next_grant_at <= now` don't get their cycle grant | On restart worker processes the backlog; late grants land with correct `cycle_start` (not "now"); tenants see their credits within 60s of worker resume. |
| Feature registry entry missing for a new feature (config bug) | Feature call site attempts to `checkEntitlement('foo.bar')` where 'foo.bar' has no row | Return 500 with `FEATURE_NOT_REGISTERED`; alert. Feature does NOT run at zero cost. Recovery: PA adds registry row via PR C admin surface. |
| Free-tier package seed missing (data migration corruption) | New tenants provision without a subscription | Onboarding route detects and refuses with `FREE_TIER_PACKAGE_MISSING`; ops runbook restores from migration 304. |
| Tenant sub `properties_committed` = 0 | Compiler returns total_credits = 0 | Worker skips grant() (PR B deviation); tenant sees zero balance; no error. Correct for free tier. |
| Two concurrent credit consumes for the same `request_id` on the same feature | UNIQUE constraint blocks second | Engine returns replay=true from first; second caller sees consistent state. Verified in PR A concurrency test. |
| Wallet cache drift (balance ≠ SUM(grants) − SUM(consumptions)) | Silent inconsistency | R110 catches within one recon cycle; ops runbook rebuilds cache from source of truth (grants + consumptions). |
| Publisher API (Instagram, TikTok, X, etc.) rejects the post | Feature runs, consumes credits, external call fails | `withCredits` handles: consume the reserved amount (external cost) at actual_cost from the ai_call_usage row if AI-driven, else at estimated cost; log the failure; tenant gets an error but is NOT overcharged. Retry policy: manual (tenant re-attempts). |
| Meta WhatsApp webhook floods (denial-of-service) | High rate of webhook events | Rate limiter at the webhook endpoint level; excessive from a single sender is 429; existing WhatsApp webhook signature verification blocks unsigned floods. |

Every failure mode above requires either an integration test or a documented runbook link.

### 4.3 Regulatory readiness

Specific compliance concerns this PR touches:

- **GDPR / MENA data protection**: tenant credit history contains personal spend patterns and is subject to erasure request. On tenant erasure: pseudonymize `credit_grants.granted_by_actor_id` and `credit_consumptions.data->>'user_id'` fields to `deleted:<hash>`. Financial rows are retained under the FINANCIAL_7Y policy (DL-041/042/043 from Stage 0 audit).
- **SOX-style dual controls**: PR C establishes two-person publish. PR D adds two-person for `credit_grants` above threshold (already in PR A). Verify both are wired on the hot path.
- **PCI-DSS scope**: this PR must NOT introduce any card handling; payment intents remain gated behind PSP webhook receivers (separate workstream). If tenant billing UI includes any card capture, it must use PSP-hosted iframes only.
- **Financial audit retention**: 7-year retention on grants + consumptions + audit events (already in PR A schema — verify DELETE remains revoked).
- **Consumer protection**: tenants viewing "you've used 100% of your typical monthly Instagram posts" gets a soft warning, not a hard block, if they still have shared balance. Hard block only at total balance = 0. Communicated clearly in-UI.
- **Right-to-explanation**: every consumption row's `data` JSONB carries enough context (feature, call_type, provider, model, cost_estimate_micro_usd, related_entity_id) for a tenant to reconstruct what they were charged for and why.

### 4.4 Scale target

Design targets to hit; test coverage must verify:

- **Tenants**: 10,000 active subscriptions across all tiers
- **Wallet operations**: 100 QPS peak (agents concurrently consuming credits during business hours)
- **Feature call site latency budget**: reserve+consume adds < 50ms P95 to any feature call
- **Grant history depth**: 3 years / 108 monthly grants per tenant × 10k tenants = ~1.1M grant rows; query performance must remain sub-second on the tenant's own grant history
- **Consumption history depth**: 200 consumptions/tenant/month × 12 × 10k = ~24M consumption rows; per-tenant + per-feature queries must remain sub-second (index sanity)
- **Reconciliation R110-R120 at scale**: full recon run must complete within 5 minutes at 10k tenants
- **Billing-cycle worker throughput**: process 10k due subscriptions in one hour (worker fires every 60s in batches of 100 = 100 subscriptions/minute = 6000/hour; if you need more, tune BATCH up to 500)

Every scale target above is verified either by an integration test at reduced scale (100 → 1k) with query-plan (`EXPLAIN ANALYZE`) verification that scaling won't degrade, or by a documented capacity-planning note that operator can revisit at 10x/100x tenant count.

## New locations

- `backend/src/lib/credits/with-credits.js` (from PR A — extended in this PR)
- `backend/src/lib/credits/feature-check.js` (new) — `checkEntitlement(tenantId, featureCode)` returns `{ enabled, quota_used_this_cycle, quota_display }`
- `backend/src/lib/credits/tenant-routes.js` (new) — tenant-scoped `/api/tenant/credits/*`, `/api/tenant/subscription/*`, `/api/tenant/invoices/*`
- `backend/src/lib/packages/property-tracker.js` — hook into listing status changes
- `web/src/pages/PlansPage.tsx` — plans + current plan + upgrade CTAs
- `web/src/pages/MySubscriptionPage.tsx` — current subscription detail
- `web/src/pages/MyCreditsPage.tsx` — real-time balance + per-feature usage bars + top-up CTA
- `web/src/pages/MyCreditNotesPage.tsx` — credit note history (from fin.credit_notes)
- `web/src/pages/MyInvoicesPage.tsx` — invoice history
- `web/src/components/credits/CreditBalance.tsx` — shared component (extend the existing whatsapp-listings-specific one, or replace)
- `web/src/components/credits/FeatureQuotaBar.tsx` — per-feature usage bar with informational tooltip
- `web/src/components/credits/TopUpDialog.tsx` — top-up amount selection + payment provider handoff (stub until Paddle wired)
- `web/src/components/credits/UpgradeDialog.tsx` — plan change with pro-ration preview via lifecycle.changePlan
- Wire pages into App.tsx: `/plans`, `/my-subscription`, `/my-credits`, `/my-credit-notes`, `/my-invoices`

## Feature wiring — every metered feature

Every feature call site listed in the migration 303 registry must be wrapped:

```js
import { withCredits } from '../lib/credits/with-credits.js'

// Instead of:
const result = await aiAdapter.extractProperty({...})

// Use:
const result = await withCredits({
  tenantId,
  feature: 'ai.listings_describe',
  requestId: `listings-ai:${listingId}`,
  callType: 'describe',
  relatedEntityType: 'listing',
  relatedEntityId: listingId,
}, async () => aiAdapter.extractProperty({...}))
```

Full list of files that must be wrapped (verified against `main`):

- `backend/src/modules/whatsapp-listings/application/pipeline.js` — already wrapped in PR A; verify still correct
- `backend/src/modules/whatsapp-listings/application/intent.js` — verify wrapper on classifyIntent
- `backend/src/modules/listings-ai/routes.js` — wrap `describe` handler
- `backend/src/contact-360.js` — wrap `computeLeadScore` + `getLeadSummary` + `regenerateSummary`
- `backend/src/lib/comment-classifier.js` — wrap `classifyComment` in the batch worker
- `backend/src/modules/area-intelligence/application/*` — wrap `runScoring` in scoring-worker; wrap `refreshGoogleSignals` in google-refresh-worker
- `backend/src/modules/property-valuation/application/analysis-service.js` — wrap the AI analysis path
- `backend/src/modules/social-cards/**` — wrap `render` path (BannerBear call)
- `backend/src/whatsapp.js` — wrap `sendListing` + `sendText` under `communication.whatsapp.conversation_window_24h`
- `backend/src/lib/notifications/sms.js` — wrap `send` under `communication.sms.per_message`
- `backend/src/lib/notifications/instagram.js`, `facebook.js`, `tiktok.js`, `x.js`, `linkedin.js` — wrap each publish path under the corresponding `publishing.social.*` feature

## Onboarding wiring

- `backend/src/identity.js` (tenant provisioning) — after inserting `public.tenants` + `fin.tenants` + `fin.holders` + `fin.billing_accounts`, immediately:
  1. Insert `public.credit_wallets` for the new tenant (calls `ensureTenantWallet` from PR A)
  2. Insert `public.tenant_subscriptions` PENDING_START pointing at the free-tier package version (id `30400000-0000-4000-8000-000000000002` from migration 304)
  3. `next_grant_at = billing_cycle_start = now`; billing-cycle worker will activate on next tick

## Reconciliation additions

- **R121** — every tenant with an ACTIVE subscription has a `credit_wallets` row (drift when someone deleted the wallet)
- **R122** — every consumption row on a feature has a matching `metered_features` row (drift when a feature is retired but consumption still logs to it — indicates dangling code path)
- **R123** — soft-cap breaches: for each tenant × feature over the last billing cycle, report if consumption exceeded 2× the tier's per-property × N assumption (indicates the quota_display was misleading and top-up UI failed to prompt)

Each with GREEN + DRIFT tests.

## Testing (all required)

- **Every feature wire is verified** in an integration test that shows: feature call reserves credits, does work, consumes at actual cost, records to ai_call_usage where AI-driven
- **Onboarding smoke test**: create a tenant, verify free-tier subscription auto-attached, verify wallet exists, verify feature call sites gate as expected
- **Threat model tests** (§4.1): one test per attack vector — self-approve blocked, replay blocked, cross-tenant read blocked, race blocked, CSRF blocked
- **Failure mode tests** (§4.2): one test per mode where feasible — engine unavailable → 503, feature registry missing → 500, mirror worker down → R114 DRIFT
- **Scale spot-check** (§4.4): EXPLAIN ANALYZE on the tenant per-feature quota query at 100k consumption rows; assert index-only scan
- **RTL tests** for every new tenant page — render + basic interactions
- **Web integration** using MSW mocks: tenant view balance → top up → see updated balance
- **Regression**: every existing whatsapp-listings test passes; PR A/B tests pass; PR C admin tests pass
- **Fast + Real-Postgres + Web all green**

## Scope guardrails (do NOT exceed)

- Do NOT integrate Stripe / Paddle / manual-receipt payment provider flows. Top-up dialog is a stub that emits an outbox event `topup.requested`. Payment provider integration is a separate workstream, dispatched after PR D lands.
- Do NOT build a marketing website — separate workstream (Paddle merchant-verification prerequisite)
- Do NOT rebuild PA admin surfaces from PR C (they exist already)
- Do NOT modify PR A engine internals or PR B compiler / lifecycle / worker internals — you consume them
- Do NOT introduce new advisory locks
- Do NOT create new packages via seed migration — the free-tier is the only seed; other packages are created via PR C admin flow

## Branch + PR

Branch: `feat/feature-wiring-and-tenant-billing-ui`
Base: `main`
PR title: `Feature wiring across all metered features + tenant billing UI + free-tier onboarding (PR D)`

## Definition of done

- Every metered feature in the migration 303 registry is wrapped with `withCredits`
- Onboarding auto-provisions free-tier subscription for new tenants
- All 5 tenant pages built (Plans, MySubscription, MyCredits, MyCreditNotes, MyInvoices) with per-feature quota display
- Top-up dialog is functional up to the payment provider handoff (stub emits outbox event)
- Change-plan dialog uses lifecycle.changePlan with pro-ration preview
- Threat model tests (§4.1) all pass
- Failure mode tests (§4.2) all pass
- R121, R122, R123 registered with GREEN + DRIFT tests
- Fast + Real-Postgres + Web suites all green
- No regressions in PR A/B/C tests
- Every attack vector in §4.1 has a passing test
- Query-plan for tenant per-feature quota query verified index-only at scale

## Deviations from spec

Same discipline as PR A/B/C — deviations documented under "Deviations from spec" in the PR body. Elevated audit will verify each deviation against the threat model + failure mode + regulatory sections, not just the code claim.
