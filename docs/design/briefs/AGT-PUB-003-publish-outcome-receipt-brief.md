# Screen Brief — AGT-PUB-003 · Publish outcome / receipt (WF-33 Action outcome · revenue-protection surface)

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

Companion to `SCREEN_MATRIX_AGENT.md` §AGT-PUB-003 (rewritten 2026-09-04 per D9). Wave-2 P0 per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` Rev 9 §5 row 23. Closes the WF-33 (Multi-channel publish) initiator loop — every publish action ends here.

**COMPANION NOTICE.** This brief inherits the four reusable REC-family anchor patterns defined in `docs/design/briefs/AGT-REC-004-application-outcome-brief.md` §Reusable REC-family patterns — `<StatusHero>`, `<OutcomeTimeline>`, `<ResolverMessage>`, `<PrimaryCtaPerState>`. Every REC-family pattern is used verbatim; screen-specific deltas are called out inline. Two NEW components are introduced here for the per-portal-outcome pattern (not previously used by REC-004):

1. **`<AggregateOutcomeHero>`** — adapter around `<StatusHero>` that shows "X succeeded, Y in review, Z failed" as the one-glance answer to "did I get what I paid for?" Composition, not a new anchor.
2. **`<PortalReceiptCard>`** — per-portal receipt row (logo + status pill + credit charge + timestamp + action buttons). NEW anchor pattern; will be reused by AGT-PUB-006 (portal submission tracker).
3. **`<CreditsSummary>`** — the "why some credits weren't charged" reconciliation block. Screen-specific; not promoted to anchor.

---

## 🎨 Broadcast alignment

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`.** All color / font / spacing / motion / radii / elevation references below are governed by that reference. Never introduce raw hex, never introduce a `--lc-orange-*` primitive alias, never use a Tailwind palette class that isn't already remapped to a Broadcast semantic in `web/tailwind.config.js`.

**Screen-specific Broadcast callouts:**

- **`<AggregateOutcomeHero>` band** — full-bleed at top. Background depends on the aggregate:
  - **ALL SUCCEEDED**: `background: var(--lc-action-primary)`, text `var(--lc-action-primary-text)`. This is the ONE screen (paired with REC-004 APPROVED) where the primary orange is allowed to run large as a hero band. Glyph inside white circle chip.
  - **MIXED (some ok, some in-review, some failed)**: `background: var(--lc-surface-sunken)`, top-border `4px solid var(--lc-status-warning-fg)`, glyph `--lc-status-warning-fg`. The default hero — most publishes are mixed.
  - **ALL FAILED**: `background: var(--lc-surface-raised)`, top-border `4px solid var(--lc-status-closed-fg)`, glyph `--lc-status-closed-fg` — never `var(--lc-status-danger)` alone as background. Failure is a state, not a system error.
  - **IN-REVIEW-ONLY** (nothing succeeded yet, nothing failed): `background: var(--lc-surface-sunken)`, top-border `4px solid var(--lc-accent-bold)` (with `--lc-accent-bold-edge` 1px underline outline — accent bold ALWAYS needs a boundary), glyph `Hourglass` in `--lc-accent-bold-edge`.
- **Aggregate counters** — three inline pill counts under the label: `N succeeded` (`--lc-status-published-bg` + `--lc-status-published-fg` + `●`), `N in review` (`--lc-status-underOffer-bg` + `--lc-status-underOffer-fg` + `◐`), `N failed` (`--lc-status-closed-bg` + `--lc-status-closed-fg` + `✕`). Numbers via `<Numeric>`. Zero-value pills render muted (opacity 0.4) — do not hide, agent needs to see the full tally.
- **`<PortalReceiptCard>`** — `--lc-surface-raised` + `--lc-elevation-sm`, `var(--lc-radius-lg)` (7px), padding `var(--lc-space-md)` all sides, gutter `var(--lc-space-sm)` between cards. Left rail 4px stripe colored by status: succeeded `--lc-status-published-fg`, in-review `--lc-status-underOffer-fg`, failed `--lc-status-closed-fg`. Card interior is neutral surface — the stripe carries the state, not the whole card.
- **Portal logo** — 32×32 square, `var(--lc-radius-md)`, official portal SVG from the dynamic `portal_registry` (see §Backend contract). Fallback: `--lc-surface-sunken` square with 2-letter code in `var(--lc-type-overline)` + `--lc-text-muted`.
- **Portal name + country row** — name `var(--lc-type-heading-3)` + country flag glyph (from `country_codes[]` in registry) beside it in a `<Badge variant="outline">` chip. Multi-country portals show a "+2 more" chip if `country_codes.length > 2`.
- **Status pill** — `<Badge>` with tint + glyph + label. Never color alone. Six failure-class labels (per `[BE-BLOCKER-03]`):
  - `AUTH_EXPIRED` → "Auth expired" — icon `KeyRound`
  - `PORTAL_RULES_VIOLATION` → "Portal rules" — icon `FileWarning`
  - `PORTAL_DOWN` → "Portal down" — icon `ServerCrash`
  - `QUOTA_EXCEEDED` → "Quota exceeded" — icon `Ban`
  - `INVALID_CONTENT` → "Invalid content" — icon `AlertOctagon`
  - `UNKNOWN_ERROR` → "Unknown error" — icon `HelpCircle`
- **Credit charge line** — `var(--lc-type-data-sm)` mono, e.g. `1 credit charged` or `0 credits · reservation released`. Grey `--lc-text-muted` for released; `--lc-text-primary` for charged. Numeric via `<Numeric>`.
- **Timestamp line** — `var(--lc-type-caption)` mono via `<Numeric>`, e.g. `Published 12:04 · 3 min ago`. `--lc-text-muted`.
- **Action button row** — inline within each card:
  - SUCCEEDED → `View live listing →` (`variant="outline"` primary anchor tag, opens in new tab with external-link icon `ExternalLink`) + `View in queue` (`variant="ghost"`) — routes to AGT-LST-011 filtered to this portal.
  - IN_REVIEW → `View in queue →` (`variant="outline"`) — routes to AGT-PUB-006 (submission tracker) for this portal.
  - FAILED → `Retry` (`variant="outline"`) OR `Fix issue →` (`variant="outline"` primary) if the error class has a resolution deep link (see §Error-class → resolution map). Optional `Contact support` (`variant="ghost"`) on `UNKNOWN_ERROR` only.
- **`<CreditsSummary>` block** — `--lc-surface-sunken` band, `var(--lc-radius-lg)`, padding `var(--lc-space-lg)`. Top row: `Total charged` label + Numeric value (large, `var(--lc-type-display)` mono). Second row: `Total reserved` (crossed-out via inline `<del>` if fewer credits were actually charged than reserved). Info icon `Info` opens a tooltip: "You're only charged for successful publishes. Reserved credits for failed or unreachable portals were released back to your balance." Tooltip surface `--lc-surface-raised` + `--lc-elevation-md`.
- **Primary CTA / secondary CTA** — the state-specific action stack uses the `<PrimaryCtaPerState>` anchor pattern from REC-004. Aggregate state → action map documented in §State variants.
- **Motion** — hero cross-fades between aggregate states at `var(--lc-duration-base)` (180ms) when a live poll or push update flips a portal's status (e.g. `IN_REVIEW` → `SUCCEEDED`). Per-portal card status pill cross-fades at `var(--lc-duration-fast)` (120ms). Signal-lamp motif (teal `--lc-accent-bold` pulsing dot at `--lc-duration-slow`) is LEGAL on the `IN_REVIEW` status pill for portals actively being reviewed by a PA — the "in flight" moment. Respect `prefers-reduced-motion`.
- **Focus rings + 44px tap floor** — automatic via base CSS. Do not override.

---

## Meta

| | |
|---|---|
| Screen ID | AGT-PUB-003 |
| Screen name | Publish outcome / receipt |
| Persona | Agent (post-publish; primary consumer of publishing credits) |
| Device targets | Mobile 375px (PRIMARY — agents publish from field, receipt often opened from push notification), tablet 768px, desktop 1440px |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark, respect `prefers-color-scheme` |
| Route | Primary: `/publish/receipts/:jobId` — canonical deep link. Alternate: modal drawer from `AGT-PUB-001` / `AGT-PUB-002` after publish submit (same component, drawer chrome instead of full route). Push notification deep-link: `wingcaster://publish-receipt/:jobId` → resolves to primary route. |
| Current state | MISSING — must ship as P0 with the AGT-PUB Wave-2 cluster. Blocked on `[BE-BLOCKER-01]` (portal publishers stubbed), `[BE-BLOCKER-03]` (error_class enum), `[BE-DESIGN-01]` (dynamic portal_registry). |
| Workflow role | WF-33 role=Action outcome. Closes the loop after `AGT-PUB-001`/`AGT-PUB-002` publish submission. |
| Backend prerequisites | ⏳ `[BE-BLOCKER-01]` portal-publisher adapters (Phase-1: Property Finder Group per D19) · ⏳ `[BE-BLOCKER-03]` `distribution_attempts.error_class` CHECK-constrained enum (6 classes) + classifier + backfill · ⏳ `[BE-DESIGN-01]` `portal_registry` table + adapter pattern + dynamic feature registration (drives portal logo / name / country_codes) · ⏳ `GET /api/publishing/jobs/:id` endpoint (see §Backend contract; NEW — see §Backend prerequisites-not-tracked) · ✅ Credit reservation-and-release infrastructure (already in place; job outcome reflects it) |

---

## Purpose

An agent submitted a listing to N portals + M social channels via `AGT-PUB-001` (Guided) or `AGT-PUB-002` (Pro per-channel). Each portal/channel costs credits (metered per `PUBLISHING_REALESTATE_<CODE>` feature key). The publish job is a fan-out — some destinations succeed instantly (social posts), some go into portal moderation queues (portal submissions in `IN_REVIEW`), some fail (auth expired, portal down, content rejected).

This screen is the ONE surface where the agent sees, per destination, what happened and what it cost. Without it:
- Agents pay credits and can't reconcile.
- Failed publishes silently rot until the agent notices the listing didn't go live.
- The 6 failure classes (per `[BE-BLOCKER-03]`) have no UI → agents can't self-serve remediation → every failure becomes a support ticket.

**Emotional stakes:** revenue trust. This screen is where an agent's belief that "WingCaster is worth its per-post credits" is either confirmed or eroded. Every ambiguous or invisible failure charges a credit against the platform's credibility. The screen exists to make the reconciliation legible in one glance.

Success outcome per aggregate state:
- **ALL_SUCCEEDED** → agent taps "View my listings" → lands on AGT-LST-011 publications tab, filtered to this job's listing.
- **MIXED** → agent works the per-portal cards from top (failed, most urgent) to bottom, retrying or fixing per class; taps "View my listings" when done.
- **ALL_FAILED** → agent sees clear resolution guidance per class; primary CTA "Retry all fixable" surfaces bulk retry for the classes that support it; support link visible.
- **IN_REVIEW_ONLY** → agent understands the wait; taps "View in queue" to jump to AGT-PUB-006 (per-portal tracker).
- **PARTIAL** (some succeeded + some still in-review, none failed) — treated visually as MIXED but with the failed-count pill muted; the "why some credits weren't charged" tooltip explains reserved-but-not-charged.
- **CROSS-COUNTRY PER-PORTAL** — portals that span multiple countries (per `country_codes[]` in `portal_registry`, e.g. Property Finder Group covers UAE/KSA/EG/LB) render one card per country-variant if the backend fanned out per country, or one card with a multi-country chip if the submission was a single cross-country listing.

---

## Design goals

1. **The aggregate is legible in the first 200ms.** The `<AggregateOutcomeHero>` at top tells the agent everything before they read a word — three numeric pills + a glyph + a background tint. Everything below is the per-destination detail.
2. **Every credit charge is reconciled.** The `<CreditsSummary>` block makes it impossible to feel cheated: total charged, total reserved, why the two differ. Never hide the "you weren't charged for failures" fact — it's the single most important trust cue on the screen.
3. **The 6 failure classes each have a resolution path.** Not "something went wrong" — the exact class (from `[BE-BLOCKER-03]` enum) with the exact next action. `AUTH_EXPIRED` → deep-link to reconnect that channel; `PORTAL_RULES_VIOLATION` → deep-link to the field that violated; `QUOTA_EXCEEDED` → deep-link to top-up. Agents don't need to write support tickets for known failure classes.
4. **Portal identity is dynamic, never hardcoded.** Every portal name, logo, country flag, and adapter reference reads from `portal_registry` (per `[BE-DESIGN-01]`). Adding a portal in Phase 2 means dropping a registry row + adapter — this screen renders it correctly with zero UI changes.
5. **Mobile-first, receipt-shaped.** The primary access pattern is opening a push notification on a phone while the agent is between showings. The screen reads top-to-bottom as one receipt: aggregate → per-destination rows → credits summary → CTAs. No horizontal scrolling, no multi-column desktop-only affordances.
6. **RTL-first for MENA.** Every element mirrors correctly; per-portal cards read right-to-left in Arabic (logo on the right, action buttons on the left); credit numerics stay LTR bidi-embedded.
7. **Anchor discipline.** `<StatusHero>`, `<OutcomeTimeline>` (optional here), `<PrimaryCtaPerState>` from REC-004 are reused verbatim — no divergence. `<PortalReceiptCard>` is a NEW anchor that AGT-PUB-006 will reuse.

---

## Layout

### Mobile 375px (PRIMARY)

Single scrolling column. No chrome distractions. Reads as one receipt top to bottom:

1. **Top nav** — thin sticky bar: back arrow (left) → screen title "Publish receipt" (`var(--lc-type-body)` + `--lc-text-heading`) → menu dot (right, overflow: Contact Support, Copy job ID). 48px tall including safe area.
2. **`<AggregateOutcomeHero>` band** — full-bleed, ~200px tall on mobile. Composition:
   - Line 1: Glyph (28×28) + Label — `var(--lc-type-heading-2)`.
   - Line 2: Three numeric pills inline: `● 3 succeeded` · `◐ 2 in review` · `✕ 1 failed`. Numbers via `<Numeric>`.
   - Line 3: Timestamp — `Published 12:04 · 3 min ago` via `<Numeric>`.
3. **Aggregate context line** — muted single line beneath hero: `Job ID abc-123 · 6 destinations · 1 listing`. Job ID `<Numeric>` mono, first 8 chars shown, tap-to-copy affordance. This is the tabular truth for support tickets.
4. **`<CreditsSummary>` block** — full-width card `--lc-surface-sunken`, above the per-portal grid so agents see the money question before the per-destination detail. Content:
   - Row 1 (large): `4 credits charged` (mono, `var(--lc-type-display)`) + `Info` icon (right, opens tooltip).
   - Row 2 (small muted): `Reserved 6 credits · 2 released to your balance`. Only shown when `charged < reserved`.
   - Row 3 (link): `View credits history →` — routes to AGT-SUB-004 (credits history) filtered to this job.
5. **Per-destination stack** — vertical stack of `<PortalReceiptCard>` (see §Anchor components below). Order:
   1. Failed cards first (agent's urgent work).
   2. In-review cards next.
   3. Succeeded cards last (already handled).
   Section headers separate the three groups if the mix has 2+ groups: `Needs your attention (1)` / `Awaiting portal moderation (2)` / `Live now (3)`. Headers `var(--lc-type-overline)` + `--lc-text-muted`.
6. **`<PrimaryCtaPerState>` block** — sticky bottom bar on mobile (44px+ tap, full-width primary, safe-area padding). Content depends on aggregate state (see §State variants → CTA map).
7. **Contact support link** — `var(--lc-text-brand)` link, centered, `var(--lc-type-body-sm)`. Always visible: "Something not right? Contact WingCaster support" — pre-fills support ticket with job ID.

### Tablet 768px & Desktop 1440px

Two-column layout, 65 / 35 split, max-width `1200px` centered. Hero band spans the FULL width above the split.

- **Left column (65%):** Aggregate context line → `<CreditsSummary>` block (compact horizontal variant) → per-destination stack (grouped by status with headers; cards remain full-width of the column, no per-card horizontal grid on desktop either — the receipt-shaped read is intentional).
- **Right column (35%):** sticky sidebar (top-offset `var(--lc-space-3xl)`) with:
  - `<PrimaryCtaPerState>` block — CTA stack (primary + secondary; tertiary support link if applicable).
  - Context helper card — `var(--lc-surface-sunken)`, `var(--lc-radius-lg)`, padding `var(--lc-space-md)`. Explains what happens next per aggregate state (e.g. MIXED: "Failed publishes weren't charged — your credit balance is 42. Retry when the underlying issue is resolved. In-review submissions typically get a decision within 24 hours; you'll get a push notification.").
  - Small print block — job ID (`<Numeric>` mono, full 26-char UUID copyable), submitted-at, completed-at (if terminal), listing ID + short title link (routes to AGT-LST-003 for that listing). This is the tabular truth support agents need.

### RTL

Full mirror. Per-portal card mirrors: logo on the right, action buttons on the left. Aggregate pill order preserved (succeeded first is a positive-frame convention; in RTL, the "first" pill appears rightmost). Sticky bottom CTA bar (mobile) contents mirror. Credit numeric fields stay LTR bidi-embedded inside RTL text.

---

## Anchor components — reused from REC-004 + NEW for the PUB family

### Reused verbatim from `AGT-REC-004-application-outcome-brief.md` §Reusable REC-family patterns

- **`<StatusHero>`** — composed by `<AggregateOutcomeHero>` (below). Uses states: `approved` (for ALL_SUCCEEDED) → runs loud orange; `more_info` (adapted, for MIXED); `rejected` (for ALL_FAILED); `pending` (for IN_REVIEW_ONLY). Emphasis="loud" only when ALL_SUCCEEDED.
- **`<OutcomeTimeline>`** — OPTIONAL on this screen. Only rendered when a portal card is expanded (tap-to-expand accordion) to show that portal's per-submission event trail (submitted → validated → sent-to-portal → portal-received → decided). When collapsed, portal card shows only the current status. This differs from REC-004 where the timeline is always shown; here the fan-out to N portals means N timelines would dominate the receipt — timeline is a detail, revealed on demand.
- **`<ResolverMessage>`** — reused when a portal returned a specific rejection message (the portal's own explanation for `INVALID_CONTENT` / `PORTAL_RULES_VIOLATION` failures). Attribution row shows the portal identity (portal name + `Portal moderator` role chip). Renders inside an expanded portal card, not at the aggregate level. Empty state still rendered so visual weight stays consistent.
- **`<PrimaryCtaPerState>`** — reused verbatim. State-typed action stack. See §State variants → CTA map.

### NEW — introduced on this screen

#### 1. `<AggregateOutcomeHero>` — composition around `<StatusHero>`

**Purpose:** the one-glance answer to "did I get what I paid for?" Adapter that maps aggregate publish-job state → `<StatusHero>` state + adds the three-pill counter row.

**Props:**
```ts
type AggregateOutcomeHeroProps = {
  aggregate: 'all_succeeded' | 'mixed' | 'all_failed' | 'in_review_only' | 'partial';
  counts: {
    succeeded: number;
    in_review: number;
    failed: number;
  };
  total_destinations: number;
  published_at: string;  // ISO 8601
  listing_title?: string;  // short reference, "3BR · Downtown Dubai · AED 4.5M"
};
```

**Aggregate → `<StatusHero>` state map:**
| aggregate | StatusHero state | emphasis | label |
|---|---|---|---|
| all_succeeded | approved | loud | Published to {N} of {N} destinations |
| mixed | more_info | default | Published to {N of M} destinations |
| all_failed | rejected | default | Publish didn't complete |
| in_review_only | pending | default | Awaiting portal moderation |
| partial | more_info | default | Published — some destinations still pending |

Counter pills always render (zeros muted, not hidden). Numbers via `<Numeric>`.

**A11y:** `<section aria-labelledby="publish-outcome-label">`. Screen reader hits the label first, then the counter row as list items announced e.g. "3 succeeded, 2 in review, 1 failed."

#### 2. `<PortalReceiptCard>` — per-destination receipt row (NEW ANCHOR — will be reused by AGT-PUB-006)

**Purpose:** the atomic per-destination receipt. One card per portal / channel / country-variant destination in the job.

**Props:**
```ts
type PortalReceiptCardProps = {
  destination: {
    portal_code: string;           // from portal_registry
    portal_display_name: string;   // from portal_registry
    portal_logo_url?: string;      // from portal_registry
    country_code?: string;         // if fan-out is per-country
    all_country_codes?: string[];  // if this card represents a multi-country submission
  };
  status: 'succeeded' | 'in_review' | 'failed';
  error_class?:                     // required if status = 'failed'
    | 'AUTH_EXPIRED'
    | 'PORTAL_RULES_VIOLATION'
    | 'PORTAL_DOWN'
    | 'QUOTA_EXCEEDED'
    | 'INVALID_CONTENT'
    | 'UNKNOWN_ERROR';
  portal_message?: string | null;   // portal's own rejection text; renders in expanded ResolverMessage
  credit_charged: number;           // 0 if reservation was released
  credit_reserved: number;          // pre-charge reservation amount
  timestamp: string;                // ISO 8601 — event time (published_at OR submitted_at OR failed_at)
  live_url?: string;                // populated on succeeded (link to live listing on portal)
  retry_available?: boolean;        // false for AUTH_EXPIRED (must reconnect first) — see error-class map
  fix_deep_link?: string;           // populated for classes with a resolution path
  moderation_queue_deep_link?: string; // populated for in_review + succeeded (portal-side moderation queue view)
  timeline_events?: OutcomeTimelineEvent[]; // populated for the accordion expand
};
```

**Visual anatomy:**
- Card `--lc-surface-raised` + `--lc-elevation-sm` + `var(--lc-radius-lg)`.
- 4px left rail stripe (right rail in RTL) colored by status.
- Row 1: portal logo (32×32, `var(--lc-radius-md)`) + portal name (`var(--lc-type-heading-3)`) + country flag chip.
- Row 2: status pill (tint + glyph + label) + credit charge (`var(--lc-type-data-sm)` mono).
- Row 3: timestamp (`var(--lc-type-caption)` mono muted).
- Row 4: action buttons (see §Broadcast callouts for per-status button map).
- Optional row 5 (expanded): timeline + resolver message.
- Expand chevron top-right — tap to reveal timeline + portal-message accordion. Chevron rotates 180° at `var(--lc-duration-fast)`.

**Multi-country portals:** if `all_country_codes.length > 1` and the fan-out was cross-country (one submission covering multiple markets), show `all_country_codes[0]` flag + `+N` chip. Tap the chip to expand a small popover listing each country's status if the backend split the submission per-country downstream.

**A11y:** card is `<article aria-labelledby="portal-card-{portal_code}">`. Status pill has `aria-label="{portal_name} status: {status_label}"`. Expand chevron `aria-expanded` toggles. All action buttons ≥ 44×44 tap target.

#### 3. `<CreditsSummary>` — the reconciliation block (screen-specific, not an anchor)

**Props:**
```ts
type CreditsSummaryProps = {
  total_charged: number;
  total_reserved: number;
  credits_history_deep_link: string;
};
```

**Rules:**
- Always render — never hide, even when `total_charged === total_reserved`.
- When `total_charged < total_reserved`, show the second row explaining the release.
- Info tooltip always available.
- All numerics via `<Numeric>`.

---

## Explicit copy (English)

Fill Arabic strings during MENA copywriter pass — mark `[TRANSLATION-PENDING]` in the AR mirror MDX for now.

| Slot | Copy |
|---|---|
| Top nav title | Publish receipt |
| Aggregate — ALL_SUCCEEDED label | Published to {N} of {N} destinations |
| Aggregate — MIXED label | Published to {N of M} destinations |
| Aggregate — ALL_FAILED label | Publish didn't complete |
| Aggregate — IN_REVIEW_ONLY label | Awaiting portal moderation |
| Aggregate — PARTIAL label | Published — some destinations still pending |
| Counter pill — succeeded | {N} succeeded |
| Counter pill — in review | {N} in review |
| Counter pill — failed | {N} failed |
| Aggregate timestamp | Published {relative} · {absolute} |
| Aggregate context line | Job {jobId_short} · {N} destinations · 1 listing · [copy] |
| Credits summary — total charged | {N} credits charged |
| Credits summary — release line | Reserved {N} credits · {N} released to your balance |
| Credits summary — tooltip title | Why some credits weren't charged |
| Credits summary — tooltip body | You're only charged for successful publishes. Reserved credits for failed or unreachable portals were released back to your balance. |
| Credits summary — history link | View credits history → |
| Group header — needs attention | Needs your attention ({N}) |
| Group header — awaiting moderation | Awaiting portal moderation ({N}) |
| Group header — live | Live now ({N}) |
| Portal card — succeeded status pill | Live |
| Portal card — in-review status pill | In review |
| Portal card — failed status pill (AUTH_EXPIRED) | Auth expired |
| Portal card — failed status pill (PORTAL_RULES_VIOLATION) | Portal rules |
| Portal card — failed status pill (PORTAL_DOWN) | Portal down |
| Portal card — failed status pill (QUOTA_EXCEEDED) | Quota exceeded |
| Portal card — failed status pill (INVALID_CONTENT) | Content rejected |
| Portal card — failed status pill (UNKNOWN_ERROR) | Unknown error |
| Portal card — credits charged | {N} credit charged |
| Portal card — credits released | 0 credits · reservation released |
| Portal card — action: view live | View live listing |
| Portal card — action: view queue | View in queue |
| Portal card — action: retry | Retry |
| Portal card — action: fix issue (AUTH_EXPIRED) | Reconnect account |
| Portal card — action: fix issue (PORTAL_RULES_VIOLATION) | Fix listing |
| Portal card — action: fix issue (QUOTA_EXCEEDED) | Top up credits |
| Portal card — action: fix issue (INVALID_CONTENT) | Edit content |
| Portal card — action: contact support | Contact support |
| Portal card — expand chevron aria | Show submission timeline |
| Timeline event — submitted | Submitted |
| Timeline event — validated | Content validated |
| Timeline event — sent to portal | Sent to portal |
| Timeline event — portal received | Portal received |
| Timeline event — portal decided | Decision from portal |
| Portal message empty | Portal didn't provide a message. |
| CTA — primary (ALL_SUCCEEDED) | View my listings |
| CTA — primary (MIXED) | View my listings |
| CTA — primary (ALL_FAILED) | Retry all fixable |
| CTA — primary (IN_REVIEW_ONLY) | View submission queue |
| CTA — primary (PARTIAL) | View my listings |
| CTA — secondary (all states) | Publish another |
| CTA — tertiary (ALL_FAILED only) | Contact WingCaster support |
| Contact support link | Something not right? Contact WingCaster support |
| Copy-job-id toast | Job ID copied |

---

## Sample content (for v0 / mockup)

Show the mobile 375px layout with:
- **Aggregate state:** MIXED
- **Aggregate hero:** sunken warning surface, `AlertCircle` glyph in warm warning tone, label "Published to 4 of 6 destinations", pills "3 succeeded · 2 in review · 1 failed", timestamp "Published 3 min ago · 07 Sep 2026, 12:04".
- **Context line:** "Job 5f3a2e1b · 6 destinations · 1 listing" + copy affordance.
- **`<CreditsSummary>`:** "4 credits charged" (large mono) + "Reserved 6 credits · 2 released to your balance" + Info icon + "View credits history →" link.
- **Group: Needs your attention (1):**
  - `<PortalReceiptCard>` — Property Finder UAE (logo + UAE flag chip), status pill "Portal rules" (red tint + `FileWarning` glyph), "0 credits · reservation released", "Failed 3 min ago · 12:04", action buttons "Fix listing" (outline) + "Retry" (ghost).
- **Group: Awaiting portal moderation (2):**
  - `<PortalReceiptCard>` — Bayut UAE (logo + UAE flag chip), status pill "In review" (amber tint + `◐` glyph, pulsing signal-lamp motif), "1 credit charged", "Submitted 3 min ago · 12:04", action button "View in queue".
  - `<PortalReceiptCard>` — Aqar.fm KSA (logo + KSA flag chip), status pill "In review", "1 credit charged", "Submitted 3 min ago · 12:04", action button "View in queue".
- **Group: Live now (3):**
  - `<PortalReceiptCard>` — Instagram (logo + WingCaster-connected badge), status pill "Live" (green tint + `●` glyph), "1 credit charged", "Published 3 min ago · 12:04", action button "View live post →" (opens Instagram in new tab).
  - `<PortalReceiptCard>` — WhatsApp broadcast, status pill "Live", "0 credits · included in plan", "Sent 3 min ago · 12:04", action button "View sent broadcasts".
  - `<PortalReceiptCard>` — Facebook Marketplace, status pill "Live", "1 credit charged", "Published 3 min ago · 12:04", action button "View live post →".
- **Sticky bottom CTA bar:** primary full-width orange "View my listings", secondary text link above "Publish another".
- **Contact support link:** centered below the sticky CTA (visible when scrolled to bottom).

Iteration order for v0 after first pass:
1. Same mobile viewport, aggregate = ALL_SUCCEEDED (loud orange hero, all 6 cards in Live group, no failed/in-review groups, CTA primary "View my listings" + secondary "Publish another").
2. Same mobile viewport, aggregate = ALL_FAILED (neutral rejection hero, all 6 cards in "Needs your attention" group with varied error classes covering all 6 enum values, CTA primary "Retry all fixable" + tertiary "Contact support").
3. Same mobile viewport, aggregate = IN_REVIEW_ONLY (calm sunken hero with teal accent border, all 6 cards in "Awaiting portal moderation" group, CTA primary "View submission queue").
4. Same mobile viewport, aggregate = PARTIAL (same visual pattern as MIXED but with failed pill muted at zero).
5. Same mobile viewport, aggregate = MIXED — cross-country per-portal variant. Show Property Finder Group as 4 separate cards (UAE / KSA / EG / LB), each with its own status + country flag chip.
6. Same mobile viewport, MIXED — one PortalReceiptCard expanded showing timeline (5 events) + ResolverMessage from "Bayut Moderator" explaining a rejection.
7. Desktop 1440px, aggregate = MIXED, two-column layout with sticky right-sidebar CTA + context helper card.
8. Desktop 1440px, aggregate = ALL_SUCCEEDED — loud orange hero full-width above the split.
9. RTL Arabic mirror at mobile 375px, aggregate = MIXED. Use `[TRANSLATION-PENDING]` where copy has no Arabic yet, but MIRROR the whole layout including per-card logo-on-the-right.
10. Dark mode desktop, aggregate = ALL_SUCCEEDED (hero orange shifts to `#FF7440` per Broadcast dark-mode primary).
11. Credits summary tooltip open, hovering the Info icon in the MIXED mobile pass.

Save each output's JSX to `web/src/components/publishing/PublishReceiptScreen/` and screenshot to `docs/design/mockups/AGT-PUB-003-<state>.png`.

---

## Component palette (shadcn / Radix / lucide-react)

| Element | Primitive |
|---|---|
| Top nav | Custom sticky `<header>` — reuse `SHR-NAV-002` mobile top-bar shell |
| `<AggregateOutcomeHero>` | Composition around `<StatusHero>` anchor (REC-004) |
| Counter pills | `Badge` variant="outline" with tint tokens per status |
| Aggregate context line + copy affordance | Custom row + `Button variant="ghost" size="sm"` with `Copy` icon |
| `<CreditsSummary>` | Custom card + `Tooltip` (Radix `TooltipProvider` / `TooltipContent`) |
| Group headers | `<h2 class="lc-overline">` |
| `<PortalReceiptCard>` | Custom (NEW anchor — see §Anchor components) |
| Portal logo | `<img>` from `portal_registry.logo_url` + fallback initials in `--lc-surface-sunken` square |
| Country flag chip | `Badge` variant="outline" + emoji flag OR SVG flag (per `country_codes[]`) |
| Status pill | `Badge` with per-status tint tokens + `lucide-react` glyph |
| Signal-lamp motif on IN_REVIEW pill | `<div>` absolutely positioned dot with CSS `@keyframes` pulse at `--lc-duration-slow` |
| Card expand chevron | `Button variant="ghost"` with `ChevronDown` — rotates 180° on `data-state="open"` |
| Expanded card timeline | `<OutcomeTimeline>` anchor (REC-004) |
| Expanded card portal message | `<ResolverMessage>` anchor (REC-004) with portal identity as resolver |
| Action buttons | `Button` variant per status (outline for primary, ghost for secondary) |
| External-link marker | `ExternalLink` icon 14×14 inside `View live` buttons |
| Sticky mobile CTA bar | Custom `<div>` position: sticky; bottom: 0 + safe-area padding + `--lc-elevation-md` upward |
| `<PrimaryCtaPerState>` | REC-004 anchor |
| Contact support link | `Button variant="link"` |
| Push-update toast | `Sonner` |
| Loading state | `Skeleton` mirroring hero + credits summary + 3 card skeletons |
| Error state | Full-screen fallback: `AlertOctagon` glyph + retry `Button` |
| Copy-job-id toast | `Sonner` — "Job ID copied" |

---

## Interactions

**On page load:**
- Fetch `GET /api/publishing/jobs/:jobId`. During load, show skeleton mirror.
- If 404: agent hit a bad link OR viewed someone else's job. Show a friendly not-found state: "This publish receipt doesn't exist or isn't yours. [Go back to listings]". (Follows REC-004 pattern — 404 not 403; do not leak existence.)
- If 200: render per aggregate state.

**On live update (push notification arrives while page is open, or 60s poll fires):**
- Poll for job state change every 60s OR subscribe to push. If any per-portal status transitions (e.g. `IN_REVIEW` → `SUCCEEDED`), cross-fade the affected portal card at `var(--lc-duration-fast)` and re-compute the aggregate. If aggregate flips (e.g. MIXED → ALL_SUCCEEDED), cross-fade the hero at `var(--lc-duration-base)` and show a toast at top: "Publish updated". Respect `prefers-reduced-motion`.

**On tapping a portal card expand chevron:**
- Card expands smoothly (height transition `var(--lc-duration-base)` `var(--lc-easing-out)`) revealing `<OutcomeTimeline>` + `<ResolverMessage>` if portal_message is present.
- Chevron rotates 180°. Multiple cards can be expanded simultaneously.

**On tapping "View live listing":**
- Opens `live_url` in a new tab. `rel="noopener noreferrer"`. Visible "opens in new tab" affordance via ExternalLink icon.

**On tapping "View in queue" (IN_REVIEW):**
- Navigates to `AGT-PUB-006` (portal submission tracker) at `/listings/:listingId/submissions/:submissionId` for that portal — same-tab route change.

**On tapping "Retry" (FAILED, retry_available === true):**
- POST `/api/publishing/jobs/:jobId/destinations/:destinationId/retry` → server re-attempts the publish for that destination. Card enters loading state (spinner in status pill, `aria-busy="true"`). On success, card flips to `IN_REVIEW` or `SUCCEEDED`; aggregate re-computes.
- No confirm dialog — retry is not destructive.

**On tapping "Fix listing" / "Reconnect account" / "Top up credits" / "Edit content" (FAILED, fix_deep_link):**
- Navigates to the class-specific deep link per §Error-class → resolution map. Agent returns via back-nav — page revalidates on window focus.

**On tapping "Retry all fixable" (aggregate CTA on ALL_FAILED or MIXED):**
- POST `/api/publishing/jobs/:jobId/retry-all` with body `{ error_classes_to_retry: [...] }` — server retries only destinations whose `error_class` supports retry (PORTAL_DOWN, UNKNOWN_ERROR — the transient classes). Non-retryable classes (AUTH_EXPIRED, PORTAL_RULES_VIOLATION, QUOTA_EXCEEDED, INVALID_CONTENT) stay untouched and the CTA copy explains this in a small helper below the button: "AUTH, quota, rules, and content issues need to be fixed first."
- Confirm dialog if > 5 destinations to retry: "Retry {N} publishes? Retries cost credits." → confirm proceeds; cancel closes.

**On tapping "View my listings":**
- Navigates to `AGT-LST-011` publications tab, filtered to the listing referenced by this job.

**On tapping "Publish another":**
- Navigates to `AGT-LST-011` (agent chooses which listing to publish next). If the current job was for a specific listing, alternate: routes to `AGT-PUB-001` pre-loaded with that listing for a re-publish flow.

**On tapping "Contact WingCaster support":**
- Navigates to `SHR-SUP-001` support portal with pre-filled context: `Job ID: {jobId}, Aggregate: {aggregate}, Failed destinations: [...]`.

**On tapping the copy affordance next to Job ID:**
- Copies job ID to clipboard. Toast: "Job ID copied".

**On tapping Info icon in `<CreditsSummary>`:**
- Opens tooltip. Tooltip content per §Explicit copy. Dismisses on tap-outside / Escape.

---

## Error-class → resolution map

Per `[BE-BLOCKER-03]` — 6 enumerated `error_class` values, each with a resolution path:

| error_class | Status pill label | Retry allowed inline? | Fix-issue deep link | Notes |
|---|---|---|---|---|
| `AUTH_EXPIRED` | Auth expired | ❌ no | `→ AGT-CHN-002` (channel connections, filtered to this portal) | Retry gated until reconnected. |
| `PORTAL_RULES_VIOLATION` | Portal rules | ✅ yes (after fix) | `→ AGT-LST-003` (listing edit, scrolled to violated field group with an inline banner naming the violation) | ResolverMessage from portal often names the exact field. |
| `PORTAL_DOWN` | Portal down | ✅ yes (transient — inline retry usually works) | no fix link | Show "The portal is unreachable — usually resolved within an hour" helper. |
| `QUOTA_EXCEEDED` | Quota exceeded | ❌ no | `→ AGT-SUB-003` (credit top-up) OR `→ AGT-SUB-002` (upgrade plan) | Two-CTA case — inline choice: `Top up` OR `Upgrade plan`. |
| `INVALID_CONTENT` | Content rejected | ✅ yes (after edit) | `→ AGT-LST-003` (listing edit) | ResolverMessage from portal explains why. |
| `UNKNOWN_ERROR` | Unknown error | ✅ yes (worth a retry) | `→ SHR-SUP-001` (support, pre-filled) | Show correlation ID prominently in the card for support handoff. |

The retry-all bulk CTA only triggers `PORTAL_DOWN` + `UNKNOWN_ERROR` retries. Other classes require per-card fix-then-retry.

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Loading** | Initial fetch in flight | Skeleton mirroring hero + credits summary + 3 card skeletons + sticky CTA skeleton. |
| **Not found (404)** | Bad jobId OR job belongs to different user | Full-screen fallback: "This publish receipt doesn't exist or isn't yours." + Back to listings button. |
| **Network error** | Fetch failed / offline | Full-screen fallback: retry button + "Check your connection." |
| **ALL_SUCCEEDED** | Every destination status = 'succeeded' | Loud orange hero. All cards in "Live now" group. CTA primary "View my listings" + secondary "Publish another". |
| **MIXED** | ≥1 succeeded AND (≥1 in_review OR ≥1 failed) | Warning-tinted hero. 2-3 group sections with headers. CTA primary "View my listings" + secondary "Publish another"; if any failed, add tertiary "Retry all fixable" if any error_class supports bulk retry. |
| **ALL_FAILED** | Every destination status = 'failed' | Neutral rejection hero. All cards in "Needs your attention" group. CTA primary "Retry all fixable" (or disabled if no class supports retry) + secondary "Publish another" + tertiary "Contact support". |
| **IN_REVIEW_ONLY** | Every destination status = 'in_review' | Calm sunken hero + teal accent border. All cards in "Awaiting portal moderation" group. CTA primary "View submission queue" (routes to AGT-PUB-006 list) + secondary "Publish another". |
| **PARTIAL** | ≥1 succeeded AND ≥1 in_review AND 0 failed | Visually MIXED, but failed pill muted at zero. CTA primary "View my listings" + secondary "Publish another". |
| **Cross-country per-portal — split** | Portal fanned out per country, backend returned N destinations for one portal | Render N separate `<PortalReceiptCard>`s, one per country. Each card shows its own country flag. |
| **Cross-country per-portal — single** | Portal accepted one submission covering N countries | Render 1 `<PortalReceiptCard>` with the primary country flag + a `+N countries` chip. Tap chip → popover listing all countries. |
| **Portal card — retry in flight** | Retry POST in flight for one card | Status pill shows Loader2 + "Retrying…"; card `aria-busy="true"`; action buttons disabled. |
| **Portal card — expanded** | Agent tapped chevron | Reveals `<OutcomeTimeline>` + `<ResolverMessage>` (or empty state). |
| **Push-update arrived while viewing** | Any per-portal status transition | Affected card cross-fades at `--lc-duration-fast`; aggregate re-computes; hero cross-fades at `--lc-duration-base` if aggregate flipped. Toast "Publish updated". |
| **Retry-all in flight** | Bulk retry POST in flight | Bulk CTA shows Loader2 + "Retrying…"; all applicable card statuses flip to loading state simultaneously. |
| **All-retryable transient — recovered** | ALL_FAILED with only PORTAL_DOWN/UNKNOWN_ERROR classes, bulk retry succeeded | After retry: cards flip to succeeded/in_review; hero re-crossfades to MIXED or ALL_SUCCEEDED. Celebratory toast: "Publish complete." |
| **No-quota-anywhere** | ALL_FAILED where every class = QUOTA_EXCEEDED | Hero label adapts: "You're out of credits". Bulk CTA becomes primary "Top up credits" (routes to AGT-SUB-003). |
| **Offline** | Network unreachable while page open | Top-of-page thin banner "You're offline — some actions won't work." Retry buttons disabled. |
| **RTL** | Locale = ar | Full mirror per §Layout. |
| **Dark mode** | prefers-color-scheme dark | Broadcast tokens swap automatically. Orange hero shifts to `#FF7440` per Broadcast reference; ink stays white. |

---

## Accessibility

- Every state hero is a `<section aria-labelledby>` with the label as its accessible name. Screen reader hits status first, always.
- Counter pills announced as a list: "3 succeeded, 2 in review, 1 failed."
- Each `<PortalReceiptCard>` is `<article aria-labelledby="portal-card-{portal_code}">`. Card title includes portal name + status.
- Status pills have accessible name that combines portal + status ("Property Finder UAE status: Portal rules violation").
- Expand chevron `aria-expanded` toggles + labeled "Show submission timeline" / "Hide submission timeline".
- Live push updates announce via `aria-live="polite"` region — e.g. "Property Finder UAE status changed to Live."
- `<CreditsSummary>` info tooltip: trigger is a real `<button>`, tooltip has `role="tooltip"`, dismissible via Escape.
- Signal-lamp pulse on IN_REVIEW status pill: purely decorative, uses `aria-hidden="true"`; the status label carries the semantic.
- Sticky mobile CTA bar has enough backdrop contrast (`--lc-surface-raised` + top-border) never to blend with the hero band above.
- Retry buttons in loading state: `aria-busy="true"` + `Loader2` icon.
- Every tap target ≥ 44×44 CSS px. Ghost-variant text links get padding-Y to hit the floor.
- Focus rings visible on every interactive element — two-tone Broadcast focus ring, do not override.
- No color-only state differentiation — every status uses glyph + label + surface tint together.
- All timestamps + credit numerics via `<Numeric>` (mono + tabular-nums).
- Copy affordance (Job ID) has `aria-label="Copy job ID {jobId}"`.
- Live URLs in "View live listing" have `rel="noopener noreferrer"` + `target="_blank"` + visible "opens in new tab" affordance.

---

## Anti-patterns (do not do these)

- ❌ Do not hardcode a portal list. Every portal name, logo, country flag, adapter reference reads from `portal_registry` (per `[BE-DESIGN-01]`). Adding a portal in Phase 2 must be zero-UI-change.
- ❌ Do not hide the `<CreditsSummary>` block when charged === reserved. Always render — reconciliation is a trust cue, not conditional information.
- ❌ Do not use `variant="destructive"` red on any button. Retry is not destructive. Fix-issue is not destructive. The Broadcast rejection surface tint on failed cards carries the state — do not compound it with red buttons.
- ❌ Do not surface "something went wrong" generic copy on any failure. Every failure MUST map to one of the 6 `error_class` values with the class-specific label + resolution path per §Error-class map.
- ❌ Do not skip the aggregate hero when the job has only 1 destination. The pattern is uniform across 1-N destinations — a 1-destination job still shows "Published to 1 of 1 destinations" hero.
- ❌ Do not show confetti / celebration animations on ALL_SUCCEEDED. The Broadcast orange hero band is the celebration. Confetti reads as juvenile in a MENA B2B commercial context.
- ❌ Do not auto-retry on failure without agent action. Every retry is agent-initiated. Silent auto-retries erode the "I know what I'm paying for" trust cue. (The publishing auto-retry-worker for transient PORTAL_DOWN cases is a separate concern handled BEFORE the receipt is written — by the time the agent sees this screen, the state is settled.)
- ❌ Do not render the raw job ID prominently in the body. Put it in the aggregate context line (first 8 chars, copyable) and in the sidebar small-print. It's not meaningful to the agent — it's for support tickets.
- ❌ Do not render dates in the UI font. Every timestamp goes through `<Numeric>`.
- ❌ Do not lay out per-portal cards in a horizontal grid on desktop. The receipt-shaped vertical read is intentional — a grid breaks the top-to-bottom "did I get what I paid for?" scan.
- ❌ Do not use the signal-lamp pulse motif anywhere except on IN_REVIEW status pills. Broadcast reference reserves the pulse for narrow "in-flight" moments — nowhere else on this screen.
- ❌ Do not open `mailto:` for support. Route to `SHR-SUP-001` in-app.
- ❌ Do not leak dedup dimension in 404 not-found copy — treat "belongs to another user" and "doesn't exist" identically ("This publish receipt doesn't exist or isn't yours").
- ❌ Do not fabricate portal logos or names. Every one comes from `portal_registry.logo_url` + `.display_name` — a missing logo falls back to the initials-in-square placeholder, never to a made-up mark.
- ❌ Do not show a portal's country as a text label — always the country flag chip from `country_codes[]`, with the country code as the accessible name.

---

## Reference designs

Draw structural cues from — do NOT copy 1:1:
- **Stripe payment-receipt page** — the receipt-shaped top-to-bottom read + reconciliation line ("You were charged $X of the $Y authorized").
- **GitHub Actions workflow-run summary** — the per-job status pill grid at the top with expand-to-see-detail affordance is closest to our per-portal card + expand pattern.
- **Shopify order-confirmation page** — the fan-out of "6 items to 3 fulfillment centers" with per-fulfillment status is directly analogous to our per-portal fan-out.
- **Buffer's post-publish detail screen** — the per-network success/failure grid with retry inline is the closest existing pattern in the multi-channel publish space.
- **Zapier task-history detail** — the timeline expand pattern per destination is closest to our accordion timeline.

Do NOT match:
- Hootsuite's post-analytics dashboard (too metrics-heavy — this screen is a receipt, not analytics).
- Later's "post published" toast (too shallow — a toast can't reconcile 6 destinations across 4 error classes).
- Salesforce's process-builder run log (too enterprise-audit-heavy).

---

## Backend contract

**Endpoint:** `GET /api/publishing/jobs/:jobId`

**Scoped strictly to caller's tenant + user_id.** A job belonging to another user returns **404** (not 403 — do not leak existence).

**Response 200:**
```json
{
  "job": {
    "id": "job_01H8XZ...",
    "listing_id": "lst_01H8...",
    "listing_short_ref": "3BR · Downtown Dubai · AED 4.5M",
    "aggregate": "all_succeeded" | "mixed" | "all_failed" | "in_review_only" | "partial",
    "submitted_at": "2026-09-07T12:04:00Z",
    "completed_at": "2026-09-07T12:04:15Z" | null,
    "counts": {
      "succeeded": 3,
      "in_review": 2,
      "failed": 1,
      "total": 6
    },
    "credits": {
      "total_charged": 4,
      "total_reserved": 6
    }
  },
  "destinations": [
    {
      "id": "dst_01H8...",
      "portal": {
        "code": "property_finder",
        "display_name": "Property Finder",
        "logo_url": "https://cdn.wingcaster.app/portals/pf.svg" | null,
        "country_code": "AE",
        "all_country_codes": ["AE"]
      },
      "channel_type": "portal" | "social" | "messaging",
      "status": "succeeded" | "in_review" | "failed",
      "error_class": "AUTH_EXPIRED" | "PORTAL_RULES_VIOLATION" | "PORTAL_DOWN" | "QUOTA_EXCEEDED" | "INVALID_CONTENT" | "UNKNOWN_ERROR" | null,
      "portal_message": "Your listing is missing the trakheesi number required by DLD." | null,
      "credit_charged": 0,
      "credit_reserved": 1,
      "event_at": "2026-09-07T12:04:15Z",
      "live_url": "https://propertyfinder.ae/en/plp/..." | null,
      "retry_available": false,
      "fix_deep_link": "/listings/lst_01H8/edit?focus=trakheesi" | null,
      "moderation_queue_deep_link": "/listings/lst_01H8/submissions/sub_01H8..." | null,
      "correlation_id": "cor_01H8..." | null,
      "timeline": [
        { "key": "submitted", "label": "Submitted", "timestamp": "...", "state": "complete" },
        { "key": "validated", "label": "Content validated", "timestamp": "...", "state": "complete" },
        { "key": "sent_to_portal", "label": "Sent to portal", "timestamp": "...", "state": "complete" },
        { "key": "portal_received", "label": "Portal received", "timestamp": "...", "state": "complete" },
        { "key": "portal_decided", "label": "Decision from portal", "timestamp": "...", "state": "complete" }
      ]
    }
  ]
}
```

**Action endpoints (all POST, all scoped to caller's user_id + tenant):**
- `POST /api/publishing/jobs/:jobId/destinations/:destinationId/retry` — retry one failed destination. 200 with the updated destination row (new event_at, new status, new credit_charged if the retry hit a new billing event).
- `POST /api/publishing/jobs/:jobId/retry-all` with body `{ error_classes_to_retry: ["PORTAL_DOWN", "UNKNOWN_ERROR"] }` — bulk retry across all destinations whose error_class matches one in the list. 200 with the updated job payload.

**Data source dependencies:**
- `distribution_attempts` table — per `[BE-BLOCKER-03]`, needs `error_class` CHECK-constrained column (6 enum values) + backend classifier + backfill for pre-existing rows. Without this migration, `error_class` cannot be reliably returned per destination and this screen cannot render its resolution UI.
- `portal_registry` table — per `[BE-DESIGN-01]`, needs the full registry table (`id`, `code`, `display_name`, `country_codes[]`, `adapter_class_name`, `logo_url`, `publisher_config`, `is_active`). Without this, portal metadata (name, logo, country flags) has no source of truth.
- Portal publisher adapters — per `[BE-BLOCKER-01]`, needs at minimum the Property Finder Group adapter (D19 Phase-1 critical path) for the receipt to represent real portal outcomes. Until then, `status` values for portal destinations are stubbed and this screen renders correctly but reports fake data.

---

## Backend prerequisite NOT already tracked

**`[BE-BLOCKER-07] GET /api/publishing/jobs/:id endpoint + retry POST endpoints.** The publish-outcome data shape defined in §Backend contract above (`GET /api/publishing/jobs/:jobId` returning aggregated job + fan-out destinations + credit reconciliation) does NOT currently exist. Publishing infrastructure has `distribution_attempts` rows in the DB but no per-job aggregation endpoint that composes them with portal registry data + credit reservation state. Scope of the fix:
- Job-level aggregation query that composes `distribution_attempts` (per-destination status + error_class) + `portal_registry` (portal metadata) + `credit_reservations` (reserved vs charged reconciliation).
- Endpoint: `GET /api/publishing/jobs/:id` with tenant + user_id scoping.
- Retry endpoints: `POST /api/publishing/jobs/:id/destinations/:destId/retry` (single) + `POST /api/publishing/jobs/:id/retry-all` (bulk).
- Push notification template: `publishing_job.completed` — piggybacks on existing dispatch (WF-01 + WF-02 patterns). Emits on job-terminal transition. Deep link: `wingcaster://publish-receipt/:jobId`.

Estimated effort: 3-5 days backend. **Depends on `[BE-BLOCKER-03]` (error_class enum) and `[BE-DESIGN-01]` (portal_registry) both landing first.** File in `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` §5a as `[BE-BLOCKER-07]`. **Slot: Week 2 (before AGT-PUB-003 dispatch), after BE-BLOCKER-03 + BE-DESIGN-01.**

---

## Notification hook

**Trigger:** publish job reaches a terminal aggregate state (`all_succeeded`, `all_failed`) OR a per-destination status changes after the job was viewed at least once.

**Piggybacks on existing push infrastructure** — WingCaster's push-dispatch service already handles WF-01 (WhatsApp AI-draft approval) + WF-02 (agency application resolved). No new dispatch machinery needed.

**Requires ONE new push-notification template row:**
- Template key: `publishing_job.completed`
- Variants by `job.aggregate`: `all_succeeded` / `mixed` / `all_failed` / `in_review_only` / `partial`
- Title / body per variant:
  - ALL_SUCCEEDED: "Published to {N} destinations" / "Your listing is live everywhere you selected."
  - MIXED: "Published to {N of M} destinations" / "Some destinations need your attention. Tap to review."
  - ALL_FAILED: "Publish didn't complete" / "None of your destinations went live. Tap to see what happened."
  - IN_REVIEW_ONLY: "Awaiting portal moderation" / "Portals are reviewing your submissions. Tap to see progress."
  - PARTIAL: "Published — awaiting portal moderation" / "Live on {N} destinations, {M} still pending review."
- Deep link: `wingcaster://publish-receipt/:jobId` → maps to `/publish/receipts/:jobId`.
- Emit at aggregate transition (in the same transaction that flips the job's aggregate column).

Filed under `[BE-BLOCKER-07]` — no separate backend blocker for the notification template.

---

## Downstream implementation (Cursor prompt handoff notes)

- **File to create:** `web/src/pages/PublishReceiptPage.tsx`.
- **Route:** add to `web/src/App.tsx` — `<Route path="/publish/receipts/:jobId" element={<PublishReceiptPage />} />`. Drawer variant embedded in `AGT-PUB-001` / `AGT-PUB-002` — same component wrapped in `<Sheet>` chrome, rendered when publish submit resolves.
- **Component decomposition:**
  - `web/src/components/publishing/AggregateOutcomeHero.tsx` — composition around REC-004's `<StatusHero>` anchor.
  - `web/src/components/publishing/PortalReceiptCard.tsx` — NEW anchor (will be reused by AGT-PUB-006 brief).
  - `web/src/components/publishing/CreditsSummary.tsx` — screen-specific.
  - `web/src/components/publishing/PublishReceiptScreen/` — page composition wrapping the above + REC-004's `<PrimaryCtaPerState>`.
- **Reused from REC-004 (`web/src/components/recipient/`):** `<StatusHero>`, `<OutcomeTimeline>`, `<ResolverMessage>`, `<PrimaryCtaPerState>`. Import verbatim — no forks.
- **Data hook:** `web/src/hooks/usePublishJob.ts` — fetches + polls every 60s + revalidates on window focus. Uses React Query.
- **Portal registry hook:** `web/src/hooks/usePortalRegistry.ts` — reads dynamic `portal_registry` (per `[BE-DESIGN-01]`). Cached at app boot; refreshed on window focus. Populates portal logos, names, country flags across the receipt UI.
- **Test discipline:**
  - Unit: each of the 3 new components renders all state variants + a11y structure.
  - Integration: full screen renders correctly across all 6 aggregate variants (all_succeeded, mixed, all_failed, in_review_only, partial, cross-country per-portal). Parameterize.
  - Retry flow: single-card retry → POST → optimistic update → success → status pill flips.
  - Retry-all flow: bulk retry → confirm dialog if >5 destinations → POST → all applicable cards flip to loading state simultaneously.
  - Push-update flow: mock a live status transition; assert hero + affected card cross-fade + toast.
  - Real-Postgres: at least one end-to-end scenario (publish → distribution_attempts rows created with mixed error_class values → this page renders per-class UI + credit reconciliation correctly).
  - Portal registry: mock a new portal_registry row appearing without any UI code change; assert it renders correctly (logo, name, country flags).
  - RTL: verified via `screens.rtl.test.tsx` extension.
- **Broadcast tokens:** `no-raw-hex.test.ts` must stay green.
- **Guard:** assertion test that verifies `<AggregateOutcomeHero>` ONLY uses `emphasis="loud"` (which triggers `--lc-action-primary` background via `<StatusHero>`) when `aggregate === 'all_succeeded'` — enforces the anchor discipline shared with REC-004.

---

## Broadcast alignment callouts

Every callout below is a Broadcast-token-specific instruction that the design AI or downstream Cursor implementation MUST honor. Non-negotiable.

- Aggregate hero surfaces per aggregate exactly as mapped in §Broadcast callouts. Never invent an aggregate color.
- ALL_SUCCEEDED hero (the ONE loud case) uses `var(--lc-action-primary)` full-bleed. Text `var(--lc-action-primary-text)`. Glyph inside a white circle chip.
- ALL_FAILED surface never uses `var(--lc-status-danger)` alone as a background. Failure is a state, not an error.
- Counter pills use the status token trio (tint + fg + dot) per `--lc-status-{published,underOffer,closed}`. Zero-value pills muted at opacity 0.4, never hidden.
- `<PortalReceiptCard>` uses `var(--lc-radius-lg)` (7px). No 12+px rounding.
- Card left rail 4px stripe carries the state color; card interior stays neutral surface.
- Portal logo fallback is `--lc-surface-sunken` square with `--lc-text-muted` initials. Never a fabricated logomark.
- Status pills always use tint + glyph + label — never color alone.
- Signal-lamp pulse (teal `--lc-accent-bold` dot at `--lc-duration-slow`) is LEGAL only on IN_REVIEW pills for portals in active moderation. Nowhere else.
- Elevations offset, not blurred — `var(--lc-elevation-sm)` for cards; `var(--lc-elevation-md)` for the sticky mobile CTA bar upward shadow + tooltip surface.
- CTA primary fill `var(--lc-action-primary)`; hover DARKER to `var(--lc-action-primary-hover)`. Never lighten.
- Destructive-adjacent actions (Contact support, Retry) use `variant="outline"` or `variant="ghost"`. Never `variant="destructive"` red on any PUB screen.
- Timestamps + job ID + credit numerics via `<Numeric>` — mono + tabular-nums.
- Focus rings two-tone via base CSS. Do not override.
- Motion: aggregate hero cross-fade `var(--lc-duration-base)`; per-card status cross-fade `var(--lc-duration-fast)`; card expand-collapse `var(--lc-duration-base)` with `var(--lc-easing-out)`. Respect `prefers-reduced-motion`.
- Radii: cards `var(--lc-radius-lg)`; buttons `var(--lc-radius-md)`; status pills + counter pills `var(--lc-radius-pill)`; portal logo `var(--lc-radius-md)`.
- Sticky mobile CTA bar `var(--lc-surface-raised)` + top-border `var(--lc-border)` + upward `var(--lc-elevation-md)` shadow. Safe-area padding for iOS home indicator.

---

## Handoff instruction to v0

Paste this brief in full into a fresh v0.app chat. Framing prompt (paste before this brief):

```
I'm designing the WingCaster "Publish receipt" screen (AGT-PUB-003) — MENA real-estate B2B SaaS. It's the mobile-first screen where an agent sees, per portal / per channel, what happened after they clicked Publish. Portals cost credits; this is the revenue-protection surface where every credit charge gets reconciled. Five aggregate states: ALL_SUCCEEDED, MIXED, ALL_FAILED, IN_REVIEW_ONLY, PARTIAL. Six failure classes per portal (AUTH_EXPIRED, PORTAL_RULES_VIOLATION, PORTAL_DOWN, QUOTA_EXCEEDED, INVALID_CONTENT, UNKNOWN_ERROR), each with a resolution path. Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind.

This screen INHERITS four anchor components from the AGT-REC-004 brief (StatusHero, OutcomeTimeline, ResolverMessage, PrimaryCtaPerState) — reuse them verbatim, don't reinvent. It introduces ONE new anchor component (PortalReceiptCard) that a sibling brief (AGT-PUB-006) will later reuse. Design it as a reusable primitive.

First pass: render the MOBILE 375px layout for aggregate = MIXED. Warning-tinted aggregate hero at top with counter pills "3 succeeded · 2 in review · 1 failed". CreditsSummary block explaining "4 credits charged · 2 released to your balance". Three grouped sections of PortalReceiptCards: Needs your attention (1 failed with Portal rules violation), Awaiting portal moderation (2 in review), Live now (3 succeeded). Sticky bottom CTA bar with primary "View my listings" + secondary "Publish another".

LTR English only for this pass — I'll ask for RTL Arabic, other aggregate states, cross-country per-portal, expanded card, desktop, and dark mode as separate follow-ups.

Follow the copy table in the brief exactly. Do not fabricate portal logos or names beyond the sample content section (Property Finder, Bayut, Aqar.fm, Instagram, WhatsApp, Facebook Marketplace).

DESIGN BRIEF FOLLOWS:
```

Iteration order after first pass:
1. `Same mobile viewport, aggregate = ALL_SUCCEEDED. Loud Broadcast-orange hero with white CheckCircle2 glyph. All 6 cards in Live now group. CTA primary "View my listings" + secondary "Publish another".`
2. `Same mobile viewport, aggregate = ALL_FAILED. Neutral rejection hero. All 6 cards in Needs your attention group with varied error classes covering all 6 enum values. CTA primary "Retry all fixable" + tertiary "Contact WingCaster support".`
3. `Same mobile viewport, aggregate = IN_REVIEW_ONLY. Calm sunken hero with teal accent border + Hourglass glyph. All 6 cards in Awaiting portal moderation group with pulsing signal-lamp on In review pills. CTA primary "View submission queue".`
4. `Same mobile viewport, aggregate = PARTIAL. Visually MIXED but with failed pill muted at zero.`
5. `Same mobile viewport, aggregate = MIXED — cross-country per-portal variant. Show Property Finder Group as 4 separate cards (UAE / KSA / EG / LB), each with its own country flag chip.`
6. `Same mobile viewport, MIXED — one PortalReceiptCard expanded showing OutcomeTimeline (5 events: submitted → validated → sent-to-portal → portal-received → portal-decided) + ResolverMessage from "Bayut Moderator" explaining a rejection.`
7. `Desktop 1440px, aggregate = MIXED. Two-column layout with sticky right-sidebar CTA + context helper card. Aggregate hero full-width above the split.`
8. `Desktop 1440px, aggregate = ALL_SUCCEEDED. Loud orange hero full-width above split.`
9. `RTL Arabic mirror at mobile 375px, aggregate = MIXED. Use [TRANSLATION-PENDING] where copy has no Arabic yet, but MIRROR the whole layout including per-card logo-on-the-right and action-buttons-on-the-left.`
10. `Dark mode desktop, aggregate = ALL_SUCCEEDED (hero orange shifts to #FF7440 per Broadcast dark-mode primary).`
11. `Credits summary tooltip open, hovering the Info icon in the MIXED mobile pass.`

Save each output's JSX to `web/src/components/publishing/PublishReceiptScreen/` + screenshot to `docs/design/mockups/AGT-PUB-003-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 has produced all 11 iteration states (mobile MIXED, ALL_SUCCEEDED, ALL_FAILED, IN_REVIEW_ONLY, PARTIAL, cross-country MIXED, expanded card MIXED; desktop MIXED, ALL_SUCCEEDED; RTL mobile MIXED; dark desktop ALL_SUCCEEDED; tooltip open).
- [ ] Screenshots committed under `docs/design/mockups/`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/`.
- [ ] Cursor Wave-2 dispatch prompt references this brief + the mockup paths + the four reused REC-004 anchors + the new `<PortalReceiptCard>` anchor.
- [ ] `[BE-BLOCKER-07]` (GET /api/publishing/jobs/:id + retry endpoints + publishing_job.completed push template) filed in kickoff §5a.
- [ ] Dependency chain confirmed in kickoff §5a: `[BE-BLOCKER-07]` depends on `[BE-BLOCKER-03]` (error_class enum) + `[BE-DESIGN-01]` (portal_registry) both landing first; `[BE-BLOCKER-01]` (Property Finder Group adapter) is a data-quality dependency, not a UI blocker (the screen renders correctly with stubbed portal data during the Phase-1 adapter build).
- [ ] AGT-PUB-006 brief (portal submission tracker) written subsequently references this brief's `<PortalReceiptCard>` anchor pattern and only spells out per-screen deltas.
