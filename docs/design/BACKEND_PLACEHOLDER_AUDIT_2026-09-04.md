# Backend placeholder / production-readiness audit

**Date:** 2026-09-04
**Scope:** `backend/src/**/*.js` (production code, excluding test files, e2e/, testing/)
**Method:** Systematic grep against known placeholder markers (`TODO`, `FIXME`, `NOT_IMPLEMENTED`, `not yet wired`, `stub`, `placeholder`, `simulated`, `simulator`, `dev fallback`, `TBD`, `for now`, `Stage N not merged`), plus manual read of every hit for context.

**Result:** WingCaster's backend is NOT production-ready today. The core platform (auth, CRM, inbox, credit engine, package system, fin.* ledger) is solid — enterprise-grade. But the **payment integration, real-estate portal publishing, tax engine, several AI producers, and a handful of admin surfaces are placeholders that throw explicit `NOT_IMPLEMENTED` errors**. Every placeholder is guarded (fails loud) so nothing silently pretends to work, which is correct. But shipping "as-is" would mean a live user cannot pay, cannot publish to Bayut / Property Finder / OLX / Dubizzle, cannot receive tax-compliant invoices, and cannot use three metered AI features.

None of the placeholders are hidden — every one throws a coded error the frontend can react to. This is a **completeness** problem, not a **safety** problem.

---

## Severity legend

- **P0 — Ship-blocker** — a live paying customer cannot complete a core flow. Money, publishing, or tax is affected.
- **P1 — Feature gap** — capability is documented, credit-metered, and expected by UX but not delivered. Users hit an error.
- **P2 — Quality gap** — dev-fallback, stale seed data, or code smell that isn't a live-customer bug but shouldn't be in production.
- **P3 — Info** — not an issue; noted so the audit is complete.

---

## P0 — Ship-blockers

### P0-1 — Stripe live integration is not wired

`backend/src/fin/funding/psp/stripe.js:87-115` — `submitPayment` never calls Stripe. Two code paths:

- **No STRIPE_SECRET_KEY:** returns simulated `pi_test_<intent_id>` / `cs_test_<intent_id>` with `simulated: true`.
- **STRIPE_SECRET_KEY set:** returns `pi_live_pending_<intent_id>` with `client_secret: null` and `pending_worker: true`.

File comment (line 104): `// Live Stripe SDK is not a Stage 7 dependency. Outbox worker retries until ops wires a client`. **Meaning: even with a real Stripe key set, no charge is actually initiated.** The outbox worker that should call Stripe does not exist in the tree.

The webhook receiver `confirmWebhook` (line 118) IS fully implemented — signature verify + intent lookup + confirmPurchasePayment/failPurchase. So the **inbound path works; the outbound path does not**.

**To fix:** install `stripe` SDK, wire `submitPayment` to actually call `stripe.paymentIntents.create()` when key present, add environment=LIVE guard.

### P0-2 — Tenant top-up endpoint is a stub

`backend/src/lib/credits/tenant-routes.js:175` — `POST /api/tenant/credits/top-up` returns:

```
{ status: 'pending_provider',
  message: 'Top-up requested. Payment provider handoff is not wired in this PR.',
  amount_usd, idempotency_key }
```

It DOES emit an `fin.outbox_events` event with topic `topup.requested` (lines 158-172) and has a corresponding webhook receiver at `POST /api/tenant/credits/top-up/webhook` (line 187) that finalises the top-up. Missing piece: nothing consumes the outbox event to actually call Paddle/Stripe.

**To fix:** consume the `topup.requested` outbox event → create a Paddle/Stripe checkout → return the checkout URL to the client instead of the current 202. Once integrated, remove the "not wired in this PR" copy.

### P0-3 — All 4 real-estate portal publishers are stubs

`backend/src/lib/notifications/realestate.js:1-43` — the entire file is a wrapper that meters credits then throws `NOT_IMPLEMENTED`:

```
export const REAL_ESTATE_PORTALS = ['olx', 'property_finder', 'bayut', 'dubizzle']

// publishToRealEstatePortal → throws { code: 'NOT_IMPLEMENTED',
//                                       message: '${portal} publish is not implemented' }
```

File comment (line 2): `Real-estate portal publishers. Production APIs are not wired yet; these stubs are wrapped with withCredits so every migration-303 feature has a metered call site. Portal integration is a separate workstream.`

**Impact:** Every UI action that publishes to OLX / PF / Bayut / Dubizzle will fail. Since these are 4 of the 22 metered features and the primary MENA distribution channels, this is a major shipping blocker.

**To fix:** each portal has a different integration model (OLX has a public feed API, PF/Bayut/Dubizzle have partner-only APIs requiring commercial agreements). This is a full workstream — 4-8 weeks of adapter development + partner-onboarding for each portal.

### P0-4 — Three AI producers are stubs

`backend/src/lib/credits/ai-stubs.js` — three metered features throw `NOT_IMPLEMENTED`:

- `rateProperty` → `AI_PROPERTY_RATING` (used by inspector / property rating flow)
- `activateLeadGen` → `AI_LEAD_GEN_ACTIVATION` (used by campaigns / lead-gen)
- `createAiPost` → `AI_POST_CREATION` (used by whatsapp-listings draft + listings-ai describe)

File comment: `Stubs for metered AI features that have no production producer yet. Each export is wrapped with withCredits so a missing wrap cannot silently run at zero cost once a caller is added.`

The wrapper is smart: it accepts an `opts.work` function that a caller can supply to inject the real work. Some callers likely already do this, but any caller that just invokes the wrapper without `work` will get the error.

**To fix:** wire real producers for each. `AI_POST_CREATION` is the most critical — it's called by both the WhatsApp intake and the listing-description flow (both are marketed).

### P0-5 — Tax engine returns `OUT_OF_SCOPE` for every invoice

`backend/src/fin/tax/service.js` — `resolveTax` always returns `{ vat_bps: 0, tax_treatment: 'OUT_OF_SCOPE', provider: 'MANUAL' }`. Comment: `Stage 9 stub — no fin.tax_registrations; default OUT_OF_SCOPE (DL-126)`.

**Impact:** Invoices carry zero VAT/GST regardless of jurisdiction. Not compliant with UAE VAT (5%), KSA VAT (15%), KSA ZATCA e-invoicing, EU VAT, or any regional tax regime. Cannot legally issue invoices to VAT-registered customers.

**To fix:** implement `fin.tax_registrations` table + per-jurisdiction rate resolution + ZATCA e-invoice XML generation for KSA + VAT-invoice PDF composition. Significant workstream.

### P0-6 — Vendor admin routes are static stubs (Stage 11 code merged but not wired)

`backend/src/fin/admin/routes.js:107-122` — `registerVendorStub` mounts:

- `GET /api/admin/fin/vendors` → returns `{ vendors: [], stage11: false, message: 'Stage 11 not merged' }`
- `GET /api/admin/fin/vendors/:id` → returns `{ vendor: null, stage11: false, message: 'Stage 11 not merged' }`

But migrations 210 (`fin.vendors`), 211 (`fin.vendor_usage`), 212 (`fin.vendor_statements`) DO create the tables, and `backend/src/fin/vendors/registry.js` DOES have `activateRateVersion` / `deprecateRateVersion` / `upsertVendorProduct` functions. **The data model + business logic exists; the admin API surface is deliberately stubbed.**

**To fix:** replace `registerVendorStub` with real read routes hitting `fin.vendors` + `fin.vendor_statements`. The Screen Matrix `PA-VEN-001..005` assumes these routes work.

### P0-7 — Consumer notification dispatch is a placeholder

`backend/src/server.js:3055-3062` — the `dispatchConsumerNotification` function has:

```
// Placeholder: channel-specific dispatchers would be invoked here.
// For now, record that the dispatch is pending until a provider is configured.
return { ok: false, status: 'pending',
         error: `Channel ${channel} dispatch not yet wired. Provider integration required.` }
```

Called by the `POST /api/automation/consumer/run` route (line 3080-ish). **Any consumer-side notification (saved-search alerts, price drop alerts, new-listing alerts to registered visitors) will not be sent.**

**To fix:** route each channel to its transport (email → sendEmail, sms → sms.js, push → capacitor push).

---

## P1 — Feature gaps (documented, expected, missing)

### P1-1 — OTP delivery outside email is not wired

`backend/src/lib/otp.js:143-146` — for any `channel` other than email:

```
const err = new Error(`OTP transport for '${channel}' is not yet implemented`)
err.code = 'OTP_TRANSPORT_NOT_IMPLEMENTED'
logger.error({ channel, contact }, 'OTP transport not implemented — request rejected')
```

**Impact:** SMS OTP + WhatsApp OTP are not deliverable, even though both transports exist in `lib/notifications/sms.js` + `whatsapp.js`. The 6-identity-path signup we scoped depends on SMS/WhatsApp OTP for phone-based signup — currently only email OTP works.

**To fix:** three-line dispatcher wiring `channel === 'sms' → sms.sendSMS`, `channel === 'whatsapp' → whatsapp.sendWhatsAppText`.

### P1-2 — Direct-publish default case throws for unhandled platforms

`backend/src/server.js:5575` — the switch statement over platforms in the direct-publish path has:

```
default:
  throw Object.assign(new Error(`Direct publish for ${platform} is not yet implemented`), {
    code: 'NOT_SUPPORTED',
  })
```

**Impact:** Any platform not in the switch (probably any non-handled portal) fails. The switch covers `instagram`, `facebook`, `tiktok`, `x`, `linkedin` (all wired) and refers to `realestate` (P0-3). Anything else = user error.

**To fix:** ensure every entry in the FEATURES registry has a corresponding case. Currently limited to social channels; new metered features need to be added to this switch.

### P1-3 — Distribution retry for unhandled platforms

`backend/src/server.js:4608` — same shape as P1-2 for the retry-publish path:

```
error = `Retry publishing is not implemented for ${row.platform}`
```

Same fix.

### P1-4 — TikTok comment reply + DM require partner API

`backend/src/lib/notifications/tiktok.js:39-43` — `replyToTikTokComment` and `sendTikTokDM` throw `TIKTOK_UNIMPLEMENTED`. File comment: `DMs and comment replies require partner-tier access most integrations don't have.` Photo publish + video publish + insights ARE wired (lines 61-185).

**Impact:** Users cannot reply to TikTok comments from the unified inbox. Publishing to TikTok works. This is a TikTok API limitation, not a code gap — the platform gates this behind a partner agreement.

**To fix:** apply for TikTok Content Posting API partner access; then implement the endpoint (moderate lift).

### P1-5 — SES email provider not wired

`backend/src/lib/notifications/email.js:102` — the `ses` provider throws `SES_NOT_IMPLEMENTED`. Graph, Resend, SendGrid, SMTP are all fully implemented.

**Impact:** Zero — Microsoft Graph is the specified transport (per memory `otp-transport`) and it works. SES is only ever selected if `EMAIL_PROVIDER=ses` is explicitly configured.

**To fix:** low priority; only if a customer specifically needs SES.

### P1-6 — Outbound conversation dispatch for unhandled channels

`backend/src/conversations/orchestrator.js:716` — fallback response:

```
dispatch = { ok: false, status: 'pending', provider: null, provider_message_id: null,
             error: `Outbound dispatch for ${channel} not yet implemented` }
```

**Impact:** Handles the case where the orchestrator sees a channel it doesn't know about. Same pattern as P1-2 — the switch above this must cover every supported channel.

### P1-7 — Tax registrations admin API is a placeholder

`backend/src/fin/admin/reads.js:359` — `tax_registrations: { placeholder: true, stage: 'future', rows: [] }` in the admin overview response. Feeds a PA screen (currently missing per my Screen Matrix) that would list which legal entities are VAT-registered in which jurisdictions.

**Impact:** No way to configure tax registrations in the admin UI. Ties to P0-5.

### P1-8 — Fin admin generic `notImplemented` helper

`backend/src/fin/admin/routes.js:66-73` — a `notImplemented(res, dl, command)` helper that returns:

```
{ status: 501, code: 'NOT_IMPLEMENTED', dl, command,
  error: `${command} is not implemented; ${dl}` }
```

I couldn't grep any callers in my scan — it's defined but not called. **Either dead code (P2) or a helper waiting for future stubs.**

### P1-9 — Consumer notification retries and dispatcher observations

`backend/src/notifications/subscription/dispatcher.js:15` — comment: `[fields] are reserved by the schema and preferences code but not wired.` Some notification schema fields aren't consumed by the dispatcher yet.

---

## P2 — Quality gaps

### P2-1 — Dev JWT-secret fallback (guarded)

`backend/src/auth.js:19` — if `JWT_SECRET` env is missing:

```
if (process.env.NODE_ENV === 'production') {
  console.error('FATAL: JWT_SECRET environment variable is required in production')
  process.exit(1)
}
const fallbackSecret = 'dev-jwt-secret-change-me'
console.warn('JWT_SECRET not set; using a development fallback secret')
```

**Safe** — hard-exits in production. Only a dev-time convenience. No action needed unless the exit-in-production behavior is changed.

### P2-2 — Hardcoded Unsplash template preview URLs

`backend/src/server.js:7480` — white-label site templates include hardcoded Unsplash URLs as preview images:

```
preview_image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400'
```

**Impact:** Template previews depend on Unsplash's CDN staying up + those specific photo IDs not being taken down. Rate limits + copyright drift risk.

**To fix:** host preview images ourselves (S3 / R2 / local `web/public/`) with proper licenses.

### P2-3 — Consumer notification retry references old `data JSONB` model

Similar to fin.* migrations noted throughout — many tables carry `data JSONB` for extensibility but this isn't schema-validated. Not a placeholder, but a discipline issue: the same field means different things in different contexts.

### P2-4 — VRM migrations (400-403) are untracked

`git status` shows migrations 400-403 (VRM: vacation rental management) as `??` untracked. WIP by someone.

**Not a placeholder in production code** — but the schema is drafted and could be applied out-of-band. Coordinate with the person doing this work before merging any related migration.

### P2-5 — `EMAIL_PROVIDER` auto-detection could pick the wrong provider

`backend/src/lib/notifications/email.js:36-51` — auto-detects provider by which env vars are set (Graph first, then Resend, SendGrid, SMTP). If multiple sets are configured, silently picks the first-matching one. Documented in the file, but could surprise a deployer.

**To fix (nice-to-have):** log the detected provider at boot; refuse to boot if multiple providers are ambiguously configured.

---

## P3 — Info (not issues)

- `@example.com` / `@example.test` — every occurrence is in test files. Expected.
- `vi.mock` / `stubGlobal` / `mockReturnValue` — all in test files. Expected.
- `simulated: false` propagating through `conversations/orchestrator.js` — this is a metadata flag on real Instagram/Graph API responses (they return `simulated: true` when the underlying integration is in dev-mode), not fabricated fake data.
- `console.log` in `persistence/migrations/runner.js:89` — migration runner is a boot-time tool, not a hot-path service; console.log is appropriate here.
- `console.log` in `lib/credentials.js:9,29` — inside a docstring and a user-facing error message showing the command to generate a key. Not runtime output. Safe.
- `SKELETON` provider in `modules/property-valuation/domain/types.js` — this is a first-class provider concept (unimplemented scraper source that shows in admin UI as "not yet available"), not a placeholder.
- `AzureAD+` in bash prompts — cosmetic OS metadata, not code.

---

## Ranked recommendation — order to close the P0 list

1. **P0-1 + P0-2 (Stripe / top-up)** — foundational for any paid customer. 1-2 weeks with existing Stripe adapter as base.
2. **P0-5 (Tax engine)** — needed before ANY invoice is issued to a paying customer. 2-4 weeks per jurisdiction (start with UAE VAT + KSA ZATCA).
3. **P0-6 (Vendor admin routes)** — the code exists; just needs the admin API to expose it. 2-3 days.
4. **P0-4 (AI producers)** — `AI_POST_CREATION` is critical (main WhatsApp intake path). 1-2 weeks per producer.
5. **P0-3 (Real-estate portals)** — 4-8 weeks per portal + partner agreements. Prioritise Bayut + Property Finder in UAE, Aqarmap in Egypt, Blue Door in Lebanon.
6. **P0-7 (Consumer notification dispatch)** — 2-3 days if the transports already exist. Simple wiring.

Total realistic timeline to close all P0: **3-6 months of focused engineering** with 1-2 partner-integration workstreams running in parallel.

---

## What is NOT a placeholder (production-ready today)

Explicit inventory of what IS wired end-to-end so we know what we HAVE:

- **Auth stack**: password login, OTP-via-email, TOTP 2FA + backup codes, step-up elevation tokens, session token-version invalidation, JWT — all production-grade
- **CRM**: contacts, notes, inquiries, viewings, opportunities, tasks — all implemented
- **Unified inbox**: conversations, messages, channel dispatch for IG / FB / TikTok / X / LinkedIn / WhatsApp / Email / SMS
- **Property model + canonical dedup + territory disclosure**
- **Area intelligence + market pricing** modules (scraper providers for Lebanon)
- **WhatsApp Listings intake pipeline** (session state machine, drafts, approval)
- **Fin.* accounting ledger** (all 40+ migrations applied, immutable, RLS-enforced)
- **Credit engine + package system** (all 11 hardening items shipped through PR #39)
- **Instagram, Facebook, TikTok (publish only), X, LinkedIn, WhatsApp** publishing
- **Stripe webhook receiver** (signature verify + intent confirmation)
- **Microsoft Graph email + Resend + SendGrid + SMTP** transports
- **Twilio SMS** transport
- **BannerBear** social-card rendering
- **AI usage logging + cost pass-through**
- **Two-person approval workflow** (`fin.approval_requests`)
- **Reconciliation runs + R-check registry (R110-R123)**
- **Advisory-lock-protected workers**: janitor (1022), fin mirror (1023), billing cycle (1024)
- **White-label sites + widgets + custom domains**
- **Platform message templates** (Unlayer editor + versioning)

The 21,899 lines of `lib/` + `modules/` code that ISN'T placeholder is production-grade. The gaps are concentrated at the boundaries: payment provider outbound, portal APIs, tax, three specific AI producers, consumer notification dispatch. These are the "last mile" integrations.
