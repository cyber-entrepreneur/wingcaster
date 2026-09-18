# Go-Live Critical Manifest — WingCaster

_Generated 2026-09-18 · Go-live (public launch): **2026-09-30** (~12 days out)._

This manifest partitions all **340 formally-defined screens** into **launch-blocker** (must be live-and-working Sept 30) vs **fast-follow** (can ship after launch), and isolates the launch-blockers that are still PARTIAL or MISSING — the real remaining launch work.

Primary input: `docs/design/SCREEN_GAP_RECONCILIATION.md` (git-truth built/partial/missing, generated 2026-09-17). Launch-blocker PARTIAL/MISSING verdicts were re-verified against the current working tree; corrections are called out inline with file-path evidence.

## The three launch constraints (these set the edges)

1. **Paid from day one.** Customers check out and pay via Paddle at launch. The billing/checkout path **and** a minimum of admin billing visibility (see subscriptions, see invoices, handle a failed payment) are launch-blockers. Deep finance ops (dunning, accounting periods, reconciliation, vendor statements, facilities) beyond that minimum are fast-follow.
2. **Both agents AND agencies onboard at launch.** Agency management (members, roles, applications, ownership transfer) is launch-critical.
3. **Lebanon only (single territory).** Multi-territory / Gulf portal + disclosure config is fast-follow; only Lebanon territory/portal config is launch-critical.

## Classification rule

A **launch-blocker** is anything a real agent or agency, or the ops team supporting paid Lebanese customers, cannot operate without on day one: daily-driver agent flows; agency onboarding/management; auth / MFA / onboarding; the paid billing/checkout path + minimum admin billing visibility; and Lebanon territory/portal config. **Fast-follow** is the deep PA finance/ops back-office, multi-territory, advanced reporting, white-label builder depth, embeddable widgets, and anything consumer-portal / Bazaar.

---

## 1. Headline numbers

| Metric | Count |
|---|---:|
| **Launch-blockers (total)** | **236** |
| — BUILT (verify only) | 206 |
| — PARTIAL (remaining work) | 18 |
| — MISSING (remaining work) | 12 |
| **Remaining launch work (PARTIAL + MISSING blockers)** | **30** |
| **Fast-follow (total)** | **104** |
| Grand total | 340 |

Launch-blocker built/partial/missing by persona:

| Persona | Blocker BUILT | Blocker PARTIAL | Blocker MISSING | Blocker total | Fast-follow |
|---|---:|---:|---:|---:|---:|
| SHR (Shared) | 46 | 0 | 2 | 48 | 7 |
| AGT (Agent) | 79 | 4 | 1 | 84 | 14 |
| AGN (Agency) | 28 | 4 | 5 | 37 | 30 |
| PA (Platform Admin) | 53 | 10 | 4 | 67 | 53 |
| **TOTAL** | **206** | **18** | **12** | **236** | **104** |

**The 12-day punch list is 30 screens** (Section 3). Note three agent screens the 2026-09-17 reconciliation marked MISSING are now BUILT (verified below), so they are already off the punch list.

### Cross-cutting billing risk (verify before locking scope)
- **Checkout card-collection is not built.** `web/src/components/credits/TopUpDialog.tsx` says outright: "the provider checkout is a separate workstream" — the top-up flow only *requests* a top-up (`api.requestTenantTopUp`) and collects no card. The backend Paddle *webhook* credit path exists (`backend/src/lib/credits/tenant-routes.js` → `completeTopUpFromWebhook`, source `topup.paddle`), but the customer-facing Paddle Checkout that takes money is absent. **This is the single biggest paid-from-day-one gap and is not represented by any one screen ID.**
- **Cancel / manage-payment-method for tenants** appear delegated to a hosted Paddle billing portal via `api.createBillingPortalSession` (used in `web/src/pages/settings/BillingPage.tsx`, "Manage subscription"). The solo-agent surface (`MySubscriptionPage.tsx`) has only a "Change plan" link and no cancel/portal entry. Verify the portal is wired to live Paddle and reachable for solo agents before treating AGT-SUB-004 / AGN-SUB-004 / AGN-SUB-005 as covered.

---

## 2. Code-verified corrections to the reconciliation

| ID | Reconciliation verdict | Verified verdict | Evidence |
|---|---|---|---|
| AGT-LST-010 | MISSING | **BUILT** | `web/src/components/listings/OffersPanel.tsx`, `OffersComparisonChart.tsx` (PR #224) |
| AGT-PUB-007 | MISSING | **BUILT** | `web/src/components/publishing/SchedulePublishDialog.tsx` (PR #226) |
| AGT-WLA-004 | MISSING | **BUILT (inline)** | `web/src/pages/agent/whatsapp-listings/AgentWhatsAppListingsPage.tsx` — `getWhatsAppListingsAgentSettings` / `updateWhatsAppListingsAgentSettings` |

All three are launch-blockers that are now done — reflected as BUILT in the headline counts.

---

## 3. Launch-blocker work list — the 12-day punch list (PARTIAL + MISSING only)

`[P]` = PARTIAL, `[M]` = MISSING. **30 screens.**

### Auth / legal (paid-launch prerequisites) — 2
| ID | Name | State | What's needed |
|---|---|---|---|
| SHR-LEG-003 | Refund Policy | [M] | Static refund-policy page — a Paddle merchant-of-record requirement for taking payment. |
| SHR-LEG-004 | Cookie / Data Processing Notice | [M] | Static cookie/DPN page — GDPR/consent requirement for a public paid launch. |

### Agent daily-driver — 3
| ID | Name | State | What's needed |
|---|---|---|---|
| AGT-LAI-001 | Generate description | [P] | Wire the AI-generate affordance on the listing composer into a real generate call/result (currently affordance-only). |
| AGT-LAI-002 | Refine / preview generated content | [P] | Complete regenerate/preview loop for AI copy before publish. |
| AGT-OPP-002 | Opportunity detail | [P] | Add routed `/opportunities/:id` detail view (pipeline currently has no detail route). |

### Billing / checkout (agent + agency) — 6
| ID | Name | State | What's needed |
|---|---|---|---|
| AGT-SUB-004 | Cancel subscription (solo agent) | [M] | Self-service cancel for solo agents (confirm hosted-portal deep-link or build native cancel; `MySubscriptionPage` has none). |
| AGT-SUB-005 | Plan change outcome | [P] | Confirmation/receipt state after a solo plan change. |
| AGN-CRD-003 | Top-up outcome | [P] | Success/failure receipt after the Paddle top-up checkout completes. |
| AGN-SUB-003 | Change plan outcome | [P] | Confirmation/receipt state after an agency plan change. |
| AGN-SUB-004 | Cancel subscription (agency) | [M] | Agency self-service cancel (verify hosted-portal coverage or build). |
| AGN-SUB-005 | Manage payment method | [M] | Update/replace card (verify hosted-portal coverage or build) — required to recover failed payments. |

### Admin billing minimum (ops supporting paid customers) — 11
| ID | Name | State | What's needed |
|---|---|---|---|
| PA-FIN-003 | Tenant detail | [P] | Routed tenant-detail view for support (list exists, no `:id` detail). |
| PA-CRD-002 | Wallet detail | [P] | Complete wallet-detail drill-down for credit support. |
| PA-CRD-006 | Grant outcome / receipt | [P] | Finish grant-outcome/receipt surface after an admin credit grant. |
| PA-SUB-003 | Preview change plan | [P] | Complete admin proration-preview before applying a plan change. |
| PA-SUB-004 | Create subscription | [P] | Finish admin manual subscription create (comp/manual onboarding). |
| PA-SUB-005 | Change plan outcome | [P] | Confirmation/receipt after an admin plan change. |
| PA-SUB-006 | Cancel subscription | [P] | Complete admin-side cancel action on subscription detail. |
| PA-INV-002 | Invoice detail | [P] | Routed invoice-detail view (list exists, no detail). |
| PA-INV-003 | Create credit note | [P] | Finish credit-note issuance (needed for refunds/adjustments on failed/disputed payments). |
| PA-PAY-001 | Payments index | [M] | A place to see individual payments incl. failures (today only `dunning_status`/`ar_outstanding` columns on Tenants + Overview counters). |
| PA-PAY-002 | Payment detail + apply | [M] | View a payment and apply/re-attempt it — the core "handle a failed payment" action. |

### Agency management — 5
| ID | Name | State | What's needed |
|---|---|---|---|
| AGN-MEM-004 | Pending invites list | [P] | Dedicated pending-invites tab (invite send exists; no pending view/resend/revoke). |
| AGN-MEM-009 | End membership (offboarding) | [M] | Remove/offboard a member — no removal path exists today. |
| AGN-CRD-005 | Allocate credits to agent(s) | [M] | General wallet credit allocation to members (only the WhatsApp-module allocation exists). |
| AGN-INV-002 | Invoice detail | [P] | Routed tenant invoice-detail view. |
| AGN-SET-003 | Contact & business info | [M] | Agency contact/business-info settings for onboarding. |

### Lebanon territory / portal config + user-admin — 3
| ID | Name | State | What's needed |
|---|---|---|---|
| PA-ARE-002 | Area detail + editor | [P] | Routed area detail/editor for maintaining Lebanon areas (index exists, no `:id`). |
| PA-USR-001 | Users search | [M] | Platform user search — ops cannot locate a Lebanese customer's user today. |
| PA-USR-002 | User detail (impersonate + promote) | [M] | User-detail with impersonate/promote — core day-one support action. |

_(PA-USR-001/002 are user-admin/support essentials grouped here with the ops-config cluster; they are the two user-admin blockers.)_

---

## 4. Launch-blocker BUILT — done, needs verification only (206)

These are already implemented per git-truth (incl. the three corrections in Section 2). They need launch-verification (smoke/QA), not build work.

**Shared (46):** SHR-AUT-001, -002, -002b, -003, -003b, -004, -005, -005b, -005c, -006; SHR-MFA-001…-007 (incl. -004b); SHR-NAV-001…-008 (incl. -004b); SHR-ERR-001, -003, -004, -006; SHR-LEG-001, -002; SHR-PUB-001, -002, -003, -004, -005, -005b; SHR-SET-001, -002, -003, -004, -005, -005c, -005d.

**Agent (79):** AGT-ONB-001…-005; AGT-DSH-001, -002; AGT-LST-001…-012 (incl. **-010 verified**); AGT-PUB-001…-007 (incl. **-007 verified**); AGT-WLA-001, -002, -003, **-004 (verified)**; AGT-NVL-001; AGT-CTC-001, -002, -003, -006, -007; AGT-OPP-001, -001b, -003; AGT-TSK-001; AGT-CMP-001, -002, -003; AGT-TPL-001, -002; AGT-INB-001, -002, -003, -005; AGT-HTX-001, -002; AGT-APR-001, -002, -003, -004, -005; AGT-APP-001; AGT-CMD-001; AGT-SUB-001, -002, -003, -006, -007; AGT-NPF-001, -002; AGT-CHN-001, -002; AGT-ROU-001; AGT-INT-001; AGT-WLB-001; AGT-REC-001…-006; AGT-SET-001, -002.

**Agency (28):** AGN-DSH-001, -002; AGN-MEM-001, -002, -002b, -003, -005, -006, -007; AGN-ROL-001, -002; AGN-PRC-001, -004; AGN-CRD-001, -002, -006; AGN-SUB-001, -002; AGN-INV-001, -003; AGN-ROU-001, -003; AGN-WLA-001, -002; AGN-SET-004, -005, -005b; AGN-AUD-001.

**Platform Admin (53):** PA-NAV-001; PA-FIN-001, -002, -004, -005; PA-CRD-001, -005; PA-PKG-001…-005; PA-SUB-001, -002; PA-INV-001; PA-APR-001, -002, -003, -005, -006; PA-AUD-001; PA-CFG-001…-007; PA-TPL-001…-004; PA-ARE-001; PA-SCR-001; PA-WLA-001, -002; PA-PVA-001, -002, -003, -004, -005, -006, -007, -008, -008b, -009, -009b; PA-MOD-001, -002; PA-ACR-001, -002; PA-CMD-001; PA-INS-001.

---

## 5. Fast-follow summary (104 — grouped, can ship after Sept 30)

| Domain | Screens | Note |
|---|---:|---|
| **PA deep finance / ops back-office** | ~46 | Dunning (PA-DUN, 5), accounting periods (PA-ACC, 3), reconciliation (PA-REC, 4), vendor statements (PA-VEN, 5), facilities (PA-FAC, 4), contracts (PA-CON, 3), price-version editing (PA-PRC, 3 of index built), credit lots/janitor/mirror/GDPR (PA-CRD-003/-004/-007/-008/-009), exceptions detail, dead-letter (PA-NDL), classifier (PA-CLS), Google usage (PA-GOO), scoring depth (PA-SCR-002/-003/-004), package deprecate/feature-registry (PA-PKG-006/-007), audit retention, approval audit trail, WhatsApp grant/audit, inspector submit, PA-MOD-003, PA-INV-004/-005, PA-PAY-003, canonical-property admin (PA-PVA-011), area signals. |
| **Agency advanced reporting** | 8 | AGN-REP-001…-008 (reports home, listings perf, funnel, leaderboard, credit spend, campaign perf, revenue attribution, custom builder). |
| **Agency white-label depth + widgets** | 7 | AGN-WLB-001/-002/-003/-004/-005 (builder depth), AGN-WID-001/-002 (embeddable widgets). |
| **Agency external sync / import** | 4 | AGN-SYN-001…-004 (external-source connections + import jobs). |
| **Agency member/pricing/settings depth** | 9 | AGN-MEM-008 (pause), AGN-CRD-004 (allocation rules), AGN-PRC-002/-003 (bulk price, comparables browser), AGN-ROU-002 (rule editor), AGN-TPL-001/-002 (agency templates), AGN-SET-001/-002/-006, AGN-PUB-001. |
| **Agent secondary flows** | 14 | Merge/export contacts, task detail+reminders, campaign detail+saved searches, closed-txn import, assign conversation, my-reports, personal channels, WhatsApp analytics, reviews, disposition/canonical/seller-report (AGT-LST-013/-014/-015). |
| **Consumer / marketing / Bazaar** | 4 | SHR-PUB-006 (marketing home), SHR-PUB-007 (public pricing — separate marketing-website workstream), SHR-INT-001/-002 (Bazaar opt-in surfaced, analytics). |
| **Shared error/settings polish** | 2 | SHR-ERR-002 (403; generic fallback covers), SHR-ERR-005 (maintenance banner), SHR-SET-005b (delete-account email step). |

_Multi-territory / Gulf portal + disclosure config is out of scope for launch (Lebanon-only) and lives inside the PA-CFG surfaces, which are BUILT for Lebanon; no separate Gulf screens are counted as blockers._

---

_Method note: verdicts derive from `SCREEN_GAP_RECONCILIATION.md` (git-truth, 2026-09-17); every PARTIAL/MISSING screen classified as a launch-blocker was re-checked against `web/src/pages/`, `web/src/components/`, `web/src/api/client.ts`, and `backend/src/` on 2026-09-18. Counts reconcile to 340 (236 blocker + 104 fast-follow)._
