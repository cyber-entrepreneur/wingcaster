# Wingcaster — Screen Matrix: Agency

Conventions, screen-entry format, and workflow subtype vocabulary defined in `SCREEN_MATRIX_SHARED.md §0`. Feedback capture in `SCREEN_MATRIX_FEEDBACK.md`.

**Scope characteristics** for every screen in this document unless otherwise noted:
- Device: **desktop 1440×900 only for v1.** Mobile-responsive treatment is a Phase 2 concern (per 2026-09-04 review — original "usable at mobile 375px" claim was aspirational, not designed). A small-viewport gate at < 1024px shows "Please use a desktop browser for the agency workspace" until mobile variants are designed.
- Locale: English + Arabic RTL (first-class)
- Theme: light default, dark supported
- Density: medium — tables preferred over cards for lists; bulk actions expected; keyboard shortcuts on power surfaces
- Auth: 4 canonical roles (owner / admin / member / guest) + capability packs (finance / marketer / readonly) per §Roles below; elevation via `SHR-MFA-007` for sensitive writes

Written 2026-09-03. Reflects `origin/main @ b989e6b`.

---

## Roles inside an agency (CORRECTED 2026-09-04 against actual code)

**Backend code truth** (`migration 028_tenant_authorization_foundation.sql`): `tenant_memberships.role` CHECK constraint enforces exactly four values: `owner`, `admin`, `member`, `guest`. `affiliation_mode` is a separate axis with values `personal`, `exclusive`, `non_exclusive`.

**Every user always has TWO tenant contexts simultaneously:**
1. A **personal tenant** (`personal:<user_id>`), auto-provisioned at signup by `identity.js :: createAgentAccount`. Role = `owner` in this tenant, always. `affiliation_mode = 'personal'`.
2. Zero or more **agency memberships** (`agency:<agency_id>`). One may be `exclusive` (capped at ONE active exclusive membership per user) OR multiple may be `non_exclusive`.

**Canonical roles in code:**

| Role | affiliation_mode | Sees / can do |
|---|---|---|
| **owner** | personal OR exclusive | Full control of the tenant; only role that can transfer ownership or delete the tenant |
| **admin** | personal OR exclusive | Full operational control below ownership |
| **member** | exclusive OR non_exclusive | Baseline operational access; refined by `capabilities` JSONB per membership |
| **guest** | non_exclusive only | Bounded read/participate access; the constraint `tenant_memberships_guest_mode_check` enforces this |

**RBAC DECISION 2026-09-04 → Path B (capabilities JSONB on `member` role).** No schema change. `Finance` / `Marketer` / `Read-Only` are **capability packs** applied on top of `role = 'member'`. `tenant_memberships.capabilities` JSONB carries the pack identity + individual capability flags. UI surfaces the pack name as a role label but under the hood every non-owner/admin member is `role='member'` + one of these packs.

**Capability packs (canonical definitions):**

| Pack (UI label) | `capabilities` JSONB shape | What it enables |
|---|---|---|
| **Finance** | `{"pack":"finance","billing_write":true,"invoices_read":true,"credits_admin":true,"subscription_write":true}` | Manage top-ups + credit allocation + subscription changes + invoice download. No listings/campaigns access. |
| **Marketer** | `{"pack":"marketer","campaigns_write":true,"templates_write":true,"listings_write":true,"publishing":true,"widgets_write":true,"white_label_write":true}` | Author campaigns + templates + widgets + white-label site + publishing. No billing / no member management. |
| **Read-Only** | `{"pack":"readonly","read_all":true,"write":false}` | Everything visible via read APIs. Write actions blocked at server + hidden in UI. Suitable for auditors, external stakeholders. |
| **Custom** | `{"pack":"custom", ...individual flags}` | Owner/admin can override the pack templates and grant/deny individual capabilities. |

`owner` and `admin` roles bypass capability checks (full access). `guest` role is bounded to specific resource IDs listed in its `capabilities` (e.g., `{"guest_of":["listing:abc","conversation:xyz"]}`).

**Server-side enforcement:** every write route reads `tenant_memberships.capabilities` for the acting user in the current tenant context and gates the action. UI hides the CTA when the capability is missing, but the server never trusts the client — every write is re-checked. Capability-check helpers live in `lib/authz.js` (already exists).

**Multi-agency membership implication:** an Agent user may be `non_exclusive` member of Agency A AND `non_exclusive` member of Agency B simultaneously with DIFFERENT capability packs in each. The UI needs a persistent **tenant switcher** (see `SHR-NAV-008` in the Shared matrix) so the user selects which tenant context they're operating in. Every Agency screen in this doc renders under a specific selected agency tenant — switching tenants may reveal/hide screens per the capability pack in that specific tenant.

**Multi-agency membership implication:** an Agent user may be `non_exclusive` member of Agency A AND `non_exclusive` member of Agency B simultaneously. The UI needs a persistent **tenant switcher** (see `SHR-NAV-008` in the Shared matrix) so the user selects which tenant context they're operating in. Every Agency screen in this doc renders under a specific selected agency tenant — switching tenants may reveal/hide screens per membership role in that specific tenant.

---

## Domain codes used in this document

| Code | Domain |
|---|---|
| DSH | Agency dashboard |
| MEM | Members & applications (team management) |
| ROL | Roles & permissions |
| PRC | Pricing portfolio (aggregate market pricing across all agency listings) |
| CRD | Credits + allocation (agency wallet + per-agent allocation) |
| SUB | Subscription (agency plan + cycles + upgrade) |
| INV | Invoices (agency's own invoices + payments) |
| WLB | White-label site builder |
| WID | Widget builder |
| ROU | Routing rules (lead routing between agents) |
| SYN | Sync connections (MLS / portal import) |
| TPL | Templates management (agency-scoped message templates) |
| WLA | WhatsApp Listings entitlements (per-agent allocation of module access) |
| REP | Reports (agency-wide analytics) |
| SET | Agency settings (identity, branding, policies) |
| AUD | Audit (agency action history) |
| PUB | Public agency profile customization |

---

## Table of contents

- [1. AGN-DSH — Agency dashboard](#1-agn-dsh)
- [2. AGN-MEM — Members & applications](#2-agn-mem)
- [3. AGN-ROL — Roles & permissions](#3-agn-rol)
- [4. AGN-PRC — Pricing portfolio](#4-agn-prc)
- [5. AGN-CRD — Credits & allocation](#5-agn-crd)
- [6. AGN-SUB — Subscription](#6-agn-sub)
- [7. AGN-INV — Invoices & payments](#7-agn-inv)
- [8. AGN-WLB — White-label site builder](#8-agn-wlb)
- [9. AGN-WID — Widget builder](#9-agn-wid)
- [10. AGN-ROU — Routing rules](#10-agn-rou)
- [11. AGN-SYN — Sync connections](#11-agn-syn)
- [12. AGN-TPL — Templates management](#12-agn-tpl)
- [13. AGN-WLA — WhatsApp Listings entitlements](#13-agn-wla)
- [14. AGN-REP — Reports](#14-agn-rep)
- [15. AGN-SET — Agency settings](#15-agn-set)
- [16. AGN-AUD — Audit log](#16-agn-aud)
- [17. AGN-PUB — Public profile customization](#17-agn-pub)
- [Summary](#summary)

---

<a id="1-agn-dsh"></a>
## 1. AGN-DSH — Agency dashboard

### AGN-DSH-001 — Agency dashboard

Purpose: One-glance agency health: MRR, active agents, active listings, credit balance, top performers, alerts.
Route: `/agency`   Persona: Agency (Owner / Admin / Read-Only)   Device: desktop 1440 primary   Mode: n/a
Current state: EXISTS — `web/src/pages/AgencyManagementPage.tsx`. Needs RTL + mobile pass + role-scoped KPI filtering.
Workflow role: n/a
Key components: KPI strip (**CORRECTED 2026-09-04 — `MRR` removed as ambiguous; replaced with metrics that make sense to an agency owner**): Active listings under management, Listings closed this month, Total leads MTD, Active agents / total agents, Credits balance + days-until-depletion at current burn, Avg agent first-response time, Bazaar-driven lead share %. Attention cards (Pending applications count → AGN-MEM-002, Low-balance warning, At-risk agents — quota > 90%, Expiring listings, Rejected portal submissions → user's recipient view), top-performer leaderboard (with revenue attribution from closed-transactions), recent activity feed.
Primary actions: Drill into any card, adjust date range (7d / 30d / 90d / QTD / YTD), export report.
State variants: loading, empty (brand-new agency: onboarding checklist), error, degraded.
Entry from: `SHR-NAV-001` post-auth routing for Agency persona.
Exit to: AGN-MEM-002, AGN-CRD-001, AGN-REP-001, agent detail links.
Metering: n/a
Notes: Empty-state doubles as onboarding: "Invite your first agent", "Create your public site", "Upload your logo", "Import listings from your MLS" — each links to the relevant setup screen.

### AGN-DSH-002 — Onboarding checklist (first-run)

Purpose: Progressive-disclosure setup for a brand-new agency.
Route: overlay/panel on AGN-DSH-001 when < 30% setup complete   Persona: Agency Owner   Device: responsive   Mode: n/a
Current state: MISSING.
Workflow role: n/a
Key components: 6-8 step checklist (Upload logo & branding → AGN-SET-002, Invite team → AGN-MEM-003, Set up routing → AGN-ROU-001, Publish public site → AGN-WLB-001, Connect a payment method → AGN-SUB-004, Import existing listings → AGN-SYN-002), progress ring (X of N complete).
Primary actions: Tap step → deep-link with return-to-checklist.
State variants: partially complete (persists across sessions), fully complete (dismisses with animation).
Entry from: AGN-DSH-001 automatic display.
Exit to: Each step's target screen.
Metering: n/a
Notes: Never blocks the user — always dismissible with "I'll finish this later".

---

<a id="2-agn-mem"></a>
## 2. AGN-MEM — Members & applications

### AGN-MEM-001 — Members list

Purpose: List every agent in the agency with role, activity, and revenue attribution.
Route: `/agency/members`   Persona: Agency (owner / admin / member+finance-pack / member+readonly-pack)   Device: desktop 1440   Mode: n/a
Current state: PARTIAL — embedded in `AgencyManagementPage.tsx`; needs a dedicated route and richer table.
Workflow role: n/a
Key components: Table (avatar, name, email, phone, role, joined-date, last-active, active listings, MTD leads, MTD revenue attribution, quota consumption %, status), filters (role, active/paused, quota-tier), search, bulk actions (message, change-role, deactivate), Invite button.
Primary actions: Row → AGN-MEM-006 (member detail); Invite → AGN-MEM-003; Bulk actions.
State variants: loading, empty (invite CTA), error.
Entry from: AGN-DSH-001, `SHR-NAV-002`.
Exit to: AGN-MEM-006, AGN-MEM-003.
Metering: n/a
Notes: Quota % across all agents helps spot allocation problems. Sortable by revenue attribution.

### AGN-MEM-002 — Applications queue (WF-02 Approval queue)

Purpose: Agency Admin/Owner reviews agents who applied to join.
Route: `/agency/applications`   Persona: Agency (Owner / Admin)   Device: desktop 1440   Mode: n/a
Current state: MISSING dedicated page (backend `GET /api/agencies/:id/applications` exists).
Workflow role: WF-02 role=Approval queue (agent-joins-agency flow).
Key components: Table (submitted-at, applicant name, city, experience, current agency, message), filters (city, experience-range), keyboard nav (`J`/`K`, `A` approve, `R` reject), bulk actions.
Primary actions: Row → AGN-MEM-002b; Bulk approve / reject.
State variants: loading, empty ("No applications right now"), error.
Entry from: AGN-DSH-001 attention card, `SHR-NAV-002`.
Exit to: AGN-MEM-002b.
Metering: n/a
Notes: Applications include the applicant's Wingcaster profile (listings count, transaction history if opted in) — helps evaluate.

### AGN-MEM-002b — Application detail (WF-02 Approval detail)

Purpose: One application shown for evaluation.
Route: `/agency/applications/:id`   Persona: Agency (Owner / Admin)   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: WF-02 role=Approval detail.
Key components: Applicant profile (photo, name, contact, current agency badge if any, bio, listings preview, transaction count, review score), Message field, Approve with initial role dropdown, Reject with reason.
Primary actions: Approve → creates membership → notification to applicant (WF-02 recipient screen lives in Agent matrix); Reject with reason.
State variants: loading, already-decided, error.
Entry from: AGN-MEM-002.
Exit to: AGN-MEM-002 with success toast, AGN-MEM-001 on approve.
Metering: n/a
Notes: Approver picks the initial role (default: Agent). Can be changed later.

### AGN-MEM-003 — Invite member

Purpose: Send an invite by email + phone to an agent to join the agency.
Route: modal from AGN-MEM-001   Persona: Agency (Owner / Admin)   Device: responsive   Mode: n/a
Current state: PARTIAL — may exist inline.
Workflow role: n/a
Key components: Email input, phone input (optional), role dropdown, personal message textarea, expiry (default 14 days), Send Invite button. Bulk invite: paste-multiple or CSV upload.
Primary actions: Send → email + WhatsApp sent with sign-up link (deep-links to `SHR-AUT-006` with agency pre-selected).
State variants: loading, error, already-invited (warn + resend), already-member (block).
Entry from: AGN-MEM-001, AGN-DSH-002 onboarding.
Exit to: AGN-MEM-001 with success toast; pending-invites list.
Metering: n/a
Notes: Pending invites list shown as tab on AGN-MEM-001 with Resend / Revoke inline actions.

### AGN-MEM-004 — Pending invites list

Purpose: See who's been invited but hasn't accepted.
Route: tab on AGN-MEM-001   Persona: Agency (Owner / Admin)   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: WF-02 role=Composition (pre-application).
Key components: Table (email, phone, invited-by, sent-at, expires-at, status: SENT/OPENED/APPLIED/EXPIRED), Resend / Revoke inline.
Primary actions: Resend; Revoke.
State variants: loading, empty, error.
Entry from: AGN-MEM-001.
Exit to: same.
Metering: n/a
Notes: Opened status derived from tracking pixel; not required.

### AGN-MEM-005 — Public join / accept invite (agent side)

Purpose: Prospective agent lands here from an invite link OR from a public agency profile "Apply to join" button.
Route: `/agencies/:id/apply?invite=…`   Persona: shared (anon) → agent post-signup   Device: responsive (mobile-first)   Mode: n/a
Current state: MISSING dedicated page.
Workflow role: WF-02 role=Initiator (applicant-side).
Key components: Agency card (logo, name, location, member count), pitch, apply form (name, phone, current status: solo / other-agency, message), if invite-token → prefill; if applicant not signed up → sign-up form embedded.
Primary actions: Submit application → SHR-AUT-005b applicant-side confirmation.
State variants: loading, invite-expired (block with clear message), agency-not-accepting-applications (block), already-applied (see status).
Entry from: Invite email link, SHR-PUB-003 (public agency profile), direct URL.
Exit to: Confirmation screen; then user is either logged in with pending-application status or invited to sign in.
Metering: n/a
Notes: This is where the Register wizard (`SHR-AUT-006`) branches when user picks "Join an agency".

### AGN-MEM-006 — Member detail

Purpose: One agent's profile as seen by agency admin: activity, listings, quota, allocation, discipline history.
Route: `/agency/members/:id`   Persona: Agency (Owner / Admin / Finance for credit portion)   Device: desktop   Mode: n/a
Current state: MISSING dedicated page.
Workflow role: n/a
Key components: Header (avatar, name, role, joined, status), tabs (Overview | Listings | Leads | Credits | Sessions | Discipline notes | Audit), quick actions (Change role → AGN-MEM-007, Adjust allocation → AGN-CRD-005, Pause → AGN-MEM-008, End membership → AGN-MEM-009).
Primary actions: Various from actions menu.
State variants: loading, error.
Entry from: AGN-MEM-001.
Exit to: AGN-MEM-007, AGN-MEM-008, AGN-MEM-009.
Metering: n/a
Notes: "Impersonate" not allowed at Agency level — only PA can do that.

### AGN-MEM-007 — Change member role

Purpose: Change an agent's role within the agency.
Route: modal from AGN-MEM-006   Persona: Agency (Owner) — role changes by Owner only for safety   Device: desktop   Mode: n/a
Current state: PARTIAL.
Workflow role: n/a
Key components: Current role, new role picker, impact banner (e.g., "Marketer → Finance grants billing access"), Save.
Primary actions: Save → immediate role change + notification to affected member.
State variants: loading, error, cannot-demote-last-owner (block).
Entry from: AGN-MEM-006, AGN-MEM-001.
Exit to: AGN-MEM-006.
Metering: n/a
Notes: Cannot demote the last owner without transferring ownership first (→ AGN-SET-005).

### AGN-MEM-008 — Pause member (CORRECTED 2026-09-04 per D9 — pause_reason as first-class field)

Purpose: Temporarily disable an agent without ending membership. Downstream behavior (listings visibility, lead routing, access level) is REASON-DRIVEN.
Route: modal from AGN-MEM-006   Persona: Agency (owner / admin only — governance action, not delegable)   Device: desktop   Mode: n/a
Current state: PARTIAL. **Needs schema extension:** `agency_members.pause_reason` enum column + `agency_members.pause_cover_agent_id` FK + downstream job wiring.
Workflow role: n/a
Key components:
- **Pause reason (controlled vocabulary — drives behavior):**
  - `LEAVE_OF_ABSENCE` — listings STAY VISIBLE + leads route to cover agent + read-only access preserved
  - `DISCIPLINARY` — listings HIDDEN from public/white-label/Bazaar/portals + leads PAUSED to agency pool + access SUSPENDED (requires SHR-MFA-007 step-up to invoke)
  - `INVESTIGATION` — listings STAY VISIBLE for business continuity + leads ESCROWED to agency pool + read-only access
  - `AGENT_REQUESTED_BREAK` — same as LOA but agent-initiated
  - `OTHER_WITH_NOTES` — free-text required (audit-flagged)
- Cover agent picker (required for LOA + AGENT_REQUESTED_BREAK)
- Expected-return-date (optional; auto-scheduled resume reminder to owner/admin)
- Continue-listings toggle DERIVED from reason (overridable with typed justification — audit-flagged)
- Notification composer preview (pre-filled per reason, template-editable)
Primary actions: Pause → status change + reason-driven downstream + member notification + audit-log entry with reason + actor + timestamp.
State variants: loading, error, missing-cover-agent (block on LOA reasons), permission-denied.
Entry from: AGN-MEM-006.
Exit to: AGN-MEM-006 with `pause_reason` badge visible.
Metering: n/a
Notes: **Behavior reason-driven, not toggle-driven.** Old free-form toggle made compliance ambiguous. Now: reason auto-configures visibility + routing + access. Override requires typed justification captured to audit. Resume via AGN-MEM-006 → Resume modal pre-filled with pause metadata.

### AGN-MEM-009 — End membership (offboarding workflow)

Purpose: Remove an agent from the agency; must reassign their tied listings + leads first.
Route: multi-step drawer from AGN-MEM-006   Persona: Agency (Owner / Admin)   Device: desktop   Mode: n/a
Current state: PARTIAL — backend routes exist (`POST /members/:id/end`, `GET /members/:id/tied-listings`, `POST /listings/:propertyId/reassign`).
Workflow role: WF-29 role=Composition (offboarding — new workflow to add to index).
Key components: Step 1 — Tied listings review (count, dropdown-per-listing to pick new owner; or Bulk-assign-all to one agent); Step 2 — Tied leads review (same shape); Step 3 — Data-retention choices (transfer contacts to agency pool vs. archive); Step 4 — Final review + End Membership button (requires SHR-MFA-007 step-up).
Primary actions: Next / Back per step; End Membership on final step → reassignments execute atomically → member removed → notification sent.
State variants: loading, per-step validation (must assign every listing), error, cannot-end-last-owner (block).
Entry from: AGN-MEM-006.
Exit to: AGN-MEM-001 with removed indicator.
Metering: n/a
Notes: Cannot end an owner unless another owner exists. All reassignments audited. If member is paused, this is the "final" removal step. Rollback is not possible — surface warning prominently.

---

<a id="3-agn-rol"></a>
## 3. AGN-ROL — Roles & permissions

### AGN-ROL-001 — Roles overview

Purpose: See the role definitions and what each can do.
Route: `/agency/settings/roles`   Persona: Agency (Owner / Admin / Read-Only)   Device: desktop   Mode: n/a
Current state: MISSING (roles are enforced in code; no admin surface for viewing/editing).
Workflow role: n/a
Key components: Role table (Owner / Admin / Finance / Marketer / Agent / Read-Only) × permissions matrix, each cell showing allowed/denied, member count per role.
Primary actions: View permissions detail per role → AGN-ROL-002.
State variants: loading.
Entry from: AGN-SET-001.
Exit to: AGN-ROL-002.
Metering: n/a
Notes: Custom roles NOT in v1 — this screen is read-only reference.

### AGN-ROL-002 — Role permissions detail

Purpose: Deep-dive per role, listing every permission granted.
Route: `/agency/settings/roles/:role`   Persona: Agency (Owner / Admin)   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: n/a
Key components: Role card, grouped permissions list (Listings / Contacts / Campaigns / Billing / Team / Settings), members with this role.
Primary actions: n/a (read-only). Change a member's role → AGN-MEM-007.
State variants: loading, error.
Entry from: AGN-ROL-001.
Exit to: AGN-ROL-001, AGN-MEM-007.
Metering: n/a
Notes: Reference doc for teams onboarding new members.

---

<a id="4-agn-prc"></a>
## 4. AGN-PRC — Pricing portfolio

### AGN-PRC-001 — Agency pricing portfolio

Purpose: Market-pricing overview across all agency listings.
Route: `/agency/pricing`   Persona: Agency (Owner / Admin / Marketer / Read-Only)   Device: desktop 1440   Mode: n/a
Current state: EXISTS — `web/src/pages/AgencyPricingPage.tsx`. Needs RTL + mobile pass.
Workflow role: n/a
Key components: KPI strip (Total portfolio value, Avg days-on-market, Overpriced count, Underpriced count, Recommended adjustments count), filters (city / area / property-type / agent / status), Table (property, owning agent, list price, comparables median, delta %, days-on-market, recommendation: Keep / Adjust up / Adjust down, action button), bulk actions.
Primary actions: Row → drill to listing (Agent matrix); Bulk apply recommendation (adjust prices across selection); Export CSV.
State variants: loading, empty, error.
Entry from: AGN-DSH-001, `SHR-NAV-002`.
Exit to: Agent matrix Listing Detail, AGN-PRC-002.
Metering: reads `GET /api/agency/pricing/portfolio` — check if any calls carry a metered feature.
Notes: Marketer role can view but cannot bulk-adjust prices (that's a Listings write, agent-scoped).

### AGN-PRC-002 — Bulk price adjustment (CORRECTED 2026-09-04 — added safety rails)

Purpose: Adjust multiple listings' prices in one operation with mandatory preview + 24h reversal window.
Route: modal from AGN-PRC-001   Persona: Agency (Owner / Admin) — bulk write requires elevation SHR-MFA-007   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: WF-36 role=Composition (bulk price change with reversal window).
Key components:
- Step 1 — Selection summary (N listings + total portfolio value affected)
- Step 2 — Adjustment strategy (Apply recommendation / % change up / % change down / Set to comparables median / Fixed delta)
- Step 3 — **Mandatory preview table** — every affected listing shown with (photo thumb, address, current price, new price, delta %, owning agent). No skip-ahead.
- Step 4 — Reversal window setting (default: 24 hours — during this window the change can be undone with one tap; after: change is committed and only reversible via a new manual adjustment)
- Step 5 — Elevation prompt (SHR-MFA-007) + typed confirmation "I have reviewed all N changes"
Primary actions: Preview → Adjust → Confirm; during reversal window, Undo restores every prior price atomically.
State variants: loading, no-changes, exceeds-safety-cap (block if > 100 listings or > 50% aggregate value change without a second-approver approval via WF-08-style flow), error, reversal-window-active (banner with countdown + Undo button), reversal-window-expired (committed).
Entry from: AGN-PRC-001.
Exit to: AGN-PRC-001 with active-reversal-window banner if applicable.
Metering: `PROPERTY_PRICE_HISTORY_WRITE` per row if metered.
Notes: The reversal window is implemented as a scheduled `revert_bulk_adjustment` job scheduled at +24h; Undo cancels the job AND applies the reverse deltas. Notifications to owning agents at both apply-time AND revert-time. Audit log includes both original + adjustment + revert (if reverted) with actor at each step.

### AGN-PRC-003 — Comparables browser

Purpose: Browse the comparables database with agency-wide filters.
Route: `/agency/pricing/comparables`   Persona: Agency (Owner / Admin / Marketer / Read-Only)   Device: desktop   Mode: n/a
Current state: MISSING dedicated page (`components/market-pricing/*` exists as component library).
Workflow role: n/a
Key components: Filters (city / area / property-type / date-range / source), map view + list view toggle, table (property, sold-date, price, comparables-strength, source), export.
Primary actions: Row → comparable detail; Report a bad comparable → WF-05 initiator (Agent matrix + Agency).
State variants: loading, empty, error.
Entry from: AGN-PRC-001.
Exit to: AGN-PRC-004.
Metering: n/a
Notes: Report-bad-comparable feeds `PA-PVA-008` review queue.

### AGN-PRC-004 — Report bad comparable (WF-05 Initiator)

Purpose: Flag a comparable as incorrect (wrong price, wrong location, duplicate).
Route: modal from AGN-PRC-003   Persona: Agency (Owner / Admin / Marketer)   Device: desktop   Mode: n/a
Current state: MISSING dedicated agency-scoped variant.
Workflow role: WF-05 role=Initiator.
Key components: Reason radio (Wrong price / Duplicate / Not comparable / Removed / Other), free-text notes, evidence upload, Submit for Review.
Primary actions: Submit → PA-PVA-008 queue.
State variants: loading, error.
Entry from: AGN-PRC-003.
Exit to: AGN-PRC-003 with pending-review indicator.
Metering: n/a
Notes: Recipient screen for the outcome (accepted/rejected) lives in Agent matrix + Agency inbox.

---

<a id="5-agn-crd"></a>
## 5. AGN-CRD — Credits & allocation

### AGN-CRD-001 — Agency wallet overview

Purpose: See agency-wide credit balance, allocation across agents, top-up, transaction history.
Route: `/agency/credits`   Persona: Agency (owner / admin / member+finance-pack / member+readonly-pack for view)   Device: desktop 1440   Mode: n/a
Current state: PARTIAL — backend routes exist (`GET /api/agency/credits/balance`, `.../transactions`, `POST .../top-up`, `.../allocate`); frontend may re-use tenant credit components. Needs a dedicated agency-scoped page.
Workflow role: n/a
Key components: KPI strip (Wallet balance, MTD spend, Burn rate, Days until exhausted at current burn), donut chart (allocation by agent, unallocated pool), Top-up button (→ AGN-CRD-002), Allocate button (→ AGN-CRD-005), Transactions table (last 50), Set Alert Threshold button.
Primary actions: Top-up; Allocate; Filter transactions; Export CSV.
State variants: loading, low-balance banner, error.
Entry from: AGN-DSH-001, `SHR-NAV-002`.
Exit to: AGN-CRD-002, AGN-CRD-005.
Metering: n/a
Notes: Read-Only role sees everything but no action buttons.

### AGN-CRD-002 — Top-up credits (Paddle checkout path)

Purpose: Add credits to the agency wallet.
Route: modal from AGN-CRD-001   Persona: Agency (Owner / Finance)   Device: responsive   Mode: n/a
Current state: PARTIAL — `web/src/components/credits/TopUpDialog.tsx` exists for tenant surface; needs agency-scoped version.
Workflow role: n/a
Key components: Preset packs (100 / 500 / 1000 / 5000 credits), custom amount input, currency display, expected credits + bonus lot calculation, Paddle checkout embed (once WF Paddle live), Confirm button.
Primary actions: Confirm → Paddle overlay; on success → wallet balance updated + AGN-CRD-003 outcome.
State variants: loading, payment-declined, error, offline.
Entry from: AGN-CRD-001, AGN-DSH-001 low-balance banner.
Exit to: AGN-CRD-003 outcome.
Metering: n/a
Notes: Uses Paddle Checkout Web skill. When Paddle isn't yet live, fall back to "Request invoice" flow that creates a PA-INV-005 manual invoice.

### AGN-CRD-003 — Top-up outcome

Purpose: Success confirmation with grant details.
Route: drawer from AGN-CRD-002   Persona: Agency (Owner / Finance)   Device: responsive   Mode: n/a
Current state: MISSING.
Workflow role: WF-30 role=Action outcome (agency top-up).
Key components: Transaction reference, credits added, new balance, invoice link, "Allocate now" quick action.
Primary actions: Allocate → AGN-CRD-005; Download invoice; Close.
State variants: mirror-pending (fin.* posting not yet mirrored).
Entry from: AGN-CRD-002.
Exit to: AGN-CRD-005, AGN-CRD-001.
Metering: n/a
Notes: Paddle webhook updates wallet; UI polls for a few seconds.

### AGN-CRD-004 — Allocation rules

Purpose: See + edit the standing rules for how credits allocate to agents (percentage / cap / on-demand).
Route: tab on AGN-CRD-001   Persona: Agency (Owner / Admin / Finance)   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: n/a
Key components: Radio (Manual per top-up / Automatic-percentage / Automatic-cap-per-agent / Hybrid), per-agent overrides, Save button.
Primary actions: Save → applies rule; existing balances unchanged (rules apply to future).
State variants: loading, error.
Entry from: AGN-CRD-001.
Exit to: same.
Metering: n/a
Notes: Percentage rule requires sum ≤ 100%; a "shared pool" catches the remainder.

### AGN-CRD-005 — Allocate credits to agent(s) (CORRECTED 2026-09-04 — clawback specifics)

Purpose: Move credits from agency pool to specific agents (one-time or standing). Supports clawback (negative amount) with a first-class explanation flow.
Route: modal from AGN-CRD-001 or AGN-MEM-006   Persona: Agency (owner / admin / member+finance-capability-pack)   Device: desktop   Mode: n/a
Current state: PARTIAL — backend `POST /api/agency/credits/allocate` exists; clawback UX needs new backend field for reason + notification composer.
Workflow role: n/a for grant; WF-37 role=Initiator for clawback (with agent dispute affordance).
Key components (grant path): Agent picker (single or multi-select), amount per agent, reason, effective-from, effective-until (optional), Save.
Key components (clawback path — negative amount): mode-toggle "Grant / Clawback" at top, agent(s) picker, amount to reclaim, **mandatory reason from controlled vocabulary** (Over-allocated / Agent departed / Fraud suspicion / Correcting a data error / Policy violation / Other-with-required-notes), notification-composer preview (the exact text the agent will receive — pre-filled per reason, editable within a template), Submit for step-up.
Primary actions:
- Grant → notifications to agents, transactions posted.
- Clawback → SHR-MFA-007 step-up → transactions posted → notification to agent(s) → agent gains a "Dispute this clawback" button in their AGT-NPF-001 notification-inbox item (opens WF-37 dispute detail with agency-side response required within 5 business days).
State variants: loading, error, insufficient-pool (block on grant, warn on clawback if pool goes negative), permission-denied (Finance-pack + owner + admin only for clawback), clawback-blocked (agent has zero balance to reclaim from).
Entry from: AGN-CRD-001, AGN-MEM-006.
Exit to: AGN-CRD-001.
Metering: n/a
Notes: Clawback is a hostile action per audit findings 2026-09-04 — the reason vocabulary + notification content + agent-dispute affordance are all required for enterprise-grade fairness. Clawback events are extra-visibly audited (AGN-AUD-001 highlights them). Backend needs a new field `credit_transactions.clawback_reason` + a new outbox event `credit.clawback.disputed` for the dispute path.

### AGN-CRD-006 — Feature quota view (agency aggregate)

Purpose: See per-feature quota consumption across all agents.
Route: tab on AGN-CRD-001   Persona: Agency (Owner / Admin / Finance / Marketer / Read-Only)   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: n/a
Key components: FeatureQuotaBar per metered feature (from `credits/features.js`), grouped by category (Social / Portal / AI / Comms), progress bar showing consumed vs. package quota, per-agent contribution breakdown expandable.
Primary actions: Expand → per-agent breakdown; Top up specific feature (if per-feature top-up available).
State variants: loading, near-cap (amber), at-cap (red), error.
Entry from: AGN-CRD-001.
Exit to: same.
Metering: n/a
Notes: Reuses `FeatureQuotaBar.tsx` from tenant surface but scoped agency-wide.

---

<a id="6-agn-sub"></a>
## 6. AGN-SUB — Subscription

### AGN-SUB-001 — Current subscription

Purpose: See the agency's current plan, cycle window, features included, quota.
Route: `/agency/subscription` (also aliased as `/my-subscription` for tenant users)   Persona: Agency (owner / admin / member+finance-pack / member+readonly-pack)   Device: responsive   Mode: n/a
Current state: EXISTS — `web/src/pages/MySubscriptionPage.tsx`. Serves both Agent and Agency; needs role-scoped variant.
Workflow role: n/a
Key components: Plan card (name, tier, billing cadence, price/mo, next renewal date, N properties covered, per-feature per-property quota), feature-list, action bar (Change Plan → AGN-SUB-002, Cancel → AGN-SUB-004, Manage Payment Method → AGN-SUB-005).
Primary actions: Change Plan; Cancel; Manage Payment Method; Download Contract.
State variants: loading, past-due banner, cancellation-scheduled banner, trial-ending banner, error.
Entry from: AGN-DSH-001, `SHR-NAV-002`.
Exit to: AGN-SUB-002, AGN-SUB-004.
Metering: n/a
Notes: Same page for agent + agency but scoping differs; note in shell.

### AGN-SUB-002 — Change plan (preview + confirm)

Purpose: Preview switching plans and confirm.
Route: `/agency/plans` or modal from AGN-SUB-001   Persona: Agency (Owner / Finance)   Device: responsive   Mode: n/a
Current state: EXISTS — `web/src/pages/PlansPage.tsx` + `components/credits/UpgradeDialog.tsx`. Needs RTL + mobile pass + agency scope.
Workflow role: WF-13 role=Composition.
Key components: Available plans grid (Free / Basic / Standard / Pro / Enterprise; annual toggle), current-plan indicator, comparison table (feature-by-feature), Select button per plan → opens preview → confirmation with proration + effective-from choice.
Primary actions: Select plan → preview → Confirm (SHR-MFA-007 for downgrade) → AGN-SUB-003 outcome.
State variants: loading, error, plan-not-available (per-region).
Entry from: AGN-SUB-001, `SHR-NAV-002 /plans`.
Exit to: AGN-SUB-003.
Metering: n/a
Notes: Downgrade disallowed if current usage exceeds new-plan quotas (show blocker with specifics). Enterprise = talk-to-sales (contact modal).

### AGN-SUB-003 — Change plan outcome

Purpose: Confirmation with impact summary.
Route: drawer from AGN-SUB-002   Persona: Agency (Owner / Finance)   Device: responsive   Mode: n/a
Current state: MISSING.
Workflow role: WF-13 role=Action outcome.
Key components: Old plan → new plan, effective-from, proration (credit note or debit), new monthly cost, new quotas, invoice link.
Primary actions: View invoice → AGN-INV-002; View subscription → AGN-SUB-001; Close.
State variants: loading, error.
Entry from: AGN-SUB-002.
Exit to: AGN-SUB-001.
Metering: n/a
Notes: Downgrade cool-down (7 days) prevents flip-flopping — surface if applicable.

### AGN-SUB-004 — Cancel subscription

Purpose: Cancel at period-end (default) or immediate.
Route: modal from AGN-SUB-001   Persona: Agency (Owner)   Device: responsive   Mode: n/a
Current state: PARTIAL.
Workflow role: n/a
Key components: Radio (End of period / Immediate), Reason dropdown (Too expensive / Missing feature / Switching provider / Business closed / Other), free-text notes, retention offer (if applicable — "10% off next 3 months"), Confirm Cancel button with SHR-MFA-007 step-up.
Primary actions: Confirm → status change; if immediate → refund via credit note + free-tier downgrade.
State variants: loading, error, has-past-due (block until settled).
Entry from: AGN-SUB-001.
Exit to: AGN-SUB-001 with cancellation banner.
Metering: n/a
Notes: Owner-only. Immediate cancellation forfeits unused portion (with credit note per PA-SUB-006 logic).

### AGN-SUB-005 — Manage payment method

Purpose: Add / remove / set-primary payment method.
Route: modal from AGN-SUB-001 or Paddle customer portal   Persona: Agency (Owner / Finance)   Device: responsive   Mode: n/a
Current state: MISSING dedicated frontend (Paddle customer portal covers most of this once integrated).
Workflow role: n/a
Key components: List (card last-4, brand, expiry, primary flag), Add Card button (opens Paddle portal), Remove, Set Primary.
Primary actions: Add / Remove / Set Primary via Paddle customer portal handoff.
State variants: loading, error.
Entry from: AGN-SUB-001, AGN-DSH-001 payment-failed banner.
Exit to: Paddle customer portal (external) or same page.
Metering: n/a
Notes: We do NOT collect card details ourselves — Paddle-hosted. Skill: `paddle-customer-portal`.

---

<a id="7-agn-inv"></a>
## 7. AGN-INV — Invoices & payments

### AGN-INV-001 — Invoices list (tenant view)

Purpose: See all invoices issued to this agency.
Route: `/my-invoices`   Persona: Agency (Owner / Finance / Admin for view / Read-Only)   Device: responsive   Mode: n/a
Current state: EXISTS — `web/src/pages/MyInvoicesPage.tsx`. Needs RTL + mobile pass.
Workflow role: n/a
Key components: Table (number, issued, due, amount, status: PAID/OPEN/PAST_DUE/VOID, download), filters (year, status), Bulk download PDF (ZIP).
Primary actions: Row → AGN-INV-002; Download PDF; Filter.
State variants: loading, empty, error.
Entry from: AGN-DSH-001, `SHR-NAV-002`.
Exit to: AGN-INV-002.
Metering: n/a
Notes: PDF is Paddle-generated or our own — decide per region. KSA ZATCA e-invoice must be attached separately for KSA-billed customers.

### AGN-INV-002 — Invoice detail

Purpose: One invoice's full breakdown.
Route: `/my-invoices/:id`   Persona: Agency (Owner / Finance / Read-Only)   Device: responsive   Mode: n/a
Current state: PARTIAL.
Workflow role: n/a
Key components: Header (number, issued, due, status), line items, tax breakdown, payment history section (payments applied), Download PDF, "Ask a question" (opens support), Related credit notes.
Primary actions: Download; Pay Now (if past-due, opens Paddle checkout); Support.
State variants: loading, error, ZATCA-pending (badge for KSA).
Entry from: AGN-INV-001.
Exit to: AGN-INV-001.
Metering: n/a
Notes: "Pay Now" only enabled for past-due invoices.

### AGN-INV-003 — Credit notes list (tenant view)

Purpose: See all credit notes issued to this agency.
Route: `/my-credit-notes`   Persona: Agency (Owner / Finance / Read-Only)   Device: responsive   Mode: n/a
Current state: EXISTS — `web/src/pages/MyCreditNotesPage.tsx`.
Workflow role: n/a
Key components: Similar to invoices list.
Primary actions: Row → detail; Download PDF.
State variants: loading, empty, error.
Entry from: AGN-INV-001, AGN-DSH-001.
Exit to: credit note detail.
Metering: n/a
Notes: Credit notes appear here after every downgrade proration / refund.

---

<a id="8-agn-wlb"></a>
## 8. AGN-WLB — White-label site builder (RESCOPED 2026-09-04 → Option b: Branded template picker, NOT WYSIWYG)

**Decision 2026-09-04:** Full WYSIWYG page builder (original scope) rescoped to a **branded template picker** for v1. No page tree, no block library, no drag-drop. Every agency site shares the same underlying structure; only branding + copy + template choice vary. Full WYSIWYG (option a) and hosted-builder integration (option c) both deferred.

**New scope per screen (overrides original entries below):**
- **AGN-WLB-001** — Site overview + preview (one site per agency for v1; multi-site is Phase 2)
- **AGN-WLB-002** — Brand + template chooser (single-page form: upload logo + favicon → pick brand colors → pick font pair from curated 6-8 → pick ONE of 3-5 pre-built templates)
- **AGN-WLB-003** — Copy fields editor (template-controlled slots: About-us, Mission, Contact info, Business hours, Featured-listings selection rule)
- **AGN-WLB-004** — Custom domain (unchanged from original — DNS + SSL provisioning)
- **AGN-WLB-005** — Analytics (unchanged from original)

**Removed from v1 scope (may return in Phase 2):**
- Page tree management (was AGN-WLB-002 canvas — GONE)
- Block library (was in AGN-WLB-002 right rail — GONE)
- Breakpoint-switcher canvas (was AGN-WLB-003 — GONE, templates are inherently responsive)
- Multi-template gallery beyond the curated 3-5 (was AGN-WLB-005 — GONE, curated set is the whole gallery)

**Estimated effort:** 1-2 weeks vs. 6-10 weeks for full builder. Templates are authored as React components with slots; brand tokens applied via CSS custom properties. Backend needs one new table: `agency_site_config` with columns for brand tokens + template_id + copy_fields JSONB + custom domain + SSL status.

**Entries below REWRITTEN 2026-09-04 per D2 Option b — branded template picker scope. AGN-WLB-006 (Analytics) merged into AGN-WLB-005; multi-site + WYSIWYG features deferred to Phase 2.**

### AGN-WLB-001 — Site overview + preview (REWRITTEN 2026-09-04 per D9)

Purpose: See the state of the agency's one white-label site (one per agency for v1; multi-site deferred to Phase 2). Preview the current published or draft state.
Route: `/agency/white-label`   Persona: Agency (owner / admin / member+marketer-pack for edits; member+readonly-pack for view)   Device: desktop   Mode: n/a
Current state: PARTIAL — existing `web/src/pages/WhiteLabelBuilderPage.tsx` will be repurposed as this overview screen with the WYSIWYG code removed.
Workflow role: n/a
Key components: Site status card (subdomain URL, custom domain if any, published/draft state, last-edited-at + actor), live preview iframe (renders the current template with current brand + copy), Edit Brand & Template button (→ AGN-WLB-002), Edit Copy button (→ AGN-WLB-003), Custom Domain button (→ AGN-WLB-004), Analytics button (→ AGN-WLB-005), View Live Site button.
Primary actions: Edit brand / Edit copy / Manage domain / View analytics / View live site.
State variants: loading, no-site-yet (nudge — Setup your site in 5 minutes), draft-pending-publish, published, error.
Entry from: AGN-DSH-001, AGN-DSH-002 onboarding checklist.
Exit to: AGN-WLB-002 / -003 / -004 / -005 / external live URL.
Metering: n/a
Notes: Free-tier agencies get 1 subdomain; paid agencies unlock the custom domain in AGN-WLB-004. **Deferred to Phase 2:** multi-site (an agency has multiple branded sites) — currently one-site-per-agency.

### AGN-WLB-002 — Brand + template chooser (REWRITTEN 2026-09-04 per D9)

Purpose: Single-page form where an agency admin picks a template + configures brand tokens (logo, colors, fonts). Template + brand tokens together define the site's look.
Route: `/agency/white-label/brand`   Persona: Agency (owner / admin / member+marketer-pack)   Device: desktop 1440   Mode: n/a
Current state: MISSING.
Workflow role: n/a
Key components:
- Logo upload (with recommended dimensions + auto-crop preview)
- Favicon upload (with 32×32 preview)
- Brand color pickers: Primary + Accent — with contrast-check against WCAG AA
- Font-pair picker (curated 6-8 options: system-sans / IBM Plex Arabic / Playfair Display + system-serif / etc.)
- **Template chooser (3-5 curated templates):** "Modern minimalist" / "Classic professional" / "Bold luxury" / "Warm boutique" / "Portfolio-heavy" — each rendered as a live preview with the agency's brand tokens applied so the admin sees exactly what they'll get
- Live-preview iframe showing the current template + brand applied to the actual agency's listings
- Save + Publish button (elevated SHR-MFA-007 for publish)
Primary actions: Upload logo / favicon; Pick colors; Pick fonts; Pick template; Save Draft; Publish.
State variants: loading, uploading, saving (autosave debounced), publish-error, contrast-warning (if brand colors fail WCAG AA — non-blocking warning).
Entry from: AGN-WLB-001.
Exit to: AGN-WLB-001 (preview the change).
Metering: n/a
Notes: Templates are React components with slots authored by the design team; PA can add new templates via PA-TPL-* variant (out of scope here). Brand tokens applied via CSS custom properties — no code changes required to swap.

### AGN-WLB-003 — Copy fields editor (REWRITTEN 2026-09-04 per D9)

Purpose: Edit the template's copy-controlled fields (About-us paragraph, mission statement, contact info, business hours, featured-listings selection rule).
Route: `/agency/white-label/copy`   Persona: Agency (owner / admin / member+marketer-pack)   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: n/a
Key components: Form organized by template section (Header / About / Featured Listings rule / Team / Contact / Footer). Each field has a live-preview snippet next to the input. Featured Listings rule = filter (all / by area / by property type / by price range) + sort (newest / most-viewed / manual). Save + Preview + Publish.
Primary actions: Edit any field (autosave debounced); Preview; Publish (elevated).
State variants: loading, saving, unsaved-changes warning on nav-away, publish-error.
Entry from: AGN-WLB-001.
Exit to: AGN-WLB-001.
Metering: n/a
Notes: Copy fields are stored in `agency_site_config.copy_fields` JSONB. Template determines which fields are shown — different templates surface different copy slots. Backend needs `agency_site_config` table with columns for brand tokens (logo_url, favicon_url, primary_color, accent_color, font_pair), template_id, copy_fields JSONB, custom_domain, ssl_status.

### AGN-WLB-004 — Custom domain (UNCHANGED FROM ORIGINAL — REVIEWED 2026-09-04 per D9)

Purpose: Bind a custom domain + DNS instructions + SSL status.
Route: `/agency/white-label/domain`   Persona: Agency (owner)   Device: desktop   Mode: n/a
Current state: PARTIAL — backend `POST /api/white-label/domains` exists.
Workflow role: n/a
Key components: Current domain (subdomain default), Add custom domain input, DNS instructions (CNAME target), Verification status (auto-poll), SSL cert status.
Primary actions: Add domain; Verify; Remove.
State variants: verifying (poll for DNS), verified, ssl-provisioning, ssl-failed (retry), error.
Entry from: AGN-WLB-001.
Exit to: same.
Metering: n/a
Notes: Custom domain is paid-plan-only. Free tier locked to subdomain. Unchanged by D2 Option b — this stays.

### AGN-WLB-005 — Analytics (REWRITTEN 2026-09-04 per D9 — merged with former AGN-WLB-006)

Purpose: Site traffic + funnels.
Route: `/agency/white-label/analytics`   Persona: Agency (owner / admin / member+marketer-pack / member+readonly-pack)   Device: desktop   Mode: n/a
Current state: PARTIAL — backend `GET /white-label/analytics` exists.
Workflow role: n/a
Key components: KPI (Visitors 30d, Inquiries generated, Conversion rate, Bazaar-referral share, Top listings by views), Traffic sources chart, Top pages, Geographic map, Export CSV/PDF.
Primary actions: Date range; Export.
State variants: loading, empty, error.
Entry from: AGN-WLB-001.
Exit to: same.
Metering: n/a
Notes: GA4-style. Optionally embed a third-party analytics ID (Google Analytics / Plausible) that the agency owns. Previous AGN-WLB-006 (also Analytics) merged into this entry — the numbering gap is intentional.

---

<a id="9-agn-wid"></a>
## 9. AGN-WID — Widget builder

### AGN-WID-001 — Widgets list

Purpose: Manage embeddable widgets (property carousel, single-listing, search, contact form) for external sites.
Route: `/widgets`   Persona: Agency (Owner / Admin / Marketer)   Device: desktop 1440   Mode: n/a
Current state: EXISTS — `web/src/pages/WidgetBuilderPage.tsx`. Needs decomposition into list + builder.
Workflow role: n/a
Key components: Cards per widget (type, name, embed count, last-modified), Create Widget button.
Primary actions: Card → AGN-WID-002; Create → wizard.
State variants: loading, empty, error.
Entry from: AGN-DSH-001, `SHR-NAV-002`.
Exit to: AGN-WID-002.
Metering: n/a
Notes: Widget usage tracked via `GET /api/public/widgets/:id.js` requests.

### AGN-WID-002 — Widget builder

Purpose: Configure a widget's data source + appearance + embed snippet.
Route: `/widgets/:id`   Persona: Agency (Owner / Admin / Marketer)   Device: desktop 1440   Mode: n/a
Current state: PARTIAL.
Workflow role: n/a
Key components: Left — type + data source (listings filter, agent filter), Middle — live preview at multiple sizes, Right — style tokens (colors, radius, font), Bottom — copy-embed snippet with instructions.
Primary actions: Save; Publish; Copy embed.
State variants: loading, unsaved, error.
Entry from: AGN-WID-001.
Exit to: AGN-WID-001.
Metering: n/a
Notes: Embed produces a script tag that fetches `/api/public/widgets/:id.js` — no iframe.

---

<a id="10-agn-rou"></a>
## 10. AGN-ROU — Routing rules

### AGN-ROU-001 — Routing rules index

Purpose: Manage rules that assign incoming leads/comments to agents.
Route: `/settings/routing` (also `/agency/routing`)   Persona: Agency (Owner / Admin)   Device: desktop 1440   Mode: n/a
Current state: EXISTS — `web/src/pages/RoutingSettingsPage.tsx`.
Workflow role: n/a
Key components: Rules table (priority, name, trigger, condition, target, active flag), reorder handles, Add Rule button, Test button.
Primary actions: Row → AGN-ROU-002; Add → wizard; Reorder (drag); Test.
State variants: loading, empty (default fallback rule shown), error.
Entry from: AGN-DSH-002, `SHR-NAV-002`.
Exit to: AGN-ROU-002, AGN-ROU-003.
Metering: n/a
Notes: Order matters — first matching rule wins. Default rule (unassigned) always at bottom.

### AGN-ROU-002 — Rule editor

Purpose: Build a rule (trigger + conditions + target).
Route: modal from AGN-ROU-001   Persona: Agency (Owner / Admin)   Device: desktop   Mode: n/a
Current state: PARTIAL.
Workflow role: n/a
Key components: Trigger picker (New inquiry / New comment / New WhatsApp message), Conditions builder (property area / property type / language / source channel / time-of-day), Target (specific agent / round-robin group / least-busy / by-language-skill), Save.
Primary actions: Save → AGN-ROU-001.
State variants: loading, validation errors, error.
Entry from: AGN-ROU-001.
Exit to: AGN-ROU-001.
Metering: n/a
Notes: Condition builder supports AND/OR groups.

### AGN-ROU-003 — Test rule

Purpose: Simulate a payload against the rules chain and see which rule fires.
Route: modal from AGN-ROU-001   Persona: Agency (Owner / Admin)   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: n/a
Key components: Payload builder (or paste JSON), Run button, Result panel (which rule matched, target agent, reason).
Primary actions: Run; Adjust; Save as test case.
State variants: loading, no-match (default rule fires).
Entry from: AGN-ROU-001.
Exit to: same.
Metering: n/a
Notes: Saved test cases can regression-check when a rule is edited.

---

<a id="11-agn-syn"></a>
## 11. AGN-SYN — Sync connections

### AGN-SYN-001 — Sync connections list

Purpose: Manage connections to external MLS / portal feeds that import listings.
Route: `/agency/sync`   Persona: Agency (Owner / Admin)   Device: desktop 1440   Mode: n/a
Current state: PARTIAL — backend `POST /sync-connections`, `GET`, `DELETE /:id`, `POST /:id/run` exist.
Workflow role: n/a
Key components: Connection cards (source name, type, last-sync, next-sync, imported count, status: OK/ERROR/DISABLED), Add Connection button.
Primary actions: Card → AGN-SYN-002; Add → wizard; Run Now inline; Delete.
State variants: loading, empty, error, sync-failed banner.
Entry from: AGN-DSH-002 onboarding, `SHR-NAV-002`.
Exit to: AGN-SYN-002, AGN-SYN-003.
Metering: n/a
Notes: Errors surface in AGN-DSH-001 attention cards.

### AGN-SYN-002 — Connection detail + logs

Purpose: One connection's config + recent sync runs + logs.
Route: `/agency/sync/:id`   Persona: Agency (Owner / Admin)   Device: desktop   Mode: n/a
Current state: PARTIAL.
Workflow role: n/a
Key components: Header (source, credentials-status, next-sync), config panel (field mapping, filters, cadence), runs table (last 20 with duration, imported, errored), log viewer.
Primary actions: Edit config; Run Now; Pause; Delete.
State variants: loading, error.
Entry from: AGN-SYN-001.
Exit to: AGN-SYN-001.
Metering: n/a
Notes: Credentials never displayed; only "last verified" + Update Credentials button.

### AGN-SYN-003 — Import listings from external source (WLB-based one-off)

Purpose: One-off import from a CSV / MLS export.
Route: modal or `/agency/sync/import`   Persona: Agency (Owner / Admin / Marketer)   Device: desktop   Mode: n/a
Current state: PARTIAL — backend `POST /api/white-label/import-listings` exists.
Workflow role: n/a
Key components: File picker (CSV / XML), column mapping, preview table, De-dupe strategy (skip / overwrite / new-version), Assign to agent picker, Import button.
Primary actions: Import → creates listings; progress screen.
State variants: uploading, mapping-required, error, in-progress (background job).
Entry from: AGN-SYN-001, AGN-DSH-002.
Exit to: AGN-SYN-004.
Metering: n/a
Notes: Large imports background-processed with progress polling.

### AGN-SYN-004 — Import job progress

Purpose: Watch a running import; view errors.
Route: `/agency/sync/imports/:jobId`   Persona: Agency (Owner / Admin / Marketer)   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: n/a
Key components: Progress bar, imported / errored counts, error list, Cancel button.
Primary actions: Cancel; Retry failed rows; View imported listings.
State variants: running, completed, cancelled, error.
Entry from: AGN-SYN-003.
Exit to: AGN-SYN-001.
Metering: n/a
Notes: Cancellation stops in-flight rows but preserves already-imported.

---

<a id="12-agn-tpl"></a>
## 12. AGN-TPL — Templates management (agency-scoped)

### AGN-TPL-001 — Agency templates list

Purpose: See agency-authored message templates (agents can use them).
Route: `/agency/templates` (differ from `/message-templates` which is agent-scope)   Persona: Agency (Owner / Admin / Marketer)   Device: desktop   Mode: n/a
Current state: PARTIAL — agent-scope `MessageTemplatesPage.tsx` exists; agency-scope variant needs creation.
Workflow role: n/a
Key components: Table (name, category, channels, agents-using-count, last-modified, status), filters, Create Template.
Primary actions: Row → AGN-TPL-002; Create; Publish to all agents.
State variants: loading, empty, error.
Entry from: AGN-DSH-001.
Exit to: AGN-TPL-002.
Metering: n/a
Notes: Agency templates are read-write by Admin+Marketer; agents can copy + modify but not publish.

### AGN-TPL-002 — Template editor (agency-scope)

Purpose: Edit an agency-scope template.
Route: `/agency/templates/:id`   Persona: Agency (Owner / Admin / Marketer)   Device: desktop   Mode: n/a
Current state: MISSING dedicated variant.
Workflow role: n/a
Key components: Similar to PA-TPL-002 (Unlayer editor) but scoped to agency variables.
Primary actions: Save Draft; Publish; Send Test.
State variants: loading, unsaved, error.
Entry from: AGN-TPL-001.
Exit to: AGN-TPL-001.
Metering: n/a
Notes: Templates use agency-branding variables (logo, name, colors).

---

<a id="13-agn-wla"></a>
## 13. AGN-WLA — WhatsApp Listings entitlements

### AGN-WLA-001 — WhatsApp Listings entitlements

Purpose: Agency-scoped view of the WhatsApp Listings intake module: usage, per-agent entitlements, credits.
Route: `/agency/whatsapp-listings`   Persona: Agency (Owner / Admin / Finance)   Device: desktop   Mode: n/a
Current state: EXISTS — `web/src/pages/agency/whatsapp-listings/AgencyWhatsAppListingsPage.tsx`.
Workflow role: n/a
Key components: KPI (drafts this month, approved-rate, avg intake→approve time, AI cost), per-agent entitlement table (agent, entitled, drafts limit, usage %, quick-toggle), Update Entitlement.
Primary actions: Edit entitlement per agent; Bulk-set.
State variants: loading, error.
Entry from: `SHR-NAV-002`.
Exit to: AGN-WLA-002.
Metering: n/a
Notes: Agency's total entitlement is derived from package quota + PA-granted overrides.

### AGN-WLA-002 — Update entitlement per agent

Purpose: Grant / adjust an agent's access to the WhatsApp Listings module.
Route: modal from AGN-WLA-001   Persona: Agency (Owner / Admin)   Device: desktop   Mode: n/a
Current state: PARTIAL — backend `POST /api/agency/entitlements`, `PATCH /:id` exist.
Workflow role: n/a
Key components: Agent picker, entitled toggle, drafts/mo cap, effective-from, Save.
Primary actions: Save.
State variants: loading, over-agency-quota (block or warn), error.
Entry from: AGN-WLA-001.
Exit to: AGN-WLA-001.
Metering: n/a
Notes: Agency-wide quota is a hard cap; splitting across agents allocates it.

---

<a id="14-agn-rep"></a>
## 14. AGN-REP — Reports (CORRECTED 2026-09-04 per D9 — data pipeline verification prerequisite)

**Before building any AGN-REP screen, run a "walk one lead end-to-end" spike to verify the data pipeline joins as expected.** The reports below assume that `activity_log`, `lead_assignments`, `distribution_jobs`, `closed_transactions`, and `properties.events` are all joinable by tenant + source + agent + time-window. This is asserted, not verified. Estimated spike: 1 day of investigation before design work starts.

**Specific joins the pipeline must support:**
- Source → agent → outcome (Sankey): every inquiry captured with `source` at inbound-webhook time + propagated through `inquiries.id` → `viewings.inquiry_id` → `opportunities.data.inquiry_id` → `closed_transactions.data.opportunity_id`
- Publications → performance: `distribution_jobs.property_id` + `distribution_attempts.status` + `properties.events` with source-attribution tokens
- Credit spend attribution: `credit_consumptions.tenant_id` + `.feature` + `.data.property_id` + `.data.agent_id`

If any of these joins fails the spike, either instrument the missing data OR mark the affected report as blocked until instrumentation lands.



### AGN-REP-001 — Reports home

Purpose: Landing for agency-wide reports.
Route: `/agency/reports`   Persona: Agency (Owner / Admin / Finance / Marketer / Read-Only)   Device: desktop 1440   Mode: n/a
Current state: MISSING dedicated page.
Workflow role: n/a
Key components: Report cards (Listings performance, Lead conversion funnel, Agent leaderboard, Credit spend, Campaign performance, White-label site traffic, Revenue attribution), Custom Report button.
Primary actions: Card → detail report.
State variants: loading.
Entry from: AGN-DSH-001, `SHR-NAV-002`.
Exit to: AGN-REP-002..008.
Metering: n/a
Notes: Report cards act as previews with a small chart + KPI.

### AGN-REP-002 — Listings performance report

Purpose: Aggregate performance across all listings.
Route: `/agency/reports/listings`   Persona: Agency (Owner / Admin / Marketer / Read-Only)   Device: desktop   Mode: n/a
Current state: PARTIAL — backend `GET /api/dashboard/analytics`, `GET /api/analytics/crm` exist; agency-wide aggregation may or may not exist.
Workflow role: n/a
Key components: Filters (date range, agent, area, property type), KPIs (views, saves, inquiries, viewings, conversions), Table + chart, Export.
Primary actions: Filter; Drill to listing; Export.
State variants: loading, empty, error.
Entry from: AGN-REP-001.
Exit to: Agent matrix Listing Detail.
Metering: n/a
Notes: Combines views + engagement across public + white-label + widgets.

### AGN-REP-003 — Lead conversion funnel

Purpose: Funnel from inquiry to viewing to opportunity to closed.
Route: `/agency/reports/leads`   Persona: Agency (Owner / Admin / Marketer / Read-Only)   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: n/a
Key components: Funnel chart, conversion rates per stage, filters (source, agent, area, date), Export.
Primary actions: Filter; Drill to specific segments.
State variants: loading, empty, error.
Entry from: AGN-REP-001.
Exit to: same.
Metering: n/a
Notes: Sankey visualization for source → agent → outcome.

### AGN-REP-004 — Agent leaderboard

Purpose: Ranked leaderboard of agents by revenue attribution, listings closed, response time.
Route: `/agency/reports/agents`   Persona: Agency (Owner / Admin / Read-Only)   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: n/a
Key components: Ranking by metric (revenue / closings / response time / conversion rate), medal badges, trend arrows, per-agent drill.
Primary actions: Filter; Drill → AGN-MEM-006.
State variants: loading, empty, error.
Entry from: AGN-REP-001.
Exit to: AGN-MEM-006.
Metering: n/a
Notes: Careful with public leaderboard signaling — this is internal-only.

### AGN-REP-005 — Credit spend report

Purpose: Aggregate credit consumption by feature and agent.
Route: `/agency/reports/credits`   Persona: Agency (owner / admin / member+finance-pack / member+readonly-pack)   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: n/a
Key components: Stacked bar (per feature per month), per-agent breakdown, cost-per-lead metric, Export.
Primary actions: Filter; Drill; Export.
State variants: loading, empty, error.
Entry from: AGN-REP-001, AGN-CRD-001.
Exit to: same.
Metering: n/a
Notes: Overlays cost against revenue attribution.

### AGN-REP-006 — Campaign performance

Purpose: Marketing campaigns performance across agents.
Route: `/agency/reports/campaigns`   Persona: Agency (Owner / Admin / Marketer / Read-Only)   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: n/a
Key components: Campaign list with KPIs, filter by channel, Export.
Primary actions: Drill.
State variants: loading, empty, error.
Entry from: AGN-REP-001.
Exit to: Agent matrix Campaign detail.
Metering: n/a
Notes: Uses `campaigns` + `enrollments` data.

### AGN-REP-007 — Revenue attribution

Purpose: How much revenue each channel / agent / campaign generated.
Route: `/agency/reports/revenue`   Persona: Agency (owner / admin / member+finance-pack / member+readonly-pack)   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: n/a
Key components: Waterfall / sankey chart, filters, per-transaction drill.
Primary actions: Filter; Drill.
State variants: loading, empty, error.
Entry from: AGN-REP-001.
Exit to: closed-transactions detail.
Metering: n/a
Notes: Depends on `closed-transactions` data.

### AGN-REP-008 — Custom report builder

Purpose: Compose a custom report by dragging in metrics + dimensions.
Route: `/agency/reports/custom/:id`   Persona: Agency (Owner / Admin / Finance)   Device: desktop 1440   Mode: n/a
Current state: MISSING.
Workflow role: n/a
Key components: Left (metrics library), Middle (canvas), Right (dimensions + filters), Save / Share / Schedule email delivery.
Primary actions: Compose; Run; Save; Schedule.
State variants: loading, running, error.
Entry from: AGN-REP-001.
Exit to: AGN-REP-001.
Metering: n/a
Notes: v2 feature; can be deferred without blocking.

---

<a id="15-agn-set"></a>
## 15. AGN-SET — Agency settings

### AGN-SET-001 — Settings home

Purpose: Grid of every settings area.
Route: `/agency/settings`   Persona: Agency (Owner / Admin scoped)   Device: responsive   Mode: n/a
Current state: MISSING dedicated home; direct URL to each settings page today.
Workflow role: n/a
Key components: Cards grouped (Agency identity, Branding, Roles, Domains, Notifications, Billing, Integrations, Advanced).
Primary actions: Tap card → area.
State variants: loading.
Entry from: AGN-DSH-001, `SHR-NAV-002`.
Exit to: AGN-SET-002..006.
Metering: n/a
Notes: Cards hidden per role permission.

### AGN-SET-002 — Agency identity & branding

Purpose: Agency name, description, logo, brand colors, favicon.
Route: `/agency/settings/branding`   Persona: Agency (Owner / Admin)   Device: desktop   Mode: n/a
Current state: PARTIAL — some settings likely in `AgencyManagementPage.tsx`; needs dedicated route.
Workflow role: n/a
Key components: Logo upload, favicon upload, brand color picker (primary + accent), font choice (system / Google Font), Save.
Primary actions: Save; Reset to defaults.
State variants: loading, uploading, error.
Entry from: AGN-SET-001, AGN-DSH-002.
Exit to: AGN-SET-001.
Metering: n/a
Notes: Changes cascade to white-label site + widgets on save.

### AGN-SET-003 — Contact & business info

Purpose: Agency's contact, address, license #, tax ID (VAT), operating hours.
Route: `/agency/settings/business`   Persona: Agency (Owner)   Device: desktop   Mode: n/a
Current state: PARTIAL.
Workflow role: n/a
Key components: Fields (address, phone, email, license, VAT, operating hours per day), Save.
Primary actions: Save.
State variants: loading, error.
Entry from: AGN-SET-001.
Exit to: AGN-SET-001.
Metering: n/a
Notes: VAT + license used on invoices; changes may need PA approval for regulated regions.

### AGN-SET-004 — Integrations

Purpose: Third-party integrations (Zapier, HubSpot, Salesforce, Google Calendar, etc.).
Route: `/integrations`   Persona: Agency (Owner / Admin)   Device: desktop   Mode: n/a
Current state: EXISTS — `web/src/pages/IntegrationSettingsPage.tsx`. Shared page; scope depends on role.
Workflow role: n/a
Key components: Integration cards (name, status, Configure / Disconnect), OAuth flows for connect.
Primary actions: Connect / disconnect; Configure per integration.
State variants: loading, error.
Entry from: AGN-SET-001.
Exit to: External OAuth.
Metering: n/a
Notes: Some integrations may be paid-only.

### AGN-SET-005 — Transfer ownership

Purpose: Owner passes ownership to another Admin/Owner.
Route: modal from AGN-SET-001   Persona: Agency (Owner)   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: WF-31 role=Initiator (ownership transfer with two-factor confirm).
Key components: Target member picker (must be Admin+), warning banner, typed confirmation, SHR-MFA-007 step-up.
Primary actions: Transfer → new owner receives confirmation email; original owner becomes Admin post-accept.
State variants: loading, error, target-not-eligible.
Entry from: AGN-SET-001.
Exit to: AGN-SET-001.
Metering: n/a
Notes: Ownership transfer irreversible; requires target's accept via email confirmation (their side is another screen: AGN-SET-005b).

### AGN-SET-005b — Accept ownership transfer

Purpose: Target user accepts the transfer.
Route: `/agency/accept-ownership?token=…`   Persona: Agency (target — Admin/Owner promoted)   Device: responsive   Mode: n/a
Current state: MISSING.
Workflow role: WF-31 role=Recipient / Action outcome.
Key components: Explanation of what happens, Accept / Decline buttons, SHR-MFA-007 step-up for accept.
Primary actions: Accept → ownership assigned; Decline → transfer canceled, original owner notified.
State variants: loading, invalid/expired token, error.
Entry from: Email link.
Exit to: AGN-DSH-001.
Metering: n/a
Notes: 7-day expiry on invite.

### AGN-SET-006 — Delete agency

Purpose: Owner deletes the agency (destructive).
Route: modal from AGN-SET-001   Persona: Agency (Owner)   Device: desktop   Mode: n/a
Current state: MISSING.
Workflow role: WF-32 role=Initiator (agency deletion — similar 3-factor pattern to user deletion).
Key components: Same 3-factor pattern as SHR-SET-005 (liveness word + email + TOTP), impact banner (N agents unassigned, N listings archived, credits forfeit, invoices retained), typed confirm.
Primary actions: Delete Agency → 30-day cool-down + notifications.
State variants: loading, error, active-agents-present (block until members are ended), has-past-due-invoice (block).
Entry from: AGN-SET-001.
Exit to: `SHR-NAV-001`.
Metering: n/a
Notes: Deletion cool-down cancellable via periodic email link. All agents get proactive notification.

---

<a id="16-agn-aud"></a>
## 16. AGN-AUD — Audit log

### AGN-AUD-001 — Agency audit log (CORRECTED 2026-09-04 per D9 — backend endpoint required)

Purpose: See every agency-scope action for compliance + debug.
Route: `/agency/audit`   Persona: Agency (owner / admin / member+readonly-pack for view)   Device: desktop   Mode: n/a
Current state: MISSING dedicated page. **BACKEND-BLOCKER:** `GET /api/admin/audit-log` exists but is PA-scoped (`requirePlatformAdmin`). This screen needs a **new agency-scoped endpoint**: `GET /api/agency/:agencyId/audit-log` that filters `audit_log` rows where `tenant_id = 'agency:' || agencyId` AND enforces caller is owner/admin of that agency. **Backend work ~2 days. Do NOT build the frontend until this exists.**
Workflow role: role=Audit / history.
Key components: Table (timestamp, actor, action, target, before/after JSON diff), filters (actor, action, target-type, date-range, category), search (JSON contains), Export CSV/PDF for compliance.
Primary actions: Row → detail modal.
State variants: loading, empty, error, permission-denied (member+finance-pack sees a billing-only subset).
Entry from: AGN-SET-001, AGN-DSH-001 attention cards, AGN-MEM-009 offboarding audit link.
Exit to: same, or drill to related entity.
Metering: n/a
Notes: Every agency-scope write action in the system MUST emit an audit row with `tenant_id = 'agency:<id>'` — instrument every write route as part of the backend build.

---

<a id="17-agn-pub"></a>
## 17. AGN-PUB — Public profile customization

### AGN-PUB-001 — Public profile settings

Purpose: Configure what's shown on the public agency page (SHR-PUB-003).
Route: `/agency/public-profile`   Persona: Agency (Owner / Admin / Marketer)   Device: desktop   Mode: n/a
Current state: PARTIAL (some fields in `AgencyManagementPage.tsx`).
Workflow role: n/a
Key components: Toggles (Show team, Show listings, Show reviews, Show closed transactions, Show contact form), custom hero content, meta description for SEO, Save & Preview.
Primary actions: Save; Preview (opens SHR-PUB-003 in new tab).
State variants: loading, error.
Entry from: AGN-DSH-001, AGN-SET-001.
Exit to: SHR-PUB-003 preview.
Metering: n/a
Notes: Changes propagate to public page cache immediately (or with 60s TTL).

---

## Summary

| Section | Screens | EXISTS | PARTIAL | MISSING |
|---|---|---|---|---|
| AGN-DSH | 2 | 1 | 0 | 1 |
| AGN-MEM | 9 | 0 | 3 | 6 |
| AGN-ROL | 2 | 0 | 0 | 2 |
| AGN-PRC | 4 | 1 | 0 | 3 |
| AGN-CRD | 6 | 0 | 3 | 3 |
| AGN-SUB | 5 | 2 | 2 | 1 |
| AGN-INV | 3 | 2 | 1 | 0 |
| AGN-WLB | 6 | 1 | 4 | 1 |
| AGN-WID | 2 | 1 | 1 | 0 |
| AGN-ROU | 3 | 1 | 1 | 1 |
| AGN-SYN | 4 | 0 | 3 | 1 |
| AGN-TPL | 2 | 0 | 1 | 1 |
| AGN-WLA | 2 | 1 | 1 | 0 |
| AGN-REP | 8 | 0 | 1 | 7 |
| AGN-SET | 7 | 1 | 3 | 3 |
| AGN-AUD | 1 | 0 | 0 | 1 |
| AGN-PUB | 1 | 0 | 1 | 0 |
| **Total** | **67** | **11** | **25** | **31** |

**Agency-specific workflows introduced:**

| WF | Name | Initiator | Approver | Key screens |
|---|---|---|---|---|
| WF-02 | Agent joins agency | Agent (SHR-AUT-006 / AGN-MEM-005) | Agency Owner/Admin | AGN-MEM-002, AGN-MEM-002b, plus Agent recipient screen in Agent matrix |
| WF-05 | Report bad comparable (Agency variant) | Agency Owner/Admin/Marketer | PA | AGN-PRC-004 initiator; PA review at PA-PVA-008 |
| WF-13 | Change plan (Agency subscription) | Agency Owner/Finance | System (elevated) | AGN-SUB-002, AGN-SUB-003 |
| WF-29 | Offboard agent | Agency Owner/Admin | none (destructive with step-up) | AGN-MEM-009 |
| WF-30 | Agency top-up | Agency Owner/Finance | Paddle webhook | AGN-CRD-002, AGN-CRD-003 |
| WF-31 | Ownership transfer | Agency Owner | Target Admin | AGN-SET-005, AGN-SET-005b |
| WF-32 | Delete agency | Agency Owner | Self (3-factor: liveness + email + TOTP) | AGN-SET-006 |

**Highest-impact Agency gaps:**
1. **AGN-MEM-*** (Members management) — 6 missing screens; application queue + detail + invite flow are foundational
2. **AGN-REP-*** (Reports) — 7 missing screens; agencies expect these on day 1
3. **AGN-CRD-004/005/006** (Allocation rules + feature quota view) — differentiator vs. per-seat competitors
4. **AGN-SET-005/005b/006** (ownership transfer + delete) — enterprise-grade destructive-action patterns
5. **AGN-WLB-*** (site builder decomposition) — current page needs to be a multi-screen builder + preview + settings flow to be usable
6. **AGN-DSH-002** (onboarding checklist) — critical for agency activation (paid conversion)
