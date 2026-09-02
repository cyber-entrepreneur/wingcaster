# Wingcaster — UI/UX design brief for Agent, Agency, and Platform Admin

Design brief for Cursor Design (or any UI/UX design AI). Produces the design system, screens, and interactive prototypes for the three role surfaces of Wingcaster. Backend implementation is a separate concurrent workstream; this brief is design-only.

Written 2026-09-02. Reflects the state of `origin/main`.

## 1. Product context

**Wingcaster** is a real-estate SaaS for agents and agencies in the MENA / Gulf region and eventually globally. It combines:

- **Listing management** (photos, video, voice → structured property listing)
- **AI extraction** (WhatsApp intake, contact enrichment, area intelligence, market pricing, AI-drafted social posts)
- **Multi-channel publishing** (Instagram, TikTok, Facebook, X, LinkedIn, WhatsApp Business, third-party real-estate portals)
- **CRM** (contacts, opportunities, tasks, campaigns, closed-transaction history)
- **White-label** (custom-domain agent/agency public sites + embeddable widgets)

**Business model:** free tier + paid monthly subscription. Metering is **per active property, not per seat.** An agent listing 1 property pays a fraction of what an agency listing 200 properties pays. Free tier lets someone register + list properties + use CRM at zero cost; paid features (publishing, AI, WhatsApp send, etc.) unlock with subscription. Subscription = a package covering N properties; each property carries an allocation of per-feature credits (X for social publishing, Y for real-estate site publishing, Z for WhatsApp send, plus AI-post-creation, property rating, benchmarking, lead-gen credits).

**Target regions:** MENA + Gulf initially (Lebanon, KSA, UAE, Egypt), so **Arabic RTL is a first-class requirement, not a translation afterthought.** Currency: USD, AED, SAR, LYD, EGP.

## 2. The three role surfaces

| Surface | Primary device | Density | Users |
|---|---|---|---|
| **Agent** | Mobile phone (iOS + Android via Capacitor wrapper) | Low-to-medium; two modes | Individual real-estate agents; skill range from tech-illiterate ("only uses WhatsApp") to power user |
| **Agency** | Desktop primary, mobile secondary | Medium | Agency admin managing 5-200 agents, viewing aggregates, allocating credits |
| **Platform Admin (PA)** | Desktop only | High density | Wingcaster staff operating the platform, managing packages, tenants, invoices, reconciliation |

Design deliverables cover all three, but the Agent surface is where the biggest UX investment goes.

## 3. Agent surface — mobile-first, dual-mode

### 3.1 Why dual-mode

Agent tech proficiency varies wildly. One agent sends WhatsApp voice memos and can barely use email. Another manages 40 listings, uses saved filters, wants keyboard shortcuts. **Building for the average pleases neither.**

Design two modes for the Agent surface:

- **Guided mode** — default for new signups
  - Wizard-driven flows (one decision per screen)
  - Big touch targets (≥ 48px, comfortable on a bumpy taxi ride)
  - Plain language, zero jargon ("Show my property on Instagram" not "Publish to social channel")
  - Contextual "why?" tooltips everywhere
  - Voice + WhatsApp intake front-and-center (send a voice memo → AI drafts listing → agent taps ✓)
  - Empty states are "how to" cards, not just blank
  - Notifications explain *what happened* + *what to do next*
  - Every destructive action requires a "yes I'm sure" confirmation

- **Pro mode** — opt-in from settings, or auto-suggested after N days of active use
  - Higher information density
  - Multi-select + bulk actions
  - Advanced filters + saved views
  - Quick-add forms
  - Optional keyboard-shortcut overlay
  - Table views alongside card views for listings/contacts
  - Direct-edit fields (no separate edit screen for small changes)
  - Data export to CSV

A settings toggle switches between modes. Mode preference persists per device. Both modes cover **every feature** — no feature is Pro-only.

### 3.2 Mobile-first constraints

- Base breakpoint: 360px wide (bottom of the market Android)
- Comfortable at 375px (iPhone SE)
- Optimized at 390-430px (modern iPhones)
- Tablet + desktop are stretch — the surface must be usable at 1024px+ but investment goes into phone.
- Runs inside a **Capacitor wrapper** (iOS + Android native shell around the web app). Design must be indistinguishable from a native app: bottom tab bar, native swipe gestures where possible, iOS-style safe-area insets, Android back-button behavior.
- One-hand-thumb reachable: primary actions in the bottom third of the screen; secondary actions (filters, settings) in the top-right.

### 3.3 Agent features — designs required

Each feature needs Guided-mode and Pro-mode variants. Route paths in parentheses are where the code lives on `origin/main` today (see `web/src/App.tsx`) — designs should map to these so implementation stays coherent.

1. **Onboarding** — free-tier signup + first-listing wizard (`/register`)
2. **Login / auth flows** — email + password + OTP + TOTP + account recovery + password reset (`/login`, `/forgot-password`, `/reset-password`, `/account-recovery`, `/settings/2fa`)
3. **Dashboard** — greeting, quota status ("42 of ~50 social credits used"), recent activity, next actions (`/dashboard`)
4. **Listings** — list + card view, create, edit, publish, view analytics, share (`/listings`, `/listings/:id`)
5. **Listing creation via WhatsApp** — send photos/video/voice to bot → open Wingcaster app → review AI-drafted listing → approve or edit → published
6. **Listing creation in-app** — manual form (Guided: wizard; Pro: single dense form)
7. **Property performance** — per-listing analytics: views, engagement, funnel, price history (`/listings/:id`)
8. **Neighborhood valuator** — area-intelligence view scoped to a listing (`/listings/:id/neighborhood-valuator`)
9. **Contacts** — list, detail, 360 view, timeline, notes, merge, export (`/contacts`, `/contacts/:id`)
10. **Opportunities** — pipeline view (kanban in Pro, list in Guided) (`/opportunities`)
11. **Tasks + reminders** — list, complete, snooze, add (`/tasks`)
12. **Campaigns** — list, create, builder, analytics (`/campaigns`, `/campaigns/new`)
13. **Message templates** — browse, edit, use (`/message-templates`)
14. **Inbox** — unified messages across channels (`/dashboard/inbox`)
15. **Historical transactions** — closed-deal log (`/settings/historical-transactions`)
16. **Agent pricing portfolio** — market pricing per listing (`/agent/pricing`)
17. **Public agent profile** — the page prospects see (`/agent/:id`)
18. **Command center** — one screen surfacing everything needing attention today (`/command-center`)
19. **Subscription + credits view** — current package, per-feature quota consumption, top-up (post PR D — design anticipates the tenant billing UI)
20. **Notification preferences** — per-channel per-event opt-in (`/settings/channels`, `/notification-preferences`)
21. **Social channels** — connect / disconnect IG / FB / TikTok / X / LinkedIn / WhatsApp accounts (`/settings/channels`)
22. **Routing settings** — how leads route to this agent (`/settings/routing`)
23. **Integrations** — third-party connections (`/integrations`)
24. **White-label site** — the agent's public site (agent view is read-mostly; edit is Agency-side) (`/white-label`)

### 3.4 Agent — flows that need special design attention

- **First-time WhatsApp intake** — the "aha moment." Agent forwards photos to a WhatsApp number, gets an AI-drafted listing back to review. Must feel magical, low-friction. Guided mode should walk them through it once with a tour.
- **Publishing a listing to social** — Guided: one big "Publish this property everywhere" button with smart defaults + a "just this channel" secondary. Pro: check-box per channel with per-channel caption preview + edit.
- **Out-of-credits flow** — when a Guided-mode agent runs out of a feature quota, they see a plain-language "You've used all this month's Instagram posts. Buy more or wait until next month." with a big "Top up" button.
- **Approval of AI-drafted content** — a review screen where they can accept the draft as-is, tweak one field, or reject entirely.
- **Lead notification** — a new-lead alert. Guided: "You have a new inquiry from Sara about the Beirut apartment. Reply here." Pro: notification badge on the inbox with jump-to.

### 3.5 Agent — accessibility & i18n

- WCAG 2.1 AA
- Language: English + Arabic. Every screen mirrors correctly in RTL. Numbers stay LTR. Icons must not have implied direction (or must have RTL variants).
- Font: system font stack + IBM Plex Arabic for Arabic (or equivalent) so Arabic reads naturally.
- Dark mode required.
- High-contrast mode support.
- All touch targets ≥ 44px (iOS HIG) / 48px (Android Material).

## 4. Agency surface — desktop-first, mobile-responsive

Agencies manage 5-200 agents. The primary user is an agency admin at a desk.

### 4.1 Agency features — designs required

1. **Agency dashboard** — aggregate KPIs across all agents, alerts (`/agency`)
2. **Agent management** — invite agents, roles (Owner / Agent / Marketer / Finance / Read-Only), permissions, activate/deactivate (`/agency`)
3. **Agency pricing portfolio** — market pricing across all listings in the agency (`/agency/pricing`)
4. **Agency credits + allocation** — see the agency's credit pool, allocate credits to individual agents (`/api/agency/credits/allocate` exists today) (post PR D — anticipated)
5. **Agency subscription view** — active package, monthly quota, per-agent consumption breakdown, top-up (post PR D)
6. **White-label site builder** — build the public agency site (`/white-label`)
7. **Widget builder** — embeddable widgets for external sites (`/widgets`)
8. **Routing rules** — lead routing between agents (`/settings/routing`)
9. **Sync connections** — import listings from external MLSs
10. **Templates management** — custom message templates for the agency
11. **Agency management page** — settings, billing, team (`/agency`)

### 4.2 Agency — special design attention

- **Multi-agent view** — a table showing every agent's activity, quota usage, and revenue attribution, sortable/filterable
- **Credit allocation** — an intuitive way to say "give agent A 20% of our monthly credits" or "cap agent B at 100 posts/month"
- **Deactivate agent flow** — what happens to their listings, their leads, their in-flight campaigns
- **Onboarding a new agent** — invite by email/phone → agent gets link → registers under the agency

### 4.3 Agency mobile

Agency admins occasionally check on phone. Every screen must be usable at 375px, but design investment is desktop 1440×900.

## 5. Platform Admin surface — desktop only, dense

Wingcaster staff running the platform.

### 5.1 PA features — designs required

Existing fin admin pages (from `web/src/pages/admin/fin/` — audit against `origin/main`):

1. **Overview** — platform-wide KPIs, health, alerts
2. **Tenants** — list every tenant, drill down to per-tenant state
3. **Usage** — per-tenant per-feature usage
4. **Credits (Lots)** — the prepaid credit stock per tenant
5. **Holds** — currently held reservations
6. **Facilities** — credit facilities (postpaid credit lines)
7. **Contracts** — active contracts + component composition
8. **Pricing** — meter-based unit rates
9. **Invoices** — issued invoices, void, credit-note, debit-note
10. **Vendor costs** — external vendor consumption (AI providers, BannerBear, etc.)
11. **Reconciliation** — R-check runs, drift resolution
12. **Exceptions** — drift/anomaly review queue
13. **Approvals** — two-person approval queue (grants over threshold, package publishing, etc.)
14. **Audit** — financial audit log
15. **Configuration** — system configuration

New PA features anticipated by PR B/C/D (design in this brief; implementation later):

16. **Packages** — CRUD subscription packages: name, tier, N properties covered, per-feature per-property credit allocation, publish/archive lifecycle, effective dating, versioning. This is the biggest new PA surface — the one this platform is currently missing entirely.
17. **Feature registry** — the master list of features that can be credit-metered (WhatsApp send, Instagram post, X post, etc.), used when composing packages
18. **Currency + pricing rules** — per-region pricing, currency support, FX rates
19. **Payment providers config** — Stripe/Paddle/manual-receipt configuration (per-territory PSP routing)

Existing non-fin PA pages:

20. **Platform message templates** — Unlayer editor (`/admin/message-templates`)
21. **WhatsApp-listings admin** — usage, credits grant, audit log, health
22. **Areas admin** — neighborhood management (`/admin/areas`)
23. **Scoring config** — area-intelligence AI configs (`/admin/scoring`)
24. **Whatsapp-listings dashboard** — module-specific admin (`/admin/whatsapp-listings`)
25. **Google usage** — Maps API budget tracking (`/api/admin/google-usage`)

### 5.2 PA — the big new surface: Packages

This is the largest new design chunk. Anticipate PR B (data model) + PR C (admin UI).

Package composition flow:

- **Create package**: name, code, tier level, currency, billing cadence, N properties covered
- **Compose features**: for each metered feature (from the feature registry), set "per property allocation" (e.g., "1 Instagram post per property per month", "3 WhatsApp conversation windows per property per month", "2 property ratings per property per month")
- **Preview quota**: system computes total monthly quota for a subscriber (e.g., 15 properties × 1 IG post = 15 monthly IG credits)
- **Preview cost math**: system estimates margin against provider raw-cost (from `ai_call_usage`, `bannerbear` etc.)
- **Non-metered features included**: white-label, XML feed, Command Center, agency management (yes/no per tier)
- **Overage pricing**: per-feature price per additional credit
- **Publish flow**: draft → submit for approval → second admin approves → published; effective_from date; archive on obsolescence
- **Version history**: every published package version is immutable; changes create a new version
- **Assign to tenant flow** (in PA-drive-tenant scenarios): pick tenant, pick package, set billing cycle start, dry-run, activate

Tenant-facing view of the same (Agent + Agency perspective):

- **My subscription**: package name + N properties covered + per-feature quota with real-time consumption bars
- **Overage warning**: soft cap at 100% per feature ("You've used all your typical monthly Instagram posts; you have M shared credits left")
- **Top-up flow**: add credits to the shared pool

### 5.3 PA density + tooling

- Tables with sortable columns, filterable, exportable
- Bulk actions in every list view
- Row-level actions inline (approve/reject/suspend) so PA doesn't click into a detail page for common ops
- Keyboard shortcuts for common actions (approve queue: press `A` to approve current, `R` to reject, `J`/`K` to navigate)
- No mobile investment — pages can be desktop-only with a "This surface requires desktop" gate on small viewports
- Dark mode required (PAs work long hours; dark is default)

## 6. Design system foundations

### 6.1 Tokens
- Color: 3-tier ramp (neutral / brand / accent) × light/dark
- Typography: display / heading / body / caption / mono, en + Arabic
- Spacing: 4px base grid
- Radius: sm / md / lg / full
- Shadow: card / modal / popover
- Motion: base ease + duration tokens

### 6.2 Components (build for all three surfaces)
- Buttons (primary/secondary/ghost/destructive/link, all sizes)
- Forms (text, textarea, select, multi-select, date, time, number, currency, phone, image upload, file upload)
- Tables (sortable, filterable, paginated, bulk-select)
- Cards (listing card, contact card, opportunity card, stat tile)
- Navigation (bottom tab bar for mobile Agent; sidebar for Agency/PA; breadcrumbs; back button)
- Modals + drawers + popovers + toasts
- Empty states (mobile + desktop variants)
- Skeleton loaders
- Charts (line, bar, donut, KPI tile — see agents' analytics screens)
- Property widgets (price display with currency; area with unit; bedrooms/bathrooms row; badges for property_type / status)
- Chat / message bubbles (for the Inbox screen)
- Media viewer (photo/video/voice memo playback)

### 6.3 Iconography
- One coherent icon set (Lucide / Phosphor / equivalent, single family)
- RTL-aware icons (arrows, back buttons, etc.)

### 6.4 Accessibility
- WCAG 2.1 AA across every surface
- Focus states visible, meet 3:1 contrast
- All interactive elements keyboard-reachable
- Screen-reader labels on icon-only buttons
- Form fields have visible labels (not placeholder-only)

## 7. Deliverables

Cursor Design produces:

1. **Design system foundations** — tokens, type, color, spacing, motion — as a Figma library file
2. **Component library** — all components above, at all states (default/hover/active/disabled/loading/error) — as Figma components with variants
3. **Screens per role** — every feature listed in §3.3 / §4.1 / §5.1, at the appropriate breakpoint:
   - Agent: mobile 390×844 + tablet 768 + desktop 1440
   - Agency: desktop 1440 + mobile 390
   - PA: desktop 1440 only
4. **Dual-mode Agent screens** — every Agent screen designed twice: Guided + Pro
5. **Arabic RTL variants** — every screen mirrored for RTL; type substitution to Arabic
6. **Dark mode** — every screen at light + dark
7. **Interactive prototype** — key flows clickable:
   - First-time signup → free tier onboarding → first listing
   - WhatsApp intake → review AI-drafted listing → publish
   - Ran out of credits → top-up flow
   - Agency admin allocates credits to agent
   - PA composes a new package from features
   - PA reviews approval queue
8. **Handoff spec** — dev-mode Figma with tokens exported, redlines, asset library, animation specs

## 8. Explicitly out of scope

- Backend implementation (Cursor Code handles that separately)
- Payment provider UI (Stripe / Paddle checkout flows) — separate spec once payment integration is in flight
- Marketing website (needed for Paddle verification; separate workstream)
- Legal pages (T&Cs / Privacy / Refund policy) — content-driven, not design-driven
- Localization to languages beyond en + Arabic (deferred to phase 2)

## 9. References — existing routes to map designs to

Verified against `origin/main` `web/src/App.tsx`. These are where the Cursor Code implementation will wire the designs:

- Agent routes: `/dashboard`, `/listings`, `/listings/:id`, `/listings/:id/neighborhood-valuator`, `/contacts`, `/contacts/:id`, `/opportunities`, `/tasks`, `/campaigns`, `/campaigns/new`, `/message-templates`, `/dashboard/inbox`, `/agent/pricing`, `/agent/:id`, `/command-center`, `/settings/2fa`, `/settings/channels`, `/settings/routing`, `/settings/historical-transactions`, `/integrations`, `/notification-preferences`
- Agent auth: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/account-recovery`, `/account-recovery/complete`
- Agency: `/agency`, `/agency/pricing`, `/white-label`, `/widgets`
- PA: `/admin/fin/*` (15 pages), `/admin/message-templates`, `/admin/message-templates/new`, `/admin/message-templates/:id`, `/admin/areas`, `/admin/whatsapp-listings`, `/admin/scoring`
- Anticipated (post PR B/C/D): `/admin/fin/packages`, `/admin/fin/packages/:id/versions`, tenant billing pages

## 10. Design constraints from the existing codebase

- Frontend is React + TypeScript + Tailwind (existing stack; keep it)
- Uses `lucide-react` for icons (existing)
- Uses radix-based `@/components/ui/*` primitives (existing) — designs should compose with these or extend
- Mobile packaging via Capacitor 6+
- All API calls go through `api.ts` client (existing)

## 11. Success criteria

The design is done when:
1. Every route listed in §9 has an approved mockup at its target breakpoint
2. Every Agent screen has both Guided and Pro variants signed off
3. Every screen has an Arabic RTL variant
4. Every screen has a dark-mode variant
5. The component library is a complete Figma library that dev can implement against
6. The 6 key flow prototypes (§7.7) are clickable end-to-end
7. Accessibility review passes WCAG 2.1 AA
8. A developer can build any listed screen from the handoff spec without ambiguity
