# Wingcaster — Screen Matrix: Agent

Conventions, screen-entry format, and workflow subtype vocabulary defined in `SCREEN_MATRIX_SHARED.md §0`. Feedback capture in `SCREEN_MATRIX_FEEDBACK.md`.

**Scope characteristics** for every screen in this document unless otherwise noted:
- Device: mobile 375px primary (baseline 360px), tablet 768px, desktop 1440px stretch
- Locale: English + Arabic RTL (first-class per design brief §3.5)
- Theme: light default, dark supported
- Mode: dual (Guided default for new signups; Pro opt-in from settings or auto-suggested after N days). Where a screen has meaningful mode differences, listed twice.
- Auth: user is an authenticated Agent (solo or agency-scoped); role checks inside pages
- Elevation: sensitive writes via `SHR-MFA-007` (Step-Up)
- Runtime: Capacitor wrapper on iOS + Android; offline handling per `SHR-ERR-004`
- Navigation chrome: bottom tab bar `SHR-NAV-003` (mobile) + top nav `SHR-NAV-002` (desktop)

Written 2026-09-03. Reflects `origin/main @ b989e6b`.

---

## DECISIONS + PRIORITIES 2026-09-04 (after user review of the matrix)

The Agent matrix review surfaced that infrastructure screens (billing, subscriptions, integrations) are built but value-creating screens (onboarding, publishing outcomes, AI refinement, workflow recipients) are not. Weighted by user value the completion rate is closer to 10-12%, not the raw 26%. Two decisions locked, seven priority reorderings applied.

### D3 → Dual-mode scope: Option (c) with focused-domain execution

**Ship dual-mode across every Agent screen as originally scoped.** BUT investment concentrates on 5 high-value domains where dual-mode delivers the most differentiation:

1. **Home page** → AGT-DSH (Dashboard) — Guided AGT-DSH-001 + Pro AGT-DSH-002 both fully designed
2. **Listing Management** → AGT-LST (Listings + Create/Edit + Detail + Publications + Comments + Analytics) — every LST screen gets both variants
3. **Listing Broadcasting** → AGT-PUB (Publishing flows) — Guided one-tap AGT-PUB-001 + Pro per-channel AGT-PUB-002 + all outcome/retry/tracker screens dual-mode
4. **Communication** → AGT-INB (Unified inbox) — Guided single-thread focus + Pro multi-thread + saved-views + keyboard shortcuts
5. **CRM** → AGT-CTC + AGT-OPP + AGT-TSK (Contacts + Opportunities + Tasks) — Guided card+list + Pro table+kanban+bulk-actions

Screens outside these 5 domains keep the `Mode: both` notation with density notes — a light Pro affordance (denser tables, direct-edit fields, keyboard shortcuts) layered over the Guided base. Standalone Pro variants only exist for the 5 focus domains above.

**Impact on the matrix:** AGT-DSH-002, AGT-LST-002, AGT-OPP-001 vs -001b, AGT-CMP-002 vs -003 — all move from "MISSING (nice-to-have)" to **P0 (required for v1)**. Same for the Pro variants of AGT-PUB-002, AGT-INB-001, AGT-CTC-001. Mode-toggle screen AGT-SET-002 becomes P0.

### D4 → Onboarding: ship all 5 ONB screens in one push

**All 5 AGT-ONB screens are P0 for v1.** No phased release. This includes the WhatsApp intake tour (AGT-ONB-002 / -003) which has an **explicit backend prerequisite: per-agent WhatsApp Business number provisioning must exist at signup time**. Currently the WhatsApp intake pipeline (`modules/whatsapp-listings/`) accepts inbound messages against a single agency-level number and matches them to agents by phone. For at-signup-time WhatsApp intake to work, each new agent needs either (a) their own dedicated Business number (expensive, provisioning latency), or (b) a shared Business number with a per-agent activation code the agent sends first ("MY-CODE-1234") to bind their identity. Cursor / backend must decide the model before the onboarding tour ships — flag as **backend dependency AGT-ONB-BLOCKER-01**.

### Priority reordering 2026-09-04

**P0 — required for shippable v1 (must exist to trust the platform):**

| Screen(s) | Reason |
|---|---|
| **All 5 AGT-ONB** (Welcome, WhatsApp tour, First-listing review, Celebration, Progress checklist) | Onboarding is the activation funnel. Empty dashboard on signup = churn. Per D4 (c). |
| **All 6 AGT-REC** (portal outcome, comparable-report outcome, price-report outcome, agency-join outcome, account-recovery outcome, ownership-transfer recipient) | Workflow feedback loop. Without outcome screens, users act blind and lose trust. Cheap to build (deep-links from notifications) but critical. |
| **AGT-PUB-003 (outcome/receipt)** | Publishing is the metered revenue surface. Without confirmation of what succeeded/failed, agents can't validate what they paid for. Revenue leak. |
| **AGT-PUB-005 (portal submission form)** | Part of the same workflow as -003 and -006. Robust per-portal field validation. |
| **AGT-PUB-006 (portal moderation tracker)** | Portal submissions have SLAs. Agents need visibility of PA decisions. **Cross-matrix blocker: PA-MOD-001/002 must also ship.** |
| **AGT-LAI-002 (AI refine loop)** | Generate-once-stuck-with-it is worse than no AI. Refinement loop is the critical UX. Same effort as -001 (already partial). |
| **AGT-DSH-002 (Pro dashboard)** | Per D3 (c) — home is a focus domain. |
| **AGT-LST-002 (Pro table view)** | Per D3 (c) — listing management is a focus domain. |
| **AGT-SET-002 (mode toggle)** | Per D3 (c) — without a toggle, dual-mode is invisible. |
| **AGT-CTC-007 (contact relationships editor)** | Schema exists (`contact_relationships` table); CRM cannot function without representation/mandate tracking under multi-tenant contact model. |

**P1 — required for enterprise-grade v1 (must exist before Paddle-verified customers):**

| Screen(s) | Reason |
|---|---|
| **AGT-PUB-004 (retry/republish with fixes)** | Reduces support burden on failed publishes. |
| **AGT-CMP-003 (Pro campaign builder)** | Per D3 (c) — communication is a focus domain, campaigns are part of the comms surface. |
| **AGT-OPP-001b (Guided mobile list view)** | Per D3 (c) — CRM is a focus domain, kanban isn't mobile-usable. |
| **AGT-INB-005 (channel + source dual-badge)** | Requires backend schema extension (`conversations.source_channel` split into `channel` + `source`). |
| **AGT-LST-013 (property disposition case)** | Legal/compliance for agent-leaves-agency; schema exists (`property_disposition_cases`). |
| **AGT-LST-014 (canonical property view)** | Transparency when multiple agencies list the same physical property. |
| **Mobile-first pass on top 8 screens** — AGT-DSH-001, AGT-LST-001, AGT-LST-003, AGT-INB-001, AGT-INB-002, AGT-CTC-002, AGT-PUB-001, AGT-WLA-002. Accept that full mobile-first is a platform rewrite; scope to the 8 highest-traffic screens for v1. 3-4 weeks focused work. |

**P2 — Phase 2 (post-PMF or post-Paddle-live):**

| Screen(s) | Reason |
|---|---|
| AGT-PUB-007 (schedule publish) | Deferred publishing; nice-to-have. |
| AGT-CMP-005 (saved searches) | Pro feature; low traffic. |
| AGT-HTX-003 (import CSV) | Pro feature; low traffic. |
| AGT-APR-005 / -006 (agent price reports) | Pro feature; requires PA review; secondary to core CRM flows. |
| AGT-REV-001 (reviews received) | Trust surface; nice-to-have but not blocking. |
| Mobile-first pass on the remaining screens | Deferred pending v1 launch feedback. |
| Custom report builder equivalent for Agent (if any) | v2 feature per Agency-side pattern. |

### Cross-matrix dependency callouts

Some Agent screens are blocked by other-persona screens. Building the Agent side without the counterpart wastes effort:

| Agent screen | Blocked on | Blocker status |
|---|---|---|
| AGT-REC-004 (agency join outcome — recipient) | AGN-MEM-005 (public "join agency" application submission page) | AGN-MEM-005 **MISSING** in Agency matrix |
| AGT-REC-006 (ownership transfer — target agent side) | AGN-SET-005b (accept ownership transfer page) | AGN-SET-005b **MISSING** in Agency matrix |
| AGT-PUB-006 (portal moderation tracker) | PA-MOD-001 (PA moderation queue) + PA-MOD-002 (submission detail) | Both **MISSING** in PA matrix |
| AGT-REC-002 (comparable-report outcome) | PA-PVA-008 (PA comparable-report review queue) | **MISSING** in PA matrix |
| AGT-REC-003 (agent price-report outcome) | PA-PVA-009 (PA agent price-report review queue) | **MISSING** in PA matrix |
| AGT-LST-013 (property disposition case) | AGN-MEM-009 (agency offboarding wizard) | **PARTIAL** in Agency matrix |
| AGT-WLA-* (WhatsApp intake pipeline) | AGN-WLA-* (agency entitlements admin) + backend per-agent number provisioning (AGT-ONB-BLOCKER-01) | Frontend PARTIAL; backend prereq undecided |

**Sequencing recommendation:** work by dependency graph, not by persona. If the goal is a shippable Agent surface, the Agency-side + PA-side blockers above must ship in parallel or before.

### On the "MRR" defect from the Agency review

Same defect exists on AGT-DSH-001 if I fabricated any equivalent metric. Re-read shows AGT-DSH-001 KPIs are: "urgent card, quota strip, recent activity feed" — no fabricated financial metric. Clean.

### Corrections applied in THIS pass

- Priorities table added (above).
- D3 decision documented + 5 focus domains listed.
- D4 decision documented + AGT-ONB-BLOCKER-01 backend dependency flagged.
- Cross-matrix dependency table added.

### Corrections queued for a follow-up authoring pass

Each of these needs the individual screen entry below to be edited (not just this preamble):
1. Elevate every AGT-REC entry from MISSING to P0 with explicit "deep-link from notification" pattern.
2. Elevate AGT-PUB-003/005/006 entries from PARTIAL/MISSING to P0.
3. Rewrite AGT-LAI-002 as required, not optional.
4. Rewrite AGT-DSH-002, AGT-LST-002, AGT-SET-002 with fully-designed Pro variants (not just "Pro shows denser table").
5. Add cross-matrix blocker annotation to each blocked screen.
6. Update "mobile 375px" scope claim honestly (top 8 screens for v1, rest deferred).
7. Design the AGT-CMP-003 and AGT-INB Pro variants concretely.
8. Design the AGT-OPP-001b Guided mobile variant concretely.

---

## CORRECTIONS APPLIED 2026-09-04 (after full code read)

The following corrections apply platform-wide across every Agent screen. Cited from actual code, not docs.

**1. Every agent user always has BOTH a personal tenant AND (optionally) agency memberships.** From `identity.js :: createAgentAccount` + `migration 028_tenant_authorization_foundation.sql`: signup auto-provisions a `personal:<user_id>` tenant with membership role=`owner`, affiliation=`personal`. Agency membership is ADDITIONAL, not substitutional. A user may be `non_exclusive` member of multiple agencies simultaneously (limit: only one `exclusive` at a time).

Consequence: every Agent screen renders under a SELECTED tenant context (personal or one specific agency). The tenant switcher `SHR-NAV-008` is a first-class chrome element. Every screen entry below implicitly gains a `Tenant context:` line — the tenant currently selected shapes what data is visible (my personal listings vs. this agency's listings), what actions are allowed (I might be `owner` in personal but `member` in agency), and what capabilities are exposed.

**2. Property ownership is layered.** `properties` carries `tenant_id` (owner) + `custody_tenant_id` (who manages, may differ) + `ownership_type` (personal/agency/shared) + `source_user_id` (who created) + `exit_disposition` (agency_retains / agent_retains / case_review for what happens when the source user leaves the tenant). This is not just for accounting — it drives what UI is shown and what actions are allowed.

**3. Contact relationships are multi-tenant.** `contact_relationships` table models buyer_representation / seller_mandate / landlord_mandate / tenant_representation / referral / prior_affinity — each with exclusivity (exclusive/non_exclusive) and scope. Same person can be represented by different agents in different agencies. My matrix's original AGT-CTC section assumed contacts were tenant-scoped only; that's incomplete.

**4. Two same-address listings are canonicalised.** `canonical_properties` deduplicates the physical property across agencies (Elite lists it, Cedar lists it, both show under one canonical property with a chosen primary listing). Public views should aggregate; agent views show the agent's own listing.

**5. Territories carry per-country disclosure fields.** `territories` + `territory_disclosure_fields` (from migration 003) define which fields are required per country/territory. Property forms must be territory-aware — a listing in Dubai has different mandatory fields than one in Beirut.

**6. Inbound inquiries carry `channel` (transport) AND `source` (origin) as distinct attributes.** Per user feedback 2026-09-04, the unified comms hub (`conversations` + `conversation_messages` in migration 005) normalises across WhatsApp / Email / SMS / IG / FB / TikTok / X / LinkedIn. Inbox rows must show BOTH badges. Sources include: Direct / WingCaster-hosted (agent profile / agency profile / white-label / widget) / Real Estate Bazaar / external portals (OLX, Property Finder, Bayut, Dubizzle).

**7. Real Estate Bazaar is a SEPARATE platform, not part of WingCaster.** RB sits in the Property Finder / Zillow consumer-marketplace space. `properties.marketplace_syndicated` is the per-listing opt-in toggle (see `SHR-INT-001`).

New screens added below to close the gaps: AGT-LST-013 (property disposition case), AGT-LST-014 (canonical property view), AGT-CTC-007 (contact relationships editor), AGT-INB-005 (channel+source dual-badge treatment).

---

## Guided vs Pro — how to read the matrix

Every user-facing feature is available in BOTH modes; nothing is Pro-locked.

- **When flows are similar and only density differs** → ONE screen entry with `Mode: both` and a Notes line describing what changes.
- **When flows fundamentally diverge** (Guided wizard vs. Pro single-form, card grid vs. dense table, one-decision-per-screen vs. everything-on-one-screen) → TWO screen entries with `Mode: guided` and `Mode: pro`.

Guided mode principles: one decision per screen, ≥ 48px touch targets, plain language, contextual "why?" tooltips, big empty-state cards, destructive-action double-confirm. Pro mode principles: table + card toggle, multi-select + bulk actions, saved views, direct-edit fields, keyboard shortcuts overlay, CSV export.

---

## Domain codes used in this document

| Code | Domain |
|---|---|
| ONB | Onboarding + first-run tour |
| DSH | Dashboard |
| LST | Listings (browse / create / edit / view / share / analytics) |
| PUB | Publishing flows (multi-channel + per-channel) |
| WLA | WhatsApp Listings intake (drafts inbox, review, approve) |
| LAI | Listings AI (generate description, refine, apply) |
| NVL | Neighborhood valuator (area intelligence per listing) |
| CTC | Contacts (CRM) |
| OPP | Opportunities (pipeline) |
| TSK | Tasks & reminders |
| CMP | Campaigns |
| TPL | Message templates (agent-scope) |
| INB | Unified inbox (across channels) |
| HTX | Historical transactions (closed deals) |
| APR | Agent pricing portfolio |
| APP | Public agent profile edit |
| CMD | Command Center (agent scope) |
| SUB | Subscription + credits (tenant billing) |
| NPF | Notifications inbox + preferences |
| CHN | Social channel connections |
| ROU | Routing settings |
| INT | Integrations |
| WLB | White-label site (agent read-mostly view) |
| REV | Reviews received on public profile |
| REC | Recipient screens (workflow outcomes) |
| SET | Agent settings shell |

---

## Table of contents

- [1. AGT-ONB — Onboarding](#1-agt-onb)
- [2. AGT-DSH — Dashboard](#2-agt-dsh)
- [3. AGT-LST — Listings](#3-agt-lst)
- [4. AGT-PUB — Publishing flows](#4-agt-pub)
- [5. AGT-WLA — WhatsApp Listings intake](#5-agt-wla)
- [6. AGT-LAI — Listings AI](#6-agt-lai)
- [7. AGT-NVL — Neighborhood valuator](#7-agt-nvl)
- [8. AGT-CTC — Contacts](#8-agt-ctc)
- [9. AGT-OPP — Opportunities](#9-agt-opp)
- [10. AGT-TSK — Tasks & reminders](#10-agt-tsk)
- [11. AGT-CMP — Campaigns](#11-agt-cmp)
- [12. AGT-TPL — Message templates](#12-agt-tpl)
- [13. AGT-INB — Unified inbox](#13-agt-inb)
- [14. AGT-HTX — Historical transactions](#14-agt-htx)
- [15. AGT-APR — Agent pricing portfolio](#15-agt-apr)
- [16. AGT-APP — Public profile editor](#16-agt-app)
- [17. AGT-CMD — Command center](#17-agt-cmd)
- [18. AGT-SUB — Subscription & credits](#18-agt-sub)
- [19. AGT-NPF — Notifications inbox & preferences](#19-agt-npf)
- [20. AGT-CHN — Social channel connections](#20-agt-chn)
- [21. AGT-ROU — Routing settings](#21-agt-rou)
- [22. AGT-INT — Integrations](#22-agt-int)
- [23. AGT-WLB — White-label site (agent view)](#23-agt-wlb)
- [24. AGT-REV — Reviews received](#24-agt-rev)
- [25. AGT-REC — Recipient / outcome screens](#25-agt-rec)
- [26. AGT-SET — Agent settings shell](#26-agt-set)
- [Summary](#summary)

---

<a id="1-agt-onb"></a>
## 1. AGT-ONB — Onboarding

### AGT-ONB-001 — Welcome (post-signup)

Purpose: The just-signed-up agent lands here. Sets the "why Wingcaster" moment and offers three intake paths.
Route: `/onboarding`   Persona: Agent (new)   Device: mobile 375px primary   Mode: guided
Current state: MISSING (currently sign-up dumps to dashboard).
Workflow role: n/a
Key components: Hero (name + welcome), 3 large intake cards ("Send a WhatsApp voice memo → we draft your first listing" → AGT-ONB-002, "Add a listing manually" → AGT-LST-004, "Import from a spreadsheet" → AGT-SYN-002 equivalent), skip link.
Primary actions: Choose intake path.
State variants: offline (queue skip), error.
Entry from: `SHR-AUT-006` success, `SHR-NAV-001` new-user branch.
Exit to: AGT-ONB-002 / AGT-LST-004 / import path.
Metering: n/a
Notes: Language selector persistent top-right. Illustrations must feel warm and MENA-appropriate — no Western real-estate stock imagery.

### AGT-ONB-002 — WhatsApp intake tour (aha moment)

Purpose: Walk the new agent through the WhatsApp intake path with a live demo.
Route: `/onboarding/whatsapp`   Persona: Agent (new)   Device: mobile 375px   Mode: guided
Current state: MISSING.
Workflow role: n/a
Key components: Big QR / Save Number card ("Save +971 XX XXX WXXX as 'Wingcaster'"), step-by-step animated illustration (Send photos → Send voice → We draft → You approve), Start Chat button (opens `wa.me` deep-link), "I've sent something" button → AGT-ONB-003.
Primary actions: Add number to contacts; Start Chat; Continue.
State variants: waiting-for-first-message (polling with friendly copy).
Entry from: AGT-ONB-001.
Exit to: AGT-ONB-003.
Metering: n/a
Notes: Deep-link opens WhatsApp with pre-filled greeting message ("Hi! I'd like to list a property"). Poll for the first draft to appear in the inbox; if none in 5 min, gentle nudge with alternative paths.

### AGT-ONB-003 — First-listing review (post-intake)

Purpose: The AI-drafted listing appears; agent reviews.
Route: `/onboarding/first-listing/:draftId`   Persona: Agent (new)   Device: mobile 375px   Mode: guided
Current state: MISSING dedicated onboarding version (AGT-WLA-002 covers the recurring version).
Workflow role: WF-01 role=Composition (WhatsApp AI-draft review, onboarding variant).
Key components: Same as AGT-WLA-002 but wrapped in a celebration frame ("Look at this! We drafted your first listing from a voice memo"), Approve button (large, primary), Edit button, Discard.
Primary actions: Approve → AGT-ONB-004; Edit → AGT-LST-005; Discard → AGT-ONB-001.
State variants: loading, ai-processing (poll), error.
Entry from: AGT-ONB-002.
Exit to: AGT-ONB-004.
Metering: `WA_LISTING_INTAKE` on draft creation (already consumed by the time this screen renders).
Notes: Copy: "You've turned a voice memo into a published-ready listing. Approve to see it live."

### AGT-ONB-004 — First-listing published (celebration)

Purpose: Positive reinforcement after first listing is live; offers next best actions.
Route: `/onboarding/first-listing/published`   Persona: Agent (new)   Device: mobile 375px   Mode: guided
Current state: MISSING.
Workflow role: n/a
Key components: Confetti / hero, listing thumbnail, 3 next-action cards ("Share on your Instagram" → AGT-PUB-002, "Connect your other channels" → AGT-CHN-001, "Explore your dashboard" → AGT-DSH-001).
Primary actions: Choose next action; Later.
State variants: n/a
Entry from: AGT-ONB-003.
Exit to: AGT-PUB-002 / AGT-CHN-001 / AGT-DSH-001.
Metering: n/a
Notes: Skip goes to dashboard. Onboarding progress persisted server-side so later sessions can resume.

### AGT-ONB-005 — Progress checklist (persistent nudge)

Purpose: While onboarding is < 100%, show a checklist card on the dashboard.
Route: card embedded in AGT-DSH-001   Persona: Agent (new-ish)   Device: mobile   Mode: guided
Current state: MISSING.
Workflow role: n/a
Key components: Progress ring, remaining steps (Connect channels / Enable notifications / Set up your public profile / Upgrade to paid), Dismiss forever link.
Primary actions: Tap step; Dismiss.
State variants: fully-complete (auto-dismiss).
Entry from: AGT-DSH-001 auto-render when incomplete.
Exit to: Various.
Metering: n/a
Notes: In Pro mode, checklist collapses to a compact status pill.

---

<a id="2-agt-dsh"></a>
## 2. AGT-DSH — Dashboard

### AGT-DSH-001 — Agent dashboard (mobile, Guided)

Purpose: "What matters today" — greeting, urgent items, quota status, quick add.
Route: `/dashboard`   Persona: Agent   Device: mobile 375px   Mode: guided
Current state: EXISTS — `web/src/pages/AgentDashboardPage.tsx`. Needs mobile-first redesign + Guided vs Pro split + RTL.
Workflow role: n/a
Key components: Greeting ("Morning, Sara"), Urgent card (top 1-2 items: new lead, price-drop alert, expiring listing), Quota strip (visual "42 of 50 Instagram posts left"), Quick Add FAB (Add listing / New contact / Add task), Recent activity feed (last 5).
Primary actions: Tap urgent → context; Tap FAB; Tap activity item.
State variants: loading (skeleton), empty (onboarding checklist AGT-ONB-005), error, offline.
Entry from: `SHR-NAV-001` Agent branch, bottom-tab Dashboard.
Exit to: Various.
Metering: n/a
Notes: One-hand thumb reach — FAB bottom-right (RTL: bottom-left). No dense tables here.

### AGT-DSH-002 — Agent dashboard (Pro) (P0 — REWRITTEN 2026-09-04 per D9 focused-domain)

Purpose: Power-user dashboard — customizable widget grid, dense KPIs, keyboard-first navigation. Home is a D3 focus domain — Guided AGT-DSH-001 and Pro AGT-DSH-002 both fully designed.
Route: `/dashboard` when `tenant_memberships.data.ui_mode = 'pro'`   Persona: Agent (Pro)   Device: mobile 375px + tablet 768px + desktop 1440px (all three explicitly designed)   Mode: pro
Current state: MISSING — must ship with the Home focus-domain cluster.
Workflow role: n/a
Key components:
- **Widget grid (12-column responsive)** — rearrangeable via drag-and-drop; widget palette on right rail
- **Widget types (Pro):** KPI cards (Active listings / Leads MTD / Conversion rate / Response time / Revenue attribution — click to drill), Funnel visualization (leads → viewings → offers → closed), Recent activity stream (last 20 events, filterable by type), Credit-quota strip (per-feature progress bars, tap to top up), Task list (today + tomorrow + overdue), Top-listings-by-performance widget, Calendar (upcoming viewings), Inbox preview (last 5 unread threads), Bazaar-driven-leads counter, Pipeline value estimate
- **Layout persistence:** stored server-side per user in `tenant_memberships.data.dashboard_layout`; syncs across devices
- **Add Widget menu** — categorized list; drag to grid
- **Keyboard shortcuts:** `?` to reveal shortcut sheet; `1-9` to open widget in fullscreen; `/` to focus global search; `G+D` (Dashboard) / `G+I` (Inbox) / `G+L` (Listings) navigation; `⌘K` command palette (per SHR-NAV-005)
- **Density toggle:** compact / comfortable / spacious rows within widgets
- **Reset to default layout** button in overflow menu
Primary actions: Drag widgets; Add / remove widgets; Fullscreen a widget; Save layout (auto-saves debounced); Keyboard nav to any deep view.
State variants: loading (skeleton grid), empty (no widgets — nudge to Add Widget), error, layout-conflict (multi-device — last-write-wins with a "your layout changed on another device" toast), first-time-Pro (guided tour overlay explaining widget grid).
Entry from: `/dashboard` when Mode=Pro (server-side tenant_memberships check).
Exit to: Various (per widget drill).
Metering: n/a
Notes: Guided variant AGT-DSH-001 stays the default for new signups; users opt into Pro via AGT-SET-002 mode toggle. Layout is per-user AND per-tenant-context (different layout when acting in agency tenant vs personal tenant). Pro mode is available on mobile too, not desktop-only — Pro on mobile stacks widgets vertically with smaller cards.

---

<a id="3-agt-lst"></a>
## 3. AGT-LST — Listings

### AGT-LST-001 — Listings index (card view, Guided, mobile)

Purpose: Browse own listings as photo-forward cards.
Route: `/listings`   Persona: Agent (own listings)   Device: mobile 375px   Mode: guided
Current state: EXISTS — `web/src/pages/ListingsPage.tsx`. Needs mobile-first card view + Guided/Pro split + RTL.
Workflow role: n/a
Key components: Filter chips (All / Active / Draft / Pending / Sold), search, cards (photo, price, beds/baths/area, status badge, days-on-market, quick actions overlay on long-press), FAB (add listing).
Primary actions: Tap card → AGT-LST-003; Long-press → quick actions; FAB → AGT-LST-004.
State variants: loading (skeleton cards), empty (illustrated "Add your first listing"), error, offline.
Entry from: bottom-tab Listings.
Exit to: AGT-LST-003, AGT-LST-004.
Metering: n/a
Notes: Infinite scroll with 20-item pages. Card thumbnails 1:1 crop with price overlay.

### AGT-LST-002 — Listings index (table view, Pro) (P0 — REWRITTEN 2026-09-04 per D9 focused-domain)

Purpose: Dense sortable table for power browsing. Listing Management is a D3 focus domain — Guided card view (AGT-LST-001) and Pro table view (AGT-LST-002) both fully designed.
Route: `/listings?view=table` OR `/listings` when Mode=Pro   Persona: Agent (Pro)   Device: mobile 375px + tablet 768px + desktop 1440px   Mode: pro
Current state: MISSING — must ship with Listing Management focus-domain cluster.
Workflow role: n/a
Key components:
- **Table (virtual-scroll for 1000+ rows):** columns (thumbnail / title / address / price / beds / baths / area / status / publication-count / views / inquiries / last-activity / owning-agent when in agency context / bazaar-syndicated toggle / actions)
- **Column customization:** show/hide columns via right-click menu; column order draggable; widths resizable; persisted server-side per user
- **Multi-select column** with header check-all + shift-click range-select
- **Filter bar:** persona-scoped filters (Status / Property type / City / Area / Price range / Days-on-market / Publication state per channel / Assigned-to-me / Missing photos / Below-market-price flag / Bazaar-syndicated flag)
- **Saved views dropdown:** "My active drafts", "Below market price", "Expiring soon", "Never published to portals" — user-authorable; shareable within tenant
- **Bulk actions bar (appears on selection):** Publish to channels / Archive / Price adjust / Change owning agent (agency context) / Toggle Bazaar syndication / Delete (with 3-tap confirm per selection count) / Export CSV
- **Keyboard shortcuts:** `J`/`K` row nav / `Enter` open detail / `Space` select / `X` bulk-select / `A` select-all / `Escape` deselect / `/` focus filter / `F` open filter drawer / `S` save current view / `⌘K` command palette
- **Inline direct-edit** for common fields (price, status) with keyboard save on Enter — no separate edit screen for one-field changes
- **Row context menu (right-click):** open detail, duplicate, share, quick-publish, quick-adjust-price, archive, delete
Primary actions: Row → AGT-LST-003; Bulk (any of above); Save view; Direct-edit; Keyboard nav.
State variants: loading (skeleton rows), empty, error, filter-yields-empty (nudge to save filter as view for later), export-in-progress (shows toast on ready).
Entry from: `/listings` when Mode=Pro or explicit view=table toggle.
Exit to: AGT-LST-003 (detail).
Metering: n/a
Notes: Guided variant AGT-LST-001 (card view) stays default. Users toggle to table via view switcher OR by switching to Pro mode globally. On mobile, table renders as horizontal-scrolling with sticky first column (title) and keyboard shortcuts replaced by long-press context menu.

### AGT-LST-003 — Listing detail (Guided, mobile)

Purpose: Full profile of one owned listing with tabs for content, publications, comments, analytics.
Route: `/listings/:id`   Persona: Agent (owner) + shared (public view is SHR-PUB-001)   Device: mobile 375px   Mode: guided
Current state: EXISTS — `web/src/pages/ListingProfilePage.tsx`. Needs Guided mobile layout + RTL + performance tabs.
Workflow role: n/a
Key components: Photo/video hero (swipe gallery), price + beds/baths/area row, status pill, tabs (Overview | Publications | Comments | Analytics | Notes), sticky bottom action bar (Publish → AGT-PUB-001, Edit → AGT-LST-005, Share, More menu).
Primary actions: Publish; Edit; Share (native share sheet); More (Duplicate, Archive, Delete).
State variants: loading, error, permission-denied (not owner), sold (subdued + "Sold" watermark).
Entry from: AGT-LST-001, AGT-LST-002, notification deep-link, share link, AGT-WLA-002 approve.
Exit to: AGT-PUB-001, AGT-LST-005.
Metering: `POST /api/properties/:id/events` (view telemetry).
Notes: Sticky bottom action bar critical for one-hand mobile. Delete is destructive — 3-tap confirm (initial → warn → typed confirm). RTL: gallery swipe direction mirrors.

### AGT-LST-004 — Listing create (Guided wizard, mobile)

Purpose: Step-by-step creation for less-technical agents.
Route: `/listings/new` (wizard)   Persona: Agent   Device: mobile 375px   Mode: guided
Current state: PARTIAL — `ListingFormModal.tsx` exists as a single-form modal; needs wizard variant.
Workflow role: n/a
Key components: Progress dots + step title, one decision per screen (Step 1 Location → Step 2 Property basics → Step 3 Photos & video → Step 4 Description (AI-assist link → AGT-LAI-001) → Step 5 Price → Step 6 Review → Publish choice), Next / Back / Save Draft.
Primary actions: Next / Back / Save Draft / Publish.
State variants: uploading (photos), validation, offline (queue), autosave-success toast.
Entry from: AGT-LST-001 FAB, AGT-DSH-001 quick-add, AGT-ONB-001.
Exit to: AGT-LST-003 on save, AGT-PUB-001 on publish.
Metering: `LISTING_CREATE` if metered; check features.js.
Notes: Every step autosaves. Photo step uses native camera + gallery picker via Capacitor; supports voice notes as descriptions. RTL: progress dots mirror.

### AGT-LST-005 — Listing create/edit (Pro single-form) [UPDATED 2026-09-04]

Updated content: this screen additionally must include (a) a **territory picker** which loads the correct disclosure fields per country per `territories` + `territory_disclosure_fields` (migration 003 — required per country), (b) the **`marketplace_syndicated` toggle** per `SHR-INT-001` (default from tenant setting), (c) an **ownership disposition** dropdown that sets `properties.exit_disposition` (`agency_retains` / `agent_retains` / `case_review`) shown only when creating within an agency tenant context. Rest of original entry stands.

### AGT-LST-005-original — Listing create/edit (Pro single-form)

Purpose: Everything on one dense screen for fast creation.
Route: `/listings/new?mode=pro` or `/listings/:id/edit`   Persona: Agent   Device: tablet + desktop primary; mobile usable   Mode: pro
Current state: PARTIAL — `ListingFormModal.tsx` is closest.
Workflow role: n/a
Key components: Two-column layout (left: fields grouped; right: photos + preview), sticky Save button, AI-assist inline (each field has ✨ button → AGT-LAI-002), unsaved-changes warning on nav-away.
Primary actions: Save Draft; Save & Publish (opens AGT-PUB-001); Discard.
State variants: loading, unsaved, autosaving, error.
Entry from: AGT-LST-002 row action, AGT-LST-003 Edit button, AGT-LST-001 FAB in Pro mode.
Exit to: AGT-LST-003, AGT-PUB-001.
Metering: n/a
Notes: Direct-edit fields visible in Pro; inline validation on blur.

### AGT-LST-006 — Listing analytics tab

Purpose: One listing's performance metrics.
Route: `/listings/:id?tab=analytics`   Persona: Agent (owner) + Agency roles for their agents   Device: mobile + desktop   Mode: both
Current state: PARTIAL — `components/performance/PerformanceTab.tsx` exists.
Workflow role: n/a
Key components: KPI strip (views, saves, inquiries, viewings, conversion), funnel chart, per-channel breakdown, geographic map of viewers, price history, comparable delta.
Primary actions: Date range; Export PDF (Pro).
State variants: loading, empty (no data yet), error.
Entry from: AGT-LST-003 tab.
Exit to: AGT-LST-003.
Metering: n/a
Notes: Guided mode simplifies to 3 KPIs + one chart; Pro shows the full grid.

### AGT-LST-007 — Listing share sheet

Purpose: Share this listing via native share, WhatsApp, copy link, QR.
Route: modal from AGT-LST-003 (native sheet on iOS/Android via Capacitor)   Persona: Agent   Device: mobile primary   Mode: both
Current state: MISSING dedicated modal.
Workflow role: n/a
Key components: QR (large), copy-link, WhatsApp share, native share button, "Share to my Instagram story" button (uses IG deep-link).
Primary actions: Copy; WhatsApp; Native share; QR download.
State variants: n/a
Entry from: AGT-LST-003, AGT-DSH-001 quick-share.
Exit to: back to AGT-LST-003.
Metering: n/a
Notes: Track shares as `POST /api/properties/:id/events` with source=share.

### AGT-LST-008 — Listing archive (soft delete)

Purpose: Archive a listing (removes from public but preserves history).
Route: confirm modal from AGT-LST-003 More menu   Persona: Agent   Device: responsive   Mode: both
Current state: MISSING.
Workflow role: n/a
Key components: Warning banner, reason picker (Sold / Rented / Withdrawn / Wrong data), notes, Archive button.
Primary actions: Archive → status change; listing removed from public + white-label.
State variants: loading, error.
Entry from: AGT-LST-003.
Exit to: AGT-LST-001 with status filter Archived.
Metering: n/a
Notes: Archive is reversible via Unarchive. True delete is a separate destructive flow (AGT-LST-009).

### AGT-LST-009 — Listing delete (destructive)

Purpose: Permanently remove a listing.
Route: modal from AGT-LST-003 More → Delete   Persona: Agent (owner only)   Device: responsive   Mode: both
Current state: MISSING dedicated flow.
Workflow role: n/a
Key components: Warning banner (what gets destroyed: publications, comments, analytics history), typed confirmation ("Type DELETE"), SHR-MFA-007 step-up.
Primary actions: Delete → hard delete; cannot undo.
State variants: loading, error, has-active-inquiry (warn).
Entry from: AGT-LST-003.
Exit to: AGT-LST-001.
Metering: n/a
Notes: This is a listing delete, NOT the 3-factor account delete (SHR-SET-005 series). Listing deletion doesn't need email + TOTP.

### AGT-LST-010 — Add / edit offer on a listing

Purpose: Record an offer received on a listing.
Route: modal from AGT-LST-003 Overview   Persona: Agent   Device: responsive   Mode: both
Current state: PARTIAL — backend `POST /api/properties/:id/offers` exists.
Workflow role: n/a
Key components: Offeror name (link to CTC), amount, date, terms, status (Received / Countered / Accepted / Withdrawn), notes.
Primary actions: Save.
State variants: loading, error.
Entry from: AGT-LST-003.
Exit to: AGT-LST-003.
Metering: n/a
Notes: On Accept → prompts to close listing (AGT-HTX-002).

### AGT-LST-011 — Publications tab

Purpose: See all past publications of this listing across channels + their status.
Route: `/listings/:id?tab=publications`   Persona: Agent (owner)   Device: mobile + desktop   Mode: both
Current state: PARTIAL — data via `GET /api/properties/:propertyId/distributions`.
Workflow role: n/a
Key components: Timeline (chronological per channel), status pills (Success / Pending / Failed / Removed), Retry button per failed, Refresh insights.
Primary actions: Retry; Refresh insights (metered — cost preview).
State variants: loading, empty, error.
Entry from: AGT-LST-003 tab.
Exit to: AGT-PUB-004 (retry) or same.
Metering: `SOCIAL_INSIGHTS_REFRESH` on refresh.
Notes: Failed publications surface reason from backend + friendly resolution copy.

### AGT-LST-013 — Property disposition case (CORRECTED — added 2026-09-04)

Purpose: When an agent leaves an agency, every property whose `exit_disposition = 'case_review'` opens a two-party disposition case. This screen is where both the agency admin AND the agent see the case, propose an outcome, and reach agreement.
Route: `/listings/:id/disposition` (both parties reach it) OR banner on AGT-LST-003 when case exists   Persona: Agent (source_user_id) + Agency Admin (custody_tenant_id owner/admin)   Device: responsive   Mode: both
Current state: MISSING — schema exists in `migration 028` (`property_disposition_cases` table with statuses pending / agreed / disputed / completed / cancelled), no UI.
Workflow role: WF-29 role=Approval detail (offboarding disposition — now with dual-party approval, not just agency-side).
Key components: Two-party header (Agency X owner-perspective / Agent Y owner-perspective), listing summary, timeline (initiated → agent-decision → agency-decision → resolved), proposed disposition (agency_retains / agent_retains / archive), each party's radio choice, notes, Approve/Reject buttons per party.
Primary actions: Set my decision (agent side); Set my decision (agency side); Resolve when both agree; Escalate to case_review when disputed.
State variants: pending (neither decided), one-sided (one party decided, waiting), agreed (both matched — auto-completes), disputed (parties disagree — flags for admin arbitration), completed, cancelled.
Entry from: AGT-LST-003 banner, AGT-MEM-009 offboarding wizard (agency side).
Exit to: AGT-LST-003 with new tenant_id if disposition changed ownership.
Metering: n/a
Notes: The `property_disposition_cases` table has UNIQUE constraint preventing multiple open cases per property. When status becomes `completed`, `properties.tenant_id` + `custody_tenant_id` are updated per the agreed disposition. Historical record retained.

### AGT-LST-014 — Canonical property view (multi-agency same property)

Purpose: When two or more agencies list the same physical property, the public view shows a canonical aggregation. This screen is the AGENT's view of that canonical record — sees who else lists it, whether their listing is the "primary" chosen by the platform, and (if applicable) requests to be the primary.
Route: banner on AGT-LST-003 when `properties.canonical_id IS NOT NULL` and other siblings exist   Persona: Agent (owning agent of one of the sibling listings)   Device: responsive   Mode: both
Current state: MISSING — schema exists in `migration 003` (`canonical_properties`, `properties.canonical_id`, `canonical_properties.primary_listing_id`), no UI.
Workflow role: n/a
Key components: Canonical badge, list of sibling listings (other agencies + prices + freshness), primary-listing indicator, "Contest primary" action (if I have better exclusive mandate).
Primary actions: View sibling; Contest primary (opens WF-34 primary-mandate dispute).
State variants: I-am-primary, I-am-not-primary, disputed.
Entry from: AGT-LST-003 banner.
Exit to: same.
Metering: n/a
Notes: Public consumer-facing view of the canonical happens on Real Estate Bazaar (separate platform); this WingCaster-side screen is the AGENT's transparency into what's happening.

### AGT-LST-012 — Comments tab

Purpose: See comments received on published channels for this listing.
Route: `/listings/:id?tab=comments`   Persona: Agent (owner)   Device: mobile + desktop   Mode: both
Current state: PARTIAL — backend `GET /api/listings/:id/comments` exists.
Workflow role: n/a
Key components: Comment cards (per channel, author avatar, text, timestamp, classification category badge, sentiment), reply inline, Reclassify override (→ WF-11 initiator).
Primary actions: Reply (opens INB conversation); Reclassify; Mark spam.
State variants: loading, empty, error.
Entry from: AGT-LST-003 tab.
Exit to: AGT-INB-002 (opened conversation).
Metering: n/a
Notes: Comments arrive via webhooks (IG, FB, TikTok, X, LinkedIn); polling for local updates.

---

<a id="4-agt-pub"></a>
## 4. AGT-PUB — Publishing flows

### AGT-PUB-001 — Publish this listing (Guided — one big button)

Purpose: Guided agents want the simplest possible publish action.
Route: modal from AGT-LST-003   Persona: Agent   Device: mobile   Mode: guided
Current state: PARTIAL (existing `PromoteDistributeModal.tsx`).
Workflow role: WF-33 role=Initiator (multi-channel publish).
Key components: Big "Publish everywhere" button (defaults: all connected channels with smart caption); Secondary "Just this channel" collapsible list.
Primary actions: Publish everywhere → confirms cost preview (credits summary) → executes; Choose channels → AGT-PUB-002.
State variants: loading, no-channels-connected (nudge to AGT-CHN-001), insufficient-credits (nudge to AGT-SUB-003), error.
Entry from: AGT-LST-003 Publish button, AGT-ONB-004.
Exit to: AGT-PUB-003 outcome.
Metering: One per channel (`SOCIAL_IG_POST`, `PORTAL_BAYUT_POST` etc.).
Notes: Cost preview MUST show per-channel credit cost + total. Guided user should see one clear number.

### AGT-PUB-002 — Publish per-channel (Pro or Guided-expanded)

Purpose: Choose channels, per-channel caption, preview.
Route: modal / drawer from AGT-LST-003 or AGT-PUB-001   Persona: Agent   Device: mobile + desktop   Mode: both
Current state: PARTIAL.
Workflow role: WF-33 role=Composition.
Key components: Channel picker (checkboxes with connected status + credit cost badge per channel), per-channel caption editor tabs (auto-generated by LAI, editable), per-channel image crop preview, Schedule for later toggle, Publish button.
Primary actions: Publish; Schedule; Save as draft campaign.
State variants: loading, per-channel error, insufficient-credit-for-selection.
Entry from: AGT-LST-003, AGT-PUB-001 expand.
Exit to: AGT-PUB-003.
Metering: Same as above per channel.
Notes: Instagram carousel requires 3+ photos; surface as validation. TikTok requires video. Real-estate portals have per-portal metadata requirements (surface in error state).

### AGT-PUB-003 — Publish outcome / receipt (P0 — REWRITTEN 2026-09-04 per D9)

Purpose: The confirmation surface after every publish action. Without this, agents pay credits and don't know what actually happened — the number-one revenue leak in the platform.
Route: drawer from AGT-PUB-001 / AGT-PUB-002   Persona: Agent   Device: mobile + desktop   Mode: both (Guided simplifies to "success / try again" one-liner; Pro shows the full per-channel grid with retry actions inline)
Current state: MISSING — must ship as P0 with the AGT-PUB cluster.
Workflow role: WF-33 role=Action outcome.
Key components:
- Header: "Published to N of M channels" with visual success/failure ratio
- Per-channel result cards (channel icon + status pill + timestamp): `Success` (green + link to live post), `Queued` (amber + ETA), `Failed` (red + specific reason + Retry button)
- Credits summary: total credits consumed + per-channel breakdown; on partial failure, show "You were only charged for successful channels" (server refunds credit reservations on failed channels)
- Failure classification with resolution guidance per class:
  - `auth-expired` → "Your Instagram connection expired. Reconnect and retry." → Reconnect button (→ AGT-CHN-002)
  - `portal-rules-violation` → "Bayut needs at least 3 photos. Add photos and retry." → Fix & Retry (→ AGT-PUB-004)
  - `insufficient-credit` → "You ran out of Instagram credits this month. Top up or wait until next cycle." → Top Up button (→ AGT-SUB-003) or Upgrade Plan (→ AGT-SUB-002)
  - `content-rejected` → per-channel specific reason with copy fix
  - `rate-limited` → "Instagram limits new posts per hour. Retry in 12 min." (with countdown)
  - `unknown-error` → "Something went wrong. Report this" (opens support with pre-filled correlation ID)
- Next actions: View Published Post (per channel), Retry Failed (all), View Publications tab (→ AGT-LST-011), Close
Primary actions: View live post; Retry per channel; Retry all failed; Contact support (on unknown-error).
State variants: partial-success (mixed grid), all-success (celebratory but minimal — no confetti), all-failed (empathic + concrete resolution).
Entry from: AGT-PUB-001, AGT-PUB-002 auto-shown after publish submit.
Exit to: AGT-LST-011 (publications tab), AGT-PUB-004 (retry).
Metering: n/a (view of prior charges)
Notes: **Revenue-leak fix.** Every failed publish without visibility to the agent is a support ticket + a churn risk + a lost credit charge. This screen closes that loop. Server-side: credit reservations are RELEASED on failure paths (not consumed) so agents aren't charged for failed publishes — the summary reflects this. **Cross-matrix dependency:** none — closes an Agent-side workflow.

### AGT-PUB-004 — Retry / republish

Purpose: Retry a failed publish with corrected content.
Route: modal from AGT-LST-011 or AGT-PUB-003   Persona: Agent   Device: mobile + desktop   Mode: both
Current state: PARTIAL — backend retry route exists.
Workflow role: n/a
Key components: Original failure reason (banner), suggested fix (copy, image crop, missing field), Edit affected field(s) inline, Retry button.
Primary actions: Retry.
State variants: loading, error again.
Entry from: AGT-LST-011, AGT-PUB-003.
Exit to: AGT-PUB-003.
Metering: same as publish.
Notes: Also handles auto-retry-worker triggered items with manual override.

### AGT-PUB-005 — Portal submission form (real-estate portals)

Purpose: Submit a listing to OLX / Property Finder / Bayut / Dubizzle for PA moderation.
Route: modal from AGT-PUB-002 when a real-estate portal is picked   Persona: Agent   Device: mobile + desktop   Mode: both
Current state: PARTIAL — backend `POST /api/properties/:id/submit-to-fi` exists.
Workflow role: WF-03 role=Initiator (portal submission awaiting PA moderation).
Key components: Portal picker, portal-specific required fields (per portal), preview of formatted listing, Submit for Review button.
Primary actions: Submit → goes to PA-MOD-001 queue; user sees "Submitted for review" status.
State variants: loading, per-portal validation errors, error.
Entry from: AGT-PUB-002.
Exit to: AGT-PUB-006 (recipient screen for tracking).
Metering: `PORTAL_BAYUT_POST` etc. on submit or on approval — check backend.
Notes: Different portals have different required extras (Bayut wants trakheesi, PF wants agency license). Prompt for each.

### AGT-PUB-006 — Portal submission status tracker (WF-03 Recipient) (P0 — REWRITTEN 2026-09-04 per D9)

Purpose: The transparency surface for portal submissions. Without this, agents submit to Bayut/PF/OLX/Dubizzle and never see what happened — silent black hole, trust broken.
Route: `/listings/:id/submissions/:subId` (per-submission deep link) + list-view section on AGT-LST-011 (publications tab, filtered by source=portal)   Persona: Agent (submitter)   Device: mobile + desktop   Mode: both
Current state: MISSING — must ship as P0 with the WF-03 cluster.
Workflow role: WF-03 role=Recipient.
Key components:
- Status pill (with color): `Pending PA review` (amber), `Under PA review` (blue), `Approved` (green + live portal link), `Rejected` (red + reason), `Changes requested` (amber + fixable-fields list), `Escalated` (orange), `Withdrawn` (gray)
- SLA countdown (from submission time to expected PA action per portal — different portals have different SLAs)
- PA decision panel (visible post-decision): decision timestamp, PA display name (or anonymized "PA reviewer"), PA notes rendered in plain language
- If approved: live portal URL + View on Portal button + link to portal analytics (if portal supports it)
- If rejected: reason from controlled vocabulary + PA notes + Fix & Resubmit button (→ AGT-PUB-005 with previous submission pre-loaded)
- If changes requested: highlighted fields needing changes + Fix button (→ AGT-PUB-005)
- Submission audit trail (expandable): submitted → assigned → reviewed → decision — timestamps + actors
- Contact support link (opens support with pre-filled submission ID)
Primary actions: Fix & Resubmit; View on portal; Contact support; Withdraw (if still pending).
State variants:
- pending-normal, pending-approaching-SLA (amber warning at 75% of SLA), pending-over-SLA (red — auto-flags to PA queue)
- approved (green + celebratory but minimal)
- rejected-with-fixable-reason, rejected-with-unfixable-reason (e.g., "Content violates portal ToS" — no fix path)
- superseded (a later submission of the same property to the same portal replaces this one)
Entry from: AGT-LST-011 publications tab, in-app notification deep-link, email notification link, `GET /api/my-submissions` list.
Exit to: AGT-PUB-005 (fix + resubmit), AGT-LST-003 (back to listing), external portal URL.
Metering: n/a
Notes: **Trust surface.** Agents pay credits per portal submission — they NEED to see what those credits bought. **Cross-matrix dependency:** requires PA-MOD-001/002 to ship in the same cluster (per D5) — otherwise the queue never resolves and this screen sits in pending forever.

### AGT-PUB-007 — Schedule publish (later)

Purpose: Schedule publish for a future time.
Route: sub-step of AGT-PUB-002   Persona: Agent   Device: mobile + desktop   Mode: both
Current state: MISSING dedicated flow.
Workflow role: n/a
Key components: Date + time picker (with timezone), recurrence (optional weekly), Schedule button.
Primary actions: Schedule → puts into `saved-searches` alerts or `campaigns/run-scheduler`.
State variants: loading, past-time (validation), error.
Entry from: AGT-PUB-002.
Exit to: AGT-PUB-002.
Metering: n/a
Notes: Scheduled posts appear in AGT-LST-011 as "Scheduled" status until fired.

---

<a id="5-agt-wla"></a>
## 5. AGT-WLA — WhatsApp Listings intake

### AGT-WLA-001 — Drafts inbox

Purpose: See all AI-drafted listings from WhatsApp intake awaiting agent approval.
Route: `/agent/whatsapp-listings`   Persona: Agent   Device: mobile + desktop   Mode: both
Current state: EXISTS — `web/src/pages/agent/whatsapp-listings/AgentWhatsAppListingsPage.tsx`.
Workflow role: WF-01 role=Approval queue (agent self-approves their AI drafts).
Key components: List of draft cards (thumbnail, price, area, "3 photos + 1 voice + 1 video", received-at, status: NEEDS_REVIEW / PROCESSED), filters (status, date), search.
Primary actions: Card → AGT-WLA-002.
State variants: loading, empty ("Send a message to your WhatsApp intake number to see drafts here"), error.
Entry from: bottom-tab "More" → WhatsApp Listings, notification deep-link.
Exit to: AGT-WLA-002.
Metering: n/a
Notes: Show WhatsApp intake number + QR at top for easy sharing.

### AGT-WLA-002 — Draft review (Approve / Edit / Discard)

Purpose: Review one AI-drafted listing.
Route: `/agent/whatsapp-listings/drafts/:id`   Persona: Agent   Device: mobile primary   Mode: both
Current state: PARTIAL.
Workflow role: WF-01 role=Approval detail.
Key components: Original message thread (WhatsApp bubble replay), AI extraction card (fields with confidence badges per field), photo/video/voice attachments, Discard / Edit / Approve buttons.
Primary actions: Approve → property created (AGT-LST-003); Edit → AGT-WLA-003; Discard → AGT-WLA-001; Reprocess → re-runs AI.
State variants: loading, ai-still-processing (poll), error.
Entry from: AGT-WLA-001, AGT-ONB-003.
Exit to: AGT-LST-003 (approve), AGT-WLA-003 (edit).
Metering: n/a (already consumed on draft creation).
Notes: Confidence badges (green ≥ 0.9, amber 0.7-0.9, red < 0.7) draw attention where AI is unsure. Voice memos playable inline.

### AGT-WLA-003 — Draft edit-before-approve

Purpose: Fine-tune AI-extracted fields before approving.
Route: modal / drawer from AGT-WLA-002   Persona: Agent   Device: mobile + desktop   Mode: both
Current state: PARTIAL.
Workflow role: WF-01 role=Composition.
Key components: Editable fields (price, beds, baths, area, description, address), photo reorder, Save & Approve button.
Primary actions: Save & Approve → creates property.
State variants: loading, validation, error.
Entry from: AGT-WLA-002.
Exit to: AGT-LST-003 with success toast.
Metering: n/a
Notes: Any manual edit is fed back to AI training pipeline (background).

### AGT-WLA-004 — WhatsApp intake settings

Purpose: Configure the WhatsApp intake preferences (opt-in, notification cadence).
Route: `/agent/whatsapp-listings/settings`   Persona: Agent   Device: responsive   Mode: both
Current state: PARTIAL.
Workflow role: n/a
Key components: Enable intake toggle, notification prefs (Immediately / Batched every hour / Daily digest), auto-approve high-confidence toggle (with warning).
Primary actions: Save.
State variants: loading, error.
Entry from: AGT-WLA-001, AGT-SET-001.
Exit to: AGT-WLA-001.
Metering: n/a
Notes: Auto-approve requires high threshold (all fields ≥ 0.95); UI warns of downside.

### AGT-WLA-005 — WhatsApp intake analytics

Purpose: See stats on your WhatsApp intake (volume, approval rate, AI accuracy).
Route: `/agent/whatsapp-listings/analytics`   Persona: Agent   Device: responsive   Mode: pro (Guided shows just 2 KPIs)
Current state: PARTIAL.
Workflow role: n/a
Key components: KPI (drafts this month, approved %, avg time-to-approve, AI cost estimate), chart, per-field accuracy breakdown.
Primary actions: Filter; Export.
State variants: loading, empty, error.
Entry from: AGT-WLA-001.
Exit to: same.
Metering: n/a
Notes: AI-cost metric is a soft signal; not a hard bill (metered via features.js).

---

<a id="6-agt-lai"></a>
## 6. AGT-LAI — Listings AI

### AGT-LAI-001 — Generate description

Purpose: Trigger AI to write a listing description from structured fields.
Route: modal from AGT-LST-004/005 description field   Persona: Agent   Device: responsive   Mode: both
Current state: PARTIAL — backend `POST /api/listings-ai/describe` exists.
Workflow role: n/a
Key components: Tone picker (Warm / Professional / Concise / Luxury), Language (en / ar), Length (Short / Medium / Long), Include-highlights checkboxes, Generate button.
Primary actions: Generate → shows draft → Apply / Refine / Discard.
State variants: loading, error, insufficient-credits.
Entry from: AGT-LST-004, AGT-LST-005.
Exit to: AGT-LAI-002.
Metering: `AI_LISTINGS_DESCRIBE`.
Notes: Cost preview before generate ("Uses 1 AI credit").

### AGT-LAI-002 — Refine / preview generated content (P0 — REWRITTEN 2026-09-04 per D9)

Purpose: The iteration loop for AI-generated content. Without this, an agent generates ONCE and is stuck with the output — "typewriter with no backspace." Refinement is the difference between AI-as-gimmick and AI-as-tool.
Route: modal from AGT-LAI-001 (auto-opens with the generated draft)   Persona: Agent   Device: responsive   Mode: both
Current state: MISSING — must ship with AGT-LAI-001 (currently PARTIAL). Together they are the AI-content-generation loop.
Workflow role: n/a (in-place refinement, no workflow chain)
Key components:
- Generated text panel (editable rich-text — agent can hand-edit any generated word inline; changes preserved even if they Regenerate)
- Character/word count (per platform if applicable — e.g., Instagram caption 2200 char limit, X 280 char limit)
- Regenerate button with clear per-tap credit cost preview ("Regenerate — 1 AI credit")
- Refine-with-instruction dropdown OR free-text ("Make it shorter", "Add family focus", "Tone: more luxury", "Emphasize the marina view", "Translate to Arabic")
- Refinement history (last 3-5 variants accessible as tabs — agent can revert to any previous version without spending another credit)
- Version A/B comparison mode (Pro): side-by-side two variants + pick preferred
- Apply button (final commitment; injects into the calling form)
- Discard button
Primary actions: Regenerate (costs credit); Refine-with-instruction (costs credit); Revert to prior version (no credit); Apply (no credit); Discard.
State variants: loading (spinner + estimated-time-to-complete), error, insufficient-credits (nudge → AGT-SUB-003), rate-limited (AI provider throttled — retry in N seconds), refinement-history-full (cap at 5 versions).
Entry from: AGT-LAI-001 auto-open after first generate.
Exit to: AGT-LST-004/005 (calling form) with applied text filled.
Metering: `AI_LISTINGS_DESCRIBE` per Regenerate or Refine-with-instruction.
Notes: **The refinement loop is where AI stops being a party trick and becomes a work tool.** Cost transparency is non-negotiable — every metered action shows its cost BEFORE the tap. Revert-to-prior-version is not metered — it's from cached history. Apply is not metered — it's a UI action. Only fresh AI calls cost credits. Server-side: keep the last 5 refinement variants in a `ai_refinement_sessions` table (or JSONB in the calling entity) so revert works even after page refresh.

---

<a id="7-agt-nvl"></a>
## 7. AGT-NVL — Neighborhood valuator

### AGT-NVL-001 — Neighborhood valuator (per listing)

Purpose: Area intelligence view scoped to a specific listing.
Route: `/listings/:id/neighborhood-valuator`   Persona: Agent   Device: responsive   Mode: both
Current state: EXISTS — `web/src/pages/NeighborhoodValuatorPage.tsx`.
Workflow role: n/a
Key components: Map with property pin + surrounding scored polygons, dimension gauges (Walkability, Amenities, Schools, Safety, Transit), Comparables in area section, Trend chart.
Primary actions: Toggle dimension; See comparable → AGT-APR-003.
State variants: loading, area-not-scored (fall back to Google-only), error, Google-quota-hit (static map fallback).
Entry from: AGT-LST-003 Overview area link.
Exit to: AGT-APR-003.
Metering: `AI_AREA_INTELLIGENCE` on refresh.
Notes: Guided mode simplifies to 1-2 headline stats; Pro shows full dimensional breakdown.

---

<a id="8-agt-ctc"></a>
## 8. AGT-CTC — Contacts

### AGT-CTC-001 — Contacts list

Purpose: Browse own contacts.
Route: `/contacts`   Persona: Agent   Device: mobile + desktop   Mode: both (card view in Guided; table in Pro)
Current state: EXISTS — `web/src/pages/ContactsPage.tsx`.
Workflow role: n/a
Key components: Search bar, filters (Source / Lead status / Assigned to / Tag), cards or table, Add contact FAB, bulk actions (Pro).
Primary actions: Row → AGT-CTC-002; Add.
State variants: loading, empty, error.
Entry from: bottom-tab Contacts.
Exit to: AGT-CTC-002.
Metering: n/a
Notes: Contact-360 features described below.

### AGT-CTC-002 — Contact detail (360)

Purpose: Full 360 view of one contact: identity, timeline, conversations, listings shown, lead score, notes.
Route: `/contacts/:id`   Persona: Agent   Device: mobile + desktop   Mode: both
Current state: EXISTS — `web/src/pages/ContactDetailPage.tsx` + `components/contact-360/Contact360Panel.tsx`.
Workflow role: n/a
Key components: Header (avatar, name, contact methods, tags, lead-score badge), tabs (Overview | Conversations | Listings shown | Notes | Timeline | Files), quick actions (Message, Schedule viewing → AGT-OPP-002, Add task, Add note).
Primary actions: Message → INB conversation; Schedule; Add task; Merge (Pro).
State variants: loading, error.
Entry from: AGT-CTC-001, INB conversation, AGT-OPP-002.
Exit to: AGT-INB-002.
Metering: n/a
Notes: Lead-score regeneration button metered (`AI_LEAD_SCORE`).

### AGT-CTC-003 — Contact create / edit

Purpose: Add or edit a contact.
Route: modal from AGT-CTC-001 or AGT-CTC-002   Persona: Agent   Device: responsive   Mode: both
Current state: PARTIAL.
Workflow role: n/a
Key components: Fields (name, email, phone, WhatsApp, source, tags, notes), Save.
Primary actions: Save.
State variants: loading, validation (duplicate warn), error.
Entry from: AGT-CTC-001 FAB, AGT-CTC-002 Edit.
Exit to: AGT-CTC-002.
Metering: n/a
Notes: Duplicate detection on email/phone; Merge suggestion inline.

### AGT-CTC-004 — Merge contacts

Purpose: Combine two duplicate contacts.
Route: modal from AGT-CTC-002 or AGT-CTC-001 bulk   Persona: Agent (Pro)   Device: desktop preferred   Mode: pro
Current state: PARTIAL — backend `POST /api/contacts/:id/merge` exists.
Workflow role: n/a
Key components: Two-column diff (left A / right B), field-by-field pick (which value wins), preview merged, Merge button.
Primary actions: Merge.
State variants: loading, error.
Entry from: AGT-CTC-002 merge action, bulk-select from list.
Exit to: AGT-CTC-002 (merged).
Metering: n/a
Notes: Merge is irreversible — surface warning.

### AGT-CTC-005 — Contact export

Purpose: Export contacts to CSV / vCard.
Route: modal from AGT-CTC-001 (Pro)   Persona: Agent (Pro)   Device: desktop   Mode: pro
Current state: PARTIAL — backend `GET /api/contacts/:id/export` exists.
Workflow role: n/a
Key components: Format (CSV / vCard / Excel), fields picker, Export button.
Primary actions: Export → downloads file.
State variants: loading, error.
Entry from: AGT-CTC-001 Pro bulk toolbar.
Exit to: same.
Metering: n/a
Notes: GDPR-compliant — includes data-subject metadata.

### AGT-CTC-007 — Contact relationships editor (CORRECTED — added 2026-09-04)

Purpose: Manage the formal representation / mandate / affinity relationships between this contact and the current tenant's agents. Multi-tenant: same contact may be represented by different agents in different agencies.
Route: tab on AGT-CTC-002   Persona: Agent (agents can manage their own relationships; agency admin can see all)   Device: responsive   Mode: pro (Guided shows just "I represent this contact as: [buyer/seller/landlord/tenant]" toggle)
Current state: MISSING — schema exists in `migration 028` (`contact_relationships` table), no UI.
Workflow role: n/a
Key components: My relationships (this tenant) section — cards per relationship (party_type: buyer/seller/landlord/tenant; relationship_type: representation/mandate/affinity; exclusivity: exclusive/non_exclusive; scope: geo + property_type + price range; status; start/end dates; consent evidence). Other tenants' relationships (visible-only, redacted) — visibility gated by contact's cross-tenant consent settings.
Primary actions: Create relationship; Update; End; Attach consent evidence.
State variants: proposed / confirmed / active / suspended / ended / expired, contested (multiple exclusive claims — error state).
Entry from: AGT-CTC-002 tab.
Exit to: AGT-CTC-002.
Metering: n/a
Notes: Exclusive-buyer-rep is guarded by `uq_active_exclusive_buyer_rep` unique index — only ONE active exclusive buyer rep per person per party_type across ALL tenants. UI must handle the "trying to create exclusive when another tenant already has one" error gracefully.

### AGT-CTC-006 — Lead score regenerate

Purpose: Trigger AI to recompute lead score.
Route: button on AGT-CTC-002   Persona: Agent   Device: responsive   Mode: both
Current state: PARTIAL — backend `POST /api/contacts/:id/regenerate-summary` exists.
Workflow role: n/a
Key components: Confirm with cost preview, Regenerate.
Primary actions: Regenerate → new score + summary; toast.
State variants: loading, insufficient-credits, error.
Entry from: AGT-CTC-002.
Exit to: AGT-CTC-002.
Metering: `AI_LEAD_SCORE`.
Notes: Auto-triggered on new conversation; manual trigger optional.

---

<a id="9-agt-opp"></a>
## 9. AGT-OPP — Opportunities

### AGT-OPP-001 — Opportunities pipeline (Kanban, Pro)

Purpose: Kanban view of the pipeline.
Route: `/opportunities`   Persona: Agent   Device: tablet + desktop   Mode: pro
Current state: EXISTS — `web/src/pages/OpportunitiesPage.tsx`.
Workflow role: n/a
Key components: Columns per stage (Lead / Qualified / Viewing / Offer / Closing / Closed / Lost), draggable cards (contact + property + value + last-touched), filters, Add Opportunity FAB.
Primary actions: Drag between stages; Card → OPP-002; Add.
State variants: loading, empty (per column), error.
Entry from: bottom-tab "More" → Opportunities.
Exit to: AGT-OPP-002.
Metering: n/a
Notes: Kanban is desktop-first; mobile stacks vertically or falls back to AGT-OPP-001b.

### AGT-OPP-001b — Opportunities list (Guided, mobile)

Purpose: Simple list view of opportunities grouped by stage.
Route: `/opportunities?view=list`   Persona: Agent   Device: mobile   Mode: guided
Current state: MISSING.
Workflow role: n/a
Key components: Sectioned list by stage, cards, Filter chip, Add FAB.
Primary actions: Tap card → AGT-OPP-002; Move stage inline (long-press or swipe actions).
State variants: loading, empty, error.
Entry from: bottom-tab.
Exit to: AGT-OPP-002.
Metering: n/a
Notes: Swipe left/right on card to advance/retreat stage.

### AGT-OPP-002 — Opportunity detail

Purpose: One opportunity: contact, property, stage, activity, notes, next actions.
Route: `/opportunities/:id`   Persona: Agent   Device: responsive   Mode: both
Current state: PARTIAL.
Workflow role: n/a
Key components: Header (title, stage, value, contact avatar, property thumbnail), tabs (Activity | Notes | Tasks | Files), actions (Advance stage, Add activity, Close won → AGT-HTX-002, Close lost with reason).
Primary actions: Advance; Add activity; Close.
State variants: loading, error.
Entry from: AGT-OPP-001/001b, AGT-CTC-002 opportunities section, notification.
Exit to: AGT-HTX-002.
Metering: n/a
Notes: Close-won opens Historical-transactions record flow.

### AGT-OPP-003 — Add opportunity

Purpose: Create a new opportunity.
Route: modal from AGT-OPP-001   Persona: Agent   Device: responsive   Mode: both
Current state: PARTIAL.
Workflow role: n/a
Key components: Contact picker, property picker (optional), stage default, value, notes, Save.
Primary actions: Save.
State variants: loading, validation, error.
Entry from: AGT-OPP-001 FAB.
Exit to: AGT-OPP-002.
Metering: n/a
Notes: Contact + property autocomplete.

---

<a id="10-agt-tsk"></a>
## 10. AGT-TSK — Tasks & reminders

### AGT-TSK-001 — Tasks list

Purpose: See own tasks + reminders.
Route: `/tasks`   Persona: Agent   Device: mobile primary   Mode: both
Current state: EXISTS — `web/src/pages/TasksPage.tsx`.
Workflow role: n/a
Key components: Filter tabs (Today / Upcoming / Overdue / Completed), grouped list, checkbox to complete inline, Snooze swipe action, Add FAB.
Primary actions: Complete; Snooze; Tap → AGT-TSK-002.
State variants: loading, empty ("You're all caught up!"), error.
Entry from: bottom-tab "More" → Tasks, AGT-DSH-001, notification.
Exit to: AGT-TSK-002.
Metering: n/a
Notes: Overdue count surfaces on bottom-tab badge.

### AGT-TSK-002 — Task detail / edit

Purpose: One task's details.
Route: modal from AGT-TSK-001   Persona: Agent   Device: responsive   Mode: both
Current state: PARTIAL.
Workflow role: n/a
Key components: Title, description, due date + time, priority, related contact/property/opportunity, reminders (multi), Save.
Primary actions: Save; Complete; Delete.
State variants: loading, error.
Entry from: AGT-TSK-001.
Exit to: AGT-TSK-001.
Metering: n/a
Notes: Reminders via notification-prefs channels.

### AGT-TSK-003 — Reminder policies

Purpose: Manage recurring reminder policies (e.g., "Follow up 3 days after inquiry").
Route: `/settings/reminders`   Persona: Agent (Pro)   Device: desktop   Mode: pro
Current state: PARTIAL — backend `GET/POST /api/reminder-policies` exists.
Workflow role: n/a
Key components: Policies list (trigger, delay, channel, active), Add / edit / delete.
Primary actions: Add / edit.
State variants: loading, empty, error.
Entry from: AGT-SET-001.
Exit to: same.
Metering: n/a
Notes: Guided mode hides this; policies apply via built-in defaults.

---

<a id="11-agt-cmp"></a>
## 11. AGT-CMP — Campaigns

### AGT-CMP-001 — Campaigns list

Purpose: See own campaigns.
Route: `/campaigns`   Persona: Agent   Device: responsive   Mode: both
Current state: EXISTS — `web/src/pages/CampaignsPage.tsx`.
Workflow role: n/a
Key components: Cards (name, status: Draft / Scheduled / Running / Completed / Paused, target size, enrollments, performance), filters, New Campaign button.
Primary actions: Card → detail; New → AGT-CMP-002.
State variants: loading, empty (create-first-campaign CTA), error.
Entry from: bottom-tab "More" → Campaigns.
Exit to: AGT-CMP-002, AGT-CMP-004.
Metering: n/a
Notes: Guided mode uses template-first "Choose a goal" pattern; Pro shows full builder.

### AGT-CMP-002 — Campaign builder wizard (Guided)

Purpose: Multi-step wizard to build a campaign.
Route: `/campaigns/new`   Persona: Agent   Device: responsive   Mode: guided
Current state: EXISTS — `web/src/pages/CampaignBuilderPage.tsx`. Wizard vs single-page split TBD.
Workflow role: n/a
Key components: Step 1 Goal (New listing announcement / Price drop / Open house / Custom), Step 2 Audience (Saved-search / Tag / Manual), Step 3 Content (template pick + edit), Step 4 Channels (WhatsApp / Email / SMS), Step 5 Schedule (Now / Later), Step 6 Review + Launch.
Primary actions: Next / Back; Launch → AGT-CMP-004.
State variants: uploading, validation, error, insufficient-credits.
Entry from: AGT-CMP-001.
Exit to: AGT-CMP-004.
Metering: per channel (WA_SEND, SMS_SEND, EMAIL_SEND).
Notes: Cost preview at Review step per channel × enrollees.

### AGT-CMP-003 — Campaign builder single-page (Pro)

Purpose: Everything on one screen for power users.
Route: `/campaigns/new?mode=pro`   Persona: Agent (Pro)   Device: desktop   Mode: pro
Current state: MISSING dedicated variant.
Workflow role: n/a
Key components: 3-column (goal + audience / content / channels + schedule), inline preview, Launch button.
Primary actions: Save Draft; Launch.
State variants: loading, unsaved, error.
Entry from: AGT-CMP-001.
Exit to: AGT-CMP-004.
Metering: same.
Notes: Reuse fields from Guided wizard; different layout.

### AGT-CMP-004 — Campaign detail + performance

Purpose: One campaign's live status + analytics.
Route: `/campaigns/:id`   Persona: Agent   Device: responsive   Mode: both
Current state: PARTIAL.
Workflow role: n/a
Key components: Header (name, status, target size), KPI strip (sent, delivered, opened, replied, converted), per-channel breakdown, enrollment table, Pause / Resume / Cancel.
Primary actions: Pause; Resume; Duplicate; Cancel.
State variants: loading, error.
Entry from: AGT-CMP-001.
Exit to: AGT-CMP-001.
Metering: n/a
Notes: Enrollment list rows link to AGT-CTC-002.

### AGT-CMP-005 — Saved searches (audience source)

Purpose: Manage saved-search filters used as campaign audiences + alert triggers.
Route: `/settings/saved-searches`   Persona: Agent (Pro)   Device: responsive   Mode: pro
Current state: PARTIAL — backend `GET /api/saved-searches` etc.
Workflow role: n/a
Key components: Saved searches list (name, filter summary, alert-on-new toggle, last-run), Add / Edit / Delete.
Primary actions: Add / edit / run-now.
State variants: loading, empty, error.
Entry from: AGT-SET-001, AGT-CMP-002 audience step.
Exit to: same.
Metering: n/a
Notes: Alert-on-new fires notifications when new matching listing appears (in agency-wide inventory).

---

<a id="12-agt-tpl"></a>
## 12. AGT-TPL — Message templates

### AGT-TPL-001 — Templates list (agent-scope)

Purpose: Browse own + agency templates.
Route: `/message-templates`   Persona: Agent   Device: responsive   Mode: both
Current state: EXISTS — `web/src/pages/MessageTemplatesPage.tsx`.
Workflow role: n/a
Key components: Tabs (Mine / Agency / Defaults), cards (name, category, channels), filters, New Template.
Primary actions: Row → AGT-TPL-002; New.
State variants: loading, empty, error.
Entry from: `SHR-NAV-002`, CRM shell sidebar.
Exit to: AGT-TPL-002.
Metering: n/a
Notes: Agency templates are read-only (copy → own to modify).

### AGT-TPL-002 — Template editor

Purpose: Compose or edit a template.
Route: `/message-templates/:id`   Persona: Agent   Device: responsive   Mode: both
Current state: PARTIAL.
Workflow role: n/a
Key components: Channels checklist (Email / WhatsApp / SMS), body editor (per channel), variables panel (contact / property / agency), Preview, Send Test, Save.
Primary actions: Save; Send Test; Delete.
State variants: loading, unsaved, error.
Entry from: AGT-TPL-001.
Exit to: AGT-TPL-001.
Metering: n/a
Notes: RTL editor for Arabic content; character counter for SMS (segment-aware).

---

<a id="13-agt-inb"></a>
## 13. AGT-INB — Unified inbox

### AGT-INB-001 — Inbox list

Purpose: All conversations across channels in one feed.
Route: `/dashboard/inbox`   Persona: Agent   Device: mobile + desktop   Mode: both
Current state: EXISTS — `web/src/pages/InboxPage.tsx`.
Workflow role: n/a
Key components: Filter tabs (Unread / Assigned to me / All), search, conversation rows (contact avatar, last-message preview, channel badge, timestamp, unread dot), Compose FAB.
Primary actions: Row → AGT-INB-002; Compose → AGT-INB-003.
State variants: loading, empty, error, offline (cached).
Entry from: bottom-tab Inbox.
Exit to: AGT-INB-002, AGT-INB-003.
Metering: n/a
Notes: Unread count on bottom-tab badge. Long-press → Assign / Close / Mark read.

### AGT-INB-002 — Conversation detail

Purpose: One conversation with message thread and reply composer.
Route: `/dashboard/inbox/:id`   Persona: Agent   Device: mobile + desktop   Mode: both
Current state: PARTIAL.
Workflow role: n/a
Key components: Header (contact card, channel badge, related listing), message list (bubbles left/right), reply composer (multi-line, insert-template, insert-listing-card, attachments), suggested-reply chips (AI, Pro).
Primary actions: Send; Insert template; Attach; Assign; Close.
State variants: loading, sending, send-failed (retry), offline (queue), error.
Entry from: AGT-INB-001, AGT-CTC-002, AGT-LST-012.
Exit to: AGT-CTC-002.
Metering: WA_SEND / SMS_SEND / EMAIL_SEND per outbound.
Notes: Voice-note recording supported via Capacitor mic API.

### AGT-INB-003 — Compose new conversation

Purpose: Start a new conversation with a contact.
Route: modal from AGT-INB-001   Persona: Agent   Device: mobile + desktop   Mode: both
Current state: PARTIAL.
Workflow role: n/a
Key components: Contact picker (autocomplete), channel picker, template picker, body, Send.
Primary actions: Send.
State variants: loading, channel-not-connected (nudge to CHN), error.
Entry from: AGT-INB-001 FAB, AGT-CTC-002.
Exit to: AGT-INB-002.
Metering: per channel.
Notes: If contact has no WhatsApp opt-in, restrict to email/SMS.

### AGT-INB-005 — Channel + source dual-badge treatment (CORRECTED — added 2026-09-04)

Purpose: Not a standalone screen — a treatment applied to every row in AGT-INB-001 and every conversation header in AGT-INB-002. Codifies that inbound messages carry TWO orthogonal attributes: `channel` (transport) and `source` (origin).
Route: n/a — component treatment   Persona: Agent   Device: responsive   Mode: both
Current state: PARTIAL — `conversations.source_channel` exists but is one-dimensional; needs decomposition into `channel` + `source` when schema is extended.
Workflow role: role=Recipient (applies to every recipient-side inbox item)
Key components:
- `channel` badge (leftmost): icon + short label — WhatsApp / Email / SMS / Instagram / Facebook / TikTok / X / LinkedIn / Telegram — tells the agent HOW to reply (which transport)
- `source` badge (rightmost): logo + short label — Direct / Agent profile / Agency profile / White-label site / Widget / Bazaar / OLX / Bayut / Property Finder / Dubizzle / Blue Door / others per market — tells the agent WHERE the inquiry originated
- Composite tooltip: "Arrived via WhatsApp from your Bayut listing" — plain-language combination
Primary actions: Tap channel badge → filter inbox to just this channel; tap source badge → filter to just this source.
State variants: source-unknown (fallback: `Direct`), channel-inferred (badge shows dotted border indicating best-guess).
Entry from: n/a
Exit to: filtered inbox view.
Metering: n/a
Notes: Same-contact-across-channels dedup preference (per user feedback 2026-09-04) is agent-configurable in AGT-SET-001. Default = keep conversations separate; opt-in merge.

### AGT-INB-004 — Assign conversation

Purpose: Reassign to another agent (in agency context).
Route: dropdown from AGT-INB-002   Persona: Agent (Owner / Admin can reassign anyone; agent can reassign own only)   Device: responsive   Mode: both
Current state: PARTIAL — backend `POST /api/conversations/:id/assign` exists.
Workflow role: n/a
Key components: Agent picker (agency members with online status), optional note, Assign.
Primary actions: Assign → target notified.
State variants: loading, error.
Entry from: AGT-INB-002.
Exit to: AGT-INB-002 with new assignee.
Metering: n/a
Notes: Solo agents don't see this action.

---

<a id="14-agt-htx"></a>
## 14. AGT-HTX — Historical transactions

### AGT-HTX-001 — Closed transactions list

Purpose: Historical log of closed deals.
Route: `/settings/historical-transactions`   Persona: Agent   Device: responsive   Mode: both
Current state: EXISTS — `web/src/pages/HistoricalTransactionsPage.tsx`.
Workflow role: n/a
Key components: Table (date, property, buyer, price, commission, status), filters, Import CSV button (Pro).
Primary actions: Row → detail; Add; Import.
State variants: loading, empty, error.
Entry from: AGT-SET-001, AGT-CMD-001, AGT-DSH-001 quick-add.
Exit to: AGT-HTX-002.
Metering: n/a
Notes: Feeds public profile "closed transactions" if opted-in.

### AGT-HTX-002 — Add closed transaction

Purpose: Record a closed deal.
Route: modal from AGT-HTX-001 or AGT-OPP-002 close-won   Persona: Agent   Device: responsive   Mode: both
Current state: PARTIAL — `web/src/components/closed-transactions/RecordClosureModal.tsx`.
Workflow role: n/a
Key components: Property picker, buyer/seller (contact), close date, price, commission, notes, Save.
Primary actions: Save → adds to history + updates listing status to Sold.
State variants: loading, error.
Entry from: AGT-HTX-001, AGT-OPP-002.
Exit to: AGT-HTX-001.
Metering: n/a
Notes: Also triggers public review request to buyer (opt-in).

### AGT-HTX-003 — Import closed transactions

Purpose: Bulk-import historical closings from CSV.
Route: modal from AGT-HTX-001   Persona: Agent (Pro)   Device: desktop preferred   Mode: pro
Current state: PARTIAL — backend `POST /api/closed-transactions/import`.
Workflow role: n/a
Key components: File picker, column mapping, preview, Import.
Primary actions: Import.
State variants: uploading, mapping, error.
Entry from: AGT-HTX-001.
Exit to: AGT-HTX-001.
Metering: n/a
Notes: Guided mode hides Import; it's Pro.

---

<a id="15-agt-apr"></a>
## 15. AGT-APR — Agent pricing portfolio

### AGT-APR-001 — Pricing portfolio

Purpose: Market-pricing view across all own listings.
Route: `/agent/pricing`   Persona: Agent   Device: responsive   Mode: both
Current state: EXISTS — `web/src/pages/AgentPricingPage.tsx`.
Workflow role: n/a
Key components: KPI (Overpriced / Underpriced / Recommended adjustments), filters, table (property, list price, comparables median, delta %, days-on-market, recommendation, action).
Primary actions: Row → AGT-LST-003; Apply recommendation; Keep price; Adjust price.
State variants: loading, empty, error.
Entry from: `SHR-NAV-002` More menu, AGT-CMD-001.
Exit to: AGT-LST-003, AGT-APR-002.
Metering: n/a
Notes: Guided mode simplifies to one badge ("N listings need attention") that routes to Pro table.

### AGT-APR-002 — Adjust price

Purpose: Change a listing's price with reason + effective date.
Route: modal from AGT-APR-001 or AGT-LST-003   Persona: Agent   Device: responsive   Mode: both
Current state: PARTIAL — backend `POST /api/agent/pricing/properties/:id/adjust-price` exists.
Workflow role: n/a
Key components: Current price, new price, delta indicator, reason, effective date, Save.
Primary actions: Save → creates price-history entry.
State variants: loading, error.
Entry from: AGT-APR-001, AGT-LST-003.
Exit to: AGT-APR-001.
Metering: n/a
Notes: Auto-notify contacts on the "watching-price" saved-search alert.

### AGT-APR-003 — Comparable detail + report bad

Purpose: One comparable shown; ability to report if wrong.
Route: modal from AGT-NVL-001 or AGT-APR-001   Persona: Agent   Device: responsive   Mode: both
Current state: PARTIAL — `components/market-pricing/ComparablesModal.tsx` exists.
Workflow role: WF-05 role=Initiator (report bad comparable).
Key components: Comparable data, map, source badge, "Report this comparable" button.
Primary actions: Report → AGT-APR-004.
State variants: loading, error.
Entry from: AGT-NVL-001, AGT-APR-001.
Exit to: AGT-APR-004.
Metering: n/a
Notes: Report goes to PA-PVA-008 queue.

### AGT-APR-004 — Report bad comparable form (WF-05 Initiator)

Purpose: Submit a report about an incorrect comparable.
Route: modal from AGT-APR-003   Persona: Agent   Device: responsive   Mode: both
Current state: MISSING dedicated agent variant.
Workflow role: WF-05 role=Initiator.
Key components: Reason radio (Wrong price / Duplicate / Not comparable / Removed / Other), notes, evidence upload, Submit.
Primary actions: Submit → PA queue.
State variants: loading, error.
Entry from: AGT-APR-003.
Exit to: AGT-APR-003 with "Under review" indicator; recipient outcome later at AGT-REC-002.
Metering: n/a
Notes: Cross-links to WF-05 recipient screen.

### AGT-APR-005 — Submit agent price report (WF-06 Initiator)

Purpose: Submit a market analysis report about pricing decisions (compensated / for public consumption).
Route: `/agent/pricing/reports/new`   Persona: Agent (Pro)   Device: desktop preferred   Mode: pro
Current state: PARTIAL — backend `POST /api/pricing/agent-price-reports` exists.
Workflow role: WF-06 role=Initiator.
Key components: Report editor (rich text), attached listings + comps, thesis, publish target (private / agency / public), Submit.
Primary actions: Submit → PA-PVA-009 queue.
State variants: loading, error.
Entry from: AGT-APR-001 Pro action.
Exit to: AGT-APR-006.
Metering: n/a
Notes: Recipient outcome at AGT-REC-003.

### AGT-APR-006 — My submitted reports

Purpose: List own submitted reports with status.
Route: `/agent/pricing/reports`   Persona: Agent (Pro)   Device: responsive   Mode: pro
Current state: PARTIAL — backend `GET /api/pricing/my-agent-price-reports` exists.
Workflow role: n/a
Key components: Table (title, submitted, status, decision).
Primary actions: Row → detail (edit if draft; view if submitted).
State variants: loading, empty, error.
Entry from: AGT-APR-001.
Exit to: AGT-APR-005 (edit), AGT-REC-003 (view outcome).
Metering: n/a
Notes: Same table shape as `my-comparable-reports` in a sub-tab.

---

<a id="16-agt-app"></a>
## 16. AGT-APP — Public profile editor

### AGT-APP-001 — Public profile editor

Purpose: Manage what appears on public agent profile (SHR-PUB-002).
Route: `/agent/profile`   Persona: Agent   Device: responsive   Mode: both
Current state: PARTIAL — `AgentProfilePage.tsx` is the public view; editor may live elsewhere.
Workflow role: n/a
Key components: Avatar upload, bio, languages spoken, specializations, service areas (city/area picker), Show-transactions toggle, Show-reviews toggle, Contact preferences (WhatsApp / SMS / Email visibility), Preview → SHR-PUB-002 in new tab.
Primary actions: Save; Preview.
State variants: loading, error.
Entry from: `SHR-NAV-002` user menu, AGT-SET-001.
Exit to: SHR-PUB-002 preview.
Metering: n/a
Notes: Bio supports en + ar.

---

<a id="17-agt-cmd"></a>
## 17. AGT-CMD — Command center (agent scope)

### AGT-CMD-001 — Command center

Purpose: Cross-cutting operational feed of everything needing attention today.
Route: `/command-center`   Persona: Agent   Device: mobile + desktop   Mode: both
Current state: EXISTS — `web/src/pages/CommandCenterPage.tsx`.
Workflow role: n/a
Key components: Sections (Urgent → 1-2 items, Today → tasks + viewings + reminders, Recent activity, Quick add).
Primary actions: Tap into any item.
State variants: loading, empty ("You're clear"), error.
Entry from: `SHR-NAV-002`.
Exit to: Various.
Metering: n/a
Notes: Guided version prominent on AGT-DSH-001; Pro users may use command-center as their landing.

---

<a id="18-agt-sub"></a>
## 18. AGT-SUB — Subscription & credits (tenant billing)

### AGT-SUB-001 — My subscription

Purpose: Current plan for agent (may be solo or inherit from agency).
Route: `/my-subscription`   Persona: Agent   Device: responsive   Mode: both
Current state: EXISTS — `web/src/pages/MySubscriptionPage.tsx` (shared with Agency).
Workflow role: n/a
Key components: Plan card (name, tier, N properties covered, per-feature quota bars, next renewal), inherit-from-agency badge if applicable, action bar (Change Plan → SUB-002, Cancel → SUB-004, Manage Payment).
Primary actions: Change; Cancel; Manage Payment.
State variants: loading, past-due, error.
Entry from: `SHR-NAV-002`, AGT-DSH-001.
Exit to: AGT-SUB-002.
Metering: n/a
Notes: Agency-inherited: read-only + "This is set by your agency" copy.

### AGT-SUB-002 — Change plan (solo agent)

Purpose: Preview + confirm plan change for solo agents.
Route: `/plans`   Persona: Agent (solo)   Device: responsive   Mode: both
Current state: EXISTS — `web/src/pages/PlansPage.tsx`.
Workflow role: WF-13 role=Composition.
Key components: Plans grid, current-plan indicator, compare, Select → preview → confirm.
Primary actions: Select; Confirm.
State variants: loading, downgrade-blocked (over-quota), error.
Entry from: AGT-SUB-001.
Exit to: AGT-SUB-005.
Metering: n/a
Notes: Agency-scoped agents cannot change plan; see agency owner.

### AGT-SUB-003 — Credits & top-up

Purpose: Solo agents manage their own credits.
Route: `/my-credits`   Persona: Agent (solo)   Device: responsive   Mode: both
Current state: EXISTS — `web/src/pages/MyCreditsPage.tsx` + `components/credits/*`.
Workflow role: n/a
Key components: Balance card, per-feature quota bars (`FeatureQuotaBar`), Top Up button (→ Paddle checkout), Transactions table, Set alert.
Primary actions: Top up; Filter transactions.
State variants: loading, low-balance banner, error.
Entry from: `SHR-NAV-002`, AGT-DSH-001, out-of-credits nudge from any metered action.
Exit to: Paddle checkout, AGT-SUB-005.
Metering: n/a
Notes: Agency-scoped agents see allocation from agency, not top-up button.

### AGT-SUB-004 — Cancel subscription (solo)

Purpose: Cancel own solo plan.
Route: modal from AGT-SUB-001   Persona: Agent (solo)   Device: responsive   Mode: both
Current state: PARTIAL.
Workflow role: n/a
Key components: End-of-period / Immediate, reason, retention offer, SHR-MFA-007 step-up.
Primary actions: Confirm.
State variants: loading, error.
Entry from: AGT-SUB-001.
Exit to: AGT-SUB-001.
Metering: n/a
Notes: Immediate cancel forfeits unused.

### AGT-SUB-005 — Plan change outcome

Purpose: Confirmation of plan change.
Route: drawer from AGT-SUB-002   Persona: Agent (solo)   Device: responsive   Mode: both
Current state: MISSING.
Workflow role: WF-13 role=Action outcome.
Key components: Old → new plan, effective, proration, new quotas.
Primary actions: View invoice; Close.
State variants: loading, error.
Entry from: AGT-SUB-002.
Exit to: AGT-SUB-001.
Metering: n/a
Notes: Downgrade cool-down disclosed if applied.

### AGT-SUB-006 — Invoices (agent scope)

Purpose: Invoices issued to this agent (only shown for solo agents; agency-scoped agents see nothing here).
Route: `/my-invoices`   Persona: Agent (solo)   Device: responsive   Mode: both
Current state: EXISTS — `web/src/pages/MyInvoicesPage.tsx`.
Workflow role: n/a
Key components: Table, filters, downloads.
Primary actions: Download; Pay Now if past-due.
State variants: loading, empty, error.
Entry from: `SHR-NAV-002`, AGT-SUB-001.
Exit to: same.
Metering: n/a
Notes: Same shape as AGN-INV-001.

### AGT-SUB-007 — Credit notes (agent scope)

Purpose: Credit notes issued to solo agent.
Route: `/my-credit-notes`   Persona: Agent (solo)   Device: responsive   Mode: both
Current state: EXISTS — `web/src/pages/MyCreditNotesPage.tsx`.
Workflow role: n/a
Key components: Same shape as invoices.
Primary actions: Download.
State variants: loading, empty, error.
Entry from: `SHR-NAV-002`.
Exit to: same.
Metering: n/a
Notes: n/a

---

<a id="19-agt-npf"></a>
## 19. AGT-NPF — Notifications inbox & preferences

### AGT-NPF-001 — Notifications inbox

Purpose: See all in-app notifications (workflow outcomes, leads, comments, quota alerts).
Route: `/notifications`   Persona: Agent   Device: responsive   Mode: both
Current state: PARTIAL — `NotificationPreferencesPage.tsx` is prefs only; inbox may live elsewhere or be new.
Workflow role: role=Recipient for many workflows.
Key components: Grouped by day, unread indicator, filter (all / unread / by category), Mark all read.
Primary actions: Tap notification → deep-link.
State variants: loading, empty, error, offline (cached).
Entry from: `SHR-NAV-002` bell, `SHR-NAV-003` bottom-tab badge.
Exit to: Various.
Metering: n/a
Notes: Categories: Leads / Publications / Approvals / Billing / System.

### AGT-NPF-002 — Notification preferences

Purpose: Per-channel per-event opt-in matrix.
Route: `/notification-preferences`   Persona: Agent   Device: responsive   Mode: both
Current state: EXISTS — `web/src/pages/NotificationPreferencesPage.tsx`.
Workflow role: n/a
Key components: Event × Channel matrix, master toggles, Save.
Primary actions: Toggle → autosave.
State variants: loading, error.
Entry from: AGT-NPF-001 gear, AGT-SET-001.
Exit to: same.
Metering: n/a
Notes: See SHR-NAV-004b — same shape, agent-scoped.

---

<a id="20-agt-chn"></a>
## 20. AGT-CHN — Social channel connections

### AGT-CHN-001 — Channels list

Purpose: See connected/disconnected social channels + connect new.
Route: `/settings/channels`   Persona: Agent   Device: responsive   Mode: both
Current state: EXISTS — `web/src/pages/SocialChannelsPage.tsx`.
Workflow role: n/a
Key components: Channel cards (IG / FB / TikTok / X / LinkedIn / WhatsApp Business / Email / SMS), status pill, Connect / Disconnect / Reconnect / Configure.
Primary actions: Connect (OAuth flow); Disconnect (destructive); Reconnect (auth expired).
State variants: loading, auth-expired warning, error.
Entry from: `SHR-NAV-002`, AGT-ONB-004, AGT-PUB-002 no-channel nudge.
Exit to: OAuth flows.
Metering: n/a
Notes: Auth-expired badge red; Reconnect flow uses same OAuth.

### AGT-CHN-002 — Channel connect (OAuth wrapper)

Purpose: Handle OAuth flow for one channel.
Route: `/settings/channels/:platform/oauth`   Persona: Agent   Device: responsive   Mode: both
Current state: PARTIAL — backend routes exist for each platform.
Workflow role: n/a
Key components: Explanation, Connect button (opens provider OAuth), success / failure screen.
Primary actions: Connect; Retry.
State variants: pending, success, error (user-friendly explanation of common failures).
Entry from: AGT-CHN-001.
Exit to: AGT-CHN-001.
Metering: n/a
Notes: Elevated (SHR-MFA-007) — connecting/disconnecting channels is sensitive.

### AGT-CHN-003 — Personal accounts ("my-connections")

Purpose: Multiple accounts per channel (e.g., personal + business Instagram).
Route: tab on AGT-CHN-001   Persona: Agent (Pro)   Device: responsive   Mode: pro
Current state: PARTIAL — backend `GET/POST /api/social-channels/my-connections` etc.
Workflow role: n/a
Key components: Multi-account list per platform, Primary designation, Set primary / Remove.
Primary actions: Add / remove / set primary.
State variants: loading, error.
Entry from: AGT-CHN-001.
Exit to: same.
Metering: n/a
Notes: Guided mode auto-picks primary; Pro allows explicit switching.

---

<a id="21-agt-rou"></a>
## 21. AGT-ROU — Routing settings

### AGT-ROU-001 — Own routing preferences

Purpose: Configure how leads route to this agent (for agency-scoped agents).
Route: `/settings/routing`   Persona: Agent (agency-scoped)   Device: responsive   Mode: both
Current state: EXISTS — `web/src/pages/RoutingSettingsPage.tsx`.
Workflow role: n/a
Key components: Available / OOO toggle, languages I speak, areas I cover, max leads/day cap, Save.
Primary actions: Save.
State variants: loading, error.
Entry from: AGT-SET-001.
Exit to: same.
Metering: n/a
Notes: Solo agents don't see this (all leads go to them by default).

---

<a id="22-agt-int"></a>
## 22. AGT-INT — Integrations

### AGT-INT-001 — Integrations (agent-scope)

Purpose: Connect third-party integrations (Google Calendar, personal email, etc.).
Route: `/integrations`   Persona: Agent   Device: responsive   Mode: both
Current state: EXISTS — `web/src/pages/IntegrationSettingsPage.tsx`.
Workflow role: n/a
Key components: Integration cards, connect / disconnect / configure.
Primary actions: Connect; Configure.
State variants: loading, error.
Entry from: AGT-SET-001.
Exit to: External OAuth.
Metering: n/a
Notes: Some integrations are paid-plan-only (surface with lock icon + upgrade nudge).

---

<a id="23-agt-wlb"></a>
## 23. AGT-WLB — White-label site (agent view)

### AGT-WLB-001 — My site (read-mostly)

Purpose: Agent sees their agency-owned white-label site's key metrics + how they appear on it.
Route: `/white-label`   Persona: Agent (agency-scoped)   Device: responsive   Mode: both
Current state: EXISTS — `WhiteLabelBuilderPage.tsx` (agency-scoped; needs agent read-mostly variant).
Workflow role: n/a
Key components: Site preview link, "My profile on this site" preview, "My listings on this site" preview, "My inquiries from this site" KPI.
Primary actions: View site; View my profile.
State variants: loading, error, no-site (agency hasn't set one up).
Entry from: `SHR-NAV-002`.
Exit to: SHR-PUB-005.
Metering: n/a
Notes: Editing is agency-scope; agent only sees.

---

<a id="24-agt-rev"></a>
## 24. AGT-REV — Reviews received

### AGT-REV-001 — Reviews received

Purpose: See reviews left on public profile.
Route: `/agent/reviews`   Persona: Agent   Device: responsive   Mode: both
Current state: PARTIAL — backend `GET /api/agents/:id/reviews` exists.
Workflow role: n/a
Key components: Reviews list (stars, reviewer, text, date), respond inline, Flag inappropriate.
Primary actions: Respond; Flag.
State variants: loading, empty, error.
Entry from: `SHR-NAV-002`, AGT-DSH-001.
Exit to: same.
Metering: n/a
Notes: Flag routes to PA-USR-002.

---

<a id="25-agt-rec"></a>
## 25. AGT-REC — Recipient / outcome screens

### AGT-REC-001 — Portal submission outcome (WF-03 Recipient) (P0 — CONSOLIDATED 2026-09-04 per D9)

**Merged into AGT-PUB-006 per 2026-09-04 review.** AGT-REC-001 was a duplicate of AGT-PUB-006's recipient role. To avoid two screens rendering the same content with slightly different affordances, the tracker itself (AGT-PUB-006) serves as the recipient surface. Notifications deep-link directly to `/listings/:id/submissions/:subId` (AGT-PUB-006's route). **This entry retained only for workflow-completeness traceability — AGT-PUB-006 is the actual screen.**

Fulfilled by: AGT-PUB-006. Workflow role WF-03=Recipient handled there.

### AGT-REC-002 — Comparable-report outcome (WF-05 Recipient) (P0 — REWRITTEN 2026-09-04 per D9)

Purpose: Agent sees PA's decision on a bad-comparable report they submitted. Closes the feedback loop for the WF-05 chain (Agent reports bad comparable → PA reviews at PA-PVA-008/008b → Agent sees outcome here).
Route: `/agent/comparable-reports/:id` + notification deep-link + list section on AGT-APR-006 (my submitted reports)   Persona: Agent (submitter)   Device: responsive   Mode: both
Current state: MISSING — must ship with WF-05 cluster (per D5).
Workflow role: WF-05 role=Recipient.
Key components:
- Header: "Your comparable report was reviewed"
- Original submitted content (reason, notes, evidence) — collapsible reference
- PA decision panel: status pill (`Approved` / `Rejected` / `More info requested`), decision timestamp, PA notes rendered in plain language
- **Corrective action taken** (if approved): "We updated the comparable" / "We removed the comparable" / "We kept the comparable but flagged it" — with before/after values
- Impact statement (if approved): "N of your listings are affected by this correction. Their valuation was recomputed." + link to affected listings
- If rejected: PA reason from controlled vocabulary + "Submit a new report if you have additional evidence" affordance
- If more-info-requested: what specifically PA needs → Resubmit-with-more-info button
- Contact support link
Primary actions: View updated comparable (→ AGT-APR-003 with the corrected data); View affected listings; Resubmit; Close.
State variants: loading, error, superseded (I submitted a duplicate report about the same comparable — this one is closed as duplicate).
Entry from: Notification (in-app + email), AGT-APR-006 (my submitted reports list).
Exit to: AGT-APR-003 (updated comparable), AGT-LST-003 (affected listing).
Metering: n/a
Notes: **Copy tone matters.** Rejection is not a slight — "We reviewed your report and decided to keep the comparable in place. Here's why:" not "Report rejected." **Cross-matrix dependency:** requires PA-PVA-008/008b to ship in same cluster (per D5).

### AGT-REC-003 — Agent price report outcome (WF-06 Recipient) (P0 — REWRITTEN 2026-09-04 per D9)

Purpose: Agent sees PA's decision on an agent-price report they submitted. WF-06 recipient closure.
Route: `/agent/pricing/reports/:id/outcome` + notification deep-link + status column on AGT-APR-006   Persona: Agent (Pro)   Device: responsive   Mode: pro
Current state: MISSING — must ship with WF-06 cluster.
Workflow role: WF-06 role=Recipient.
Key components:
- Report title + submitted-at
- Original report content (collapsible)
- PA decision panel: status (`Approved for publication` / `Approved with edits` / `Rejected` / `Needs revision`), publication scope (`Public` — appears on agent profile / `Agency-only` — visible only within agency / `Private` — internal only), PA notes
- Publication link (if approved and published): live URL
- If edits requested: specific changes needed with inline diff → Apply Edits button (→ AGT-APR-005 with pre-loaded diff)
- If rejected: reason + Withdraw button OR Revise-and-resubmit button
- If more-info: what's needed → Resubmit
Primary actions: View published report; Apply edits; Revise; Withdraw.
State variants: loading, error, superseded, published (green + celebrate mildly).
Entry from: Notification, AGT-APR-006.
Exit to: AGT-APR-005 (edit), published URL.
Metering: n/a
Notes: Approved reports may be featured on agent public profile (SHR-PUB-002) — this is the differentiator for Pro-tier agents building thought leadership. **Cross-matrix dependency:** PA-PVA-009/009b in same cluster.

### AGT-REC-004 — Agency application outcome (WF-02 Recipient) (P0 — REWRITTEN 2026-09-04 per D9)

Purpose: Agent sees an agency's decision on their application to join. WF-02 recipient closure. High-emotional-stakes screen — respect matters.
Route: `/agency/applications/:appId/status` + notification deep-link + email deep-link   Persona: Agent (applicant)   Device: responsive (mobile-first — likely opened from phone)   Mode: guided
Current state: MISSING — must ship with WF-02 cluster.
Workflow role: WF-02 role=Recipient.
Key components:
- Agency card (logo, name, location) — sets context
- Application timeline: submitted → reviewed → decision (with timestamps)
- **If APPROVED:**
  - Warm headline: "You've been accepted by {Agency Name}"
  - Role you'll be joining as (from `tenant_memberships.role` + capability pack)
  - Affiliation mode (exclusive / non-exclusive) with clear explanation of what that means for the agent (esp. impact on their existing personal tenant and any other agency memberships)
  - Accept button (large, primary) — activates the membership immediately → agent lands in agency tenant context via SHR-NAV-008 → AGT-DSH-001 with celebratory banner
  - Decline button (subdued) — with confirmation ("Decline this offer? You can apply again in future.")
- **If REJECTED:**
  - Respectful headline: "{Agency Name} has decided not to proceed with your application at this time"
  - Agency's message (if any) rendered as-is
  - Encouragement + affordances: Browse other agencies (→ SHR-PUB-003 directory), Continue as solo agent (→ AGT-DSH-001 personal tenant), Contact WingCaster support
- **If PENDING (checking status):**
  - "Your application is under review by {Agency Name}. Typical review time: N days."
  - Estimated response by (SLA-based)
  - Withdraw application affordance (subdued)
Primary actions per state: Accept / Decline / Withdraw / Browse other agencies / Contact support.
State variants: pending, approved, rejected, withdrawn (agent withdrew), expired (agency never responded within N days — auto-close with option to re-apply), agency-suspended (agency was suspended during review — application converted to pending-transfer with WingCaster support).
Entry from: Notification (in-app + email), direct URL from onboarding, agency invite link.
Exit to: AGT-DSH-001 (accept → agency tenant), SHR-PUB-003 (rejected → other agencies), personal-tenant dashboard (decline).
Metering: n/a
Notes: **Copy tone matters — rejection must be respectful.** No "You have been rejected" — use "The agency decided not to proceed with your application at this time." Approval Accept flow MUST update the JWT + tenant context server-side + re-route through SHR-NAV-008 so the agent lands in the correct tenant. **Cross-matrix dependency:** requires AGN-MEM-002/002b (agency review side) to ship in same WF-02 cluster.

### AGT-REC-005 — Account recovery outcome (WF-04 Recipient)

Purpose: Handled by SHR-AUT-005c (email-linked completion). Referenced here for workflow completeness.
Notes: See SHR-AUT-005c.

### AGT-REC-006 — Ownership transfer offered (WF-31 Recipient — target agent)

Purpose: Agent is offered the ownership of an agency.
Route: `/agency/accept-ownership?token=…`   Persona: Agent (Admin becoming Owner)   Device: responsive   Mode: both
Current state: MISSING (mirror of AGN-SET-005b).
Workflow role: WF-31 role=Recipient.
Key components: Same as AGN-SET-005b.
Primary actions: Accept / Decline.
State variants: same.
Entry from: Email link.
Exit to: AGN-DSH-001.
Metering: n/a
Notes: Kept in Agent matrix for workflow completeness; the actual page is shared with Agency.

---

<a id="26-agt-set"></a>
## 26. AGT-SET — Agent settings shell

### AGT-SET-001 — Settings home (agent)

Purpose: Grid of agent settings areas.
Route: `/settings`   Persona: Agent   Device: responsive   Mode: both
Current state: MISSING dedicated home.
Workflow role: n/a
Key components: Cards grouped (Account, Security, Notifications, Channels, Routing, Integrations, Mode: Guided/Pro, Language, Historical transactions, WhatsApp intake, Reminder policies, Saved searches).
Primary actions: Card → area.
State variants: loading.
Entry from: `SHR-NAV-002` user menu, bottom-tab More.
Exit to: Various.
Metering: n/a
Notes: Pro-only cards labeled with "Pro" pill.

### AGT-SET-002 — Mode toggle (P0 — REWRITTEN 2026-09-04 per D9)

Purpose: Agent controls whether the app renders in Guided (default for new signups) or Pro mode. Without this toggle, D3 dual-mode is invisible and every Pro variant we build is unreachable.
Route: card on AGT-SET-001   Persona: Agent   Device: responsive   Mode: n/a (this IS the mode toggle)
Current state: MISSING — required to expose the D3 dual-mode work.
Workflow role: n/a
Key components:
- Current mode indicator (large: "You're in Guided mode" or "You're in Pro mode")
- Two mode cards side-by-side:
  - **Guided card:** icon + one-line pitch ("Big buttons, one decision at a time, plain language, all features available") + "Best for: new users, occasional use, or when you want the simplest path"
  - **Pro card:** icon + one-line pitch ("Dense tables, keyboard shortcuts, bulk actions, saved views, all the same features") + "Best for: power users, high listing volume, or when you value speed over hand-holding"
- Radio-style select — one active at a time
- Immediate-switch on select (no separate Save button) → whole app re-renders in new mode
- "Try Pro for a week" nudge (system-triggered when the user has been in Guided for N days AND has 20+ listings — soft prompt on the dashboard to try Pro)
- Automatic Pro nudge dismissal (once user tries Pro and either stays or reverts to Guided, don't nudge again for 90 days)
Primary actions: Select Guided or Pro → immediate switch + persist server-side.
State variants: idle, switching (200ms transition), error (persist failed — rollback the visual).
Entry from: AGT-SET-001 (settings home), nudge banner on AGT-DSH-001, first-time onboarding option (AGT-ONB-004).
Exit to: same page.
Metering: n/a
Notes: Preference persisted server-side per tenant context (different mode per tenant — an agent could be Guided in their personal tenant but Pro in their agency tenant if they want). Preference syncs across devices. Mode change reloads the current route.

---

## Summary

| Section | Screens | EXISTS | PARTIAL | MISSING |
|---|---|---|---|---|
| AGT-ONB | 5 | 0 | 0 | 5 |
| AGT-DSH | 2 | 1 | 0 | 1 |
| AGT-LST | 12 | 2 | 6 | 4 |
| AGT-PUB | 7 | 0 | 5 | 2 |
| AGT-WLA | 5 | 1 | 4 | 0 |
| AGT-LAI | 2 | 0 | 1 | 1 |
| AGT-NVL | 1 | 1 | 0 | 0 |
| AGT-CTC | 6 | 2 | 4 | 0 |
| AGT-OPP | 4 | 1 | 2 | 1 |
| AGT-TSK | 3 | 1 | 2 | 0 |
| AGT-CMP | 5 | 2 | 2 | 1 |
| AGT-TPL | 2 | 1 | 1 | 0 |
| AGT-INB | 4 | 1 | 3 | 0 |
| AGT-HTX | 3 | 1 | 2 | 0 |
| AGT-APR | 6 | 1 | 4 | 1 |
| AGT-APP | 1 | 0 | 1 | 0 |
| AGT-CMD | 1 | 1 | 0 | 0 |
| AGT-SUB | 7 | 5 | 1 | 1 |
| AGT-NPF | 2 | 1 | 1 | 0 |
| AGT-CHN | 3 | 1 | 2 | 0 |
| AGT-ROU | 1 | 1 | 0 | 0 |
| AGT-INT | 1 | 1 | 0 | 0 |
| AGT-WLB | 1 | 1 | 0 | 0 |
| AGT-REV | 1 | 0 | 1 | 0 |
| AGT-REC | 6 | 0 | 0 | 6 |
| AGT-SET | 2 | 0 | 0 | 2 |
| **Total** | **93** | **24** | **43** | **26** |

**Agent-specific workflows introduced or referenced:**

| WF | Name | Initiator | Approver | Key Agent screens |
|---|---|---|---|---|
| WF-01 | WhatsApp AI-draft approval | AI (auto) | Agent (self) | AGT-WLA-001, AGT-WLA-002, AGT-WLA-003 + AGT-LST-003 outcome |
| WF-02 | Join agency | Agent | Agency Owner/Admin | AGT-ONB-001 (branch), AGN-MEM-005 (submission), AGT-REC-004 (recipient) |
| WF-03 | Portal submission | Agent | PA | AGT-PUB-005 (initiator), AGT-PUB-006 / AGT-REC-001 (recipient) |
| WF-05 | Report bad comparable | Agent | PA | AGT-APR-003, AGT-APR-004 (initiator), AGT-REC-002 (recipient) |
| WF-06 | Agent price report | Agent (Pro) | PA | AGT-APR-005 (initiator), AGT-APR-006 (list), AGT-REC-003 (recipient) |
| WF-11 | Comment reclassify | Agent | System | AGT-LST-012 (reclassify inline) |
| WF-13 | Change plan | Agent (solo) or Agency Owner | System | AGT-SUB-002, AGT-SUB-005 |
| WF-16 | Delete account | Agent | Self (3-factor per feedback) | SHR-SET-005..005d (Shared matrix) |
| WF-31 | Ownership transfer accept | Agency Owner | Target admin (Agent) | AGT-REC-006 |
| WF-33 | Multi-channel publish | Agent | System | AGT-PUB-001, AGT-PUB-002, AGT-PUB-003 |

**Highest-impact Agent gaps:**
1. **All of AGT-ONB (5 missing)** — no onboarding surface today; blocks conversion of new signups
2. **All of AGT-REC (6 missing)** — workflow recipients not surfaced anywhere; users are left in the dark
3. **AGT-DSH-002 + AGT-SET-002 + AGT-LST-002** — no Pro mode of anything; design-brief §3.1 dual-mode requirement is entirely missing
4. **Mobile-first pass on every EXISTS/PARTIAL page** — responsive Tailwind is not mobile-first; needs redesign at 375px baseline with bottom tab bar
5. **Arabic RTL on every screen** — zero coverage today; MENA-primary market blocker
6. **AGT-PUB-* series** — publishing UX is the primary metered surface; needs proper per-channel + outcome + retry design
