# Platform-wide credit system — design

This doc defines the shape of the credit system that will gate every paid feature on Wingcaster once feature build-out is done and per-feature costs are agreed. It is NOT an implementation plan — pricing decisions have not been made. This is the ARCHITECTURE the pricing decisions plug into.

Written 2026-08-30, targeting the state of `origin/main` at commit `d4d475c`.

## The problem

Wingcaster runs six AI providers, seven social channels, SMS, image generation, and mapping APIs. Every one of these costs the platform real money per unit. Today:

- The **`whatsapp-listings`** module has its own credit gate: `ai_credit_balances` + `feature_entitlements` + `/api/agent/credits/*` + `/api/agency/credits/*`.
- Every other paid capability (AI listing description, contact enrichment, comment classifier, social publish, SMS reminders, saved-search alerts, market pricing analysis, area intelligence, social card renders) has **NO credit gate**. Runs free.
- The **`fin.*`** schema is a full enterprise ledger — invoices, credit facilities, double-entry accounting, dunning — but is not wired to any tenant feature.

The design below unifies these into one platform-wide credit system.

## Principles (product decisions locked 2026-08-30)

1. **Free tier is real.** Any agent can register, list properties, and use the operating platform without a subscription. Free tier permits: property records, contact/CRM management, tasks, opportunities, listing management — no publishing, no AI, no WhatsApp send, no metered features. Free tier onboarding is the "one-property owner" path — someone with a single property to manage should not be charged.
2. **Paid subscription = monthly, per active-property model, per-tier included quotas.** Subscribing enables a defined number of active properties AND unlocks the metered features. The included quotas (X for social publishing, Y for real-estate-site publishing, Z for WhatsApp send, A for property rating, B for price benchmarking, C for AI post creation, D for lead-gen AI activation) are attached to the subscription tier. Overage requires top-up credits or a higher tier.
3. **Per-active-property, not per-seat.** Billing unit is a listing/property, matching the user's stated model. Seats are free; properties are metered.
4. **Cost-plus recording, not enforcement (v1).** Fixed per-unit prices (whatever pricing decides) are fine. But the system MUST record actual cost per call (see [CURSOR_AI_USAGE_LOGGING](../prompts/CURSOR_AI_USAGE_LOGGING.md)) so cost-plus becomes possible later without a re-architecture. AI cost is metered in raw-cost equivalents (input tokens + output tokens per provider+model), WhatsApp cost is metered per Meta conversation-window, BannerBear is metered per render.
5. **Two-tier architecture.** fin.* is the source of truth (money in, invoices out). Operational credits are the hot-path gate (feature call → check balance → debit). This is what most large SaaS does; avoids fin.* on the request hot path while keeping fin.* as the authoritative ledger.
6. **Idempotent everywhere.** Every debit is idempotent by `(request_id, feature, call_type)`. A caller retrying a failed feature call cannot double-debit.
7. **Best-effort logging must not fail a paying feature call.** If the log insert fails, the call still succeeds. Reconciliation catches missed rows.
8. **Hybrid credit model — single unified balance in the backend, per-feature quota display in the UI.** Under the hood: one credit currency per tenant, one balance. Each feature has a per-unit "credit price" (1 social publish = X credits, 1 WhatsApp conversation = Y credits, 1 AI post = Z credits — with prices set by pricing decisions and updatable via config, not by migration). Frontend shows the tenant per-feature usage vs their tier's expected consumption ("you've used 40 of your ~50 typical monthly social publishes; you have M credits left overall") — the "typical" is a soft display; consumption is against the shared balance so unused social credits can pay for extra WhatsApp when a tenant's usage tilts differently that month. Precedent: Cloudflare Workers, Stripe, OpenAI, Anthropic — all run unified balance with per-service pricing and per-service dashboards.
9. **Social publishing is BOTH tier-gate AND metered.** Access to publish at all is a tier feature (free tier cannot publish; paid tier can). Each publish then counts against the tier's included quota. Overage requires top-up or tier upgrade.
10. **Platform-owned vendor accounts, tenant-metered consumption.** BannerBear is the canonical example: platform holds ONE BannerBear subscription; tenants consume from that central pool. Tenants never see or hold BannerBear credentials. Same pattern applies to any per-render / per-call vendor where the platform gets bulk pricing (BannerBear, some AI providers, mapping APIs).

## Architecture — two tiers

### Tier 1 — Operational credits (`public.*`, hot-path)

Every feature call debits here. Sub-millisecond hot path. No fin.* calls in the request path. **One unified balance per tenant; each consumption row is feature-tagged for reporting.**

```
public.credit_wallets          -- one row per tenant
  (tenant_id, credits_remaining, credits_reserved,
   billing_period_start, billing_period_end, updated_at, version)

public.credit_grants           -- append-only; every grant creates a row
  (id, tenant_id, source, amount, granted_at, grant_ref,
   billing_period_start, billing_period_end, expires_at, data)
  -- source ∈ 'subscription_cycle' | 'topup.stripe' | 'topup.paddle'
  --        | 'topup.manual_receipt_omt' | 'topup.manual_receipt_whish'
  --        | 'topup.manual_receipt_monty' | 'topup.manual_receipt_bank_transfer'
  --        | 'topup.manual_receipt_paypal' | 'promo' | 'goodwill'
  --        | 'migration' | 'facility_draw'

public.credit_consumptions     -- append-only; every debit creates a row
  (id, tenant_id, feature, call_type, consumed_at,
   credits_amount, actual_cost_micro_usd, provider, model,
   request_id, related_entity_type, related_entity_id, data)
  -- UNIQUE(tenant_id, request_id, feature, call_type) — idempotency
  -- feature ∈ 'publishing.social' | 'publishing.realestate' | 'whatsapp'
  --         | 'rating' | 'benchmarking' | 'ai.post-creation' | 'ai.lead-gen'

public.credit_prices           -- config-driven; one row per (feature, call_type)
  (feature, call_type, credits_per_unit, unit, effective_from,
   deprecated_at, notes)
  -- e.g. ('publishing.social', 'publish',       1,  'property_publish', ...)
  --      ('whatsapp',           'conv_utility', 3,  'conv_window_24h',  ...)
  --      ('whatsapp',           'conv_marketing',15,'conv_window_24h',  ...)
  --      ('ai.post-creation',   'create',       5,  'call',             ...)
  --      ('rating',             'compute',      2,  'call',             ...)
```

Balance = SUM(grants.amount) - SUM(consumptions.credits_amount). `credit_wallets` is a CACHE, updated in the same transaction as the append. Rebuild from grants + consumptions if it ever drifts.

**Per-feature quota display** (frontend concern): compute from `credit_consumptions` filtered by feature over the billing period, compared against the tier's expected `N × per_property_assumption[feature]`. Rendered as "you've used 40 of your ~50 typical monthly social publishes" — the "~" signals it's advisory, not a hard cap. Hard cap is only the total balance hitting zero.

**Subscription-cycle grants** fire on billing period start: one `credit_grants` row with `source='subscription_cycle'` and `amount = sum over features of (N × per_property_assumption[feature] × credit_prices[feature].credits_per_unit)`. That total is what the tenant sees as their fresh monthly credit balance. Rollover rules per tier: expire vs carry-forward at period end.

**Top-ups** are one currency: customer buys credits, they land in the same pool, work for any feature.

**Free tier** = no active subscription, no monthly grant, no billing period. Wallet exists with balance zero. Every metered feature call fails at balance check: `INSUFFICIENT_CREDITS`. Non-metered features (CRM, contacts, listing management) do not touch the wallet and remain free.

**Feature-tier gates** (independent of balance): if the free tier disallows publishing entirely, that's a `feature_entitlements` check that fires BEFORE the balance check, returning `PUBLISHING_NOT_IN_PLAN` — not `INSUFFICIENT_CREDITS`. This distinguishes "your plan doesn't include this" from "your plan includes this but you're out of credits."

### Tier 2 — Accounting / source of truth (`fin.*`, warm-path)

Every operational-tier grant lands as a `fin.lots` row (prepaid tokens). Every operational-tier consumption lands as a `fin.rated_usage` row. Payments land as `fin.payments`. Invoices land as `fin.invoices`. Reconciliation is R-check driven — for every consumption row in Tier 1, there must be a matching rated_usage row in Tier 2, with matching amounts.

Tier 2 is what Finance sees. Tier 2 is what the customer's invoice PDF comes from. Tier 2 is what dunning reads to know who's overdue.

## Data flow

### Money in (grant → wallet + fin.lots)

```
1. Customer pays via Stripe/Paddle/OMT/Whish/Monty/BankTransfer/PayPal
2. Payment lands (webhook for PSPs, admin action for manual paths)
3. Payment recorded in fin.payments
4. Tier 2: fin.lots row created (source_kind based on provider)
5. Tier 1: credit_grants row appended, credit_wallets balance updated
6. All 3+5 in one Tier 2 transaction; Tier 1 fires from a Tier 2 trigger
```

### Feature call (consume → wallet + fin.rated_usage)

```
1. Feature receives request; extracts tenant_id + request_id
2. Feature calls costEstimator(feature, callType, args) → estimated_credits
3. Feature calls wallet.reserve(tenant_id, estimated_credits, request_id):
   - If not enough available: throw INSUFFICIENT_CREDITS
   - If enough: increment credits_reserved
4. Feature does the actual work (AI call, WhatsApp send, whatever)
5. Feature calls wallet.consume(tenant_id, request_id, actual_cost) with:
   - actual_credits (may differ from estimate)
   - actual_cost_micro_usd (from ai-usage-logger, if AI)
   - provider + model (if applicable)
   - related entity
6. wallet.consume:
   - Idempotent on (tenant_id, request_id, feature, call_type)
   - If already consumed: return cached result
   - Else: append credit_consumptions row, decrement wallet, release reservation
7. Async worker syncs to Tier 2: creates fin.rated_usage row
```

If step 4 fails, feature calls `wallet.releaseReservation(tenant_id, request_id)` — no consumption row, no fin.* activity.

### Payment failure / dunning (facility-backed tenants)

Postpaid tenants get a `fin.credit_facilities` row. Tier 1 wallet allows overdraft up to the facility limit. Facility usage generates a `fin.rated_usage` row on consume, which rolls into the next billing period's invoice. Overdue invoice → dunning case → progressive gating → eventual suspension (freeze wallet + facility).

## Feature registration

Each feature declares its cost model in a config file so pricing decisions can update one place. Rough shape:

```js
// backend/src/lib/feature-costs.js

export const FEATURE_COSTS = {
  'whatsapp-listings:draft': {
    kind: 'ai-bundle',     // multiple AI calls per draft
    unit: 'draft',
    credits: 5,            // flat estimate, refined by post-call actual_cost
    perProperty: true,
  },
  'listings-ai:describe': {
    kind: 'ai-single',
    unit: 'call',
    credits: 1,
    perProperty: true,
  },
  'social-publish:post': {
    kind: 'action',
    unit: 'post',
    credits: 1,            // may be tier-gated instead of per-unit
    perProperty: true,
    channel: 'meta|instagram|tiktok|x|linkedin',  // per-channel variants
  },
  'whatsapp-send:message': {
    kind: 'external-passthrough',
    unit: 'conversation-window',  // Meta pricing is per 24h window, not per message
    credits: 3,            // higher for marketing, lower for utility
    perProperty: false,
    category: 'utility|marketing',
  },
  'sms:send': {
    kind: 'external-passthrough',
    unit: 'message',
    credits: 1,            // ~10x for MENA vs US
    perProperty: false,
    country: 'auto',       // varies pricing by destination
  },
  'contact-enrich:lead-score': { kind: 'ai-single', unit: 'call', credits: 1, perProperty: false },
  'contact-enrich:lead-summary': { kind: 'ai-single', unit: 'call', credits: 2, perProperty: false },
  'comment-classifier:one': { kind: 'ai-single', unit: 'call', credits: 1, perProperty: false },
  'area-intelligence:score': { kind: 'ai-plus-external', unit: 'call', credits: 5, perProperty: false },
  'market-pricing:analysis': { kind: 'ai-plus-external', unit: 'call', credits: 3, perProperty: true },
  'social-cards:render': { kind: 'external-passthrough', unit: 'render', credits: 1, perProperty: true },
  'saved-search:alert-deliver': { kind: 'passthrough-fanout', unit: 'delivery', credits: 1, perProperty: false },
  'reminder-policy:fire': { kind: 'passthrough-fanout', unit: 'fire', credits: 1, perProperty: false },
}
```

Credits values here are placeholders — real values come from pricing.

## Subscription tiers and included quotas

### Free tier
- Register + list properties + operating platform (CRM, tasks, opportunities, contacts, message templates, listing management)
- NO publishing (social platforms, real-estate sites)
- NO WhatsApp send
- NO AI (post creation, property rating, price benchmarking, lead-gen AI)
- Zero cost to tenant, zero cost to platform beyond storage

### Paid tier (monthly subscription)

Subscribing enables a defined number of "active properties" AND unlocks the metered features. Each tier includes a per-tier set of quotas:

| Included quota | Symbol | Metering unit |
|---|---|---|
| Publishing to social platforms (Instagram / Facebook / TikTok / X / LinkedIn / WhatsApp) | **X** | Active property posted (not per-post) |
| Publishing to real-estate portal sites (OLX, Property Finder, etc.) | **Y** | Active property posted (not per-post) |
| WhatsApp outbound messages | **Z** | Meta conversation window (24h) — utility and marketing priced separately per Meta |
| Property rating (area intelligence scoring) | **A** | Rating computation call |
| Property price benchmarking (market pricing analysis) | **B** | Benchmarking computation call |
| AI-generated post creation | **C** | AI post-creation call |
| Qualified lead-generator AI activation | **D** | Lead-gen AI activation |

**Quota model (confirmed — hybrid).** Each tier declares `properties_covered = N` and pricing sets a `credit_price` per feature+call_type in `credit_prices`. The tier's monthly credit grant is:

```
tier.monthly_grant = SUM over features:
    N × per_property_assumption[feature] × credit_prices[feature].credits_per_unit
```

Per-property assumptions (illustrative — actual numbers set by pricing):
- Social publishing: ~1 property published per property per month
- Real-estate site publishing: ~1 property published per property per month
- WhatsApp intake / send: ~1 conversation window per property per month
- Property rating: ~2 rating computations per property per month
- Price benchmarking: ~2 benchmark computations per property per month
- AI post creation: ~1 AI-generated post per property per month
- Lead-gen AI activation: ~1 activation per property per month

Example: if pricing decides `credit_prices` = 1/1/3/2/2/5/4 respectively and per-property assumptions above, then the monthly grant for a 10-property tier is:

```
10 × (1×1 + 1×1 + 1×3 + 2×2 + 2×2 + 1×5 + 1×4) = 10 × 22 = 220 credits
```

Customer's monthly wallet display:
```
wallet: {
  properties_covered: 10,
  credits_remaining: 220 (fresh grant on each billing cycle),
  quota_display: {
    social_publish:       "0 of ~10 typical publishes",
    realestate_publish:   "0 of ~10 typical publishes",
    whatsapp:             "0 of ~10 typical conversation windows",
    rating:               "0 of ~20 typical rating calls",
    benchmarking:         "0 of ~20 typical benchmark calls",
    ai_post_creation:     "0 of ~10 typical AI posts",
    leadgen_ai:           "0 of ~10 typical activations",
  }
}
```

The quota_display strings are computed from consumption history + tier + credit_prices — not stored. Tenant can consume any feature freely as long as the shared 220-credit balance holds; the display flags when they've exceeded a per-feature typical usage as a soft signal ("used 15 of your ~10 typical — you have M credits left").

Top-ups are a single "buy credits" action; the added credits work for any feature. Rollover / expiry rules per tier: expire vs carry-forward at period end (default: expire).

Actual numeric values for N, per-property assumptions, and credit_prices per feature are pricing decisions not yet made. This doc holds the SHAPE the pricing plugs into.

### Non-metered tier-gated features (yes/no per tier)

Some capabilities are pure tier-gate — no metering, either on or off per subscription plan. Use `feature_entitlements` (already in `public.*`). Confirmed candidates from the audit:

- White-label site (custom domain)
- White-label embeddable widgets
- XML property feed (for external portals)
- Advanced CRM analytics (Command Center)
- Multi-agent / agency management
- Inspector workflow module

### Social publishing — combined tier-gate + metered (special case)

Per product decision: social publishing is BOTH a tier-gate (free tier cannot publish; paid tier can) AND metered (each publish consumes from X or Y quota). Two guards, in this order at call time:
1. `feature_entitlements` check — is publishing enabled for this tenant's tier? If not: `PUBLISHING_NOT_IN_PLAN`.
2. Quota check — does the tenant have X (or Y) remaining, or top-up credits? If not: `PUBLISHING_QUOTA_EXHAUSTED`.

## Platform-owned vendor accounts

Some vendors are held at the platform level, not per-tenant. Tenants never hold credentials for these. Platform pays the vendor (bulk/subscription/tier pricing) and meters tenant consumption from a central pool.

- **BannerBear** — one platform-level BannerBear subscription. Each `/api/listings/:id/social-cards/render` call debits from the tenant's credit balance based on internal price-per-render. Tenants never see BannerBear API keys or dashboards.
- **AI providers** (Claude / OpenAI / Gemini / Kimi / DeepSeek / Qwen) — platform holds all six API keys. Tenants never bring their own. Consumption metered per raw-cost equivalents (see [CURSOR_AI_USAGE_LOGGING](../prompts/CURSOR_AI_USAGE_LOGGING.md)).
- **Google Maps** — one platform key; tenant consumption tracked against `GOOGLE_MAPS_BUDGET_USD_MONTHLY`; over-budget access gates.

Tenants DO bring their own credentials for:
- Social channels where they publish AS themselves (Meta / Instagram / TikTok / X / LinkedIn) — the token/account they own
- WhatsApp Business (their own WABA + phone number)
- SMS if they use their own Twilio (else platform pool)

## Migration from today

### Phase 0 — Prereq
Ship AI per-call usage logging ([CURSOR_AI_USAGE_LOGGING](../prompts/CURSOR_AI_USAGE_LOGGING.md)). Without this, we can't price Tier A features honestly.

### Phase 1 — Extract the entitlement + credit service from whatsapp-listings
- Move `application/entitlements.js` and `application/credits.js` from `modules/whatsapp-listings/` to `lib/credits/` (or a new top-level `credits/` module)
- Register `/api/agent/credits/*` and `/api/agency/credits/*` at platform level, not per-module
- Update whatsapp-listings to use the extracted service via import, not local implementation
- Rename `ai_credit_balances` → `credit_wallets`, `ai_credit_transactions` → include both grants and consumptions (or split into two tables per the spec above)
- Add `feature` + `call_type` + `request_id` + `actual_cost_micro_usd` columns

### Phase 2 — Wire the other Tier A features
- Wrap each feature call with `wallet.reserve()` + `wallet.consume()`
- Use the `FEATURE_COSTS` table for estimates
- Ship one feature at a time; verify each in staging
- Do NOT wire until pricing is agreed for that feature

### Phase 3 — Payment integration
- Wire Stripe + Paddle as PSPs (per user's territory-routing decision)
- Wire manual-receipt admin surface for OMT/Whish/Monty/BankTransfer/PayPal
- On payment success: create `fin.payments`, then `fin.lots`, then trigger Tier 1 grant

### Phase 4 — Fin.* wiring
- Async worker syncs Tier 1 consumptions → `fin.rated_usage` rows
- Postpaid facilities: allow Tier 1 wallet overdraft up to facility limit
- Enable dunning for overdue invoices
- Enable invoice PDF generation from `fin.invoices`

### Phase 5 — Tenant-facing billing UI
- Rebuild `PlansPage`, `SubscribeDialog`, `MySubscriptionPage`, `MyCreditNotesPage`, `MyInvoicesPage` on the new stack
- Consumes both operational wallet (real-time balance display) and fin.* (invoice history)

## What v1 does NOT include

- Cost-plus dynamic pricing. Prices are fixed per unit; margin is set by pricing decisions, not by real-time cost pass-through.
- Multi-currency wallet. One currency per tenant at signup.
- Per-user credit sub-pools inside an agency. Agency gets one pool; agency-admin allocates via `/api/agency/credits/allocate` (route already exists).
- Auto-topup. Manual only in v1; auto-topup is Phase 6+.
- Facility-backed postpaid for retail tenants. Agencies only; retail agents are prepaid-only.

## Open questions to resolve during pricing

- **How many credits does each Tier A action cost?** Requires pricing input. Populate `FEATURE_COSTS`.
- **What plan tiers exist? What Tier C capabilities are gated to each?** Marketing/product decision.
- **How many credits are included in each plan?** Business decision.
- **Do agencies get discounted overage rates?** Business decision.
- **Is there a "included in plan" credit reset at each billing period, or do they roll over?** Business decision (implication: `credit_grants.expires_at` handling).
- **Are WhatsApp/SMS pass-through costs marked up, or at-cost?** Business decision.
- **Which social-publish channels get free vs paid?** All are free-API today; may still gate as premium.

## Dependencies

- Phase 0: [CURSOR_AI_USAGE_LOGGING](../prompts/CURSOR_AI_USAGE_LOGGING.md) — ship first.
- Phase 3: Paddle build spec (pending) + Stripe subscription/metered upgrade spec + manual-receipt admin surface spec.
- Phase 5: Marketing website (Paddle verification prerequisite) + object storage (`fin.invoices` PDFs).

## Cross-references (verified against `origin/main`, not against .md files)

- Current credits framework: `backend/src/modules/whatsapp-listings/application/{entitlements,credits}.js`, migration `010_templates_entitlements.sql`
- fin.* accounting engine: `backend/src/fin/**` — 22 subdirs including ledger, accounting, billing, dunning, funding, rating
- fin.* migrations: 100-series (foundation), 200-series (billing), 289 (quota projection), 290 (constraint back-fill from PR #25)
- PSP adapter shape: `backend/src/fin/funding/psp/{index,stripe}.js`
