# Screen Brief — AGT-REC-004 · Agency application outcome (WF-02 Recipient) — ANCHOR for AGT-REC family

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

Companion to `SCREEN_MATRIX_AGENT.md` §25 entry `AGT-REC-004`. Week 1 anchor per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` Rev 9 §5 row 30 + §6 Week 1. Closes the WF-02 (Join agency) recipient loop after `AGN-MEM-002b` (agency review + accept/reject).

**ANCHOR NOTICE.** This brief is the pattern anchor for the entire AGT-REC family (recipient / outcome screens: REC-002 comparable-report outcome, REC-003 agent-price-report outcome, REC-005 account-recovery outcome, REC-006 ownership-transfer offered). REC-002 / REC-003 / REC-005 / REC-006 briefs will inherit the four reusable Broadcast patterns defined below and spell out only per-screen deltas:

1. **`<StatusHero>`** — glyph + label + timestamp banner. §Reusable REC-family patterns.
2. **`<OutcomeTimeline>`** — vertical event rail (submitted → viewed → decided → resolved). §Reusable REC-family patterns.
3. **`<ResolverMessage>`** — decision message rendered as-is from the resolver (agency owner / PA / system) with attribution card. §Reusable REC-family patterns.
4. **`<PrimaryCtaPerState>`** — the single state-specific primary action pattern (accept / withdraw / re-apply / browse alternatives / switch tenant). §Reusable REC-family patterns.

---

## 🎨 Broadcast alignment

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`.** All color / font / spacing / motion / radii / elevation references below are governed by that reference. Never introduce raw hex, never introduce a `--lc-orange-*` primitive alias, never use a Tailwind palette class that isn't already remapped to a Broadcast semantic in `web/tailwind.config.js`.

**Screen-specific Broadcast callouts:**

- **Status hero band** — full-bleed section at top of scroll. Background depends on state:
  - PENDING: `background: var(--lc-surface-sunken)`, border-bottom `var(--lc-border)`, glyph + text `var(--lc-text-primary)` (calm, no color emotion).
  - APPROVED: `background: var(--lc-action-primary)`, text `var(--lc-action-primary-text)` — this is the ONE screen where the primary orange is allowed to run large as a hero band (matches Broadcast reference §Colors — Actions "may run LARGE for hero bands"). Glyph inside white circle chip on the orange.
  - REJECTED: `background: var(--lc-surface-raised)`, top-border `4px solid var(--lc-status-closed-fg)`, glyph in `var(--lc-status-closed-fg)` — never `var(--lc-status-danger)` alone (rejection is not an error, it's a decision).
  - EXPIRED: `background: var(--lc-surface-sunken)`, top-border `4px solid var(--lc-text-muted)`, glyph `var(--lc-text-muted)`.
  - WITHDRAWN: `background: var(--lc-surface-sunken)`, glyph `var(--lc-text-muted)`, muted framing.
- **Status glyphs** (lucide-react):
  - PENDING → `Clock`
  - APPROVED → `CheckCircle2`
  - REJECTED → `XCircle`
  - EXPIRED → `Hourglass`
  - WITHDRAWN → `ArrowUturnLeft`
  Glyph 32×32 on desktop, 28×28 on mobile. Always paired with a text label AND a machine-readable status pill — never color alone.
- **Status label typography** — `var(--lc-type-heading-1)` (26/32 IBM Plex Sans 600) on desktop; `var(--lc-type-heading-2)` (21/28) on mobile.
- **Status timestamp** — always `<Numeric>` component, `var(--lc-type-caption)`, `var(--lc-text-muted)`, e.g. `Decided 2 hours ago · 07 Sep 2026, 14:22`.
- **Agency identity block** — mirrors `AGN-MEM-005` public agency card. Logo 56×56 with `var(--lc-radius-md)`; agency name `var(--lc-type-heading-3)`; location line `var(--lc-type-body-sm)` + `var(--lc-text-muted)`. Card `--lc-surface-raised` + `--lc-elevation-sm`.
- **Timeline rail** — 2px vertical rule in `var(--lc-border)`. Event dots 12×12: completed dots `var(--lc-accent-bold)` with `var(--lc-accent-bold-edge)` 1px outline (accent bold ALWAYS needs a boundary per Broadcast reference); pending dot `var(--lc-border-strong)` open ring; current dot pulses at `var(--lc-duration-slow)` (the ONE case the signal-lamp motif is legal on this screen, and only for the current in-progress node). Timestamps mono via `<Numeric>`.
- **Decision message card (`<ResolverMessage>`)** — `--lc-surface-raised` + `--lc-elevation-sm`, `var(--lc-radius-lg)` (7px), padding `var(--lc-space-lg)` all sides. Author attribution row uses agency-owner display name + role chip (`Owner` / `Admin`). Body renders resolver's message via a strict Markdown-subset renderer (paragraph, line break, link only — no images, no headings, no lists). If empty, show a muted `var(--lc-text-muted)` "No message provided" instead of hiding the card.
- **Primary CTA** — `<Button variant="default" size="lg">` full-width on mobile, right-aligned max-width 320px on desktop. Fill `var(--lc-action-primary)`, hover DARKER to `var(--lc-action-primary-hover)`. Secondary action `<Button variant="outline">`. Destructive-adjacent actions (Withdraw application) use `<Button variant="ghost">` with `var(--lc-text-muted)` label, NEVER destructive red on this screen — withdrawal is not destruction.
- **Motion** — status hero cross-fades between states at `var(--lc-duration-base)` (180ms) with `var(--lc-easing-out)` when the page re-renders after a live poll or push update. Timeline event dot advancing pulses once at `var(--lc-duration-slow)` (240ms) with `var(--lc-easing-emphasis)` (the "broadcast moment" easing) — the ONLY legal use of emphasis easing on this screen. Respect `prefers-reduced-motion`: skip both.
- **Focus rings + 44px tap floor** — automatic via base CSS. Do not override.

---

## Meta

| | |
|---|---|
| Screen ID | AGT-REC-004 |
| Screen name | Agency application outcome |
| Persona | Agent (post-signup, applicant to an agency via WF-02) |
| Device targets | Mobile 375px (primary — likely opened from a push notification), tablet 768px, desktop 1440px |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark, respect `prefers-color-scheme` |
| Route | Primary: `/agency/applications/:appId/status` (matches matrix §25). Alternate deep-link (from unified inbox notification badge): `/inbox/applications/:applicationId` — same component, different route entry. Email deep-link: signed link that resolves to the primary route. |
| Current state | MISSING — must ship with WF-02 cluster (Week 1). |
| Workflow role | WF-02 role=Recipient. Closes loop after `AGN-MEM-002b` decision. |
| Backend prerequisites | ✅ `agency_applications` table (created with WF-02 cluster migrations) · ✅ `GET /api/users/me/agency-applications/:id` (endpoint scoped to caller's user_id, returns 404 not 403 for other users' applications) · ✅ Tenant switch via `SHR-NAV-008` on approval accept · ⏳ Push-notification template for `agency_application.resolved` — see §Notification hook below (piggybacks on existing infra, template row NEW) · ⏳ 30-day auto-expire cron / rule — see §Backend contract |

---

## Purpose

An agent who applied to join an existing agency (via `AGN-MEM-005` submission, which is the recipient-side of the SHR-AUT-006 `path=join` registration path OR standalone re-application from the agency directory `SHR-PUB-003`) opens this screen to see the outcome. Five states — PENDING (waiting), APPROVED (agency accepted), REJECTED (agency declined), EXPIRED (30 days passed without agency response), WITHDRAWN (agent recalled).

**Emotional stakes:** high. The agent has offered something of themselves — their identity, their book of business, potentially their next paycheck's origin — to an agency and is now standing at the door waiting to hear if they're in. Rejection copy must respect that. Approval must feel like being welcomed, not being processed.

Success outcome per state:
- APPROVED → agent taps "Switch to {Agency} workspace" → JWT reissued with new active tenant → `SHR-NAV-008` tenant context set → land on `AGT-DSH-001` with a one-time celebratory banner ("You're now with {Agency}. Welcome.").
- REJECTED → agent has two respectful exits: browse other agencies (`SHR-PUB-003`) or continue solo in personal tenant (`AGT-DSH-001` in personal tenant context).
- EXPIRED → offered a re-apply CTA (opens `AGN-MEM-005` re-scoped to same agency) OR pick a different agency.
- WITHDRAWN → offered the same re-apply / pick-different affordances.
- PENDING → soft "we'll notify you" reassurance + Withdraw affordance + estimated response window.

---

## Design goals

1. **The state is legible in the first 200ms.** The status hero at the top of scroll tells the agent everything before they read a word — glyph + color + label + timestamp. Everything below is context, not answer.
2. **Rejection is respectful.** No "You have been rejected." No red banner. Neutral surface, closed-diamond glyph in muted tone, warm-but-firm copy. Two clear onward paths so the agent never feels they've been left in a dead end.
3. **Approval feels earned.** The one time we let Broadcast orange run as a full hero band across this family. The Accept CTA is unmissable. The switch-tenant action carries the emotional weight of "you're in."
4. **Timeline earns the space it takes.** The `<OutcomeTimeline>` isn't decorative — it shows the agent's application was seen (viewed timestamp), reviewed (decided timestamp), and the SLA the agency was working against. Removes ghosting anxiety in the pending state.
5. **RTL-first for MENA.** Arabic mirrors the whole layout; the timeline rail flips to the right side; status hero mirrors icon+label order; identifier fields (agency slug, application ID) stay LTR embedded in RTL context.
6. **Anchor discipline.** The four reusable patterns (status hero, timeline, resolver message, primary CTA per state) are lifted verbatim by REC-002/003/005/006. Any change to those patterns lands here first, in this brief.

---

## Layout

### Mobile 375px (primary)

Single scrolling column, no chrome distractions:

1. **Top nav** — thin sticky bar: back arrow (left) → screen title "Application status" (center, `var(--lc-type-body)` + `var(--lc-text-heading)`) → menu dot (right, only reveals Contact Support in overflow). 48px tall including safe area.
2. **`<StatusHero>` band** — full-bleed, ~180px tall on mobile. Glyph 28×28, label `var(--lc-type-heading-2)`, timestamp `var(--lc-type-caption)` mono. State-dependent background per Broadcast callout above.
3. **Agency identity card** — full-width card, `var(--lc-space-md)` padding, `var(--lc-space-md)` gutter from hero. Contents: logo (56×56, `var(--lc-radius-md)`) + agency name (`var(--lc-type-heading-3)`) + city / market line (`var(--lc-type-body-sm)` muted) + a small `>` chevron to expand into agency public profile (`SHR-PUB-004`) in a bottom sheet, not a route change (agent should not lose their place).
4. **`<OutcomeTimeline>` rail** — 4 event nodes stacked vertically:
   - Submitted — always present, timestamp mono.
   - Viewed by agency — timestamp OR "Not yet viewed" muted.
   - Decided — timestamp OR "Pending decision" muted (open ring dot with pulse if agency has viewed but not decided; open ring no pulse if not viewed yet).
   - Resolved (Approved / Rejected / Expired / Withdrawn) — completed dot when state ≠ pending.
   Timeline sits directly below agency card, edge-to-edge padding.
5. **`<ResolverMessage>` card** — only rendered when a message exists AND state ≠ pending (agent doesn't want the agency's message shown when there is no decision yet). Attribution row: avatar 32×32 + `{owner_name}` + `Owner` role chip + `Decided 07 Sep 2026, 14:22` timestamp. Body message below.
6. **State-specific detail block** — one of:
   - APPROVED: role you're joining as (`Agent · Standard capability pack`) + affiliation mode (`Exclusive` / `Non-exclusive`) + what-this-means one-liner + note about what happens to personal tenant.
   - REJECTED: encouragement paragraph + two link cards ("Browse other agencies" / "Continue solo in personal workspace").
   - PENDING: SLA expectation line (`Typical review: 3 days · Your application expires 07 Oct 2026`) + Withdraw affordance.
   - EXPIRED: "This application timed out." + Re-apply CTA + Browse-different CTA.
   - WITHDRAWN: "You withdrew this application on {date}." + Re-apply CTA + Browse-different CTA.
7. **`<PrimaryCtaPerState>` block** — sticky bottom bar on mobile ONLY (44px+ tap, full-width primary, safe-area padding). Content depends on state (see §State variants). Secondary/ghost actions inline above the primary bar.
8. **Contact support link** — `var(--lc-text-brand)` link, centered, `var(--lc-type-body-sm)`. Always visible, always same wording: "Something not right? Contact WingCaster support."

### Tablet 768px & Desktop 1440px

Two-column layout, 65 / 35 split, max-width `1200px` centered:

- **Left column (65%):** status hero band spans FULL width above the split (not columned). Below the split: agency identity card → timeline → resolver message → state-specific detail → contact support. Reads as one document top to bottom.
- **Right column (35%):** sticky sidebar (top-offset `var(--lc-space-3xl)`) with:
  - `<PrimaryCtaPerState>` block — CTA stack (primary + secondary + destructive-adjacent ghost).
  - Context helper card — a `var(--lc-surface-sunken)` card explaining what happens next per state (e.g. approved: "When you accept, your workspace switches to {Agency}. Your personal tenant remains, but this browser will land in {Agency} until you switch back via the tenant menu.").
  - Small print — application ID (`<Numeric>` monospaced), applied-on timestamp, decision-on timestamp (if any) — the tabular truth for support tickets.

### RTL

Full mirror. Timeline rail flips to the right side of its column. Status hero glyph → text order flips. Sticky bottom CTA bar (mobile) stays anchored bottom; contents mirror. Agency logo card mirrors so logo is on the right in RTL. Numeric fields (timestamps, application ID) stay LTR bidi-embedded inside RTL text run.

---

## Reusable REC-family patterns (anchor definitions — REC-002/003/005/006 inherit)

**These four components live under `web/src/components/recipient/` and are shared across every AGT-REC screen. Any change to them lands here first, in this brief. Downstream REC briefs reference this section by name (e.g. "REC-002 status hero uses the anchor `<StatusHero>` pattern with state map: `approved` / `rejected` / `more_info_requested` / `superseded`").**

### 1. `<StatusHero>` — glyph + label + timestamp band

**Purpose:** the one-glance answer to "what happened?" State-typed. Full-bleed on mobile, edge-to-edge inside container on desktop.

**Props:**
```ts
type StatusHeroProps = {
  state: 'pending' | 'approved' | 'rejected' | 'expired' | 'withdrawn' | 'superseded' | 'more_info';
  label: string;                    // required — no default; brief must supply per-screen wording
  timestamp?: string;               // ISO 8601; rendered as relative + absolute via <Numeric>
  glyph?: LucideIcon;               // override; default per state (see mapping)
  emphasis?: 'default' | 'loud';    // 'loud' = allowed to run --lc-action-primary as bg (approval only)
};
```

**State → glyph + surface map** (per Broadcast callouts above):
| state | glyph | background | ink | notes |
|---|---|---|---|---|
| pending | `Clock` | `--lc-surface-sunken` | `--lc-text-primary` | calm; no emotion |
| approved | `CheckCircle2` | `--lc-action-primary` (loud) | `--lc-action-primary-text` | THE loud case |
| rejected | `XCircle` | `--lc-surface-raised` + top-border `--lc-status-closed-fg` | `--lc-text-primary`, glyph `--lc-status-closed-fg` | never `--lc-status-danger` alone |
| expired | `Hourglass` | `--lc-surface-sunken` + top-border `--lc-text-muted` | `--lc-text-muted` | |
| withdrawn | `ArrowUturnLeft` | `--lc-surface-sunken` | `--lc-text-muted` | |
| superseded | `Layers` | `--lc-surface-sunken` | `--lc-text-muted` | REC-002 duplicate-report case |
| more_info | `AlertCircle` | `--lc-surface-raised` + top-border `--lc-status-warning-fg` | `--lc-text-primary` | REC-002/003 "needs revision" |

Typography: label `var(--lc-type-heading-1)` desktop / `heading-2` mobile. Timestamp `var(--lc-type-caption)` mono via `<Numeric>`. Glyph 32×32 desktop / 28×28 mobile.

Cross-fade between states at `var(--lc-duration-base)` when props change. Respect `prefers-reduced-motion`.

**A11y:** entire hero is a `<section aria-labelledby="status-hero-label">`. Label is the accessible name of the status. Timestamp is inside the same section with a hidden `aria-label` expanding relative → absolute.

### 2. `<OutcomeTimeline>` — vertical event rail

**Purpose:** shows the trajectory of the request — was it seen, was it decided, is it resolved. Kills ghosting anxiety in the pending state; provides receipt-of-events for support tickets in resolved states.

**Props:**
```ts
type OutcomeTimelineEvent = {
  key: string;                      // stable key for React
  label: string;                    // e.g. "Submitted", "Viewed by agency", "Decided"
  timestamp?: string;               // ISO 8601; omit → "Pending" muted
  state: 'complete' | 'current' | 'pending' | 'skipped';
};

type OutcomeTimelineProps = {
  events: OutcomeTimelineEvent[];   // ordered top → bottom
};
```

**Visual anatomy:** 2px vertical rule in `var(--lc-border)`. Event dots 12×12 in a column offset `var(--lc-space-md)` from left edge (or right in RTL). Labels + timestamps on the right of the dot (left in RTL). Row height `var(--lc-space-2xl)` per event minimum.

**Dot states:**
- `complete` → filled circle, `var(--lc-accent-bold)` fill with `var(--lc-accent-bold-edge)` 1px outline (accent bold NEEDS a boundary per Broadcast reference).
- `current` → open ring, `var(--lc-accent-bold-edge)` 2px stroke, 12×12 pulsing at `var(--lc-duration-slow)` — the one legal signal-lamp use on this screen. Skip pulse if `prefers-reduced-motion`.
- `pending` → open ring, `var(--lc-border-strong)` 2px stroke, no pulse.
- `skipped` → dashed open ring, `var(--lc-border)` 2px dashed. Used when an event was bypassed (e.g. auto-approved application → "Viewed by agency" is skipped).

**Rule segment coloring:** between two `complete` dots the rule uses `var(--lc-accent-bold-edge)`; before a `pending` or `current` dot it uses `var(--lc-border)`.

**A11y:** rendered as `<ol>` with `<li>` per event; state announced via `aria-current="step"` on the current node.

### 3. `<ResolverMessage>` — decision message from the resolver

**Purpose:** renders the free-text message the resolver (agency owner, PA reviewer, system) attached to their decision, with clear attribution and a fallback for the empty case. The message is untrusted user content, so it's rendered via a strict Markdown-subset renderer.

**Props:**
```ts
type ResolverMessageProps = {
  resolver: {
    display_name: string;
    role_label: string;             // e.g. "Owner", "Admin", "Platform Administrator"
    avatar_url?: string;
  };
  decided_at: string;               // ISO 8601
  message: string | null;           // Markdown-subset; null renders muted empty state
  empty_state_copy?: string;        // default: "No message provided."
};
```

**Anatomy:** card `--lc-surface-raised` + `--lc-elevation-sm` + `var(--lc-radius-lg)`. Attribution row at top: avatar 32×32 (`Avatar` shadcn primitive with fallback initials) + name + role chip (`<Badge variant="outline">`) + timestamp `<Numeric>` right-aligned. Below: message body in `var(--lc-type-body-lg)` mobile / `var(--lc-type-body)` desktop.

**Markdown subset allowed:** paragraph, line break, link (`<a>` opens in new tab with `rel="noopener noreferrer"`), inline emphasis. Explicitly forbidden: images, headings, lists, tables, code blocks. Renderer strips them silently — no error banner shown to the agent.

**Empty state:** if `message == null || message.trim() === ''`, card still renders (never hidden), body replaced with `var(--lc-text-muted)` italic `empty_state_copy`. Keeps the visual weight consistent across resolved-with-msg vs resolved-without-msg.

**A11y:** attribution row is `<header>` inside the card; body is a `<div role="article">`. Screen reader reads "Message from {name}, {role}, decided {timestamp}: {body}".

### 4. `<PrimaryCtaPerState>` — the state-specific action stack

**Purpose:** every REC screen has exactly one primary action per state (with 1-2 secondary/ghost supporting actions). This component maps `state` → correct action set, so downstream briefs never re-invent the pattern.

**Props:**
```ts
type CtaAction = {
  key: string;
  label: string;
  variant: 'default' | 'outline' | 'ghost';
  href?: string;                    // client-side route
  onClick?: () => void;             // for tenant-switch / withdraw / etc.
  icon?: LucideIcon;
  loading?: boolean;                // for in-flight action
  disabled?: boolean;
  confirm?: {                       // opens Dialog before firing
    title: string;
    body: string;
    confirm_label: string;
    cancel_label: string;
  };
};

type PrimaryCtaPerStateProps = {
  primary: CtaAction;               // required — exactly one
  secondary?: CtaAction;            // optional — max one
  tertiary?: CtaAction;             // optional — max one, ghost variant only
  layout: 'stacked' | 'inline';     // stacked = mobile / sidebar; inline = desktop bottom
};
```

**Rules for downstream briefs:**
- Exactly ONE primary action per state. No "two primaries."
- Primary uses `variant="default"` (orange fill). Hover DARKENS, never lightens.
- Secondary uses `variant="outline"`.
- Tertiary uses `variant="ghost"`. Reserved for destructive-adjacent actions (Withdraw, Decline) that must not be visually violent.
- No `variant="destructive"` red on any REC screen. Rejection isn't a system error and withdrawal isn't destruction — REC screens are outcome pages, not tooling pages.
- Mobile: sticky bottom bar (safe-area-padded, `--lc-surface-raised` + top-border `--lc-border`, primary full-width; secondary as text link above; tertiary as text link above secondary).
- Desktop: right-sidebar vertical stack, max-width 320px, gap `var(--lc-space-sm)`.

**State → action map for AGT-REC-004 specifically:**

| state | primary | secondary | tertiary |
|---|---|---|---|
| pending | (none — the primary bar shows a passive "Awaiting agency response" `disabled` chip, no action) | View agency profile | Withdraw application (with confirm dialog) |
| approved | Switch to {Agency} workspace | View agency profile | Decline (with confirm dialog) |
| rejected | Browse other agencies | Continue as solo agent | — |
| expired | Re-apply to {Agency} | Browse other agencies | — |
| withdrawn | Re-apply to {Agency} | Browse other agencies | — |

(REC-002/003/005/006 will define their own state → action tables in their briefs, but MUST use the same primary/secondary/tertiary rules.)

**A11y:** primary/secondary/tertiary are `<button>` or `<a role="button">` per Radix conventions. Confirm-required actions open `<AlertDialog>` (focus trap, Escape closes). Loading state uses `Loader2` icon + `aria-busy="true"` on the button.

---

## Explicit copy (English)

Fill Arabic strings during MENA copywriter pass — mark `[TRANSLATION-PENDING]` in the AR mirror MDX for now.

| Slot | Copy |
|---|---|
| Top nav title | Application status |
| Status hero — PENDING label | Awaiting {Agency Name}'s response |
| Status hero — PENDING timestamp | Submitted {relative} · {absolute} |
| Status hero — APPROVED label | You've been accepted by {Agency Name} |
| Status hero — APPROVED timestamp | Decided {relative} · {absolute} |
| Status hero — REJECTED label | {Agency Name} decided not to proceed at this time |
| Status hero — REJECTED timestamp | Decided {relative} · {absolute} |
| Status hero — EXPIRED label | This application timed out |
| Status hero — EXPIRED timestamp | Expired {relative} · {absolute} |
| Status hero — WITHDRAWN label | You withdrew this application |
| Status hero — WITHDRAWN timestamp | Withdrawn {relative} · {absolute} |
| Agency card — expand chevron aria | View {Agency Name}'s public profile |
| Timeline — event 1 label | Submitted |
| Timeline — event 2 label | Viewed by agency |
| Timeline — event 2 empty | Not yet viewed |
| Timeline — event 3 label | Decided |
| Timeline — event 3 pending | Awaiting decision |
| Timeline — event 4 label (approved) | Approved |
| Timeline — event 4 label (rejected) | Declined |
| Timeline — event 4 label (expired) | Timed out |
| Timeline — event 4 label (withdrawn) | Withdrawn |
| Resolver message — attribution role — owner | Owner |
| Resolver message — attribution role — admin | Admin |
| Resolver message — empty state | No message provided. |
| APPROVED detail — role line | You'll join as **{role_label}** with the **{capability_pack_label}** capability pack. |
| APPROVED detail — affiliation exclusive | This is an **exclusive** affiliation. Your personal workspace stays, but your listings and leads flow to {Agency Name}. |
| APPROVED detail — affiliation non-exclusive | This is a **non-exclusive** affiliation. Your personal workspace stays independent; you can be with other agencies at the same time. |
| APPROVED detail — tenant note | When you switch, this browser will land in {Agency Name} until you switch back via the workspace menu. |
| REJECTED detail — encouragement | The MENA market is wide open. Other agencies may be a better fit — or you can start solo and revisit later. |
| PENDING detail — SLA line | Typical review: **3 days** · Application expires **{expires_on}** |
| PENDING detail — reassurance | We'll notify you the moment {Agency Name} decides. |
| EXPIRED detail | This application timed out after 30 days without a response. You can re-apply or explore other agencies. |
| WITHDRAWN detail | You withdrew this application on **{withdrawn_on}**. You can re-apply or explore other agencies. |
| CTA — primary (pending, disabled chip) | Awaiting agency response |
| CTA — primary (approved) | Switch to {Agency Name} workspace |
| CTA — primary (rejected) | Browse other agencies |
| CTA — primary (expired) | Re-apply to {Agency Name} |
| CTA — primary (withdrawn) | Re-apply to {Agency Name} |
| CTA — secondary (pending) | View agency profile |
| CTA — secondary (approved) | View agency profile |
| CTA — secondary (rejected) | Continue as solo agent |
| CTA — secondary (expired) | Browse other agencies |
| CTA — secondary (withdrawn) | Browse other agencies |
| CTA — tertiary (pending) | Withdraw application |
| CTA — tertiary (approved) | Decline this offer |
| Withdraw dialog title | Withdraw your application? |
| Withdraw dialog body | You can re-apply to {Agency Name} anytime, but they'll see this as a fresh application. |
| Withdraw dialog confirm | Withdraw |
| Withdraw dialog cancel | Keep application open |
| Decline dialog title | Decline {Agency Name}'s offer? |
| Decline dialog body | You can apply again in future. If you decline now, {Agency Name}'s decision is final for this application. |
| Decline dialog confirm | Decline offer |
| Decline dialog cancel | Not yet |
| Contact support link | Something not right? Contact WingCaster support |
| Post-accept celebratory banner (lands on AGT-DSH-001) | You're now with {Agency Name}. Welcome. |

---

## Sample content (for v0 / mockup)

Show the mobile 375px layout with:
- **State:** APPROVED
- **Status hero band:** Broadcast orange full-bleed background, white `CheckCircle2` 28×28 in a white ring, label "You've been accepted by Elite Real Estate", timestamp "Decided 2 hours ago · 07 Sep 2026, 14:22" in white mono.
- **Agency card:** Elite Real Estate logo placeholder (a 56×56 grey square with initials `ER`), name "Elite Real Estate", city line "Dubai, UAE · Residential & Commercial", chevron on the right.
- **Timeline:** Submitted (complete, 05 Sep, 09:14) → Viewed by agency (complete, 06 Sep, 11:22) → Decided (complete, 07 Sep, 14:22) → Approved (complete, 07 Sep, 14:22).
- **Resolver message card:** avatar with initials `AK`, name "Ahmad Khoury", role chip "Owner", timestamp "Decided 07 Sep 2026, 14:22". Body: "Welcome to Elite, Sara. Your track record in Downtown Dubai is exactly the kind of coverage we've been looking to add. Ping me on WhatsApp when you're switched over and we'll set up your first team meeting for Sunday."
- **APPROVED detail:** "You'll join as **Agent** with the **Standard** capability pack." + "This is an **exclusive** affiliation. Your personal workspace stays, but your listings and leads flow to Elite Real Estate." + tenant note.
- **Sticky bottom CTA bar:** primary full-width orange "Switch to Elite Real Estate workspace", secondary text link above "View agency profile", tertiary text link above secondary "Decline this offer".
- **Contact support link:** centered below the sticky CTA (visible when scrolled to bottom).

Iteration order for v0 after first pass:
1. Same mobile viewport, state = PENDING (calm sunken hero, timeline with current-pulse dot at "Decided", sticky CTA disabled chip "Awaiting agency response" + Withdraw tertiary).
2. Same mobile viewport, state = REJECTED (neutral rejection hero, resolver message from Ahmad politely declining, two paths in CTA).
3. Same mobile viewport, state = EXPIRED (Hourglass glyph muted, re-apply CTA).
4. Desktop 1440px, state = APPROVED, showing sticky right-sidebar CTA + context helper.
5. Desktop 1440px, state = REJECTED.
6. RTL Arabic mirror at mobile 375px, state = APPROVED with `[TRANSLATION-PENDING]` copy.
7. Dark mode desktop, state = APPROVED (hero stays orange but shifts to `#FF7440` dark-mode primary; text swaps).
8. Withdraw confirm dialog open over PENDING state.

Save each output's JSX to `web/src/components/recipient/AgencyOutcomeScreen/` and screenshot to `docs/design/mockups/AGT-REC-004-<state>.png`.

---

## Component palette (shadcn / Radix / lucide-react)

| Element | Primitive |
|---|---|
| Top nav | Custom sticky `<header>` — reuse `SHR-NAV-002` mobile top-bar shell |
| `<StatusHero>` | Custom (anchor pattern — see §Reusable patterns above) |
| Agency identity card | `Card` + custom expand-to-bottom-sheet via `Sheet` |
| `<OutcomeTimeline>` | Custom (anchor pattern) — uses `<ol>` semantics |
| `<ResolverMessage>` | `Card` + custom Markdown-subset renderer (whitelist-based, do NOT use `dangerouslySetInnerHTML` without sanitization — use `react-markdown` with explicit allowlist) |
| Attribution avatar | `Avatar` + `AvatarFallback` |
| Role chip | `Badge` variant="outline" |
| `<PrimaryCtaPerState>` | Custom (anchor pattern) — composes `Button` variants |
| Withdraw / Decline confirm dialog | `AlertDialog` |
| Sticky mobile CTA bar | Custom `<div>` with `position: sticky; bottom: 0` + safe-area padding + `--lc-elevation-md` upward |
| Numeric renders (timestamps, application ID) | `<Numeric>` from `web/src/components/ui/numeric.tsx` |
| Loading state | `Skeleton` shape mirroring hero → agency card → timeline |
| Error state | Full-screen fallback: glyph `AlertOctagon` + retry `Button` |
| Toast (post-accept, post-withdraw, post-decline) | `Sonner` |

---

## Interactions

**On page load:**
- Fetch `GET /api/users/me/agency-applications/:id`. During load, show skeleton mirror.
- If 404: agent hit a bad link OR viewed someone else's application. Show a friendly not-found state: "This application doesn't exist or isn't yours. [Go back to inbox]".
- If 200: render per state.

**On live update (push notification arrives while page is open):**
- Poll for state change every 60s OR subscribe to push (see §Notification hook). If state transitions (pending → approved / rejected / expired), cross-fade status hero at `var(--lc-duration-base)` and refresh the whole page data.

**On tapping agency card chevron:**
- Opens `SHR-PUB-004` (agency public profile) in a `<Sheet>` from the bottom (mobile) or side (desktop). Does not navigate — agent stays on the outcome page.

**On tapping "Switch to {Agency} workspace" (APPROVED primary):**
- POST `/api/users/me/agency-applications/:id/accept` → server issues new JWT with `active_tenant_id = agency_tenant_id` + activates `tenant_memberships` row.
- On success: navigate to `AGT-DSH-001` (agency tenant context) with a one-time celebratory banner (dismissed on scroll or after 8s).
- On failure: destructive toast + Continue button re-enables.

**On tapping "Decline this offer" (APPROVED tertiary):**
- Open `AlertDialog` per copy above.
- On confirm: POST `/api/users/me/agency-applications/:id/decline` → state flips to REJECTED-BY-APPLICANT sub-state (renders as REJECTED with the "You declined" attribution).

**On tapping "Withdraw application" (PENDING tertiary):**
- Open `AlertDialog` per copy above.
- On confirm: POST `/api/users/me/agency-applications/:id/withdraw` → state flips to WITHDRAWN.

**On tapping "Re-apply to {Agency}" (EXPIRED / WITHDRAWN primary):**
- Navigate to `AGN-MEM-005` (public agency application submission) with `agency_slug` pre-filled. Server treats it as a fresh application; the prior expired/withdrawn application stays in agent's history.

**On tapping "Browse other agencies":**
- Navigate to `SHR-PUB-003` agency directory.

**On tapping "Continue as solo agent" (REJECTED secondary):**
- Switch active tenant to personal via `SHR-NAV-008` client hook → route to `AGT-DSH-001` in personal-tenant context. No JWT reissue needed (personal tenant is always in the agent's tenant list).

**On tapping "Contact WingCaster support":**
- Navigate to `SHR-SUP-001` support portal with a pre-filled context ("Application ID: {id}"). Never open `mailto:` — support flow lives in-app.

**Timeline live-updating:**
- The "Viewed by agency" event flips from muted "Not yet viewed" to a completed dot with timestamp the moment the agency-side hits `AGN-MEM-002b` for this application. The dot advances with a `var(--lc-duration-slow)` pulse using `var(--lc-easing-emphasis)`. Respect `prefers-reduced-motion` → cross-fade only.

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Loading** | Initial fetch in flight | Skeleton mirroring hero + agency card + timeline. Bottom CTA area shows disabled skeleton chip. |
| **Not found (404)** | Bad appId OR application belongs to different user | Full-screen fallback: "This application doesn't exist or isn't yours." + Back to inbox button. |
| **Network error** | Fetch failed / offline | Full-screen fallback: retry button + "Check your connection." |
| **PENDING** | `status = 'pending'` from backend | Sunken hero, live-pulsing "Decided" timeline dot (open ring), disabled CTA chip, Withdraw tertiary. |
| **PENDING — viewed** | `status = 'pending' AND viewed_at IS NOT NULL` | Same as PENDING but the "Viewed by agency" event shows a completed dot + timestamp. |
| **APPROVED** | `status = 'approved'` | Orange hero, all 4 timeline dots complete, resolver message rendered (or empty state), APPROVED detail block, Switch-workspace primary CTA. |
| **REJECTED** | `status = 'rejected'` | Neutral rejection hero, resolver message, encouragement block, Browse-other-agencies primary + Continue-solo secondary. |
| **EXPIRED** | `status = 'expired'` (30 days elapsed) | Hourglass muted hero, "Timed out" 4th timeline event, Re-apply primary + Browse-other secondary. |
| **WITHDRAWN** | `status = 'withdrawn'` (agent withdrew) | Muted hero, "Withdrawn" 4th timeline event, Re-apply primary + Browse-other secondary. |
| **DECLINED-BY-APPLICANT** | `status = 'rejected' AND rejected_by = 'applicant'` (approved offer that agent then declined) | Same visual as REJECTED, but attribution says "You declined on {date}"; primary Browse-other + secondary Continue-solo. |
| **AGENCY-SUSPENDED** | `status = 'pending' AND agency_tenant.suspended_at IS NOT NULL` | Special hero: "Elite Real Estate is temporarily suspended. WingCaster support is reviewing." + Contact support primary CTA. Timeline stays paused. |
| **AGENCY-DELETED** | `status = 'pending' AND agency_tenant.deleted_at IS NOT NULL` | Special hero: "The agency you applied to no longer exists on WingCaster." + Browse-other primary. Timeline shows a `Layers` dot + "Agency removed" line. |
| **Post-accept redirect in flight** | Accept POST in flight | Primary button shows `Loader2` + "Switching workspace…" ; entire screen inert. |
| **Push-update arrived while viewing** | State changed on backend during open session | Hero cross-fades to new state at `var(--lc-duration-base)`. Toast at top confirms "Application updated". |
| **Offline** | Network unreachable | Top-of-page thin banner "You're offline — some actions won't work." + CTAs disabled. |
| **RTL** | Locale = ar | Full mirror per §Layout. |
| **Dark mode** | prefers-color-scheme dark | Broadcast tokens swap automatically. Orange hero shifts to `#FF7440` per Broadcast reference; ink stays white. |

---

## Accessibility

- Every state hero has a semantic `<section aria-labelledby>` with the label as its accessible name. Screen reader hits status first, always.
- Timeline is an `<ol>` with `<li>` per event; current node has `aria-current="step"`.
- Live push updates announce via `aria-live="polite"` region — e.g. "Application status changed to approved."
- Confirm dialogs (Withdraw, Decline) use `AlertDialog` — focus trap, Escape closes, focus returns to invoker on close.
- Sticky mobile CTA bar has enough backdrop contrast (`--lc-surface-raised` + top-border) that it never blends with the hero band above when the hero is orange.
- Primary CTA in disabled-chip form (PENDING) is `aria-disabled="true"` and has descriptive text — no ambiguous grey button.
- Motion: `prefers-reduced-motion` skips hero cross-fade AND timeline dot pulse AND emphasis-easing. Uses instant swap instead.
- Every tap target ≥ 44×44 CSS px including tertiary text links (add padding-Y to the ghost variant).
- Resolver message body renders untrusted user content via a whitelist Markdown renderer — never `dangerouslySetInnerHTML` without sanitization. Links carry `rel="noopener noreferrer"` and `target="_blank"` with visible "opens in new tab" affordance.
- Focus rings visible on every interactive element — two-tone Broadcast focus ring, do not override.
- No color-only state differentiation — every state uses glyph + label + surface tint together.

---

## Anti-patterns (do not do these)

- ❌ Do not use `variant="destructive"` red on any button on this screen. Withdrawal / Decline are ghost. Rejection surface is neutral, not red.
- ❌ Do not use "Rejected" as the label — use "{Agency Name} decided not to proceed at this time." Rejection is a decision, not a verdict on the person.
- ❌ Do not hide the resolver message card when the message is empty — render the empty state consistently so the visual weight stays constant across resolved variants.
- ❌ Do not render dates in the UI font. Every timestamp goes through `<Numeric>`.
- ❌ Do not put two primary CTAs on the same state. Exactly one primary per state, always. If a state seems to need two, one of them is a secondary.
- ❌ Do not use the signal-lamp pulse motif anywhere except the current-step timeline dot. Broadcast reference reserves the pulse for the "listing went live" moment and (here) the "waiting for decision" moment — nowhere else.
- ❌ Do not open `mailto:` for support. Route to `SHR-SUP-001` in-app.
- ❌ Do not auto-redirect on state change. If the agent is looking at this page and it flips to APPROVED, cross-fade and let them tap Switch. Never yank them out of context.
- ❌ Do not fabricate SLA numbers. The "Typical review: 3 days" line reads from a real backend-configured `agency_settings.review_sla_days` field (fallback to a documented platform default of 3 days).
- ❌ Do not display the raw application ID in the main body — put it in the sidebar small-print block for support-ticket reference only. It's not meaningful to the agent.
- ❌ Do not repeat the agency logo three times on the page. Once in the identity card, and once tiny in the resolver message attribution row — that's it.
- ❌ Do not use `<img>` for the agency logo without a proper fallback (initials in a `--lc-surface-sunken` square with `--lc-text-muted` initials). Logo URLs go stale.

---

## Reference designs

Draw structural cues from — do NOT copy 1:1:
- **Stripe application-review outcome emails** — respectful, non-verdictive rejection framing.
- **LinkedIn "we hope to see you again" post-rejection copy pattern** — the tone for our REJECTED state.
- **Notion invitation-accepted screen** — the celebratory-but-restrained approval moment (we go louder than Notion with the orange hero band).
- **Github organization invitation page** — the timeline-of-events pattern is closest to our `<OutcomeTimeline>`.
- **Airbnb reservation-status page** — the state-machine-driven single-screen showing all lifecycle states in the same layout.

Do NOT match:
- Zendesk ticket-update pages (too utilitarian; no emotional register).
- Slack invitation-accepted flow (too playful for a B2B commercial context).
- LinkedIn Recruiter application-rejection copy (too corporate-euphemism; we say "decided not to proceed at this time" once, cleanly, then move on).

---

## Backend contract

**Endpoint:** `GET /api/users/me/agency-applications/:id`

**Response 200:**
```json
{
  "application": {
    "id": "app_01H8XZ...",
    "status": "pending" | "approved" | "rejected" | "expired" | "withdrawn",
    "rejected_by": null | "agency" | "applicant",
    "submitted_at": "2026-09-05T09:14:22Z",
    "viewed_at": "2026-09-06T11:22:00Z" | null,
    "decided_at": "2026-09-07T14:22:15Z" | null,
    "resolved_at": "2026-09-07T14:22:15Z" | null,
    "expires_at": "2026-10-05T09:14:22Z",
    "sla_days": 3
  },
  "agency": {
    "tenant_id": "ten_01H8...",
    "slug": "elite-real-estate",
    "display_name": "Elite Real Estate",
    "logo_url": "https://cdn.wingcaster.app/agencies/elite.png" | null,
    "primary_market_label": "Dubai, UAE · Residential & Commercial",
    "suspended_at": null,
    "deleted_at": null,
    "public_profile_url": "/agencies/elite-real-estate"
  },
  "decision": {
    "resolver": {
      "user_id": "usr_01H8...",
      "display_name": "Ahmad Khoury",
      "role_label": "Owner",
      "avatar_url": "https://cdn.wingcaster.app/users/ahmad.jpg" | null
    } | null,
    "message": "Welcome to Elite..." | null,
    "role_offered": "agent" | null,
    "capability_pack": "standard" | "senior" | "custom" | null,
    "affiliation_mode": "exclusive" | "non_exclusive" | null
  }
}
```

Scoped strictly to the caller's user_id via server-side check — an application belonging to another user returns **404** (not 403 — do not leak existence).

**Action endpoints (all POST, all scoped to caller's user_id):**
- `POST /api/users/me/agency-applications/:id/accept` — flips status to `approved` acceptance-confirmed, reissues JWT with new active_tenant_id, activates tenant_memberships row.
- `POST /api/users/me/agency-applications/:id/decline` — only valid when status = `approved`; flips to `rejected` with `rejected_by = 'applicant'`.
- `POST /api/users/me/agency-applications/:id/withdraw` — only valid when status = `pending`; flips to `withdrawn`.

**30-day auto-expire:** background cron OR write-time check (either acceptable) flips `pending` applications to `expired` after `submitted_at + 30 days`. If cron: run every 6h. Emit `agency_application.expired` push notification on transition.

**Backend prerequisite surfaced (NOT already tracked):** the `expires_at` field + the 30-day auto-expire behavior. `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` §5a currently tracks WF-02 cluster completion but does not call out the expire-cron. File as `[BE-BLOCKER-06] agency_applications.expires_at + auto-expire cron` — Week 1 dependency. Migration: add `expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days')` to `agency_applications`; add cron job or write-time check that flips to `expired` and emits the notification.

---

## Notification hook

**Trigger:** application status changes to `approved`, `rejected`, or `expired` (system-triggered for expire; user-triggered on the agency side for approved/rejected).

**Piggybacks on existing push infrastructure** — WingCaster already has a `notifications` table and a push-dispatch service established in WF-01 (WhatsApp AI-draft approval) and WF-03 (portal submission outcome). No new dispatch machinery needed.

**Requires ONE new push-notification template row** (not a new infrastructure):
- Template key: `agency_application.resolved`
- Variants by `application.status`: `approved` / `rejected` / `expired`
- Title / body per variant (short-form for push, longer-form for in-app):
  - APPROVED: "{Agency Name} accepted your application" / "Welcome. Tap to switch to your new workspace."
  - REJECTED: "{Agency Name} responded to your application" / "Your application was reviewed. Tap to see the outcome."
  - EXPIRED: "Your application to {Agency Name} timed out" / "No response after 30 days. Tap to re-apply or browse other agencies."
- Deep-link: `wingcaster://agency-application/:id` → maps to `/agency/applications/:id/status`
- Emit at status transition (in the same transaction that flips the status column).

**Answer to caller's question:** the notification hook piggybacks on existing push infrastructure — no new dispatcher, no new subscription plumbing. It requires ONE new template row (`agency_application.resolved`) with three variants (approved / rejected / expired). File under Week 1 cluster work.

---

## Downstream implementation (Cursor prompt handoff notes)

- **File to create:** `web/src/pages/AgencyApplicationOutcomePage.tsx`.
- **Route:** add to `web/src/App.tsx` — `<Route path="/agency/applications/:appId/status" element={<AgencyApplicationOutcomePage />} />` and alias `/inbox/applications/:applicationId` to the same component (with the `:applicationId` param mapping to `:appId`).
- **Component decomposition (anchor pattern, lifted verbatim by REC-002/003/005/006):**
  - `web/src/components/recipient/StatusHero.tsx` — anchor.
  - `web/src/components/recipient/OutcomeTimeline.tsx` — anchor.
  - `web/src/components/recipient/ResolverMessage.tsx` — anchor.
  - `web/src/components/recipient/PrimaryCtaPerState.tsx` — anchor.
  - `web/src/components/recipient/AgencyOutcomeScreen/` — REC-004-specific composition wrapping the four anchors.
- **Data hook:** `web/src/hooks/useAgencyApplicationOutcome.ts` — fetches + polls every 60s + revalidates on window focus. Uses React Query.
- **Test discipline:**
  - Unit: each of the 4 anchor components renders all its state variants + accessibility structure.
  - Integration: full screen renders correctly across all 8 state variants (pending, pending-viewed, approved, rejected, expired, withdrawn, declined-by-applicant, agency-suspended). Parameterize.
  - Accept flow: POST → JWT reissue → navigate → celebratory banner shows once and dismisses.
  - Withdraw flow: dialog appears → confirm → status flips → hero cross-fades.
  - Real-Postgres: at least one end-to-end scenario (agent submits application via `AGN-MEM-005` → agency reviews via `AGN-MEM-002b` → agent lands on this page and sees APPROVED).
  - RTL: verified via `screens.rtl.test.tsx` extension.
- **Broadcast tokens:** `no-raw-hex.test.ts` must stay green.
- **Guard:** an assertion test that verifies the `<StatusHero>` component ONLY uses `var(--lc-action-primary)` as its background when `state === 'approved' && emphasis === 'loud'` — enforces the anchor discipline for REC-002/003/005/006.

---

## Broadcast alignment callouts

Every callout below is a Broadcast-token-specific instruction that the design AI or downstream Cursor implementation MUST honor. Non-negotiable.

- Status hero surfaces per state exactly as mapped in §Reusable REC-family patterns table. Never invent a state color.
- Approval hero (the ONE loud case) uses `var(--lc-action-primary)` full-bleed. Text `var(--lc-action-primary-text)`. Glyph inside a white circle chip so the icon reads at glance.
- Rejection surface never uses `var(--lc-status-danger)` alone as a background. Rejection is a decision, not an error.
- Timeline dot completed color `var(--lc-accent-bold)` ALWAYS with `var(--lc-accent-bold-edge)` 1px outline — accent bold needs a boundary per Broadcast reference.
- Timeline current-node pulse at `var(--lc-duration-slow)` with `var(--lc-easing-emphasis)` — the ONE legal use of the signal-lamp motif on this screen.
- Resolver message card `var(--lc-radius-lg)` (7px). No 12+px rounding anywhere.
- Elevations offset, not blurred — `var(--lc-elevation-sm)` for resolver card and agency card. Never a soft blur shadow.
- CTA primary fill `var(--lc-action-primary)`; hover DARKER to `var(--lc-action-primary-hover)`. Never lighten.
- Destructive-adjacent actions (Withdraw, Decline) use `variant="ghost"` with `var(--lc-text-muted)` label. Never `variant="destructive"` red on any REC screen.
- Timestamps + application ID via `<Numeric>` — mono + tabular-nums.
- Focus rings two-tone via base CSS. Do not override.
- Motion: hero cross-fade `var(--lc-duration-base)`; timeline pulse `var(--lc-duration-slow)`. Respect `prefers-reduced-motion`.
- Radii: cards `var(--lc-radius-lg)`; buttons `var(--lc-radius-md)`; role chip `var(--lc-radius-pill)`.
- Sticky mobile CTA bar `var(--lc-surface-raised)` + top-border `var(--lc-border)` + upward `var(--lc-elevation-md)` shadow. Safe-area padding for iOS home indicator.

---

## Handoff instruction to v0

Paste this brief in full into a fresh v0.app chat. Framing prompt (paste before this brief):

```
I'm designing the WingCaster "Agency application outcome" screen (AGT-REC-004) — MENA real-estate B2B SaaS. It's the mobile-first screen where an agent sees whether an agency accepted, rejected, or is still reviewing their application to join. Five states: PENDING, APPROVED, REJECTED, EXPIRED, WITHDRAWN. Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind.

This screen is the ANCHOR for the AGT-REC recipient-outcome screen family — four reusable components defined here (StatusHero, OutcomeTimeline, ResolverMessage, PrimaryCtaPerState) will be lifted verbatim by REC-002/003/005/006 later. Design them as reusable primitives, not one-off compositions.

First pass: render the MOBILE 375px layout for state=APPROVED. Full-bleed Broadcast-orange status hero band at top with CheckCircle2 glyph and "You've been accepted by Elite Real Estate" heading. Agency identity card below. Vertical timeline with 4 completed events. Resolver message card from "Ahmad Khoury, Owner" with a warm welcome message. APPROVED detail block (role + affiliation mode + tenant note). Sticky bottom CTA bar with primary "Switch to Elite Real Estate workspace" + secondary "View agency profile" + tertiary "Decline this offer". Contact support link at bottom.

LTR English only for this pass — I'll ask for RTL Arabic, other states, desktop, and dark mode as separate follow-ups.

Follow the copy table in the brief exactly. Do not fabricate agency messages beyond the sample content section.

DESIGN BRIEF FOLLOWS:
```

Iteration order after first pass:
1. `Same mobile viewport, state = PENDING. Calm sunken hero, "Awaiting Elite Real Estate's response". Timeline: Submitted complete, Viewed complete, Decided open-ring current node with pulse, Approved pending. SLA line "Typical review: 3 days · Application expires 07 Oct 2026". Sticky CTA: disabled chip "Awaiting agency response" + tertiary "Withdraw application".`
2. `Same mobile viewport, state = REJECTED. Neutral rejection hero with XCircle in muted-closed tone. Resolver message card from Ahmad politely declining. Encouragement copy. Sticky CTA: primary "Browse other agencies" + secondary "Continue as solo agent".`
3. `Same mobile viewport, state = EXPIRED. Hourglass muted hero. "This application timed out." detail. Sticky CTA: primary "Re-apply to Elite Real Estate" + secondary "Browse other agencies".`
4. `Desktop 1440px, state = APPROVED. Two-column layout with sticky right-sidebar CTA + context helper card. Status hero full-width above the split.`
5. `Desktop 1440px, state = REJECTED.`
6. `RTL Arabic mirror at mobile 375px, state = APPROVED. Use [TRANSLATION-PENDING] where copy has no Arabic yet, but MIRROR the whole layout including timeline rail to the right side.`
7. `Dark mode desktop, state = APPROVED (hero orange shifts to #FF7440 per Broadcast dark-mode primary).`
8. `Withdraw confirm dialog open over PENDING mobile state.`

Save each output's JSX to `web/src/components/recipient/AgencyOutcomeScreen/` + screenshot to `docs/design/mockups/AGT-REC-004-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 has produced all 8 iteration states (mobile APPROVED, PENDING, REJECTED, EXPIRED; desktop APPROVED, REJECTED; RTL mobile APPROVED; dark desktop APPROVED; withdraw dialog).
- [ ] Screenshots committed under `docs/design/mockups/`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/`.
- [ ] Cursor Week-1 dispatch prompt references this brief + the mockup paths + the four reusable anchor components.
- [ ] `[BE-BLOCKER-06]` (agency_applications.expires_at + auto-expire cron) filed in kickoff §5a.
- [ ] Push template `agency_application.resolved` filed as a Week-1 backend task (piggybacks on existing dispatch — see §Notification hook).
- [ ] REC-002/003/005/006 briefs written subsequently reference this brief's §Reusable REC-family patterns section by name and only spell out per-screen deltas.
