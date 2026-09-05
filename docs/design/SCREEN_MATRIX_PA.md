# Wingcaster — Screen Matrix: Platform Admin

Conventions, screen-entry format, and workflow subtype vocabulary defined in `SCREEN_MATRIX_SHARED.md §0`. This document enumerates every Platform Admin (PA) surface.

**Scope characteristics** for every screen in this document unless otherwise noted:
- Device: desktop 1440×900 (small-viewport gate at < 1024px)
- Locale: en-only (per design brief §5.3)
- Theme: dark default, light supported
- Density: high — inline row actions, keyboard shortcuts, bulk selection
- Auth: `requirePlatformAdmin` (verified in `web/src/pages/admin/fin/shell.tsx :: FinAdminGate`)
- Elevation: sensitive writes require `x-elevated-token` via `SHR-MFA-007` (Step-Up prompt)
- **Environment (LIVE / TEST) awareness (CORRECTED 2026-09-04):** `fin.*` and `vrm.*` schemas both carry an `environment` column with CHECK constraint `IN ('LIVE', 'TEST')`, and `trg_env_matches_tenant` triggers enforce parent-child consistency. Every PA screen that reads or writes fin/vrm data MUST render an environment badge in its header + an environment switcher in the PA nav shell. Actions in TEST never affect LIVE and vice versa. The `fin.platform_admin` + `fin.elevated` GUC settings both must be `'on'` for platform_admin_bypass — the elevation token step-up gates BOTH.

Written 2026-09-03. Reflects `origin/main @ b989e6b`.

---

## DECISIONS + PRIORITIES 2026-09-04 (after user review of the matrix)

The PA matrix review surfaced that the PA surface is not just an internal admin tool — it's the **fulfillment layer** for workflows initiated in Agent + Agency + Shared matrices. Portal moderation, account recovery, comparable-report review, and two-person approval are all workflows a user starts and a PA finishes. Every incomplete PA screen dead-ends a user-facing feature elsewhere. Two decisions locked, 11 priority + scope reorderings applied.

### D5 → Build sequencing: Option (c) — Coordinated dispatch across matrices by dependency chain

**Assign parallel engineering capacity to work PA + Agent + Agency simultaneously, ordered by the dependency graph, not by persona.** Rationale: building any single-persona screen without its cross-matrix counterpart is wasted work. The PA-MOD-001 queue is useless if Agent doesn't submit anything to it; the AGT-PUB-006 tracker shows an empty state if PA-MOD-002 never resolves the submission. **The unit of work is a workflow chain, not a screen.**

**Practical sequencing per workflow chain (P0 clusters that must ship together):**

| Workflow cluster | Screens (all P0) | Effort estimate |
|---|---|---|
| **Portal moderation** (WF-03) | AGT-PUB-005 (submit) + AGT-PUB-006 (tracker) + AGT-REC-001 (outcome) + PA-MOD-001 (queue) + PA-MOD-002 (detail) + PA-MOD-003 (audit) + backend stub-submission wiring | 2-3 weeks |
| **Account recovery** (WF-04) | SHR-AUT-005 (request) + SHR-AUT-005b/c/d (email + TOTP + scheduled) + PA-ACR-001 (queue) + PA-ACR-002 (detail) | 1-2 weeks |
| **Comparable-report review** (WF-05) | AGT-APR-003 (comparable detail) + AGT-APR-004 (report) + AGT-REC-002 (outcome) + PA-PVA-008 (queue) + PA-PVA-008b (detail) | 1-2 weeks |
| **Agent price-report review** (WF-06) | AGT-APR-005 (submit) + AGT-APR-006 (my list) + AGT-REC-003 (outcome) + PA-PVA-009 (queue) + PA-PVA-009b (detail) | 1-2 weeks |
| **Package publishing two-person approval** (WF-07) | PA-PKG-004 (editor) + PA-PKG-005 (approval detail) + PA-APR-001 (queue) + PA-APR-003 (action confirm) + PA-APR-004 (audit trail) + PA-APR-006 (recall) | Most already EXISTS/PARTIAL — 1 week to complete |
| **Credit grant two-person approval** (WF-08) | PA-CRD-005 (initiator) + PA-CRD-006 (outcome) + PA-APR-001 (queue) + PA-APR-002 (generic detail) + PA-APR-003 + PA-APR-005 (escalation) | 1-2 weeks |
| **Agency application review** (WF-02) | SHR-AUT-006 register-with-agency + AGN-MEM-005 (public join) + AGN-MEM-002 (queue) + AGN-MEM-002b (detail) + AGT-REC-004 (outcome) | 2 weeks |
| **Onboarding activation** (WF-01) | All 5 AGT-ONB + AGT-WLA-002 (draft review) + AGT-LST-003 outcome | 2-3 weeks |

**Coordinated-dispatch model:** 2-3 engineers, each owning one active workflow cluster end-to-end (backend wiring + PA UI + counterpart user UI + tests). Cursor executes; architect-owner review at cluster boundaries. Ship one cluster per week.

**Realistic v1 completion timeline with 2-3 engineers on coordinated dispatch: 8-12 weeks.** Faster than single-persona serial builds (which would be 3-4 months) because no rework from broken dependencies.

### D6 → Environment awareness: Option (a) — Global PA nav switcher

**Add a first-class `PA-NAV-001` screen as new entry.** LIVE/TEST is a session-scoped setting reflected in the top nav across every PA page. Matches the `fin.*` and `vrm.*` schema-level enforcement (`trg_env_matches_tenant`, `fin.platform_admin`, `fin.elevated` GUC settings).

**Behaviour:**
- Top-nav dropdown always visible; current env shown as a colored badge (LIVE = amber, TEST = neutral gray)
- Switching env requires a confirmation modal ("You are switching from LIVE to TEST. Any in-flight action on this page will be discarded. Continue?")
- Every write action within a session inherits the current env → server sets `fin.env`/`vrm.env` GUC per request
- Cross-env actions are structurally impossible (server rejects with 400 on env mismatch)
- Every fin/vrm screen entry ALSO renders a smaller env-badge in its own header for redundant visibility

**New screen added:**

### PA-NAV-001 — Environment switcher + PA nav shell

Purpose: Global chrome for PA users showing current env context (LIVE / TEST) with a controlled-switch affordance. Ensures no PA action ever runs against the wrong environment.
Route: component wrapping every `/admin/**` route   Persona: PA   Device: desktop   Mode: n/a
Current state: MISSING — the code has env-aware server-side enforcement (`fin.env`, `vrm.env` GUC), no UI surface.
Workflow role: n/a (chrome, not workflow)
Key components: Env badge (LIVE amber / TEST neutral), Env dropdown (Switch to LIVE / Switch to TEST), Confirmation modal on switch ("You are switching env. Any unsaved changes on this page will be lost."), Persistent session state (env sticks across page loads until switched).
Primary actions: Switch env → confirm → server sets GUC → whole app re-renders in new env context.
State variants: LIVE-active (default for new PA sessions), TEST-active (surfaces warning ribbon along page top saying "You are in TEST — actions do not affect LIVE data"), mid-switch (loading), switch-blocked (rare: some in-flight action holds a lock — surface why).
Entry from: n/a — persistent chrome on all /admin/** routes.
Exit to: n/a
Metering: n/a
Notes: LIVE default on session start. TEST is deliberate opt-in per session. Elevated-token step-up applies per env (elevating in LIVE does not elevate TEST and vice versa). Every screen entry below implicitly inherits the current env — no screen entry needs to duplicate the switcher; every screen entry DOES need a small env badge in its header as redundant visibility.

### Priority reordering 2026-09-04

**P0 — required for shippable v1 (must exist to complete cross-matrix workflows):**

| Cluster | PA screens | Blocks |
|---|---|---|
| Portal moderation | PA-MOD-001, PA-MOD-002, PA-MOD-003 | Agent portal publishing (AGT-PUB-005/006/REC-001) |
| Account recovery | PA-ACR-001, PA-ACR-002 | Shared auth recovery (SHR-AUT-005/b/c/d) |
| Property valuation admin | PA-PVA-002, PA-PVA-008, PA-PVA-008b, PA-PVA-009, PA-PVA-009b, PA-PVA-011 | Agent price/comparable reports (AGT-APR-*/REC-002/003) |
| Two-person rule cluster | PA-APR-002, PA-APR-003, PA-APR-005, PA-APR-006 | Every workflow using `fin.approval_requests` (WF-07/08/09/14/15/17/18/19/20/21/22/23/24/25) |
| Credit-grant outcome | PA-CRD-005 (initiator — elevate PARTIAL→P0), PA-CRD-006 (outcome — MISSING→P0) | WF-08 two-person credit grant chain |
| PSP config (Paddle-only, simplified) | PA-CFG-005 (see revised scope below) | Paddle launch |
| API key rotation | PA-CFG-003 | Secret hygiene for launch |
| Environment switcher | PA-NAV-001 (NEW) | All PA screens (chrome) |

**P1 — required for enterprise-grade v1 (must exist for support ops + platform integrity):**

| Cluster | PA screens | Rationale |
|---|---|---|
| Worker health visibility | PA-CRD-008 (janitor), PA-CRD-009 (fin mirror), PA-CFG-002 (worker cadence & health) | Elevated from P2 per review — operational blind spots produce production incidents |
| Dead-letter notifications | PA-NDL-001 | Elevated from P2 — failed notifications indicate misconfiguration; PAs need visibility |
| Credit reconciliation surfaces | PA-CRD-002 (wallet detail), PA-CRD-003 (lots), PA-CRD-004 (holds) | Complete the credit admin surface |
| Reconciliation drift resolution | PA-REC-002, PA-REC-004 | Complete WF-09 drift resolution flow |
| Territories + Bazaar integration | PA-CFG-006, PA-CFG-007 | Enables agencies to list per-country + Bazaar syndication |
| Vendor admin | PA-VEN-002, PA-VEN-003 | Data model exists; expose the reads |
| User management | PA-USR-001, PA-USR-002 | Support ops — search + promote/ban/impersonate |

**P1 revised (was P0) — Dunning:** PA-DUN-002/003/004/005 revised to P1. **Rationale:** under Paddle MoR, Paddle handles PSP-level dunning (card retry, cancellation on failure). WingCaster-side dunning is scoped to credit-wallet negative-balance reconciliation + bad-debt write-off. Smaller scope than originally.

**P2 — Phase 2 (post-PMF, post-Paddle-live):**

| Cluster | PA screens | Rationale |
|---|---|---|
| Full custom-report builder equivalent for PA | (any) | v2 feature |
| Full facility management surface | PA-FAC-* | Complete when a customer needs postpaid credit lines |
| Complete contracts surface | PA-CON-* | Complete when a customer needs custom pricing contracts |
| Regional expansion admin | Full country onboarding tooling | v2 feature |

### Simplified PA-CFG-005 — PSP config (Paddle-only)

Original scope was a full multi-PSP admin surface. **Revised: Paddle is the sole PSP for launch. Config surface is small:**

Purpose: View + rotate the Paddle credentials + test the webhook.
Route: `/admin/fin/configuration#paddle`   Persona: PA (elevated + two-person for rotation)   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: WF-24 role=Initiator (Paddle cred rotation with two-person rule).
Key components: Environment indicator (Paddle sandbox / production — mapped to WingCaster env LIVE/TEST via PA-NAV-001), Paddle seller ID (display-only, last-4 for secrets), webhook secret (last-rotated only, never displayed), Rotate Credentials button (opens WF-23 approval), Test Webhook button (POSTs a simulated event, verifies signature roundtrip).
Primary actions: Rotate (approval-gated); Test Webhook.
State variants: healthy, credentials-expiring, webhook-signature-failed.
Entry from: PA-FIN-005.
Exit to: PA-APR-001 for rotation.
Metering: n/a
Notes: Not the multi-PSP surface I originally scoped. Paddle is the sole merchant of record; no Stripe / Airwallex / Areeba admin needed. Live cutover happens by switching PA-NAV-001 env from TEST to LIVE with Paddle production credentials configured.

### Cross-matrix "fulfills" annotations (add to individual entries in follow-up pass)

Every PA screen that completes a workflow initiated elsewhere gets a `Fulfills:` line:

| PA screen | Fulfills workflow from |
|---|---|
| PA-MOD-001/002/003 | Agent portal submissions (AGT-PUB-005) |
| PA-ACR-001/002 | Shared account recovery (SHR-AUT-005) |
| PA-PVA-008/008b | Agent comparable reports (AGT-APR-004) |
| PA-PVA-009/009b | Agent price reports (AGT-APR-005) |
| PA-PKG-005 | PA-authored package versions (WF-07 second approver) |
| PA-CRD-005b via PA-APR-002 | PA-authored credit grants (WF-08 second approver) |
| PA-USR-002 promote/ban/impersonate | Support-triggered actions on user accounts |
| PA-REC-004 | System-detected drift resolution |
| PA-DUN-003/004/005 | Automated dunning progression exceptions |
| PA-CFG-007 (Bazaar) | Cross-platform integration (SHR-INT-001 tenant opt-in) |

### Corrections applied in THIS pass

1. Priorities table added (above) with P0/P1/P2 clusters mapped to cross-matrix dependencies.
2. D5 → coordinated-dispatch model documented; 8 workflow clusters identified with effort estimates.
3. D6 → PA-NAV-001 (Environment switcher + PA nav shell) added as a first-class new screen.
4. PA-DUN priority revised from P0 to P1 given Paddle-MoR context.
5. PA-CFG-005 simplified to Paddle-only single-provider surface.
6. Two-person approval cluster (PA-APR-002/003/005/006) elevated to P0.
7. Worker-health visibility (PA-CRD-008/009 + PA-CFG-002) elevated from P2 to P1.
8. PA-NDL-001 elevated P2 → P1.
9. PA-PVA cluster elevated to P0 with named blocking impact.
10. Cross-matrix "fulfills" annotations table added (per-entry rewrites queued).
11. Environment-badge treatment principle documented (every fin/vrm screen carries a small env badge; per-entry annotation queued for follow-up).

### Corrections queued for a follow-up per-entry authoring pass

Each of these needs the individual screen entry below to be edited:
- Add `Fulfills:` line to every PA screen that completes a cross-matrix workflow.
- Add `Environment badge:` note to every fin/vrm screen entry.
- Rewrite PA-APR-003 (action confirmation), PA-APR-005 (escalation), PA-APR-006 (recall) as full P0 entries.
- Rewrite PA-CRD-005 (elevate PARTIAL → P0 with full elevation + reason + evidence scope) + PA-CRD-006 (outcome, MISSING → P0 with mirror-status + view-wallet + grant-another actions).
- Rewrite PA-MOD-001/002/003 as P0 with the "backend stub-submission prerequisite" note.
- Rewrite PA-PVA-002 through -009b + PA-PVA-011 as P0 with the "unblocks AGT-APR-* / AGT-REC-*" note.
- Simplify original PA-CFG-005 entry in section 17 to reflect the Paddle-only revised scope above.
- Add PA-DUN-* priority-revision note.

---

## Domain codes used in this document

| Code | Domain |
|---|---|
| FIN | Fin console home (Overview, Tenants, Usage, Configuration) |
| CRD | Credits (lots, holds, grants, wallets, janitor) |
| FAC | Facilities (credit facilities / lines) |
| CON | Contracts (fin.contracts + components) |
| PRC | Pricing (fin.prices) |
| PKG | Packages (public.packages.* CRUD + version lifecycle) |
| SUB | Subscriptions (tenant_subscriptions admin) |
| INV | Invoices |
| PAY | Payments |
| ACC | Accounting periods |
| VEN | Vendors + statements + margin |
| REC | Reconciliation (R-check runs, drift) |
| EXC | Exceptions queue (drift, anomalies) |
| APR | Approvals queue (fin.approval_requests) |
| DUN | Dunning cases |
| AUD | Audit log |
| CFG | Platform configuration (feature flags, secrets, budgets) |
| TPL | Platform message templates (Unlayer editor + versioning) |
| ARE | Areas (neighborhood management) |
| SCR | Scoring configuration (area intelligence AI) |
| WLA | WhatsApp Listings admin (entitlements, credits grant, health) |
| PVA | Property Valuation admin (comparables, agent-price-reports, sources) |
| MOD | Moderation queues (portal submissions, comparable reports, agent price reports) |
| ACR | Account recovery review |
| NDL | Notifications dead-letter |
| CLS | Comment classifier admin |
| USR | User management (promotion, ban) |
| GOO | Google API usage & budget |
| CMD | Command Center (cross-cutting ops feed) |
| INS | Inspector (field data QA) |

---

## Table of contents

- [1. PA-FIN — Fin console core (Overview, Tenants, Usage, Configuration)](#1-pa-fin)
- [2. PA-CRD — Credits admin (wallets, grants, lots, holds, janitor)](#2-pa-crd)
- [3. PA-FAC — Facilities (credit lines)](#3-pa-fac)
- [4. PA-CON — Contracts](#4-pa-con)
- [5. PA-PRC — Pricing (meter unit prices)](#5-pa-prc)
- [6. PA-PKG — Packages CRUD + versioning + two-person approval](#6-pa-pkg)
- [7. PA-SUB — Subscriptions admin](#7-pa-sub)
- [8. PA-INV — Invoices, credit notes, debit notes](#8-pa-inv)
- [9. PA-PAY — Payments](#9-pa-pay)
- [10. PA-ACC — Accounting periods (soft/hard close, reopen)](#10-pa-acc)
- [11. PA-VEN — Vendors (costs, statements, margin)](#11-pa-ven)
- [12. PA-REC — Reconciliation (R-check runs)](#12-pa-rec)
- [13. PA-EXC — Exceptions (drift + anomalies)](#13-pa-exc)
- [14. PA-APR — Approvals queue (two-person rule surface)](#14-pa-apr)
- [15. PA-DUN — Dunning](#15-pa-dun)
- [16. PA-AUD — Audit log](#16-pa-aud)
- [17. PA-CFG — Configuration](#17-pa-cfg)
- [18. PA-TPL — Platform message templates](#18-pa-tpl)
- [19. PA-ARE — Areas](#19-pa-are)
- [20. PA-SCR — Scoring configuration](#20-pa-scr)
- [21. PA-WLA — WhatsApp Listings admin](#21-pa-wla)
- [22. PA-PVA — Property Valuation admin](#22-pa-pva)
- [23. PA-MOD — Moderation queues](#23-pa-mod)
- [24. PA-ACR — Account recovery review](#24-pa-acr)
- [25. PA-NDL — Notifications dead-letter](#25-pa-ndl)
- [26. PA-CLS — Comment classifier admin](#26-pa-cls)
- [27. PA-USR — User management](#27-pa-usr)
- [28. PA-GOO — Google API usage & budget](#28-pa-goo)
- [29. PA-CMD — Command Center for PAs](#29-pa-cmd)
- [30. PA-INS — Inspector QA](#30-pa-ins)
- [Summary](#summary)

---

<a id="1-pa-fin"></a>
## 1. PA-FIN — Fin console core

### PA-FIN-001 — Overview / dashboard

Purpose: One-glance platform health: revenue, active tenants, credits circulation, unclosed periods, open approvals, drift count, dunning alerts.
Route: `/admin/fin`   Persona: PA   Device: desktop 1440   Mode: n/a
Current state: EXISTS — `web/src/pages/admin/fin/Overview.tsx` (name inferred from audit list). Needs data verification against `GET /api/admin/fin/overview` shape.
Workflow role: n/a
Key components: KPI strip (MRR, active tenants, credits circulating, invoices past-due), 4-6 attention cards (open approvals count → PA-APR-001, drift count → PA-EXC-001, dunning cases → PA-DUN-001, unclosed billing periods → PA-ACC-001), recent activity feed, health widget (fin mirror worker last-run, janitor last-run, reconciliation last-run).
Primary actions: Drill into any card, refresh, adjust date range.
State variants: loading, error, degraded (health widget red).
Entry from: `SHR-NAV-001` PA branch, direct URL.
Exit to: PA-APR-001, PA-EXC-001, PA-DUN-001, PA-ACC-001, PA-CRD-001, PA-REC-001.
Metering: n/a
Notes: This is the PA's home. Every KPI must show delta vs. previous period. Any red count on attention cards should be prominent.

### PA-FIN-002 — Tenants list

Purpose: List every tenant with quick filters, drill to per-tenant state.
Route: `/admin/fin/tenants`   Persona: PA   Device: desktop 1440   Mode: n/a
Current state: EXISTS — `Tenants.tsx`. Needs bulk actions + saved views.
Workflow role: n/a
Key components: Table (name, subscription plan, MRR, credits balance, last active, status), filters (plan / status / created-date / region / balance-range), search, bulk-select column, row action menu (open, suspend, note, run reconciliation), Saved Views (My Watchlist, High-Value, At-Risk).
Primary actions: Row → PA-FIN-003 (tenant detail). Bulk actions (suspend, message, tag). Export CSV.
State variants: loading, empty (unlikely), error, filter-yields-empty.
Entry from: PA-FIN-001 card, direct URL.
Exit to: PA-FIN-003.
Metering: n/a
Notes: Handles up to 10 000 rows with virtualization. Keyboard: `/` to search, `J`/`K` to move rows, `Enter` to open.

### PA-FIN-003 — Tenant detail

Purpose: Full 360 view of one tenant: identity, subscription, wallets, invoices, usage, activity.
Route: `/admin/fin/tenants/:id`   Persona: PA   Device: desktop 1440   Mode: n/a
Current state: PARTIAL — file may exist under tenants; needs verification against `GET /api/admin/fin/tenants/:id`.
Workflow role: n/a
Key components: Header (tenant name, plan badge, MRR, health chip), tabs (Overview | Subscription | Wallet | Usage | Invoices | Payments | Notes | Audit), side panel (quick actions: impersonate, suspend, message, run recon).
Primary actions: Tab-nav; per-tab actions (change plan → PA-SUB-005, top-up wallet → PA-CRD-005, void invoice → PA-INV-005, etc.).
State variants: loading, error, deleted/suspended (banner).
Entry from: PA-FIN-002, PA-CRD-002, direct URL.
Exit to: PA-SUB-002, PA-CRD-002, PA-INV-002, PA-AUD-001.
Metering: n/a
Notes: Impersonation is a high-risk action — gate behind SHR-MFA-007 step-up + audit-log entry + banner in impersonated session.

### PA-FIN-004 — Usage explorer

Purpose: Per-tenant per-feature usage over time (from `metered_usage` / `rated_usage`).
Route: `/admin/fin/usage`   Persona: PA   Device: desktop 1440   Mode: n/a
Current state: EXISTS — `Usage.tsx`.
Workflow role: n/a
Key components: Filters (tenant, feature, date-range, aggregation: hour/day/month), chart (stacked bar or line), table below (raw rows), export.
Primary actions: Filter; export CSV; drill to tenant → PA-FIN-003.
State variants: loading, empty (no usage in range), error.
Entry from: PA-FIN-001, PA-FIN-003 (tenant → usage tab pass-through).
Exit to: PA-FIN-003.
Metering: n/a
Notes: Query must be cached — usage tables can be huge.

### PA-FIN-005 — Configuration (platform settings)

Purpose: Platform-wide feature flags, worker toggles, budgets.
Route: `/admin/fin/configuration`   Persona: PA (elevated for writes)   Device: desktop   Mode: n/a
Current state: EXISTS — `Configuration.tsx`.
Workflow role: n/a
Key components: Sections (Feature flags, Worker enable/disable — mirror, janitor, billing-cycle, reconciliation cadence, Rate limits, Google Maps budget, Email sender identity, WhatsApp business number), each row: key, current value, default, edit button.
Primary actions: Edit any value → SHR-MFA-007 → save.
State variants: loading, save-success, save-error, permission-denied per row.
Entry from: PA-FIN-001 → nav.
Exit to: same page.
Metering: n/a
Notes: Every change writes to `PA-AUD-001` with before/after. Some settings require a worker restart — surface that clearly.

---

<a id="2-pa-crd"></a>
## 2. PA-CRD — Credits admin

### PA-CRD-001 — Wallets index

Purpose: List all tenant wallets across scopes (agent, agency, tenant-pool), balances, thresholds.
Route: `/admin/fin/credits`   Persona: PA   Device: desktop 1440   Mode: n/a
Current state: EXISTS — `Credits.tsx` (may focus on lots).
Workflow role: n/a
Key components: Table (scope, scope_id, currency, current balance in credits, current balance in centi-credits, low-water flag, last-consumed-at), filters (scope, currency, low-balance-only), search by scope_id.
Primary actions: Row → PA-CRD-002 (wallet detail). Grant credits → PA-CRD-005 (initiator of WF-08). Bulk export.
State variants: loading, error, filter-yields-empty.
Entry from: PA-FIN-001, PA-FIN-003 (tenant tab).
Exit to: PA-CRD-002, PA-CRD-005.
Metering: n/a
Notes: Balances shown in credit-scale (÷100 from centi-credits). Column tooltip explains centi-credit scale.

### PA-CRD-002 — Wallet detail

Purpose: One wallet's ledger: balance, active grants, historical consumptions, active reservations.
Route: `/admin/fin/credits/wallets/:scope/:scopeId`   Persona: PA   Device: desktop   Mode: n/a
Current state: PARTIAL — needs implementation aligned to `GET /api/admin/credits/wallets`.
Workflow role: n/a
Key components: Header (balance, last-consumed, wallet status), tabs (Grants | Consumptions | Reservations | Audit), timeline chart (balance over time), quick actions (grant → PA-CRD-005, mirror to fin → sync worker, GDPR erasure).
Primary actions: Grant → PA-CRD-005. View lot detail → PA-CRD-003.
State variants: loading, error, empty (never had activity).
Entry from: PA-CRD-001, PA-FIN-003.
Exit to: PA-CRD-005, PA-CRD-003.
Metering: n/a
Notes: Show BOTH centi-credit exact values and rounded credit values. GDPR erasure action gated behind SHR-MFA-007 + typed confirmation.

### PA-CRD-003 — Credit lots (prepaid stock) index

Purpose: List credit lots per tenant — used by prepaid billing to draw from oldest-first.
Route: `/admin/fin/credits/lots`   Persona: PA   Device: desktop   Mode: n/a
Current state: EXISTS — likely under `Credits.tsx`. Verify.
Workflow role: n/a
Key components: Table (tenant, lot ID, granted-at, expiry, original centi-credits, remaining, status: ACTIVE/EXHAUSTED/EXPIRED), filters (tenant, status, expiring-soon).
Primary actions: Row → lot detail modal. Retire lot (destructive, elevated).
State variants: loading, empty, error.
Entry from: PA-CRD-002 tab, PA-FIN-001.
Exit to: PA-CRD-002.
Metering: n/a
Notes: Expiring-soon filter default = expiring in ≤30 days.

### PA-CRD-004 — Holds (current reservations)

Purpose: List reservations currently held (`FOR UPDATE SKIP LOCKED` context).
Route: `/admin/fin/credits/holds`   Persona: PA   Device: desktop   Mode: n/a
Current state: EXISTS — `Holds.tsx`.
Workflow role: n/a
Key components: Table (tenant, feature, held centi-credits, held-at, expires-at, request_id), filters (feature, expiring-soon, orphaned — created > TTL ago).
Primary actions: Force-release (destructive, elevated); bulk release orphaned; refresh.
State variants: loading, empty (nothing held), error.
Entry from: PA-CRD-002 tab, direct nav.
Exit to: same.
Metering: n/a
Notes: Force-release should re-dispatch the janitor for that scope. Audit-log every manual release.

### PA-CRD-005 — Credit grant request form (Initiator) (P0 — ELEVATED 2026-09-04 per D9)

Purpose: PA creates a manual credit grant for a tenant. Small grants execute directly; large grants (above per-approver threshold) route through the WF-08 two-person approval cluster.
Route: modal from PA-CRD-002 / PA-CRD-001   Persona: PA (elevated for any write)   Device: desktop   Mode: n/a
Current state: PARTIAL — backend `POST /api/admin/credits/grants` exists (already-elevated + rate-limited per PR #39 hardening); UI needs authoring.
Workflow role: WF-08 role=Initiator.
Environment badge: inherits current env from PA-NAV-001. Grants against LIVE and TEST are stored in separate rows via the fin.env GUC.
Fulfills: PA-authored credit grants that flow through WF-08 (two-person approval when above threshold) or execute directly (small grants + auto-approve tier).
Key components:
- Target scope + scope_id (pre-filled from context: agent / agency / tenant-pool) with autocomplete search
- Amount input (currency-scaled with live credit-scale preview: "1,000 credits = 100,000 centi-credits" tooltip)
- Reason (dropdown from vocabulary: Onboarding grant / Retention grant / Support-case remediation / Compensation for outage / Partnership credit / Other-with-required-notes) + free-text notes
- Expiry (optional; default = no expiry; if set, grant becomes an expiring lot)
- Attach evidence (URL / file — support ticket link, executive-approval email, contract PDF)
- Reference ID (optional external system reference — Zendesk ticket #, Salesforce opportunity ID)
- Submit for Approval button (if amount > per-approver threshold) OR Grant Directly button (if under)
Primary actions:
- Grant Directly (small) → SHR-MFA-007 step-up → server executes → redirect to PA-CRD-006 outcome
- Submit for Approval (large) → SHR-MFA-007 step-up → creates `fin.approval_requests` row → surfaces in PA-APR-001 → submitter sees pending indicator
State variants: loading, validation (amount / target), error, permission-denied (below-scope PA cannot grant to out-of-scope tenants), threshold-exceeded (shows the threshold + explains routing), submission-in-flight (grants over threshold show a countdown to approver decision).
Entry from: PA-CRD-001 (wallets index), PA-CRD-002 (wallet detail).
Exit to: PA-CRD-006 (direct grant) or PA-APR-001 (approval queue).
Metering: n/a
Notes: Threshold value from CFG. Reason mandatory. Server enforces two-person rule (submitter cannot approve own request). PA-APR-002 (generic approval detail) is used for the second-approver view; PA-CRD-006 handles the outcome view for both direct and approved-then-executed paths.

### PA-CRD-006 — Grant outcome / receipt (P0 — REWRITTEN 2026-09-04 per D9)

Purpose: The confirmation surface after a credit grant executes (either directly or through two-person approval). Shows what happened + provides observability into the fin.* mirror posting + offers next-actions.
Route: drawer from PA-CRD-005 (direct path) or PA-APR-003 (approved path)   Persona: PA (submitter + observers)   Device: desktop   Mode: n/a
Current state: MISSING — required to close the WF-08 chain.
Workflow role: WF-08 role=Action outcome.
Environment badge: inherits current env from PA-NAV-001.
Fulfills: closes the WF-08 credit-grant cycle initiated at PA-CRD-005 and (for large grants) approved via PA-APR-003.
Key components:
- Grant ID + timestamp
- Target scope + scope_id (with link to wallet)
- Amount granted (in credits + centi-credits)
- Effective-from + effective-until (if expiring lot)
- Approval trail (if applicable: submitter → approver + decision timestamp)
- **Mirror status widget** — one of: `pending` (worker 1023 hasn't run yet, ETA display), `posted` (fin.* journal entries created — link to fin transaction), `failed` (mirror worker error — surfaces the specific error + Retry Mirror button)
- New wallet balance (before → after)
- Notification-sent-to-target indicator (was the tenant notified? — links to the notification event)
- Quick actions: View Wallet (→ PA-CRD-002), Grant Another (→ PA-CRD-005), Close
Primary actions: View Wallet; Grant Another; Retry Mirror (if failed); Close.
State variants:
- mirror-pending (worker not yet posted — auto-polls every 5s for up to 60s)
- mirror-posted (green check + fin.* journal-entry link)
- mirror-failed (red alert + specific error + Retry Mirror button that dispatches `runCreditFinMirrorTick`)
- mirror-permanently-failed (after 5 retries — escalation notice with instruction to file a support ticket)
Entry from: PA-CRD-005 (direct grant), PA-APR-003 (post-approval execute action).
Exit to: PA-CRD-002 (wallet detail).
Metering: n/a
Notes: The mirror is the eventually-consistent bridge between `public.credit_grants` and `fin.events` (advisory lock 1023). Failed mirrors are a serious integrity issue — surface prominently on PA-FIN-001 attention cards too. Grants that fail to mirror after 5 retries are moved to PA-EXC-001 (exceptions queue) automatically.

### PA-CRD-007 — GDPR erasure for wallet history

Purpose: Pseudonymize a wallet's history per data-subject request.
Route: modal from PA-CRD-002   Persona: PA (elevated + two-person)   Device: desktop   Mode: n/a
Current state: PARTIAL — `credits/erasure.js` exists in backend; UI likely missing.
Workflow role: WF-17 role=Initiator (GDPR erasure workflow; add to WF index).
Key components: Erasure preview (what will change: display_name → hashed, notes → NULL, etc.), impact banner, "This cannot be undone", typed confirmation, Submit for Approval button.
Primary actions: Submit → routes to WF-17 second-approver queue.
State variants: loading, error, already-erased (block).
Entry from: PA-CRD-002.
Exit to: PA-APR-001.
Metering: n/a
Notes: Under GDPR right-to-erasure; invoices are retained by law but reference names are pseudonymized.

### PA-CRD-008 — Janitor status widget

Purpose: See janitor worker state (advisory lock 1022): last run, held reservations processed, backlog.
Route: card embedded in PA-CRD-001 or PA-FIN-005   Persona: PA   Device: desktop   Mode: n/a
Current state: MISSING (backend has worker, no UI surface).
Workflow role: n/a
Key components: Last-run timestamp, held-count processed, current-backlog count, lock-held-by (host + PID), Run Now button (elevated).
Primary actions: Run Now → triggers `POST /api/admin/janitor/run` (needs backend route confirmation).
State variants: loading, stuck-lock-held-by-dead-worker (alert), degraded (backlog growing).
Entry from: PA-FIN-001 health widget, PA-CRD-001.
Exit to: same.
Metering: n/a
Notes: Advisory lock 1022 conflict indicated visually if worker on another node also holding.

### PA-CRD-009 — Fin mirror worker status

Purpose: See the fin double-entry mirror worker state (advisory lock 1023): backlog, last-posted, failures.
Route: card in PA-FIN-005 or PA-CRD-001   Persona: PA   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: n/a
Key components: Backlog count, last-successful mirror time, failed-events queue (→ retry), health chip.
Primary actions: Retry failed batch (elevated); Run Now.
State variants: healthy, backlog-growing, mirror-failed.
Entry from: PA-FIN-001 health.
Exit to: PA-CRD-006 outcome list.
Metering: n/a
Notes: Failure of the mirror is a serious integrity issue — surfaces alerts on PA-FIN-001.

---

<a id="3-pa-fac"></a>
## 3. PA-FAC — Facilities (credit lines / postpaid)

### PA-FAC-001 — Facilities index

Purpose: List active facilities (postpaid credit lines) per tenant.
Route: `/admin/fin/facilities`   Persona: PA   Device: desktop   Mode: n/a
Current state: EXISTS — `Facilities.tsx`.
Workflow role: n/a
Key components: Table (tenant, limit centi-credits, drawn, available, status: ACTIVE/PAUSED/SUSPENDED/CLOSED, opened-at, next-cycle), filters (status, tenant, limit-band), Create Facility button.
Primary actions: Row → PA-FAC-002; Create → PA-FAC-003.
State variants: loading, empty, error.
Entry from: PA-FIN-001, PA-FIN-003.
Exit to: PA-FAC-002, PA-FAC-003.
Metering: n/a
Notes: Aggregate exposure across all facilities shown in header.

### PA-FAC-002 — Facility detail

Purpose: One facility: draw ledger, cycle history, actions (pause/resume/suspend/close/adjust limit).
Route: `/admin/fin/facilities/:id`   Persona: PA (elevated for writes)   Device: desktop   Mode: n/a
Current state: PARTIAL — needs page dedicated to facility (may be modal today).
Workflow role: n/a
Key components: Header (tenant, current draw / limit ring), timeline of draws, cycle statement table, quick actions (Pause / Resume / Suspend / Close / Adjust Limit).
Primary actions: Pause / Resume / Suspend / Close → confirm modals with SHR-MFA-007 step-up; Adjust Limit → PA-FAC-004.
State variants: loading, error, permission-denied.
Entry from: PA-FAC-001.
Exit to: PA-FAC-001 or same.
Metering: n/a
Notes: All state transitions logged. Close is irreversible — extra confirmation.

### PA-FAC-003 — Create facility

Purpose: Open a new credit facility for a tenant.
Route: modal from PA-FAC-001   Persona: PA (elevated)   Device: desktop   Mode: n/a
Current state: MISSING or partial.
Workflow role: WF-18 role=Initiator (facility approval if above threshold; add to index).
Key components: Tenant picker, currency, limit, billing cycle (7/14/30 days), interest rate (if any), reason, evidence, Submit.
Primary actions: Submit → either direct-open (small) or WF-18 approval queue.
State variants: loading, validation, error.
Entry from: PA-FAC-001, PA-FIN-003.
Exit to: PA-FAC-002.
Metering: n/a
Notes: Only elevated PAs can open facilities above threshold.

### PA-FAC-004 — Adjust facility limit

Purpose: Increase or decrease the credit limit.
Route: modal from PA-FAC-002   Persona: PA (elevated + approval)   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: WF-18 role=Composition (mid-life change).
Key components: Current limit, new limit input, reason, effective-from, Submit for Approval (if delta above threshold).
Primary actions: Submit → PA-APR-001.
State variants: loading, error.
Entry from: PA-FAC-002.
Exit to: PA-APR-001.
Metering: n/a
Notes: Decreases below current draw are refused with clear error.

---

<a id="4-pa-con"></a>
## 4. PA-CON — Contracts (fin.contracts)

### PA-CON-001 — Contracts index

Purpose: List every contract (a tenant's rate agreement + components).
Route: `/admin/fin/contracts`   Persona: PA   Device: desktop   Mode: n/a
Current state: EXISTS — `Contracts.tsx`.
Workflow role: n/a
Key components: Table (tenant, contract code, status: DRAFT/ACTIVE/SUSPENDED/TERMINATED, effective-from, effective-until, component count, MRR-attributable), filters, Create Contract button.
Primary actions: Row → PA-CON-002; Create → PA-CON-003.
State variants: loading, empty, error.
Entry from: PA-FIN-001, PA-FIN-003.
Exit to: PA-CON-002, PA-CON-003.
Metering: n/a
Notes: MRR-attributable is derived — link to computation logic in tooltip.

### PA-CON-002 — Contract detail

Purpose: One contract: components (prices attached), version history, lifecycle actions.
Route: `/admin/fin/contracts/:id`   Persona: PA (elevated for writes)   Device: desktop   Mode: n/a
Current state: PARTIAL.
Workflow role: n/a
Key components: Header (contract code, tenant, status, effective window), components table (feature → price × quantity), version timeline, actions (Activate / Suspend / Terminate / New Version).
Primary actions: Activate / Suspend / Terminate → confirm modal; New Version → PA-CON-003.
State variants: loading, error, permission-denied.
Entry from: PA-CON-001.
Exit to: PA-CON-003.
Metering: n/a
Notes: Terminate is irreversible; needs step-up. All lifecycle transitions logged.

### PA-CON-003 — Create / edit contract version

Purpose: Draft a new contract version with component composition.
Route: `/admin/fin/contracts/:id/versions/new` (or `?edit=1`)   Persona: PA (elevated)   Device: desktop   Mode: n/a
Current state: MISSING dedicated editor.
Workflow role: WF-19 role=Composition (if contract publish requires approval).
Key components: Contract header, currency, effective-from, effective-until, components section (add row: feature + price + quantity), preview total, Submit for Activation button.
Primary actions: Save Draft; Submit for Activation → PA-APR-001.
State variants: loading, validation errors, error.
Entry from: PA-CON-002.
Exit to: PA-CON-002.
Metering: n/a
Notes: All prices selected must be ACTIVE version prices.

---

<a id="5-pa-prc"></a>
## 5. PA-PRC — Pricing (fin.prices)

### PA-PRC-001 — Prices index

Purpose: List every metered feature's current unit price.
Route: `/admin/fin/pricing`   Persona: PA   Device: desktop   Mode: n/a
Current state: EXISTS — `Pricing.tsx`.
Workflow role: n/a
Key components: Table (feature key, human name, current price version, price per unit, currency, status: DRAFT/ACTIVE/DEPRECATED, effective-from), filters (feature-module: social, portal, AI, comms), Create Price button.
Primary actions: Row → PA-PRC-002; Create new price → PA-PRC-003.
State variants: loading, error.
Entry from: PA-FIN-001, PA-CON-003 (during contract composition).
Exit to: PA-PRC-002, PA-PRC-003.
Metering: n/a
Notes: Every metered feature MUST have an ACTIVE price. Warn on features without ACTIVE.

### PA-PRC-002 — Price detail + versions

Purpose: One price's version history + lifecycle.
Route: `/admin/fin/pricing/:feature`   Persona: PA (elevated for writes)   Device: desktop   Mode: n/a
Current state: PARTIAL.
Workflow role: n/a
Key components: Feature description, current ACTIVE version card, all versions timeline (with activate/deprecate buttons per row), New Version button.
Primary actions: Activate a draft (elevated) → makes it ACTIVE, deprecates prior; Deprecate an active (elevated); New Version → PA-PRC-003.
State variants: loading, error.
Entry from: PA-PRC-001.
Exit to: PA-PRC-003.
Metering: n/a
Notes: Activation is atomic — old ACTIVE → DEPRECATED, new ACTIVE simultaneously. Version diff view helpful.

### PA-PRC-003 — Create price version

Purpose: Draft a new version of a feature's price.
Route: modal from PA-PRC-002   Persona: PA (elevated)   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: WF-20 role=Initiator (price change; may need approval per policy).
Key components: Feature (prefilled), unit price, currency, effective-from, reason, Submit.
Primary actions: Save Draft; Submit for Activation → PA-APR-001.
State variants: loading, validation, error.
Entry from: PA-PRC-002.
Exit to: PA-PRC-002.
Metering: n/a
Notes: Effective-from cannot be in the past.

---

<a id="6-pa-pkg"></a>
## 6. PA-PKG — Packages (public.packages.* CRUD + versioning)

**Workflow WF-07 (package publishing) touches every screen in this section.** Two-person rule enforced via `fin.approval_requests`.

### PA-PKG-001 — Packages index

Purpose: List every subscription package with tier, versions, active-subscription count.
Route: `/admin/fin/packages`   Persona: PA   Device: desktop   Mode: n/a
Current state: EXISTS — `Packages.tsx`.
Workflow role: n/a
Key components: Table (code, name, tier: FREE/BASIC/STANDARD/PRO/ENTERPRISE, active version, currency, active-subscriptions count, status: DRAFT/PUBLISHED/DEPRECATED), filters, Create Package button.
Primary actions: Row → PA-PKG-002; Create → PA-PKG-003.
State variants: loading, error.
Entry from: PA-FIN-001.
Exit to: PA-PKG-002, PA-PKG-003.
Metering: n/a
Notes: Free tier package is preset; cannot be deleted.

### PA-PKG-002 — Package detail (versions list)

Purpose: One package's version history + lifecycle.
Route: `/admin/fin/packages/:id`   Persona: PA   Device: desktop   Mode: n/a
Current state: EXISTS — `PackageDetail.tsx`.
Workflow role: WF-07 role=Composition (aggregate view).
Key components: Package header (code, name, tier, currency), versions table (version number, status: DRAFT/PENDING_APPROVAL/PUBLISHED/DEPRECATED, effective-from, quotas summary, actions), New Version button.
Primary actions: New Version → PA-PKG-004; Edit draft → PA-PKG-004; Submit for Approval → transitions state, appears in PA-APR-001; View subscribers → PA-SUB-001 filtered.
State variants: loading, error.
Entry from: PA-PKG-001.
Exit to: PA-PKG-004, PA-PKG-005 (approval detail).
Metering: n/a
Notes: A published version is immutable — edits create new version.

### PA-PKG-003 — Create package

Purpose: Kick off a brand-new package (name, tier, currency).
Route: modal from PA-PKG-001   Persona: PA (elevated)   Device: desktop   Mode: n/a
Current state: PARTIAL — likely a modal.
Workflow role: WF-07 role=Initiator.
Key components: Code (URL-safe, immutable), display name, tier, currency, billing cadence (monthly/annual), N-properties covered.
Primary actions: Create → PA-PKG-004 (open the version editor for v1).
State variants: loading, validation, error.
Entry from: PA-PKG-001.
Exit to: PA-PKG-004.
Metering: n/a
Notes: Code is used in URLs and cannot change.

### PA-PKG-004 — Package version editor (quotas + flags)

Purpose: Compose one package version: per-feature per-property allocation + non-metered flags + overage prices.
Route: `/admin/fin/packages/:id/versions/:vid`   Persona: PA (elevated)   Device: desktop   Mode: n/a
Current state: EXISTS — `PackageVersionEditor.tsx`.
Workflow role: WF-07 role=Composition.
Key components: Version header (draft badge, effective-from picker), Quotas section (row per metered feature from `credits/features.js`: allocation-per-property + overage-price), Flags section (white-label enabled, XML feed, Command Center, agency management etc.), Preview quota total (`compileGrantFromSnapshot` result), Preview cost math (margin vs. provider raw-cost), Save Draft button, Submit for Approval button.
Primary actions: Save Draft; Submit for Approval → status transitions to PENDING_APPROVAL, appears in PA-APR-001; Preview.
State variants: loading, unsaved-changes warning, save-error, permission-denied (below-scope PA).
Entry from: PA-PKG-002, PA-PKG-003.
Exit to: PA-PKG-002 (save/cancel), PA-APR-001 (submit).
Metering: n/a
Notes: The preview quota section MUST call `compileGrantFromSnapshot` server-side to show the exact centi-credits a subscriber gets. Live-update as PA edits allocations.

### PA-PKG-005 — Package approval (Approval detail / second-approver review)

Purpose: A second PA reviews a submitted package version and approves or rejects it.
Route: `/admin/fin/packages/:id/versions/:vid/approval`   Persona: PA (second approver, different from submitter, elevated)   Device: desktop   Mode: n/a
Current state: EXISTS — `PackageApproval.tsx`.
Workflow role: WF-07 role=Approval detail.
Key components: Submission metadata (submitter, submitted-at, reason), diff view (this version vs. previous PUBLISHED version — quotas + flags side-by-side), impact assessment (N subscribers affected on next cycle), Approve button, Reject with reason, Request Changes (returns to draft with note).
Primary actions: Approve (elevated) → version becomes PUBLISHED atomically; Reject with reason → returns to DRAFT with submitter notification; Request Changes → DRAFT + note; Escalate → PA-APR-005 (delegate).
State variants: loading, already-decided (someone else acted), permission-denied (you were the submitter), error.
Entry from: PA-APR-001, direct URL from notification.
Exit to: PA-PKG-002 on approve/reject, PA-APR-001 on close.
Metering: n/a
Notes: The system MUST prevent the submitter from approving their own submission. Show submitter's identity prominently to reduce collusion risk.

### PA-PKG-006 — Package deprecate

Purpose: Retire a published package version.
Route: modal from PA-PKG-002   Persona: PA (elevated + approval if subscribers active)   Device: desktop   Mode: n/a
Current state: PARTIAL — action likely exists as button; separate flow spec needed.
Workflow role: WF-07 role=Composition (end-of-life).
Key components: Impact banner (N subscribers on this version; what happens on next cycle), Grace-period picker, Reason, Submit for Approval.
Primary actions: Submit → PA-APR-001.
State variants: loading, error.
Entry from: PA-PKG-002.
Exit to: PA-APR-001.
Metering: n/a
Notes: Subscribers on a deprecated version continue current cycle; move to next-highest at renewal (unless subscribed to specific version).

### PA-PKG-007 — Feature registry admin

Purpose: Manage the master list of metered features that appear in package composition.
Route: `/admin/fin/packages/features`   Persona: PA (elevated)   Device: desktop   Mode: n/a
Current state: PARTIAL — features seeded in migration 303; admin CRUD partly exposed via backend routes.
Workflow role: n/a
Key components: Table (feature key, name, module: social/portal/AI/comms/assets, active flag, current active price link), Add Feature button.
Primary actions: Row → detail modal; Add Feature (rare — new feature launches).
State variants: loading, error.
Entry from: PA-PKG-004 (nested link from package editor when a feature is missing).
Exit to: PA-PRC-001.
Metering: n/a
Notes: Adding a feature is a code + config event — surface a warning that backend wiring is also required.

---

<a id="7-pa-sub"></a>
## 7. PA-SUB — Subscriptions admin

### PA-SUB-001 — Subscriptions index

Purpose: List every tenant subscription (public.tenant_subscriptions).
Route: `/admin/fin/subscriptions`   Persona: PA   Device: desktop   Mode: n/a
Current state: EXISTS — `Subscriptions.tsx`.
Workflow role: n/a
Key components: Table (tenant, package + version, cycle start/end, status: TRIAL/ACTIVE/PAST_DUE/CANCELED/PAUSED, MRR, credits consumed % of quota), filters (status, package, at-risk, expiring-soon), Create Subscription button (rare).
Primary actions: Row → PA-SUB-002; Create → PA-SUB-004; Bulk export.
State variants: loading, error.
Entry from: PA-FIN-001, PA-FIN-003, PA-PKG-002 (subscribers view).
Exit to: PA-SUB-002, PA-SUB-004.
Metering: n/a
Notes: At-risk = quota % > 90 in first half of cycle OR past due invoice.

### PA-SUB-002 — Subscription detail

Purpose: One subscription: cycles history, active grants, quotas real-time, lifecycle actions.
Route: `/admin/fin/subscriptions/:id`   Persona: PA (elevated for writes)   Device: desktop   Mode: n/a
Current state: EXISTS — `SubscriptionDetail.tsx`.
Workflow role: n/a
Key components: Header (tenant, package, version, status, next renewal), tabs (Overview | Cycles | Quotas | Invoices | Audit), quick actions (Pause / Resume / Cancel-at-period-end / Cancel-immediate / Change Plan).
Primary actions: Pause / Resume → step-up + confirm; Cancel → PA-SUB-006; Change Plan → PA-SUB-005.
State variants: loading, error, permission-denied.
Entry from: PA-SUB-001.
Exit to: PA-SUB-005, PA-SUB-006.
Metering: n/a
Notes: Any lifecycle change writes audit + notification to tenant.

### PA-SUB-003 — Preview change plan

Purpose: Show the impact of switching a subscription to a different package version (used by both PA and tenant surfaces).
Route: modal from PA-SUB-002   Persona: PA (or tenant in Agent/Agency matrix)   Device: desktop   Mode: n/a
Current state: EXISTS — backend `POST /api/admin/subscriptions/preview-change` and `POST /api/tenant/subscription/preview-change`.
Workflow role: WF-13 role=Composition (change-plan flow).
Key components: Current package + version summary, target package picker + version, effective-from picker (immediate / next cycle), impact diff (quota delta per feature, price delta, credit balance change, proration), Confirm Change button.
Primary actions: Confirm → executes change (PA-SUB-005 outcome); Cancel.
State variants: loading, error, no-change (target = current).
Entry from: PA-SUB-002.
Exit to: PA-SUB-005 outcome.
Metering: n/a
Notes: Preview is READ-ONLY; the actual change happens in PA-SUB-005.

### PA-SUB-004 — Create subscription

Purpose: Manually attach a tenant to a package (rare — most flows are self-service).
Route: modal from PA-SUB-001   Persona: PA (elevated)   Device: desktop   Mode: n/a
Current state: PARTIAL.
Workflow role: n/a
Key components: Tenant picker, package + version, billing cycle start, trial-days (optional), Create.
Primary actions: Create → PA-SUB-002.
State variants: loading, tenant-already-subscribed (warn + link to existing), error.
Entry from: PA-SUB-001.
Exit to: PA-SUB-002.
Metering: n/a
Notes: Refuses if tenant has an existing ACTIVE subscription.

### PA-SUB-005 — Change plan outcome

Purpose: Confirmation after a plan change executes; shows before/after.
Route: drawer from PA-SUB-002   Persona: PA   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: WF-13 role=Action outcome.
Key components: Summary (from → to), effective-from, proration invoice / credit note references, new balance.
Primary actions: View subscription → PA-SUB-002; View invoice → PA-INV-002; Close.
State variants: loading, error.
Entry from: PA-SUB-003.
Exit to: PA-SUB-002.
Metering: n/a
Notes: Proration is calculated automatically; surface any manual-intervention flags.

### PA-SUB-006 — Cancel subscription

Purpose: Cancel at period end (default) or immediately.
Route: modal from PA-SUB-002   Persona: PA (elevated)   Device: desktop   Mode: n/a
Current state: PARTIAL.
Workflow role: n/a
Key components: Radio (End of period / Immediate), Reason dropdown, Free-text notes, Impact banner (immediate = forfeit N credits), Cancel button.
Primary actions: Cancel → PA-SUB-002 with status change.
State variants: loading, error.
Entry from: PA-SUB-002.
Exit to: PA-SUB-002.
Metering: n/a
Notes: Immediate cancellation refunds unused portion via credit note (auto).

---

<a id="8-pa-inv"></a>
## 8. PA-INV — Invoices, credit notes, debit notes

### PA-INV-001 — Invoices index

Purpose: List all invoices platform-wide.
Route: `/admin/fin/invoices`   Persona: PA   Device: desktop   Mode: n/a
Current state: EXISTS — `Invoices.tsx`.
Workflow role: n/a
Key components: Table (number, tenant, issued-date, due-date, amount, currency, status: OPEN/PAID/VOID/PAST_DUE, notes-attached), filters (status, tenant, date-range, currency, amount-range), Export button, Create Manual Invoice button.
Primary actions: Row → PA-INV-002; Void → confirm modal; Credit note → PA-INV-003; Debit note → PA-INV-004; Bulk resend.
State variants: loading, empty, error.
Entry from: PA-FIN-001, PA-FIN-003.
Exit to: PA-INV-002.
Metering: n/a
Notes: Sequence number is immutable per `fin.invoice_sequences`. Void does not delete; audit trail preserved.

### PA-INV-002 — Invoice detail

Purpose: One invoice: line items, payments applied, related credit/debit notes.
Route: `/admin/fin/invoices/:id`   Persona: PA   Device: desktop   Mode: n/a
Current state: PARTIAL.
Workflow role: n/a
Key components: Header (number, tenant, status, amounts), line items table, payments applied table (→ PA-PAY-001 filtered), notes tab, Resend Email button, Download PDF button, actions (Void, Credit Note, Debit Note, Apply Payment).
Primary actions: Void → confirm (elevated); Credit Note → PA-INV-003; Debit Note → PA-INV-004; Apply Payment → PA-PAY-002.
State variants: loading, error.
Entry from: PA-INV-001.
Exit to: PA-INV-003, PA-INV-004, PA-PAY-002.
Metering: n/a
Notes: Void is irreversible; credit notes preferred for adjustments after payment.

### PA-INV-003 — Create credit note

Purpose: Issue a credit note against an invoice.
Route: modal from PA-INV-002   Persona: PA (elevated)   Device: desktop   Mode: n/a
Current state: PARTIAL.
Workflow role: n/a
Key components: Original invoice reference, line-selector (which items and amounts), reason, effective-date, Preview total, Submit.
Primary actions: Submit → creates credit note, links to invoice → PA-INV-002 refresh.
State variants: loading, validation, error.
Entry from: PA-INV-002.
Exit to: PA-INV-002.
Metering: n/a
Notes: Credit note can also be issued unattached (e.g., proration on downgrade) — surface both paths.

### PA-INV-004 — Create debit note

Purpose: Issue a debit note (rare — corrections upward).
Route: modal from PA-INV-002   Persona: PA (elevated + approval)   Device: desktop   Mode: n/a
Current state: PARTIAL.
Workflow role: WF-21 role=Initiator (debit note approval; adjustment increasing customer liability).
Key components: Similar to PA-INV-003; requires approval above threshold.
Primary actions: Submit for approval → PA-APR-001.
State variants: loading, error.
Entry from: PA-INV-002.
Exit to: PA-APR-001.
Metering: n/a
Notes: Debit notes rarely used — most upward corrections are new invoices.

### PA-INV-005 — Manual invoice create

Purpose: Rare — issue an invoice outside normal billing (e.g., one-off consulting).
Route: `/admin/fin/invoices/new`   Persona: PA (elevated)   Device: desktop   Mode: n/a
Current state: MISSING or partial.
Workflow role: n/a
Key components: Tenant picker, line items (add row: description + qty + price + tax), notes, due-date, Submit.
Primary actions: Save Draft; Issue → creates invoice → PA-INV-002.
State variants: loading, validation, error.
Entry from: PA-INV-001.
Exit to: PA-INV-002.
Metering: n/a
Notes: Manual invoices skip normal `fin.invoice_generation` — must produce same audit shape.

---

<a id="9-pa-pay"></a>
## 9. PA-PAY — Payments

### PA-PAY-001 — Payments index

Purpose: List all payments received (Stripe webhooks + manual receipts).
Route: `/admin/fin/payments`   Persona: PA   Device: desktop   Mode: n/a
Current state: PARTIAL.
Workflow role: n/a
Key components: Table (received-at, tenant, amount, currency, source: STRIPE/PADDLE/MANUAL/BANK, applied-to invoice, status: APPLIED/UNAPPLIED/REVERSED), filters, Record Payment button, Export.
Primary actions: Row → PA-PAY-002; Record → PA-PAY-003; Reverse → confirm modal.
State variants: loading, empty, error.
Entry from: PA-FIN-001, PA-FIN-003, PA-INV-002.
Exit to: PA-PAY-002, PA-PAY-003.
Metering: n/a
Notes: Reversal creates a linked negative payment record — no destructive delete.

### PA-PAY-002 — Payment detail + apply

Purpose: One payment: apply to one or many invoices; view provenance.
Route: `/admin/fin/payments/:id`   Persona: PA (elevated for writes)   Device: desktop   Mode: n/a
Current state: PARTIAL.
Workflow role: n/a
Key components: Header (amount, source, provenance JSON), unapplied balance, Apply section (select invoices + amounts), Apply button.
Primary actions: Apply → PA-INV-002 refresh; Reverse.
State variants: loading, error, over-apply (validation).
Entry from: PA-PAY-001, PA-INV-002.
Exit to: PA-INV-002.
Metering: n/a
Notes: Multi-invoice split-apply supported.

### PA-PAY-003 — Record manual payment

Purpose: Record a bank transfer or offline payment.
Route: modal from PA-PAY-001 or PA-INV-002   Persona: PA (elevated)   Device: desktop   Mode: n/a
Current state: MISSING or partial.
Workflow role: n/a
Key components: Tenant picker (prefilled), amount, currency, received-date, source (Bank/Cash/Cheque/Wire), reference #, evidence upload, Submit.
Primary actions: Submit → PA-PAY-002.
State variants: loading, validation, error.
Entry from: PA-PAY-001, PA-INV-002.
Exit to: PA-PAY-002.
Metering: n/a
Notes: Evidence required for manual payments (bank slip screenshot).

---

<a id="10-pa-acc"></a>
## 10. PA-ACC — Accounting periods

### PA-ACC-001 — Periods index

Purpose: List billing / accounting periods with status (OPEN/SOFT_CLOSED/HARD_CLOSED).
Route: `/admin/fin/accounting/periods`   Persona: PA   Device: desktop   Mode: n/a
Current state: PARTIAL — routes exist, dedicated page may or may not.
Workflow role: n/a
Key components: Table (period id — YYYY-MM, status, tx count, drift count, closed-at, closed-by), Close Selected button.
Primary actions: Row → PA-ACC-002; Bulk close.
State variants: loading, empty, error.
Entry from: PA-FIN-001.
Exit to: PA-ACC-002.
Metering: n/a
Notes: Hard-closed periods are frozen — no writes.

### PA-ACC-002 — Period detail

Purpose: One period: closing checklist, drift status, sign-off gate.
Route: `/admin/fin/accounting/periods/:id`   Persona: PA (elevated for close)   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: WF-14 (billing) + WF-15 (accounting) role=Composition.
Key components: Header (period, status), checklist (all invoices generated, reconciliation clean, drift resolved, approvals cleared), Soft Close button, Hard Close button (post soft-close), Reopen button (post-close, elevated + approval).
Primary actions: Soft Close (elevated) → status change; Hard Close (elevated + typed confirm) → WF-15 approval outcome; Reopen → WF-15 approval (rarely).
State variants: loading, checklist-incomplete (blocked), error.
Entry from: PA-ACC-001.
Exit to: PA-ACC-001.
Metering: n/a
Notes: Hard close is an audit signal — SEC/audit teams rely on it. Reopen must be exceptional.

### PA-ACC-003 — Billing period close

Purpose: Close a billing period (`fin.billing_periods.close`) — advisory lock 1020.
Route: sub-flow from PA-ACC-002   Persona: PA (elevated)   Device: desktop   Mode: n/a
Current state: PARTIAL.
Workflow role: WF-14 role=Action outcome.
Key components: Confirmation (period-id, tenant scope: all / specific), lock status (1020 held by / free), Close button.
Primary actions: Close → runs `close_billing_period` in advisory-lock context.
State variants: loading, lock-held-by-another (block + wait), error.
Entry from: PA-ACC-002.
Exit to: PA-ACC-002.
Metering: n/a
Notes: If advisory lock 1020 is held elsewhere, show holder identity and wait affordance.

---

<a id="11-pa-ven"></a>
## 11. PA-VEN — Vendors (fin.vendor_* — external cost tracking)

### PA-VEN-001 — Vendors index

Purpose: List external vendors we buy from (OpenAI, Anthropic, BannerBear, Twilio SMS, WhatsApp BSP, Google Maps).
Route: `/admin/fin/vendors`   Persona: PA   Device: desktop   Mode: n/a
Current state: EXISTS — `VendorCosts.tsx` (may cover vendors + costs together).
Workflow role: n/a
Key components: Table (vendor code, name, rate schedule count, MTD cost, MTD units, margin per cost driver), Add Vendor button.
Primary actions: Row → PA-VEN-002; Create → PA-VEN-003.
State variants: loading, error.
Entry from: PA-FIN-001.
Exit to: PA-VEN-002.
Metering: n/a
Notes: Data source is `fin.vendor_costs` populated from adapters (`ai_call_usage`, etc.).

### PA-VEN-002 — Vendor detail

Purpose: One vendor: rate schedules, monthly statements, margin against selling prices.
Route: `/admin/fin/vendors/:id`   Persona: PA   Device: desktop   Mode: n/a
Current state: PARTIAL.
Workflow role: n/a
Key components: Header, tabs (Rates | Statements | Margin), Rates table (rate_key, price per unit, effective window), Statements list (monthly), Margin chart (selling price − vendor cost per feature).
Primary actions: Add Rate → PA-VEN-003; View Statement → PA-VEN-004; Reconcile Statement → PA-VEN-005.
State variants: loading, error.
Entry from: PA-VEN-001.
Exit to: PA-VEN-003, PA-VEN-004.
Metering: n/a
Notes: Margin computation server-side; UI just displays.

### PA-VEN-003 — Add / edit vendor rate

Purpose: Enter a new rate (e.g., "OpenAI GPT-4 output token $0.03 / 1k") with effective window.
Route: modal from PA-VEN-002   Persona: PA (elevated)   Device: desktop   Mode: n/a
Current state: MISSING or partial.
Workflow role: n/a
Key components: Rate key (dropdown from adapter registry), unit price, unit, currency, effective-from, effective-until (optional), Submit.
Primary actions: Submit → PA-VEN-002.
State variants: loading, validation, error.
Entry from: PA-VEN-002.
Exit to: PA-VEN-002.
Metering: n/a
Notes: Overlapping rates per (vendor, rate_key) refused.

### PA-VEN-004 — Vendor statement detail

Purpose: One monthly statement showing usage rows from `fin.vendor_costs` reconciled against invoice.
Route: `/admin/fin/vendors/:id/statements/:month`   Persona: PA   Device: desktop   Mode: n/a
Current state: MISSING dedicated page.
Workflow role: n/a
Key components: Header (month, expected total, invoiced total, delta), rows (rate_key × units × price → line total), variance column, Reconcile action.
Primary actions: Reconcile → PA-VEN-005; Flag anomaly → PA-EXC-001.
State variants: loading, error, out-of-tolerance-drift (alert).
Entry from: PA-VEN-002.
Exit to: PA-VEN-005, PA-EXC-001.
Metering: n/a
Notes: Vendor advisory lock 1021 held during reconcile.

### PA-VEN-005 — Vendor statement reconcile action

Purpose: Mark a statement as reconciled (with signed evidence).
Route: modal from PA-VEN-004   Persona: PA (elevated + advisory lock 1021)   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: WF-22 role=Action outcome.
Key components: Statement summary, notes, evidence upload, Mark Reconciled button.
Primary actions: Reconcile → writes audit, releases lock, returns to PA-VEN-004.
State variants: loading, lock-held-elsewhere, drift-unresolved (block).
Entry from: PA-VEN-004.
Exit to: PA-VEN-004.
Metering: n/a
Notes: Cannot reconcile with unresolved drift.

---

<a id="12-pa-rec"></a>
## 12. PA-REC — Reconciliation

### PA-REC-001 — Reconciliation runs index

Purpose: List runs of the R-check registry (`fin/reconciliation/checks.js`).
Route: `/admin/fin/reconciliation`   Persona: PA   Device: desktop   Mode: n/a
Current state: EXISTS — `Reconciliation.tsx`.
Workflow role: n/a
Key components: Table (run_id, started-at, duration, R-check pass/fail counts, drift count), Run Now button, filters (date-range, status).
Primary actions: Row → PA-REC-002; Run Now → PA-REC-003.
State variants: loading, empty, error.
Entry from: PA-FIN-001.
Exit to: PA-REC-002, PA-REC-003.
Metering: n/a
Notes: Show trending — increasing drift is signal.

### PA-REC-002 — Reconciliation run detail

Purpose: One run: per-check pass/fail, drift items, resolution.
Route: `/admin/fin/reconciliation/:id`   Persona: PA (elevated for resolve)   Device: desktop   Mode: n/a
Current state: PARTIAL.
Workflow role: WF-09 role=Composition.
Key components: Header (run metadata), per-check accordion (R110, R111, … R123: pass/fail, message), drift list (`fin.drift_events`), per-drift Resolve button.
Primary actions: Resolve drift → PA-REC-004 (per drift); Rerun single check.
State variants: loading, error.
Entry from: PA-REC-001.
Exit to: PA-REC-004, PA-REC-001.
Metering: n/a
Notes: Drift resolution feeds into WF-09 flow.

### PA-REC-003 — Run reconciliation manually

Purpose: Kick off a reconciliation run outside the scheduler.
Route: modal from PA-REC-001   Persona: PA (elevated)   Device: desktop   Mode: n/a
Current state: PARTIAL.
Workflow role: n/a
Key components: Scope picker (all tenants / one tenant / one check), Start button.
Primary actions: Start → PA-REC-002.
State variants: loading, error.
Entry from: PA-REC-001.
Exit to: PA-REC-002.
Metering: n/a
Notes: Cadence controlled in CFG. Manual runs are auditable.

### PA-REC-004 — Resolve drift item

Purpose: One drift item shown with expected vs. actual + resolution options.
Route: modal from PA-REC-002 or PA-EXC-002   Persona: PA (elevated + approval if adjusting money)   Device: desktop   Mode: n/a
Current state: PARTIAL.
Workflow role: WF-09 role=Approval detail.
Key components: Drift metadata (check, tenant, resource, expected, actual, delta), resolution radios (Adjust to expected / Accept actual / Escalate), justification field, Submit for Approval (if delta > threshold) or Resolve directly.
Primary actions: Resolve → creates journal entry via `fin.events` if money involved.
State variants: loading, error, already-resolved.
Entry from: PA-REC-002, PA-EXC-002.
Exit to: PA-REC-002 or PA-APR-001.
Metering: n/a
Notes: All drift resolutions immutable; recorded to audit.

---

<a id="13-pa-exc"></a>
## 13. PA-EXC — Exceptions queue

### PA-EXC-001 — Exceptions index

Purpose: Unified queue of drift + anomalies + orphaned data.
Route: `/admin/fin/exceptions`   Persona: PA   Device: desktop   Mode: n/a
Current state: EXISTS — `Exceptions.tsx`.
Workflow role: n/a
Key components: Table (created-at, type, tenant, description, severity: LOW/MED/HIGH/CRITICAL, status: OPEN/INVESTIGATING/RESOLVED/WONT_FIX), filters, bulk actions (Assign, Change Severity, Resolve).
Primary actions: Row → PA-EXC-002; Bulk resolve.
State variants: loading, empty, error.
Entry from: PA-FIN-001, PA-VEN-004, PA-REC-002.
Exit to: PA-EXC-002.
Metering: n/a
Notes: Keyboard navigation (`J`/`K`) + `E` to open → high-throughput ops.

### PA-EXC-002 — Exception detail

Purpose: One exception: full context + resolution.
Route: `/admin/fin/exceptions/:id`   Persona: PA (elevated for resolution actions)   Device: desktop   Mode: n/a
Current state: PARTIAL.
Workflow role: n/a
Key components: Header (type, severity, tenant, resource), full JSON payload (collapsible), related-drift links (→ PA-REC-004), Notes tab, Resolution actions (Adjust, Ignore, Escalate).
Primary actions: Resolve → same flow as PA-REC-004; Escalate → PA-APR-005.
State variants: loading, error.
Entry from: PA-EXC-001.
Exit to: PA-REC-004, PA-EXC-001.
Metering: n/a
Notes: Wont-fix requires a justification.

---

<a id="14-pa-apr"></a>
## 14. PA-APR — Approvals queue (two-person rule surface)

**All two-person approval workflows converge here.** Backed by `fin.approval_requests`.

### PA-APR-001 — Approvals queue

Purpose: List every pending approval across all workflows (WF-07 packages, WF-08 credit grants, WF-09 drift, WF-14/15 period close, WF-18 facility, WF-19 contract, WF-20 price, WF-21 debit note, WF-22 vendor recon, others).
Route: `/admin/fin/approvals`   Persona: PA (any admin, but cannot approve own submissions)   Device: desktop   Mode: n/a
Current state: EXISTS — `Approvals.tsx`.
Workflow role: role=Approval queue (multiple workflows).
Key components: Table (requested-at, submitter, type, target (tenant/package/etc.), summary, threshold-tier, status), filters (type, submitter, my-eligible-only, threshold), Bulk-approve (if all under a low-risk threshold).
Primary actions: Row → the workflow-specific Approval Detail (PA-PKG-005 for packages, PA-CRD-005b for credit grants, PA-REC-004 for drift, etc.); Bulk approve.
State variants: loading, empty, error, filter-my-eligible-only (excludes submissions where I was submitter).
Entry from: PA-FIN-001 attention card, direct URL, notification link.
Exit to: PA-PKG-005, PA-CRD-005b, PA-REC-004, PA-INV-004b, PA-FAC-004b, PA-CON-003b, PA-PRC-003b — one for each workflow's Approval Detail screen.
Metering: n/a
Notes: The system enforces the two-person rule server-side; UI reinforces it by hiding the Approve button on my own submissions.

### PA-APR-002 — Approval detail (generic wrapper)

Purpose: When a workflow doesn't have a dedicated Approval Detail screen (WF-08 credit grant is the primary example), a generic view shows the request payload + diff + approve/reject controls.
Route: `/admin/fin/approvals/:id`   Persona: PA (second approver)   Device: desktop   Mode: n/a
Current state: PARTIAL.
Workflow role: role=Approval detail (generic).
Key components: Metadata (submitter, workflow type, submitted-at, reason), payload (JSON), diff (if applicable), impact estimate, Approve / Reject / Request Changes / Escalate controls.
Primary actions: Same as workflow-specific screens.
State variants: loading, already-decided, permission-denied (I was submitter), error.
Entry from: PA-APR-001.
Exit to: PA-APR-001.
Metering: n/a
Notes: Prefer workflow-specific screens where they exist (PA-PKG-005 for packages).

### PA-APR-003 — Approval action confirmation (P0 — REWRITTEN 2026-09-04 per D9)

Purpose: The confirm-and-execute surface that every two-person-rule approve/reject action passes through. Without this, PA-APR-001 (queue) has no reliable action mechanism — approvers can see the queue but cannot commit a decision.
Route: modal from PA-APR-002 / PA-PKG-005 / PA-CRD-005b / PA-INV-004b / any workflow-specific approval-detail screen   Persona: PA (second approver, distinct from submitter)   Device: desktop   Mode: n/a
Current state: MISSING — must ship with the two-person-rule cluster (PA-APR-002/003/005/006) as one indivisible unit.
Workflow role: role=Action outcome (all two-person-approval workflows: WF-07 / 08 / 09 / 14 / 15 / 17 / 18 / 19 / 20 / 21 / 22 / 23 / 24 / 25 / 27 / 28).
Environment badge: inherits current env from PA-NAV-001 (LIVE amber / TEST neutral). Elevated-token step-up is per-env — elevating in LIVE does not elevate TEST.
Fulfills: the terminal action-commit for every workflow whose queue lives in PA-APR-001.
Key components:
- Action pill (Approve — green / Reject — red / Request Changes — amber) — mutually exclusive
- Reason field: **required for Reject** (from controlled vocabulary per workflow type — WF-07 rejection reasons include "Pricing math wrong / Missing feature quotas / Compliance conflict / Other"; WF-08 rejection reasons include "Amount too large for tier / Missing evidence / Suspicious pattern / Other"). Free-text notes always available.
- Impact preview panel: shows what will happen server-side on Approve (e.g., "This package version becomes PUBLISHED; N subscribers get the new quotas at next cycle"; "This credit grant posts NNN centi-credits to wallet X and mirrors to fin.* via worker 1023").
- Step-up prompt (SHR-MFA-007) — 15-minute elevation TTL, per-env
- Confirm button (disabled until action + reason satisfied)
- Cancel link (returns to detail without action)
Primary actions: Confirm → server executes atomically → returns to PA-APR-001 with success toast + link to the workflow's outcome screen (e.g., PA-CRD-006 for credit grants, PA-PKG-002 for packages).
State variants: loading, step-up-required (redirects to SHR-MFA-007 modal, resumes here on success), already-decided (someone else acted first — refresh the queue with a warning), permission-denied (I was the submitter — server-enforced, UI hides Approve/Reject buttons), execution-failed (surface the specific error + retry option).
Entry from: Any approval-detail screen's Approve/Reject button.
Exit to: PA-APR-001 (queue), workflow-specific outcome screen.
Metering: n/a
Notes: Server MUST enforce the two-person rule (submitter cannot approve own submission) regardless of what the UI shows. Every action writes to `fin.approval_requests.decision_at` + `.decided_by` + `.decision_reason` and to the immutable audit log (PA-AUD-001).

### PA-APR-004 — Approval audit trail per item

Purpose: Immutable log of who submitted, approved/rejected, when, with what payload.
Route: side panel or tab on the workflow-specific detail   Persona: PA   Device: desktop   Mode: n/a
Current state: PARTIAL (may live in AUD).
Workflow role: role=Audit / history.
Key components: Timeline (submitted → approved/rejected → executed → post-conditions), payload snapshots, actor identities.
Primary actions: Export to PDF (for audit).
State variants: loading.
Entry from: PA-APR-002, PA-PKG-005, PA-AUD-001.
Exit to: same.
Metering: n/a
Notes: Referenced by external audits (SOX, financial).

### PA-APR-005 — Escalate approval (P0 — REWRITTEN 2026-09-04 per D9)

Purpose: An approver can defer a decision to a senior PA when the request is out-of-scope for their authority (e.g., a credit grant exceeds their per-approver cap), contentious (submitter is a friend / conflict of interest), or requires domain expertise they lack (e.g., a tax-related package change needs legal review).
Route: modal from any approval-detail screen (PA-APR-002 / PA-PKG-005 / etc.)   Persona: PA (elevated)   Device: desktop   Mode: n/a
Current state: MISSING — ships as part of the two-person-rule cluster (PA-APR-002/003/005/006).
Workflow role: role=Escalation.
Environment badge: inherits current env from PA-NAV-001.
Fulfills: enables the escalation path for every two-person-rule workflow.
Key components:
- Escalation reason (from controlled vocabulary: Out-of-scope authority / Conflict of interest / Requires domain expertise / Contentious / Compliance concern / Other-with-required-notes)
- Target approver picker: dropdown of eligible senior PAs (server-scoped by role.seniority OR by capability pack `capabilities.escalation_target=true`)
- Free-text notes (context for the target)
- Send Escalation button
Primary actions: Send → request moves to target approver's queue with `escalated_from` + `escalation_reason` populated → target sees the item highlighted as escalated → target can approve/reject/re-escalate/return-to-original.
State variants: loading, error, no-eligible-target (block with clear message), target-out-of-office (surface OOO status, suggest alternatives).
Entry from: Any approval-detail screen.
Exit to: PA-APR-001 with escalation-confirmation toast.
Metering: n/a
Notes: Escalation is auditable — the chain (submitter → first approver → escalated to → decided by) is preserved. Target seeing the request must be a DIFFERENT person than the submitter AND the escalator. Server enforces. Escalated requests get a higher SLA priority in the queue sort. Re-escalation (target escalates again) is allowed but capped at 3 hops before auto-flag for manual review.

### PA-APR-006 — Recall submission (P0 — REWRITTEN 2026-09-04 per D9)

Purpose: The submitter of a pending approval can withdraw it before another approver decides. Prevents the "I noticed a mistake in my own submission but it's already in the queue" trap and reduces embarrassing rejections.
Route: banner on the workflow-specific detail screen when I am the submitter AND the request is still `REQUESTED` / `PENDING_APPROVAL`   Persona: PA (submitter only — server-enforced)   Device: desktop   Mode: n/a
Current state: MISSING — ships as part of the two-person-rule cluster.
Workflow role: role=Recall.
Environment badge: inherits current env from PA-NAV-001.
Fulfills: the submitter-side abort path for every two-person-rule workflow.
Key components:
- "You submitted this. You can withdraw it before another PA decides." banner
- Reason field (optional but strongly encouraged — helps future reviewers understand the rescinded request)
- Withdraw button (destructive-outline)
- Confirmation dialog ("Withdrawing returns this request to DRAFT. You can resubmit after making changes.")
Primary actions: Withdraw → server changes `fin.approval_requests.status` to `WITHDRAWN` → the underlying entity (package version / credit grant / etc.) returns to DRAFT → item disappears from PA-APR-001 → any approver who had opened it sees a "This request was withdrawn by the submitter" toast on next action.
State variants: loading, already-decided (cannot withdraw — the button hides once status changes to APPROVED / REJECTED), error, in-flight-execution (rare: an approver clicked Approve at the same instant — server races, first-writer-wins, appropriate error message).
Entry from: PA-PKG-002 (my draft package with pending submission), PA-CRD-002 (my credit-grant submission), or any workflow-specific detail screen where I am the submitter.
Exit to: origin screen with entity status back to DRAFT.
Metering: n/a
Notes: Withdraw is not-quite-audit-neutral: the request row remains with `status=WITHDRAWN`; the audit log gets a withdraw event; second approvers who had seen it in their queue get a notification "N.N withdrew a request from your queue." The reason (if provided) is captured for future context but never shown as blame.

---

<a id="15-pa-dun"></a>
## 15. PA-DUN — Dunning

### PA-DUN-001 — Dunning cases index

Purpose: List every dunning case (past-due invoice progression).
Route: `/admin/fin/dunning`   Persona: PA   Device: desktop   Mode: n/a
Current state: PARTIAL — routes exist, page may be part of Invoices.
Workflow role: n/a
Key components: Table (tenant, invoice, days-past-due, stage: NOTICE_1/NOTICE_2/PRE_SUSPEND/SUSPEND/WRITE_OFF, last-action, next-action-due), filters (stage, tenant, amount-band), Bulk advance.
Primary actions: Row → PA-DUN-002; Advance selected.
State variants: loading, empty, error.
Entry from: PA-FIN-001 card.
Exit to: PA-DUN-002.
Metering: n/a
Notes: Automated advancement is scheduled; UI is for exception handling.

### PA-DUN-002 — Dunning case detail

Purpose: One case: history, communications sent, next action, resolution actions.
Route: `/admin/fin/dunning/:id`   Persona: PA (elevated for writes)   Device: desktop   Mode: n/a
Current state: MISSING dedicated page.
Workflow role: WF-10 role=Composition.
Key components: Header (tenant, invoice, current stage, days-past-due), timeline (notices sent, replies, promises-to-pay), quick actions (Advance / Cure / Write-off / Send Notice Now).
Primary actions: Advance stage → PA-DUN-003; Cure (mark paid) → PA-DUN-004; Write-off → PA-DUN-005.
State variants: loading, error.
Entry from: PA-DUN-001.
Exit to: PA-DUN-003 / -004 / -005.
Metering: n/a
Notes: Cure is triggered when payment arrives; but PA can manually mark-paid + apply payment.

### PA-DUN-003 — Advance stage

Purpose: Manually move a case to the next dunning stage.
Route: modal from PA-DUN-002   Persona: PA (elevated)   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: WF-10 role=Action outcome.
Key components: Current stage, target stage, notes, Advance button.
Primary actions: Advance → triggers stage-associated communications (email/WhatsApp per SHR-NAV-004b prefs).
State variants: loading, error.
Entry from: PA-DUN-002.
Exit to: PA-DUN-002.
Metering: n/a
Notes: SUSPEND stage suspends the tenant's subscription — surface warning.

### PA-DUN-004 — Cure case (mark paid)

Purpose: Manually mark a case as cured (payment received offline).
Route: modal from PA-DUN-002   Persona: PA (elevated)   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: WF-10 role=Action outcome.
Key components: Payment reference (link to PA-PAY-002), notes, Cure button.
Primary actions: Cure → status = RESOLVED, tenant reactivated if suspended.
State variants: loading, error.
Entry from: PA-DUN-002.
Exit to: PA-DUN-002.
Metering: n/a
Notes: Cure without a payment record forbidden — enforce link.

### PA-DUN-005 — Write off (destructive + approval)

Purpose: Write-off a case; invoice becomes uncollectable.
Route: modal from PA-DUN-002   Persona: PA (elevated + approval)   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: WF-10 role=Approval detail (via generic PA-APR-002).
Key components: Amount to write off, reason (Bad debt / Fraud / Regulatory / Other), evidence, Submit for Approval.
Primary actions: Submit → PA-APR-001.
State variants: loading, error.
Entry from: PA-DUN-002.
Exit to: PA-APR-001.
Metering: n/a
Notes: Write-off creates a `fin.events` bad-debt entry; feeds the ledger.

---

<a id="16-pa-aud"></a>
## 16. PA-AUD — Audit log

### PA-AUD-001 — Audit log

Purpose: Immutable log of every PA action, tenant admin action, and system event.
Route: `/admin/fin/audit`   Persona: PA   Device: desktop   Mode: n/a
Current state: EXISTS — `Audit.tsx`.
Workflow role: role=Audit / history (all workflows).
Key components: Table (timestamp, actor, action, target, before/after JSON), filters (actor, action, target-type, date-range, workflow), search (JSON contains), Export to CSV, Retention policy settings link.
Primary actions: Row → detail modal with full JSON diff; Export.
State variants: loading, empty, error.
Entry from: Everywhere with an "Audit" link; direct URL.
Exit to: Detail modal.
Metering: n/a
Notes: Audit is append-only; retention policy configurable in CFG.

### PA-AUD-002 — Retention policy

Purpose: Configure audit-log retention (data-residency + regulatory).
Route: modal from PA-AUD-001   Persona: PA (elevated)   Device: desktop   Mode: n/a
Current state: MISSING or partial.
Workflow role: n/a
Key components: Retention days per event category (PA actions / tenant actions / system events), export before purge toggle, Save.
Primary actions: Save → policy applied on next janitor.
State variants: loading, error.
Entry from: PA-AUD-001, PA-CFG-001.
Exit to: PA-AUD-001.
Metering: n/a
Notes: Minimum retention enforced (7 years for financial audit).

---

<a id="17-pa-cfg"></a>
## 17. PA-CFG — Configuration

### PA-CFG-001 — Feature flags

Purpose: Toggle feature flags on/off, per env, per tenant.
Route: `/admin/fin/configuration#flags`   Persona: PA (elevated)   Device: desktop   Mode: n/a
Current state: PARTIAL — likely inside `Configuration.tsx`.
Workflow role: n/a
Key components: Table (flag key, scope: global/per-tenant, current value, default, description), Edit inline, per-tenant override list.
Primary actions: Edit → step-up → save → audit.
State variants: loading, error.
Entry from: PA-FIN-005 tab.
Exit to: PA-FIN-005.
Metering: n/a
Notes: All flag flips audited.

### PA-CFG-002 — Worker cadence & health

Purpose: See + configure the schedule of async workers (janitor 1022, mirror 1023, billing-cycle 1024, recon cadence).
Route: `/admin/fin/configuration#workers`   Persona: PA (elevated)   Device: desktop   Mode: n/a
Current state: MISSING dedicated section.
Workflow role: n/a
Key components: Table (worker name, cadence cron, last-run, next-run, backlog, lock status), Edit cadence inline, Run Now.
Primary actions: Edit → save; Run Now → immediate dispatch.
State variants: loading, error, worker-crashed (red).
Entry from: PA-FIN-005.
Exit to: PA-FIN-005.
Metering: n/a
Notes: Advisory lock holders shown per row.

### PA-CFG-003 — API keys & secrets rotation

Purpose: View + rotate 3rd-party API keys (OpenAI, Anthropic, BannerBear, Twilio, MSFT Graph client cred, Paddle, Google Maps).
Route: `/admin/fin/configuration#keys`   Persona: PA (elevated + approval)   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: WF-23 role=Initiator (secret rotation with two-person rule).
Key components: List (service, last-rotated-at, key-preview last-4, expires-at if known), Rotate button per row.
Primary actions: Rotate → new key input (paste or generate) → PA-APR-001 for two-person approval → activate → old key deprecated + grace window.
State variants: loading, expiring-soon (badge), error.
Entry from: PA-FIN-005.
Exit to: PA-APR-001.
Metering: n/a
Notes: Never display full key; last-4 only. Rotation follows two-person rule.

### PA-CFG-004 — Regional & currency configuration

Purpose: Configure supported regions, currencies, FX rates.
Route: `/admin/fin/configuration#regions`   Persona: PA (elevated)   Device: desktop   Mode: n/a
Current state: MISSING dedicated page (regional currency scattered).
Workflow role: n/a
Key components: Regions table (name, enabled, currency, VAT rate, PSP: Stripe/Paddle/Manual), Currencies table (code, symbol, decimals, active), FX rates table (source: `fx.py` schedule / manual), Add / edit inline.
Primary actions: Toggle region; edit rate; add currency.
State variants: loading, error.
Entry from: PA-FIN-005.
Exit to: PA-FIN-005.
Metering: n/a
Notes: Rate changes audited. KSA ZATCA compliance flag lives here per region.

### PA-CFG-006 — Territories & disclosure fields config (CORRECTED — added 2026-09-04)

Purpose: Manage the countries/territories WingCaster supports and the per-territory required disclosure fields on property listings.
Route: `/admin/fin/configuration#territories`   Persona: PA (elevated + approval for adding a territory)   Device: desktop   Mode: n/a
Current state: MISSING — schema exists in `migration 003` (`territories` + `territory_disclosure_fields`), no admin UI. Backend routes exist (`GET /api/territories`, `GET /api/territories/:id/disclosure-fields`).
Workflow role: WF-35 role=Initiator (adding a new territory requires two-person approval).
Key components: Territories table (id, code, name, currency, active), per-territory disclosure-fields sub-table (key, label, field_type, required, unit, sort_order). Add territory (approval-gated), Edit disclosure fields, Reorder.
Primary actions: Add territory; Edit disclosure field; Reorder; Deactivate.
State variants: loading, has-active-listings-blocked (deactivating a territory with active listings requires migration path).
Entry from: PA-FIN-005.
Exit to: PA-APR-001 for new-territory additions.
Metering: n/a
Notes: The `territories.code` is used across `properties.territory_id` — changing it is a breaking migration. Currency per territory sets the default currency for new listings in that territory.

### PA-CFG-007 — Real Estate Bazaar integration config (CORRECTED — added 2026-09-04)

Purpose: Configure the sync pipeline between WingCaster and Real Estate Bazaar (separate consumer platform).
Route: `/admin/fin/configuration#bazaar`   Persona: PA (elevated + two-person for cred rotation)   Device: desktop   Mode: n/a
Current state: MISSING (no config surface for the RB integration audited).
Workflow role: WF-24 (PSP-adjacent — external integration config) or new WF.
Key components: Sync cadence (real-time / batched every N min), Bazaar API credentials (last-rotated only, no raw display), listing-visibility default policy (opt-in per listing vs opt-out), inbound-attribution tracking token format, health chip.
Primary actions: Rotate credentials (approval-gated), Edit cadence, Test sync, Force-resync.
State variants: healthy, sync-lag warning, credentials-expiring.
Entry from: PA-FIN-005.
Exit to: PA-APR-001.
Metering: n/a
Notes: This is the ONE place PA controls the WingCaster-side of the RB boundary. RB itself is on a different codebase.

### PA-CFG-005 — Paddle config (SIMPLIFIED 2026-09-04 per D5 → Paddle-only single-provider surface)

Purpose: View + rotate the Paddle credentials + test the webhook. **Paddle is the sole PSP under merchant-of-record model.** No multi-PSP admin needed.
Route: `/admin/fin/configuration#paddle`   Persona: PA (elevated + two-person for cred rotation)   Device: desktop   Mode: n/a
Current state: MISSING — needs authoring aligned to the simplified single-provider scope.
Workflow role: WF-24 role=Initiator (Paddle cred rotation with two-person rule).
Environment badge: inherits current env from PA-NAV-001. **Paddle sandbox maps to WingCaster env TEST; Paddle production maps to LIVE.**
Fulfills: enables Paddle payment processing at launch; PA-CRD-005 top-ups + AGT-SUB-002/AGN-SUB-002 subscription changes all route through Paddle configured here.
Key components:
- Paddle seller ID (display-only)
- Environment mapping indicator (WingCaster env → Paddle sandbox/production, always matched via PA-NAV-001)
- Webhook secret (last-rotated timestamp only — raw value never displayed)
- API key (last-rotated timestamp only — raw value never displayed, entered via secure paste box on rotation only)
- Rotate Credentials button (opens WF-23 approval via PA-APR-001)
- Test Webhook button (POSTs a simulated Paddle event to `/webhooks/stripe` — wait, need to rename to `/webhooks/paddle`; verifies signature roundtrip; surfaces result)
- Test Checkout Session button (creates a $1 test checkout in Paddle sandbox to verify integration)
Primary actions: Rotate credentials (approval-gated) → SHR-MFA-007 step-up → paste new value → submit → WF-23 → apply on approve. Test webhook / test checkout.
State variants: healthy, credentials-expiring (< 30 days), webhook-signature-failed, checkout-test-failed, sandbox-vs-production mismatch (warns if PA-NAV-001 env doesn't match Paddle env — should never happen but defence-in-depth).
Entry from: PA-FIN-005.
Exit to: PA-APR-001 for rotation.
Metering: n/a
Notes: **Live cutover blocked until:** webhook signature roundtrip verified via test event AND at least one successful test checkout AND `PADDLE_SELLER_ID` + `PADDLE_WEBHOOK_SECRET` + `PADDLE_API_KEY` env vars set in production. Server has a `/api/ready` health-check gate that includes Paddle readiness. Under Paddle MoR: Paddle handles PSP-level dunning, chargebacks, tax collection + remittance, currency conversion. WingCaster only orchestrates checkout + processes webhooks.

---

<a id="18-pa-tpl"></a>
## 18. PA-TPL — Platform message templates

### PA-TPL-001 — Templates index

Purpose: List platform-wide message templates (used by notifications system).
Route: `/admin/message-templates`   Persona: PA   Device: desktop   Mode: n/a
Current state: EXISTS — `web/src/pages/admin/platform-templates/MessageTemplatesPage.tsx`.
Workflow role: n/a
Key components: Table (name, category, channels: email/sms/whatsapp/push, active version, last-modified, status), filters, Create Template.
Primary actions: Row → PA-TPL-002; Create → PA-TPL-002.
State variants: loading, error.
Entry from: SHR-NAV-002 admin section.
Exit to: PA-TPL-002.
Metering: n/a
Notes: Templates are versioned per `platform-templates/routes.js`.

### PA-TPL-002 — Template editor

Purpose: Edit template with Unlayer editor + variable diagnostics + preview + test-send.
Route: `/admin/message-templates/:id`   Persona: PA (elevated for publish)   Device: desktop   Mode: n/a
Current state: EXISTS — `TemplateEditPage.tsx` + full editor kit under `components/platform-templates/*`.
Workflow role: WF-25 role=Composition (template publish approval, add to WF index).
Key components: Unlayer canvas, right rail (Settings / Versions / Variables / Preview), tabs, Send Test, Preview, Save Draft, Submit for Publish.
Primary actions: Save Draft; Submit → PA-APR-001; Send Test → PA-TPL-003; Revert to prior version.
State variants: loading, unsaved-changes, error.
Entry from: PA-TPL-001.
Exit to: PA-TPL-001, PA-APR-001.
Metering: n/a
Notes: Multi-channel content (email HTML + WhatsApp text) authored together.

### PA-TPL-003 — Send test dialog

Purpose: Send a test render of the template to a chosen address.
Route: modal from PA-TPL-002   Persona: PA   Device: desktop   Mode: n/a
Current state: EXISTS — `SendTestDialog.tsx`.
Workflow role: n/a
Key components: Recipient (email/phone/whatsapp), variables JSON (prefilled with sample data), Send button.
Primary actions: Send → toast success/failure.
State variants: loading, error.
Entry from: PA-TPL-002.
Exit to: PA-TPL-002.
Metering: n/a
Notes: Delivered via same transports as production (Microsoft Graph email, Twilio SMS, WhatsApp BSP).

### PA-TPL-004 — Template versions history

Purpose: See version history + revert.
Route: tab in PA-TPL-002   Persona: PA (elevated for revert)   Device: desktop   Mode: n/a
Current state: EXISTS — `VersionsTab.tsx`.
Workflow role: role=Audit / history.
Key components: Timeline (version, published-by, published-at, active flag), diff, Revert button.
Primary actions: Revert → creates new draft from old version.
State variants: loading, error.
Entry from: PA-TPL-002.
Exit to: PA-TPL-002.
Metering: n/a
Notes: Revert never deletes; always forward-only.

---

<a id="19-pa-are"></a>
## 19. PA-ARE — Areas

### PA-ARE-001 — Areas index

Purpose: List neighborhoods managed by the platform.
Route: `/admin/areas`   Persona: PA   Device: desktop   Mode: n/a
Current state: EXISTS — `AdminAreasPage.tsx`.
Workflow role: n/a
Key components: Table (slug, name, region, scoring-enabled, sources count, last-refresh), filters, Create Area, Bulk import CSV.
Primary actions: Row → PA-ARE-002; Create → PA-ARE-002 with new-flag.
State variants: loading, error.
Entry from: SHR-NAV-002 admin.
Exit to: PA-ARE-002.
Metering: n/a
Notes: Areas power SHR-PUB-004.

### PA-ARE-002 — Area detail + editor

Purpose: Manage one area's identity, geometry, and sources.
Route: `/admin/areas/:id`   Persona: PA (elevated)   Device: desktop   Mode: n/a
Current state: PARTIAL.
Workflow role: n/a
Key components: Header (slug, name, region), map polygon editor, sources list (add/remove), Disclosure fields config, Enable Scoring toggle, Refresh Google Signals button.
Primary actions: Save; Add source; Refresh Google.
State variants: loading, error, quota-exceeded (Google Maps budget hit).
Entry from: PA-ARE-001.
Exit to: PA-ARE-001, PA-SCR-002 (scoring dimensions for this area).
Metering: n/a
Notes: Refresh Google Signals consumes Maps API budget (PA-GOO-001 tracks).

### PA-ARE-003 — Signals review

Purpose: Review AI-signaled points-of-interest for an area (verify/reject).
Route: `/admin/areas/:id/signals`   Persona: PA   Device: desktop   Mode: n/a
Current state: PARTIAL.
Workflow role: WF-26 role=Approval queue (signal moderation).
Key components: Table (signal type, name, source, confidence, status: PENDING/VERIFIED/REJECTED), map with pins, Verify / Reject inline, Bulk verify by confidence-threshold.
Primary actions: Verify / Reject → status change.
State variants: loading, empty, error.
Entry from: PA-ARE-002.
Exit to: PA-ARE-002.
Metering: n/a
Notes: Verified signals feed into public area page.

---

<a id="20-pa-scr"></a>
## 20. PA-SCR — Scoring configuration

### PA-SCR-001 — Scoring dimensions

Purpose: Manage scoring dimensions (Walkability, Amenities, Schools, Safety, etc.).
Route: `/admin/scoring`   Persona: PA (elevated)   Device: desktop   Mode: n/a
Current state: EXISTS — `AdminScoringPage.tsx`.
Workflow role: n/a
Key components: Table (dimension key, name, weight, active), Edit inline, Add Dimension.
Primary actions: Edit / add / reorder / activate-deactivate.
State variants: loading, error.
Entry from: SHR-NAV-002 admin.
Exit to: same.
Metering: n/a
Notes: Weight change forces re-score for all areas → warn + queue background job.

### PA-SCR-002 — AI configs

Purpose: Manage AI configs used by area intelligence (prompts, model, temp).
Route: `/admin/scoring/ai-configs`   Persona: PA (elevated)   Device: desktop   Mode: n/a
Current state: PARTIAL.
Workflow role: n/a
Key components: Table (config key, model, prompt version, active), Edit inline, Preview run.
Primary actions: Edit; Preview against a sample area.
State variants: loading, error.
Entry from: PA-SCR-001.
Exit to: PA-SCR-001.
Metering: `AI_AREA_INTELLIGENCE` on Preview.
Notes: Prompt is versioned; new versions get preview.

### PA-SCR-003 — Calculate / recalculate scores

Purpose: Kick off calculate + override actions.
Route: modal from PA-SCR-001 or PA-ARE-002   Persona: PA (elevated)   Device: desktop   Mode: n/a
Current state: PARTIAL.
Workflow role: n/a
Key components: Scope (all areas / one area / one dimension), Start button.
Primary actions: Start → background job → surfaces on PA-CMD-001.
State variants: loading, error, worker-busy.
Entry from: PA-SCR-001, PA-ARE-002.
Exit to: PA-CMD-001.
Metering: `AI_AREA_INTELLIGENCE` per area × dimension.
Notes: Cost-preview (est. AI cost) shown before start.

### PA-SCR-004 — Manual score override

Purpose: Override an AI-calculated score for one area × dimension.
Route: modal from PA-ARE-002   Persona: PA (elevated + approval)   Device: desktop   Mode: n/a
Current state: PARTIAL.
Workflow role: WF-27 role=Initiator (override requires approval per policy).
Key components: Current score, new score, reason, evidence.
Primary actions: Submit → PA-APR-001.
State variants: loading, error.
Entry from: PA-ARE-002.
Exit to: PA-APR-001.
Metering: n/a
Notes: Overrides are audited; area shows "manually overridden" badge on public page (SHR-PUB-004).

---

<a id="21-pa-wla"></a>
## 21. PA-WLA — WhatsApp Listings admin

### PA-WLA-001 — WhatsApp Listings health

Purpose: Module health: throughput, error rate, latency.
Route: `/admin/whatsapp-listings`   Persona: PA   Device: desktop   Mode: n/a
Current state: EXISTS — `AdminWhatsAppListingsPage.tsx`.
Workflow role: n/a
Key components: Health chip (green/amber/red), KPI cards (drafts today, approved-rate, avg latency, AI cost MTD), recent activity.
Primary actions: Drill (entitlements / usage / audit).
State variants: loading, degraded, error.
Entry from: PA-FIN-001 health.
Exit to: PA-WLA-002 / -003 / -004.
Metering: n/a
Notes: Rolls up backend `whatsapp-listings/interface` telemetry.

### PA-WLA-002 — Entitlements admin

Purpose: List + edit tenant entitlements to the WhatsApp Listings module.
Route: `/admin/whatsapp-listings/entitlements`   Persona: PA (elevated)   Device: desktop   Mode: n/a
Current state: PARTIAL.
Workflow role: n/a
Key components: Table (tenant, entitled, drafts/mo limit, current usage), inline Edit, Add Entitlement.
Primary actions: Edit; Add.
State variants: loading, error.
Entry from: PA-WLA-001.
Exit to: PA-WLA-001.
Metering: n/a
Notes: Overrides package quotas for this module.

### PA-WLA-003 — Grant credits (WhatsApp module)

Purpose: One-off credit grant for WhatsApp Listings specifically.
Route: modal from PA-WLA-002   Persona: PA (elevated)   Device: desktop   Mode: n/a
Current state: PARTIAL.
Workflow role: WF-08 role=Initiator (variant scoped to WA feature).
Key components: Tenant, amount, reason, Submit.
Primary actions: Submit → PA-CRD-005 flow.
State variants: loading, error.
Entry from: PA-WLA-002.
Exit to: PA-CRD-005.
Metering: n/a
Notes: Same two-person rule as generic grants.

### PA-WLA-004 — WhatsApp audit log

Purpose: Per-tenant audit of intake events (draft created, approved, discarded, reprocessed).
Route: `/admin/whatsapp-listings/audit`   Persona: PA   Device: desktop   Mode: n/a
Current state: PARTIAL.
Workflow role: role=Audit / history.
Key components: Table (timestamp, tenant, event, reference, actor).
Primary actions: Filter; export.
State variants: loading, empty, error.
Entry from: PA-WLA-001.
Exit to: same.
Metering: n/a
Notes: Rolls into PA-AUD-001.

---

<a id="22-pa-pva"></a>
## 22. PA-PVA — Property Valuation admin

### PA-PVA-001 — Pricing config home

Purpose: Landing for property-valuation admin surfaces.
Route: `/admin/pricing`   Persona: PA   Device: desktop   Mode: n/a
Current state: EXISTS — `PricingAdminPage.tsx`. Needs to expand into full sub-navigation for the 30+ backend routes.
Workflow role: n/a
Key components: Sub-nav (Sources | Currency rates | Normalization | Comparables review | Agent price reports | Recalc jobs | Trend runs), KPI cards.
Primary actions: Nav to sub-page.
State variants: loading.
Entry from: SHR-NAV-002 admin.
Exit to: PA-PVA-002..010.
Metering: n/a
Notes: This surface is under-implemented; brief §5.1 lists it but frontend has only a stub. Requires build-out to match backend surface.

### PA-PVA-002 — Sources CRUD

Purpose: Manage comparable-property data sources (external feeds).
Route: `/admin/pricing/sources`   Persona: PA (elevated)   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: n/a
Key components: Table (source name, type, ingest cadence, last-ingest, row count), CRUD.
Primary actions: Add / edit / disable.
State variants: loading, error.
Entry from: PA-PVA-001.
Exit to: same.
Metering: n/a
Notes: Sources feed the pricing analysis pipeline.

### PA-PVA-003 — Currency rates

Purpose: Manage FX rates used in cross-region price comparison.
Route: `/admin/pricing/currency-rates`   Persona: PA (elevated)   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: n/a
Key components: Table (base, quote, rate, source, updated-at), CRUD.
Primary actions: Add / edit.
State variants: loading, error.
Entry from: PA-PVA-001.
Exit to: same.
Metering: n/a
Notes: Some rates auto-fetched (source: 'ECB'), others manual (source: 'MANUAL').

### PA-PVA-004 — Normalization rules

Purpose: Rules that normalize raw comparable data (property_type mapping, area unit conversion, etc.).
Route: `/admin/pricing/normalization`   Persona: PA (elevated)   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: n/a
Key components: Rules table (input pattern, output value, priority, active).
Primary actions: Add / edit / reorder.
State variants: loading, error.
Entry from: PA-PVA-001.
Exit to: same.
Metering: n/a
Notes: Rule change triggers re-normalization job.

### PA-PVA-005 — CSV import

Purpose: Bulk import comparables from a CSV.
Route: modal from PA-PVA-001   Persona: PA (elevated)   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: n/a
Key components: File picker, column mapping, preview, Submit.
Primary actions: Submit → import job.
State variants: uploading, mapping-required, error.
Entry from: PA-PVA-001.
Exit to: PA-PVA-006 (job progress).
Metering: n/a
Notes: Large files → background job.

### PA-PVA-006 — Recalculation jobs

Purpose: Manage price recalculation jobs (kick, cancel, retry-failed).
Route: `/admin/pricing/recalc-jobs`   Persona: PA (elevated)   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: n/a
Key components: Jobs table (id, scope, started, status, progress %, errors), Cancel / Retry-failed inline.
Primary actions: Cancel, Retry failed.
State variants: loading, error.
Entry from: PA-PVA-001.
Exit to: same.
Metering: n/a
Notes: Long-running; use polling.

### PA-PVA-007 — Trend runs

Purpose: Kick off / manage area-price-trend calculation runs.
Route: `/admin/pricing/trends`   Persona: PA (elevated)   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: n/a
Key components: Runs table (period, scope, status), Start Trend Run.
Primary actions: Start; view results.
State variants: loading, error.
Entry from: PA-PVA-001.
Exit to: same.
Metering: n/a
Notes: Powers agent + agency pricing portfolios.

### PA-PVA-008 — Comparable reports review

Purpose: PA reviews user-submitted "this comparable is wrong" reports.
Route: `/admin/pricing/comparable-reports`   Persona: PA   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: WF-05 role=Approval queue.
Key components: Queue (reporter, comparable, reason, evidence, status), Approve / Reject / Request Info.
Primary actions: Row → PA-PVA-008b detail.
State variants: loading, empty, error.
Entry from: PA-PVA-001.
Exit to: PA-PVA-008b.
Metering: n/a
Notes: Approval removes/corrects the comparable and re-runs affected valuations.

### PA-PVA-008b — Comparable report detail

Purpose: One report shown for evaluation.
Route: `/admin/pricing/comparable-reports/:id`   Persona: PA (elevated)   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: WF-05 role=Approval detail.
Key components: Report metadata, comparable in question, side-by-side with report, Approve / Reject / Request Info.
Primary actions: Same as generic PA-APR-002.
State variants: loading, already-decided, error.
Entry from: PA-PVA-008.
Exit to: PA-PVA-008.
Metering: n/a
Notes: On Approve → corrective action + notification to reporter.

### PA-PVA-009 — Agent price reports review

Purpose: PA reviews user-submitted analysis of an agent's pricing decisions.
Route: `/admin/pricing/agent-reports`   Persona: PA   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: WF-06 role=Approval queue.
Key components: Same shape as PA-PVA-008.
Primary actions: Row → PA-PVA-009b.
State variants: loading, empty, error.
Entry from: PA-PVA-001.
Exit to: PA-PVA-009b.
Metering: n/a
Notes: These reports can affect agent public rating.

### PA-PVA-011 — Canonical property resolution admin (CORRECTED — added 2026-09-04)

Purpose: When two or more agency listings match the same physical property, `canonical_properties` groups them and picks a primary. PAs review edge cases: contested primary claims, algorithmic false-positive merges, false-negative dedup misses.
Route: `/admin/pricing/canonical`   Persona: PA   Device: desktop   Mode: n/a
Current state: MISSING — schema exists in `migration 003` (`canonical_properties`, `properties.canonical_id`), no admin UI.
Workflow role: WF-34 role=Approval queue (canonical-primary dispute resolution).
Key components: Canonical property queue (address, N sibling listings, current primary agency, dispute count), detail view (side-by-side sibling listings with photos + prices + mandates + freshness), decision panel (change primary / split canonical / merge canonicals / hold pending investigation).
Primary actions: Change primary; Split; Merge; Hold.
State variants: loading, empty, error.
Entry from: PA-PVA-001 sub-nav.
Exit to: PA-PVA-001.
Metering: n/a
Notes: Primary listing is chosen by policy — exclusive-mandate > lowest-price > most-recent. PA override captured with reason.

### PA-PVA-009b — Agent price report detail

Purpose: Detail of one agent-price report.
Route: `/admin/pricing/agent-reports/:id`   Persona: PA (elevated)   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: WF-06 role=Approval detail.
Key components: Reported agent, reporter, allegation, evidence, agent's history, Approve / Reject.
Primary actions: Approve → action on agent (warning, review); Reject → close.
State variants: loading, error.
Entry from: PA-PVA-009.
Exit to: PA-PVA-009.
Metering: n/a
Notes: Actions on agent audited; agent gets notification of outcome (WF-06 recipient screen lives in Agent matrix).

---

<a id="23-pa-mod"></a>
## 23. PA-MOD — Moderation queues

### PA-MOD-001 — Portal submissions queue (WF-03 Approval queue) (P0 — ANNOTATED 2026-09-04 per D9)

Purpose: PA moderates agent submissions to external real-estate portals (OLX, Property Finder, Bayut, Dubizzle).
Route: `/admin/submissions`   Persona: PA   Device: desktop   Mode: n/a
Current state: MISSING (backend routes exist: `GET /api/admin/submissions`, approve/reject). **Backend stub-submission prerequisite:** the portal publishers themselves are stubs (`lib/notifications/realestate.js` throws NOT_IMPLEMENTED — per backend placeholder audit P0-3). Until portal publishers are wired, submissions from AGT-PUB-005 populate the queue with `status=pending_moderation` + a stub portal-payload; PA approve/reject decisions are recorded but the downstream portal push is a no-op. Ship the queue against the stub path so the workflow chain is complete; wire real portal APIs as a parallel workstream. **Fulfills:** Agent portal submissions (AGT-PUB-005) + drives AGT-PUB-006 tracker + AGT-REC-001 outcome. **Environment badge:** inherits current env from PA-NAV-001.
Workflow role: WF-03 role=Approval queue.
Key components: Table (submitted-at, agent, tenant, portal, property → thumbnail, status: PENDING/APPROVED/REJECTED, priority), filters (portal, tenant, priority), keyboard nav (`J`/`K`, `A` approve, `R` reject, `E` open detail).
Primary actions: Row → PA-MOD-002; Bulk approve (low-risk); Assign.
State variants: loading, empty, error.
Entry from: PA-FIN-001 attention card, direct URL.
Exit to: PA-MOD-002.
Metering: n/a
Notes: SLA countdown per row (each portal has different response time expectations).

### PA-MOD-002 — Portal submission detail (WF-03 Approval detail)

Purpose: One submission shown for review with side-by-side of property data + portal preview.
Route: `/admin/submissions/:id`   Persona: PA (elevated for reject)   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: WF-03 role=Approval detail.
Key components: Two panes (Wingcaster property data / portal-formatted preview), issues panel (missing photo, price format wrong, description too short, etc. — automated linter), Approve / Reject with reason / Request Changes.
Primary actions: Approve → submits to portal API; Reject with reason → notification to agent → status change.
State variants: loading, already-decided, portal-api-down (warn), error.
Entry from: PA-MOD-001.
Exit to: PA-MOD-001.
Metering: n/a
Notes: Reject reasons drop from a controlled vocabulary — agent-friendly copy per reason.

### PA-MOD-003 — Submission audit trail

Purpose: History of all decisions on one submission.
Route: tab in PA-MOD-002   Persona: PA   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: role=Audit / history.
Key components: Timeline (submitted → reviewed → resubmitted → approved).
Primary actions: Export.
State variants: loading.
Entry from: PA-MOD-002.
Exit to: same.
Metering: n/a
Notes: Rolls into PA-AUD-001.

---

<a id="24-pa-acr"></a>
## 24. PA-ACR — Account recovery review

### PA-ACR-001 — Recovery queue (WF-04 Approval queue)

Purpose: PA reviews account-recovery requests from users who lost email access.
Route: `/admin/account-recovery`   Persona: PA (elevated)   Device: desktop   Mode: n/a
Current state: MISSING (backend routes exist).
Workflow role: WF-04 role=Approval queue.
Key components: Table (submitted-at, target user, current email on file, provided contact, urgency), filters, keyboard nav.
Primary actions: Row → PA-ACR-002.
State variants: loading, empty, error.
Entry from: PA-FIN-001 attention card.
Exit to: PA-ACR-002.
Metering: n/a
Notes: Critical for support ops; SLA-tracked.

### PA-ACR-002 — Recovery detail (WF-04 Approval detail)

Purpose: One recovery request with identity-proof review.
Route: `/admin/account-recovery/:id`   Persona: PA (elevated, two-person for sensitive accounts)   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: WF-04 role=Approval detail.
Key components: User identity data, target account (email, phone, agency, plan), submitted evidence (photos of ID etc.), decision panel (Approve / Reject / Request more info).
Primary actions: Approve → generates completion link, emails user (SHR-AUT-005c); Reject with reason → notification.
State variants: loading, already-decided, permission-denied.
Entry from: PA-ACR-001.
Exit to: PA-ACR-001.
Metering: n/a
Notes: Approval requires two-person for accounts with elevated privileges (owner of large agency etc.). PII displayed here must be masked by default; reveal on tap.

---

<a id="25-pa-ndl"></a>
## 25. PA-NDL — Notifications dead-letter

### PA-NDL-001 — Dead-letter queue

Purpose: Notifications that failed to send after retries; PA can retry or mark ignored.
Route: `/admin/notifications/dead-letter`   Persona: PA   Device: desktop   Mode: n/a
Current state: MISSING (backend routes exist: `GET /api/admin/notifications/dead-letter`, `POST .../retry-pending`).
Workflow role: n/a
Key components: Table (created-at, tenant, event type, channel, last-error, retry-count), filters (channel, error-family), Bulk retry.
Primary actions: Retry one; Bulk retry; Mark ignored (destructive).
State variants: loading, empty, error.
Entry from: PA-FIN-001 health.
Exit to: same.
Metering: n/a
Notes: Persistent DLQ items usually indicate misconfiguration — link to CFG.

---

<a id="26-pa-cls"></a>
## 26. PA-CLS — Comment classifier admin

### PA-CLS-001 — Classifier config

Purpose: View classifier config + trigger runs.
Route: `/admin/comment-classifier`   Persona: PA (elevated)   Device: desktop   Mode: n/a
Current state: MISSING (backend routes exist: `GET /api/comment-classifier/config`, `POST /api/admin/comment-classifier/run`).
Workflow role: n/a
Key components: Current config (model, thresholds, categories), Run Now, run history.
Primary actions: Edit config → save; Run Now.
State variants: loading, error.
Entry from: SHR-NAV-002.
Exit to: same.
Metering: `AI_CLASSIFY_COMMENT` per run.
Notes: Classifier changes require re-classification of open items — surface impact.

---

<a id="27-pa-usr"></a>
## 27. PA-USR — User management

### PA-USR-001 — Users search

Purpose: Search + list users platform-wide.
Route: `/admin/users`   Persona: PA   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: n/a
Key components: Search (email, phone, name), Table (name, email, primary tenant, roles, last-active, 2FA status), filters.
Primary actions: Row → PA-USR-002.
State variants: loading, error.
Entry from: SHR-NAV-002.
Exit to: PA-USR-002.
Metering: n/a
Notes: Search must be redacted-safe — no PII leaks in URL.

### PA-USR-002 — User detail (impersonate + promote)

Purpose: One user's profile + PA actions (promote to PA, ban, force-2FA-reset, impersonate).
Route: `/admin/users/:id`   Persona: PA (elevated + approval for promote/ban)   Device: desktop   Mode: n/a
Current state: PARTIAL (backend `POST /api/admin/users/:id/promote` exists).
Workflow role: WF-28 role=Initiator (user role change with approval).
Key components: Header (name, email, primary tenant, roles), tabs (Sessions | Recent activity | Notes | Audit), actions (Promote → approval; Demote → approval; Ban → approval; Force 2FA reset → step-up; Impersonate → step-up + banner in session).
Primary actions: Various admin actions each with own confirm + approval.
State variants: loading, error, permission-denied.
Entry from: PA-USR-001.
Exit to: PA-APR-001 for approval-gated actions.
Metering: n/a
Notes: Impersonation is high-risk; log every impersonation session to audit, show a persistent red banner in the impersonated session, and auto-expire after 30 min.

---

<a id="28-pa-goo"></a>
## 28. PA-GOO — Google API usage & budget

### PA-GOO-001 — Google usage dashboard

Purpose: Track Google Maps API budget + usage per feature.
Route: `/admin/google-usage`   Persona: PA   Device: desktop   Mode: n/a
Current state: PARTIAL (backend `/api/admin/google-usage` exists).
Workflow role: n/a
Key components: KPI (MTD spend, budget, projected month-end, headroom), chart (daily spend), per-endpoint breakdown, per-tenant top-consumers, Alert-threshold config.
Primary actions: Edit budget; edit alert threshold.
State variants: loading, error, over-budget (banner).
Entry from: PA-FIN-001 health, PA-ARE-002 (refresh signals cost preview).
Exit to: same.
Metering: n/a
Notes: Over-budget triggers automatic fallback to static maps site-wide.

---

<a id="29-pa-cmd"></a>
## 29. PA-CMD — Command Center (for ops)

### PA-CMD-001 — Command Center

Purpose: Cross-cutting ops feed: worker health, DLQ, exceptions, approvals, dunning, submissions queue.
Route: `/command-center`   Persona: PA (also usable by ops PA-scoped subset)   Device: desktop   Mode: n/a
Current state: EXISTS — `CommandCenterPage.tsx`. Also referenced from Agent matrix (agent-scoped variant).
Workflow role: n/a
Key components: Widget grid (workers status, DLQ count, open approvals, top exceptions, recent audit-flagged actions, tenant alerts).
Primary actions: Drill into any widget.
State variants: loading, degraded (any widget red), error.
Entry from: SHR-NAV-002, direct URL.
Exit to: Various PA screens per widget.
Metering: n/a
Notes: PA view of Command Center exposes ALL widgets; agents see only their own scope in the Agent-matrix variant.

---

<a id="30-pa-ins"></a>
## 30. PA-INS — Inspector QA

### PA-INS-001 — Inspector queue

Purpose: Field inspectors (or PA on their behalf) manage on-site inspection assignments.
Route: `/inspector`   Persona: PA (Inspector role subset)   Device: desktop + mobile   Mode: n/a
Current state: EXISTS — `InspectorPage.tsx`.
Workflow role: n/a
Key components: Assignments list (property, area, status, deadline), Start button, Submissions list.
Primary actions: Start → PA-INS-002; view submissions.
State variants: loading, empty, error.
Entry from: SHR-NAV-002.
Exit to: PA-INS-002.
Metering: n/a
Notes: The Inspector role may deserve promotion to a peer persona later (dedicated field-worker surface).

### PA-INS-002 — Inspection submit form

Purpose: Inspector submits findings for one assignment.
Route: `/inspector/:id/submit`   Persona: PA (Inspector)   Device: desktop + mobile   Mode: n/a
Current state: PARTIAL.
Workflow role: n/a
Key components: Assignment metadata, photos upload, notes, dimensions checklist, signature, Submit.
Primary actions: Submit → status change; back to queue.
State variants: loading, offline (queue for retry), error.
Entry from: PA-INS-001.
Exit to: PA-INS-001.
Metering: `INSPECTION_SUBMIT` if metered (verify features.js).
Notes: Offline queue important — inspectors may be in low-signal areas.

---

## Summary

| Section | Screens | EXISTS | PARTIAL | MISSING |
|---|---|---|---|---|
| PA-FIN | 5 | 4 | 1 | 0 |
| PA-CRD | 9 | 3 | 3 | 3 |
| PA-FAC | 4 | 1 | 2 | 1 |
| PA-CON | 3 | 1 | 1 | 1 |
| PA-PRC | 3 | 1 | 1 | 1 |
| PA-PKG | 7 | 4 | 2 | 1 |
| PA-SUB | 6 | 2 | 2 | 2 |
| PA-INV | 5 | 1 | 3 | 1 |
| PA-PAY | 3 | 0 | 2 | 1 |
| PA-ACC | 3 | 0 | 2 | 1 |
| PA-VEN | 5 | 1 | 2 | 2 |
| PA-REC | 4 | 1 | 2 | 1 |
| PA-EXC | 2 | 1 | 1 | 0 |
| PA-APR | 6 | 1 | 2 | 3 |
| PA-DUN | 5 | 0 | 1 | 4 |
| PA-AUD | 2 | 1 | 1 | 0 |
| PA-CFG | 5 | 0 | 2 | 3 |
| PA-TPL | 4 | 4 | 0 | 0 |
| PA-ARE | 3 | 1 | 2 | 0 |
| PA-SCR | 4 | 1 | 2 | 1 |
| PA-WLA | 4 | 1 | 3 | 0 |
| PA-PVA | 10 | 1 | 0 | 9 |
| PA-MOD | 3 | 0 | 0 | 3 |
| PA-ACR | 2 | 0 | 0 | 2 |
| PA-NDL | 1 | 0 | 0 | 1 |
| PA-CLS | 1 | 0 | 0 | 1 |
| PA-USR | 2 | 0 | 1 | 1 |
| PA-GOO | 1 | 0 | 1 | 0 |
| PA-CMD | 1 | 1 | 0 | 0 |
| PA-INS | 2 | 1 | 1 | 0 |
| **Total** | **114** | **31** | **38** | **45** |

**Approval workflows referenced (all bound to `fin.approval_requests`, converging on PA-APR-001):**

| WF | Name | Initiator | Approver | Key screens |
|---|---|---|---|---|
| WF-03 | Portal submission moderation | Agent | PA | Initiator lives in Agent matrix; PA-MOD-001, PA-MOD-002, PA-MOD-003 |
| WF-04 | Account recovery review | Public user | PA (two-person for privileged) | SHR-AUT-005..005c, PA-ACR-001, PA-ACR-002 |
| WF-05 | Comparable price report | Agent | PA | PA-PVA-008, PA-PVA-008b (initiator + recipient in Agent matrix) |
| WF-06 | Agent price report | Agent | PA | PA-PVA-009, PA-PVA-009b |
| WF-07 | Package publishing (two-person) | PA (author) | PA (second approver) | PA-PKG-003..007 + PA-APR-001, PA-APR-004 |
| WF-08 | Credit grant approval | PA | PA (second approver) | PA-CRD-005, PA-CRD-006, PA-APR-002, PA-APR-004 |
| WF-09 | Reconciliation drift resolution | System | PA | PA-REC-002, PA-REC-004 |
| WF-10 | Dunning progression | System | PA | PA-DUN-001..005 |
| WF-13 | Change plan | Tenant or PA | System (with elevation) | PA-SUB-003, PA-SUB-005; tenant screens in Agent/Agency matrices |
| WF-14 | Billing period close | PA | PA (two-person for hard) | PA-ACC-002, PA-ACC-003 |
| WF-15 | Accounting period close | PA | PA (two-person for hard) | PA-ACC-002 |
| WF-17 | GDPR erasure | PA | PA (two-person) | PA-CRD-007 (+ Agent matrix initiator) |
| WF-18 | Facility open/adjust | PA | PA (two-person above threshold) | PA-FAC-003, PA-FAC-004 |
| WF-19 | Contract activation | PA | PA (two-person for large tenants) | PA-CON-003 |
| WF-20 | Price change | PA | PA (two-person per policy) | PA-PRC-003 |
| WF-21 | Debit note | PA | PA (two-person) | PA-INV-004 |
| WF-22 | Vendor statement reconcile | PA | System (with elevation) | PA-VEN-004, PA-VEN-005 |
| WF-23 | API key rotation | PA | PA (two-person) | PA-CFG-003 |
| WF-24 | PSP config change | PA | PA (two-person) | PA-CFG-005 |
| WF-25 | Template publish | PA | PA (two-person for prod) | PA-TPL-002 |
| WF-26 | Area signal moderation | AI (auto) | PA | PA-ARE-003 |
| WF-27 | Score override | PA | PA (two-person) | PA-SCR-004 |
| WF-28 | User role change (promote/ban) | PA | PA (two-person) | PA-USR-002 |

**Highest-impact PA gaps** (blocking enterprise-grade platform ops):
1. **PA-MOD-*** (portal submission moderation) — backend routes exist but no UI. Cannot ship portal publishing at scale without this.
2. **PA-ACR-*** (account recovery review) — backend exists, no UI. Support ops blocker.
3. **PA-DUN-*** (dunning cases) — 4 of 5 screens MISSING. Cannot collect past-due at scale.
4. **PA-CFG-003 / PA-CFG-005** (key rotation, PSP config) — foundational for Paddle integration.
5. **PA-PVA-002..009b** (property valuation admin) — 9 MISSING screens; backend has 30+ routes, frontend has one stub.
6. **PA-CRD-005/-006 outcomes** — credit grant Initiator ↔ Approval Detail ↔ Outcome missing dedicated screens (falls through to generic PA-APR-002).
7. **PA-USR-*** (user management) — no user-search or user-detail admin UI. Support ops gap.
8. **PA-NDL-001** (dead-letter) — no UI for a critical health tool.
