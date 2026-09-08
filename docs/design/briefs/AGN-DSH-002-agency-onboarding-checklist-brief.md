# Screen Brief — AGN-DSH-002 · Agency onboarding checklist (paid-conversion driver)

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

Companion to `SCREEN_MATRIX_AGENCY.md` §1 entry `AGN-DSH-002`. Wave 7 per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` §5 row 36 + §6 Week 7. **Ships as its own PR** (not bundled with AGN-ROL-* because it depends on a distinct backend blocker — `agency_onboarding_state` — separate from the AGT-ONB family's `agent_onboarding_state` from [BE-BLOCKER-20]).

**Family relationship to AGT-ONB-005:** This is the AGENCY-SIDE sibling of the AGT-ONB-005 agent onboarding checklist. Both share the checklist-card pattern + progress-ring UI + dismissible-forever behavior, but:
- AGT-ONB-005 → agent-persona tasks (WhatsApp intake / first listing / notifications).
- AGN-DSH-002 → agency-owner-persona tasks (agency profile / invite team / billing / portal / listing / roles / 2FA).

The visual affordances match; the state machines and API surfaces are distinct.

Upstream: `SHR-AUT-006` signup success (path=c → agency owner) redirects here. Also renders as an OVERLAY on `AGN-DSH-001` dashboard when `agency_onboarding_state.completed_at IS NULL AND dismissed_at IS NULL`.

---

## Broadcast alignment

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`.** All color / font / spacing / motion / radii references below are governed by that reference.

**Screen-specific Broadcast callouts:**

- **C1 · Hero greeting** ("Welcome to WingCaster, {agencyName}"): `font: var(--lc-type-display)` — Archivo 800, 32/38 desktop. Uses the AGENCY NAME (not the owner's first name — this screen belongs to the agency, not to Sara personally). Fallback if agency name missing at first-load race condition: "Welcome to WingCaster". Color `--lc-text-heading`.
- **C2 · Hero sub** ("Let's set your agency up for the whole team — 7 steps, most under 2 minutes each."): `var(--lc-type-body-lg)` + `--lc-text-secondary`. Time-to-value honest — not a marketing promise.
- **C3 · Progress ring.** Top-right corner of the hero band, 96×96px SVG ring. Track `--lc-border-strong`; filled arc `--lc-action-primary` (broadcast orange). Center text: `<Numeric>{completedCount}</Numeric> / <Numeric>{totalCount}</Numeric>` in `var(--lc-type-data)` (IBM Plex Mono 500, tabular-nums). Below the ring: caption `var(--lc-type-caption)` + `--lc-text-muted` reading "complete".
- **C4 · Task-card grid.** Seven cards laid out as a 2×4 grid on desktop (last row has 3 + 1 empty slot filled by a soft-tinted "You're on your way" placeholder) OR as a single column on mobile. Card surface `--lc-surface-raised` + `--lc-elevation-sm`. Radius `--lc-radius-lg`. Selected/focused `2px solid var(--lc-focus-ring)` two-tone via base CSS.
- **C5 · Task-card anatomy.** Each card contains, top-to-bottom:
  - **Status glyph well** (40×40): `Circle` (todo, `--lc-border-strong`) / `CircleDashed` (in-progress, `--lc-status-underOffer-dot`) / `CircleCheck` (done, `--lc-status-published-fg` filled). Never color-only — glyph shape carries the status semantically.
  - **Task title** (`var(--lc-type-heading-3)`).
  - **One-line description** (`var(--lc-type-body-sm)` + `--lc-text-secondary`).
  - **Time-to-value line** (`var(--lc-type-caption)` + `--lc-text-muted`): "~2 min" / "~5 min" etc.
  - **CTA button** (bottom-right): "Start →" (todo) / "Continue →" (in-progress) / "Review" (done, ghost variant).
- **C6 · Completed task styling.** Completed cards get a `--lc-surface-sunken` background wash + strikethrough on the title + the CTA becomes "Review" ghost variant. Never hide completed cards — visibility of progress motivates.
- **C7 · Section overline** ("Set up your agency workspace"): `var(--lc-type-overline)` + `--lc-text-muted`. Placed above the card grid.
- **C8 · Dismiss-forever affordance.** Bottom-right of the checklist, `<Button variant="link">` reading "Dismiss for now". On click, opens a small confirm popover: "Hide this checklist? You can bring it back from your dashboard's Setup menu for 7 days, after which it hides permanently." Two buttons: [Keep it] [Dismiss for 7 days]. On dismiss, PATCH state + hide the checklist + toast with an Undo link (7-day window).
- **C9 · Undo toast.** After dismiss, a `<Sonner>` toast at bottom-center: "Onboarding checklist hidden. Undo (7 days) →". The Undo link stays valid for 7 days via the backend's `dismissed_at` timestamp — clicking anywhere in the toast within that window restores.
- **C10 · Financial-task badge.** The "Set up billing" task card shows a small `--lc-text-brand` + `Coins` glyph badge "Financial setup" in the top-right. Reinforces the two-person-rule convention (though for the OWNER themselves on first signup, no second owner exists yet, so billing setup is single-owner — the badge is informational, not gating).
- **C11 · Motion.** Task-card status flip on completion `var(--lc-duration-emphasis)` (320ms) `var(--lc-easing-emphasis)` — this is one of the RARE places the emphasis easing is legal (checklist-item-completion is a celebration moment). Progress-ring arc animation `var(--lc-duration-slow)` (240ms) `var(--lc-easing-out)`. Reduced-motion → instant.
- **C12 · Focus ring** base-CSS two-tone, never overridden.
- **C13 · Layout container.** On desktop, the checklist renders inside a `max-width: 960px` centered container. On mobile, edge-to-edge with `--lc-space-md` gutters.
- **C14 · Overlay-on-dashboard variant.** When rendered as an overlay on AGN-DSH-001 (not the full-screen `/agency/onboarding` route), the checklist appears as a `<Sheet side="right">` at 480px width — same task cards, same progress ring, but the hero band is compact (single line "Setup — {N}/7 complete") and the dismiss link at the bottom.

---

## Meta

| | |
|---|---|
| Screen ID | AGN-DSH-002 |
| Screen name | Agency onboarding checklist |
| Persona | Agency owner (first-run, primary) + agency admin with `settings.access.read` (ongoing reference; sees the checklist but "Set up billing" and "Enable 2FA for owner" tasks are read-only for admins) |
| Device targets | Desktop 1440px (primary), tablet 1024px, mobile 375px |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark |
| Route | `/agency/onboarding` (full-screen) — also embedded as overlay on `/agency` dashboard (AGN-DSH-001) when incomplete + not dismissed |
| Current state | MISSING. |
| Workflow role | Agency-side sibling of WF-01 (Onboarding) — separate state machine. Not a workflow initiator; it's a hub that deep-links into 7 initiators (agency-profile / invite-member / billing-portal / channel-connect / listing-create / roles-overview / mfa-enroll). |
| Backend prerequisites | ⏳ `agency_onboarding_state` table + `GET/PATCH /api/agency/onboarding-state` endpoints (NEW — separate from `agent_onboarding_state` in [BE-BLOCKER-20]; see §Backend contract) · ✅ deep-link targets all exist as separate briefs (AGN-SET-002 for profile, AGN-MEM-003 for invite, SHR-SET-003 for billing, AGT-CHN-001 for portal, AGT-LST-004 for listing, AGN-ROL-001 for roles, SHR-MFA-001 for 2FA) |
| Family role | Sibling to AGT-ONB-005 (agent-side checklist); shares affordances not state |
| PR bundle | Ships as its own PR (Week 7) — not bundled with AGN-ROL-* because the backend blocker is distinct |

---

## Purpose

The agency owner has just registered. Their agency workspace exists but is empty — no branding, no team, no billing, no portals, no listings, no roles configured, no 2FA. Without guidance, first-run agency owners bounce or leave a half-set-up tenant that never converts to paid.

This screen is the ACTIVATION driver. Paid conversion depends on the owner completing enough of the checklist to see the product's value across all four surfaces (branding + team + billing + inventory). Rev-6 slate marked this **P0 audit-#3** for exactly this reason.

Seven tasks, in priority order (most-load-bearing first):

1. **Complete agency profile** — logo, description, address, business license upload. → `/agency/settings/branding` (AGN-SET-002). ~5 min.
2. **Invite team members** — 1+ agent invites sent. → `/agency/members?action=invite` (AGN-MEM-003 modal). ~2 min.
3. **Set up billing** — Paddle customer portal deep-link to add a payment method. → `/settings/billing` (SHR-SET-003 → Paddle portal via `paddle-customer-portal` skill). ~3 min.
4. **Connect first portal** — Bayut / Property Finder / Dubizzle / OLX / Aqar credentials. → `/agency/channels/new` (AGT-CHN-001 in agency context). ~5 min per portal.
5. **Publish first listing** — get one listing live. → `/listings/new` (AGT-LST-004 in agency context). Varies.
6. **Set custom roles** — configure the Custom capability pack. → `/agency/settings/roles` (AGN-ROL-001). ~5 min.
7. **Enable 2FA for owner** — TOTP / SMS second factor for the owner account. → `/settings/security/2fa` (SHR-MFA-001). ~3 min.

Success outcome: `agency_onboarding_state.checklist` records completions as each task finishes (auto-detected via existing signals — e.g. `agency.logo_url IS NOT NULL` marks task 1 done). Progress ring updates. When all 7 done, `completed_at` timestamp set + confetti celebration on the last completion + checklist auto-hides from the dashboard overlay.

Dismissible: user can hide the checklist for 7 days (with undo). After 7 days without engagement, permanent dismiss. Never blocks — always dismissible.

---

## Design goals

1. **Progress visibility drives completion.** The progress ring (C3) is the emotional anchor — a 2/7 today becomes a 3/7 after one task. Small wins compound.
2. **Each task is one obvious next-click.** No sub-steps, no accordion, no drill-down within a card. Card → deep-link → target screen → return to checklist (with the task auto-completed if the target completes).
3. **Completed tasks stay visible.** Strikethrough + sunken wash + Review button. Hiding done tasks would feel like starting over.
4. **Dismiss is a first-class citizen.** Owners who already know WingCaster (returning founders spinning up a second agency) can dismiss without judgment. The 7-day undo prevents "I dismissed by accident" regret.
5. **Financial tasks marked but not gated.** Owner on first-run has only themselves — two-person rule is informational for now (C10 badge). Real gating kicks in once a second owner exists.
6. **Full-screen at first render, overlay thereafter.** First render (post-signup redirect) is full-screen at `/agency/onboarding` — no distractions. On subsequent dashboard visits with incomplete state, the checklist renders as a right-side sheet so the owner can also see their dashboard.
7. **RTL Arabic mirrors 1:1.** Progress ring stays LTR (numeric). Task cards mirror. Confetti (on completion) mirrors direction of particles.

---

## Layout

### Desktop / tablet ≥1024px — full-screen route

- Top bar: WingCaster wordmark (left) + `<ColorModeToggle>` + language selector (right).
- Hero band (spans `max-width: 960px` centered): C1 greeting + C2 sub on the left; C3 progress ring on the right.
- Section overline (C7): "Set up your agency workspace".
- Card grid (C4): 2×4 grid, 7 task cards + 1 placeholder in position 8 (soft-tinted "You're on your way" with a celebratory icon; when checklist is 100% complete, the placeholder becomes a `Sparkles`-badged "All set! 🎉 — take me to my dashboard →" card).
- Below the grid, right-aligned: C8 dismiss-forever link.
- Bottom of viewport: `<TrustFooter>` compact — "Payments processed by Paddle · Your details are encrypted" (reused from SHR-AUT-006).

### Desktop overlay-on-dashboard variant

Rendered as `<Sheet side="right" width={480}>` over AGN-DSH-001:
- Compact hero: "Setup — {N}/7 complete" single line + small progress ring 48×48.
- 7 task cards stacked vertically inside the sheet.
- Dismiss-forever link at bottom of sheet.
- Sheet has a close-X (top-right) — closing without dismissing means "hide for this visit; show again next dashboard load". Dismissing means the 7-day countdown starts.

### Mobile ≤767px — full-screen route

Single column, scroll:
- Top bar: wordmark + color mode + language selector.
- Hero band stacks vertically: C1 (`var(--lc-type-heading-1)`) → C2 → C3 progress ring 64×64 centered.
- Section overline.
- 7 cards stack full-width.
- Dismiss link centered at bottom.

### Mobile overlay-on-dashboard variant

Sheet becomes full-screen bottom drawer (`<Sheet side="bottom">`). Same content as desktop overlay, adjusted for mobile.

### Task-card anatomy (all viewports) — used by C5-C6

Each card, 200px min height on desktop, 140px on mobile:
- Status glyph well (40×40) + task title on the same row.
- Description line below.
- Time-to-value line below that.
- CTA on the bottom-right corner, 44px min.
- Financial badge (C10) top-right for the billing task only.

---

## Explicit copy (English — Arabic mirror pending MENA copywriter pass)

| Slot | Copy |
|---|---|
| Hero greeting (C1) | Welcome to WingCaster, {agencyName} |
| Hero greeting fallback | Welcome to WingCaster |
| Hero sub (C2) | Let's set your agency up for the whole team — 7 steps, most under 2 minutes each. |
| Progress caption | complete |
| Section overline (C7) | Set up your agency workspace |
| Task 1 title | Complete your agency profile |
| Task 1 description | Add your logo, description, address, and business license. Your public agency page uses this. |
| Task 1 time | ~5 min |
| Task 1 CTA (todo) | Start → |
| Task 2 title | Invite team members |
| Task 2 description | Send agents an invite to join your agency. They'll sign up under your workspace. |
| Task 2 time | ~2 min |
| Task 2 CTA (todo) | Invite → |
| Task 3 title | Set up billing |
| Task 3 description | Add a payment method through Paddle. Required to move off the free tier. |
| Task 3 time | ~3 min |
| Task 3 CTA (todo) | Set up billing → |
| Task 3 financial badge (C10) | Financial setup |
| Task 4 title | Connect your first portal |
| Task 4 description | Bayut, Property Finder, Dubizzle, OLX, Aqar — connect a portal to publish there. |
| Task 4 time | ~5 min |
| Task 4 CTA (todo) | Connect → |
| Task 5 title | Publish your first listing |
| Task 5 description | Get one property live. You'll see the full publishing flow — portals, Bazaar, social. |
| Task 5 time | Varies |
| Task 5 CTA (todo) | New listing → |
| Task 6 title | Set custom roles |
| Task 6 description | Configure the Custom capability pack for your team's specific needs. |
| Task 6 time | ~5 min |
| Task 6 CTA (todo) | Configure → |
| Task 7 title | Enable 2FA for your owner account |
| Task 7 description | Protect your agency with two-factor authentication. TOTP or SMS. |
| Task 7 time | ~3 min |
| Task 7 CTA (todo) | Enable 2FA → |
| CTA (in progress, all tasks) | Continue → |
| CTA (done, all tasks) | Review |
| Placeholder card (< 100%) | You're on your way — {N} of 7 done. |
| Placeholder card (100%) | All set. Take me to my dashboard → |
| Dismiss link (C8) | Dismiss for now |
| Dismiss confirm popover title | Hide this checklist? |
| Dismiss confirm popover body | You can bring it back from your dashboard's Setup menu for 7 days, after which it hides permanently. |
| Dismiss confirm CTA — keep | Keep it |
| Dismiss confirm CTA — dismiss | Dismiss for 7 days |
| Undo toast (C9) | Onboarding checklist hidden. Undo (7 days) → |
| Overlay compact hero | Setup — {N}/7 complete |
| Overlay close-X aria | Close checklist for this visit |
| Trust footer | Payments processed by Paddle · Your details are encrypted |
| Completion celebration (C11) | Your agency is set up. Welcome to the network. |
| Error toast — read state | We couldn't load your setup progress. Try again? |
| Error toast — write state | We couldn't save your progress. Try again? |
| Offline banner | You're offline. Your progress is saved locally and will sync when you reconnect. |
| Admin-persona read-only helper (Tasks 3 + 7) | Owner-only setup — ask your agency owner to complete this. |

**Voice rules:**
- Second person, warm, no exclamations except celebration (C11 + placeholder 100% card).
- Time promises must be honest — "~" prefixes signal approximation.
- Never fabricate — no "Trusted by X agencies" here (that's the marketing home).
- Financial vocabulary — "Financial setup" (proper noun for this class of task).

---

## Component palette (shadcn / Radix / lucide-react)

| Element | Primitive |
|---|---|
| Hero greeting | Plain `<h1>` |
| Hero sub | Plain `<p>` |
| Progress ring (C3) | Custom `<ProgressRing size={96} value={n} max={7}>` — SVG-based |
| Section overline | Plain `<p>` with `var(--lc-type-overline)` |
| Task card | `<Card>` |
| Status glyph well | Plain `<div>` with tinted background + lucide `Circle` / `CircleDashed` / `CircleCheck` glyph |
| Financial badge (C10) | `<Badge variant="outline">` with `--lc-text-brand` ink + `Coins` glyph |
| Task CTA | `<Button variant="default" \| "outline" \| "ghost">` per state |
| Placeholder card | `<Card>` with `--lc-surface-sunken` + `Sparkles` icon |
| Dismiss link (C8) | `<Button variant="link">` |
| Dismiss confirm | `<Popover>` |
| Undo toast (C9) | `<Sonner>` with action button |
| Overlay sheet | `<Sheet side="right">` on desktop, `<Sheet side="bottom">` on mobile |
| Language selector | Embedded `SHR-NAV-006` |
| Color mode toggle | `<ColorModeToggle>` |
| Trust footer | `<TrustFooter>` (reused from SHR-AUT-006) |
| Completion confetti | `canvas-confetti` (lightweight; no external CDN required — bundled npm dep) — fires once on 7/7 transition; respects `prefers-reduced-motion` |
| Offline banner | `<OfflineBanner>` (reused from AGT-ONB family) |
| Loading skeleton | Custom `<TaskCardSkeleton>` |

Icons — `lucide-react`: `Circle`, `CircleDashed`, `CircleCheck`, `Coins`, `Sparkles`, `X`, `ArrowRight`, `Building2`, `Users`, `CreditCard`, `Link2`, `Home`, `KeyRound`, `Shield`.

Per-task icons for the status well when task is DONE (in addition to CircleCheck):
- Task 1 → `Building2` overlay
- Task 2 → `Users`
- Task 3 → `CreditCard`
- Task 4 → `Link2`
- Task 5 → `Home`
- Task 6 → `KeyRound`
- Task 7 → `Shield`

(These are informational; the CircleCheck is the primary status glyph — the domain icon is a small overlay for extra scanability.)

---

## Sample content (for v0 / mockup)

First pass — desktop 1440px, full-screen route, agency name "Elite Real Estate", 2/7 complete (Tasks 1 + 3 done):
- Hero greeting: "Welcome to WingCaster, Elite Real Estate"
- Hero sub: as per copy table
- Progress ring: 2/7, orange arc filling ~28.5%
- Section overline visible
- 7 task cards + 1 placeholder in 2×4 grid:
  - Task 1 (Complete profile) — DONE — sunken wash + strikethrough + Review ghost CTA
  - Task 2 (Invite team) — TODO — Invite → primary CTA
  - Task 3 (Billing) — DONE — sunken wash + Financial badge still visible + Review ghost CTA
  - Task 4 (Connect portal) — TODO — Connect → primary CTA
  - Task 5 (Publish listing) — TODO — New listing → primary CTA
  - Task 6 (Custom roles) — TODO — Configure → primary CTA
  - Task 7 (2FA) — TODO — Enable 2FA → primary CTA
  - Placeholder — "You're on your way — 2 of 7 done." with `Sparkles` icon in soft tint
- Dismiss link visible bottom-right
- Trust footer at bottom
- Language: EN, Light mode

Second pass — 7/7 complete state:
- Progress ring 7/7, full arc
- All 7 cards show DONE state
- Placeholder card becomes "All set. Take me to my dashboard →" as a primary CTA card
- Confetti still animating (or captured mid-animation)
- Celebration copy visible

Third pass — dashboard overlay variant, 3/7 complete:
- Right-side sheet 480px wide over the AGN-DSH-001 dashboard (dashboard visible behind, dimmed slightly)
- Compact hero: "Setup — 3/7 complete" + 48×48 ring
- 7 task cards stacked vertically inside sheet
- Dismiss link at bottom of sheet
- Close-X at top-right of sheet

Fourth pass — dismiss confirm popover open:
- Overlay variant with popover attached to Dismiss link
- Popover content per copy table
- Two buttons: [Keep it] [Dismiss for 7 days]

---

## Interactions

**On page load (full-screen route):**
- Fetch `GET /api/agency/onboarding-state`. Returns state + auto-derived task completions.
- If `completed_at IS NOT NULL AND dismissed_at IS NULL`, this route still renders (owner wants to see the celebration). Show 7/7 state.
- If `dismissed_at IS NOT NULL AND (now() - dismissed_at) < 7 days`, render but with a top banner "You've dismissed this. Undo →". After 7 days without engagement, `dismissed_at` becomes permanent → this route redirects to `/agency`.
- Otherwise render normal checklist.

**On task-card CTA click:**
- Navigate to the deep-link. Do NOT patch state client-side — task completion is auto-detected server-side on the target action (e.g. logo uploaded → task 1 done; invite sent → task 2 done; Paddle callback confirms payment method → task 3 done).
- On return to the checklist, `GET /api/agency/onboarding-state` refetches (SWR revalidate on focus).
- Freshly-completed task animates with C11 status flip + progress ring arc extends with C11 slow animation.

**On task auto-completion:**
- If all 7 tasks are now done, fire confetti once + toast "Your agency is set up. Welcome to the network."
- Progress ring stays at 7/7.
- 8th card slot flips to the "All set" navigator card.

**On dismiss click:**
- Popover opens. On Dismiss confirm: PATCH `/api/agency/onboarding-state` with `{ dismissed_at: now() }`. Overlay closes (if in overlay mode) or route stays but shows dismissed banner. Toast fires with 7-day Undo.
- On Keep it: popover closes.

**On Undo click (within 7 days):**
- PATCH `/api/agency/onboarding-state` with `{ dismissed_at: null }`. Checklist reappears.

**On overlay close-X click:**
- Sheet closes for this visit only. `dismissed_at` NOT written. Next dashboard load re-opens.

**On placeholder "All set" card click (100% only):**
- Navigate to `/agency` dashboard. Backend automatically transitions `completed_at` if not already set.

**On language toggle / mode toggle:**
- Instant swap. Progress ring re-renders with same values.

**On offline:**
- Show OfflineBanner. CTAs remain enabled (deep-links still work); on target screens, offline handling is the target's responsibility.

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Initial 0/7** | Brand-new agency | All 7 cards TODO; placeholder "You're on your way — 0 of 7 done." |
| **Partial N/7** | Some auto-completions | Mix of TODO and DONE; progress ring arc partial. |
| **All 7/7** | Every task completed | Confetti fires ONCE; celebration copy visible; 8th slot becomes navigator card. |
| **Overlay on dashboard** | AGN-DSH-001 with incomplete state | Right-side sheet 480px (desktop) or bottom-sheet (mobile). |
| **Full-screen route** | Post-signup redirect or direct navigation | Full-screen `/agency/onboarding` layout. |
| **Dismissed (< 7 days)** | User clicked Dismiss for 7 days | Overlay hides; dashboard shows "Setup dismissed. Restore →" in the top menu; full-screen route still renders with a dismissed banner. |
| **Dismissed permanent** | > 7 days since dismiss without engagement | Full-screen route redirects to `/agency`; dashboard does not re-show; user can still find restore in Settings → Access. |
| **Loading** | GET state in flight | Skeleton task cards. |
| **Error — read** | GET 500 | Empty state + Retry. |
| **Error — write** | PATCH 500 | Toast; local optimistic state reverts. |
| **Admin persona (not owner)** | Caller is admin, not owner | Same layout; Tasks 3 (Billing) and 7 (2FA) render read-only with helper "Owner-only setup — ask your agency owner to complete this." No CTA. |
| **Offline** | Network unreachable | OfflineBanner; CTAs still work as deep-links. |
| **RTL Arabic** | Locale = ar | Layout mirrors. Progress ring stays LTR (numeric). Placeholder card mirrors. Confetti particles fall symmetrically. |
| **Dark mode** | prefers-color-scheme dark | Tokens swap. Progress ring track darkens; filled arc stays orange. Confetti palette adjusts to Broadcast tokens. |
| **Reduced motion** | prefers-reduced-motion | Confetti suppressed; ring animation instant; card status flip instant. |

---

## Accessibility

- Progress ring is a `<div role="progressbar" aria-valuenow={n} aria-valuemin={0} aria-valuemax={7} aria-label="Setup progress: {n} of 7 complete">`. Screen readers announce the current progress.
- Each task card is `role="group"` with `aria-labelledby` pointing to the title. The CTA button is inside the group; card itself is NOT `role="link"` (unlike AGN-ROL-001 pack cards) — task cards have interactive descriptions, not a single card-click behavior.
- Status glyph has `aria-label="{Task title}: {todo|in progress|done}"`.
- Completed cards announce "Task N of 7, {title}, done" — the strikethrough is decoration only.
- Focus order: language toggle → color mode → each task card in order (focus lands on the CTA, not the card wrapper) → dismiss link → trust footer link.
- Dismiss confirm popover traps focus; Escape closes without dismissing.
- Confetti is `aria-hidden="true"` + suppressed under reduced-motion.
- Undo toast is `role="status"` + `aria-live="polite"`; the Undo action is keyboard-focusable within the toast.
- Overlay sheet uses Radix `<Sheet>` primitive — Escape + click-outside close for this visit; explicit dismiss requires the confirm popover.
- Every tap target ≥ 44×44.

---

## Anti-patterns (do NOT do)

- Do NOT block the user — the checklist is always dismissible. No modal traps.
- Do NOT auto-launch the checklist as a modal blocking the dashboard on every load. Overlay-sheet mode is opt-out (Close X for this visit; Dismiss for 7 days for real hiding).
- Do NOT patch task completion client-side. Task completion is auto-detected server-side from the actual product event (upload complete, invite sent, Paddle callback, portal handshake success, listing published, roles patched, MFA enrolled). Client-side patching would create ghost-complete tasks if the target action actually failed.
- Do NOT reorder tasks based on completion. Order is stable — completed tasks stay in place with sunken wash, so the owner sees "task 1 done, task 2 still to do" in the ORIGINAL sequence.
- Do NOT hide completed tasks. Visibility of progress motivates.
- Do NOT show the "Set up billing" task as GATED with a "You need a second owner" error — first-run owners don't have a second owner yet. Financial badge is informational only.
- Do NOT skip the 7-day undo — dismiss regret is a real pattern; the undo window is a UX contract.
- Do NOT confetti on every partial completion — only fires ONCE on the 7/7 transition. Overuse of celebration devalues it.
- Do NOT use raw hex or Tailwind palette classes — Broadcast semantic tokens only.
- Do NOT show more than 7 tasks in v1. If future tasks are needed (e.g. "Connect Slack for notifications"), replace or bundle — the 8-slot grid layout depends on the count.
- Do NOT let the placeholder 100% card auto-navigate. The owner must click it — auto-nav would skip the celebration moment.

---

## Reference designs

Draw structural cues from — do NOT copy 1:1:
- **Linear onboarding checklist** — the top-right progress ring + inline task cards pattern.
- **Notion onboarding sidebar** — the overlay-on-workspace variant with a persistent right-sheet.
- **Stripe onboarding "Activate account" checklist** — the mix of "auto-detected done" tasks + user-driven ones is directly analogous.
- **Vercel first-project checklist** — the compact "You're on your way — 2 of 5" placeholder pattern.
- **Airbnb Host setup progress** — the celebration confetti on final completion.

Do NOT match:
- Salesforce "Trailhead" (too gamified; conflicts with WingCaster's honest-tone voice).
- Any onboarding that hides completed tasks (visibility of progress > terseness).

---

## Backend contract

### Read state on load

**Endpoint:** `GET /api/agency/onboarding-state` (NEW — must ship with this brief)

**Response 200:**
```json
{
  "agency_id": "agn_...",
  "checklist": {
    "profile_complete": { "done": true, "completed_at": "2026-09-07T10:00:00Z" },
    "team_invited": { "done": false },
    "billing_set_up": { "done": true, "completed_at": "2026-09-07T10:15:00Z" },
    "first_portal_connected": { "done": false },
    "first_listing_published": { "done": false },
    "custom_roles_set": { "done": false },
    "owner_2fa_enabled": { "done": false }
  },
  "completed_count": 2,
  "total_count": 7,
  "started_at": "2026-09-07T09:55:00Z",
  "completed_at": null,
  "dismissed_at": null,
  "dismissed_permanent_after": null
}
```

**Response 404:** first-time — return the same shape with all `done: false`, `completed_count: 0`. Do NOT force clients to handle 404 as an error.

### Write state on dismiss / undo / completion (rare direct write)

**Endpoint:** `PATCH /api/agency/onboarding-state` (NEW)

**Request body (dismiss):**
```json
{ "dismissed_at": "2026-09-08T12:00:00Z" }
```

**Request body (undo dismiss):**
```json
{ "dismissed_at": null }
```

**Request body (manual mark complete — rare, e.g. checklist task the auto-detector missed):**
```json
{
  "checklist_delta": {
    "custom_roles_set": true
  }
}
```

**Response 200:** the full updated state shape.

**Response 409 `INVALID_TRANSITION`:** attempted to mark a task done that has no supporting evidence (e.g. mark billing done but no Paddle callback recorded). Client silently drops.

**Response 500:** toast; no state change.

### Auto-detection sources

Task completions are auto-computed by joining state from other tables:
- Task 1 (profile) → `agencies.logo_url IS NOT NULL AND agencies.description IS NOT NULL AND agencies.address IS NOT NULL AND agencies.business_license_url IS NOT NULL`.
- Task 2 (team) → `SELECT COUNT(*) > 0 FROM agency_invitations WHERE agency_id = $1 AND revoked_at IS NULL` OR `SELECT COUNT(*) > 1 FROM tenant_memberships WHERE tenant_id = $1 AND status = 'active'`.
- Task 3 (billing) → `SELECT COUNT(*) > 0 FROM paddle_customers WHERE agency_id = $1 AND payment_method_status = 'active'` (schema exists per Paddle integration).
- Task 4 (portal) → `SELECT COUNT(*) > 0 FROM portal_bindings WHERE agency_id = $1 AND status = 'active'`.
- Task 5 (listing) → `SELECT COUNT(*) > 0 FROM listings WHERE agency_id = $1 AND status = 'published'`.
- Task 6 (roles) → `SELECT COUNT(*) > 0 FROM agency_capability_pack_overrides WHERE agency_id = $1 AND pack_id = 'custom' AND jsonb_object_keys(capabilities)@> ANY(...)` (any non-empty custom pack) — depends on AGN-ROL-002's schema shipping first.
- Task 7 (owner 2FA) → `SELECT mfa_enrolled = true FROM users WHERE id = (SELECT user_id FROM tenant_memberships WHERE tenant_id = $1 AND role = 'owner' ORDER BY joined_at LIMIT 1)`.

The GET endpoint computes these on-the-fly with SWR-cache-friendly ETag support. Alternative: store a materialized `agency_onboarding_state` table (below) + trigger-based recompute on the source tables — cheaper for high-frequency reads.

### Schema (new — migration required)

```sql
-- New migration (numbered per branch state)
CREATE TABLE IF NOT EXISTS agency_onboarding_state (
  agency_id            UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  checklist            JSONB NOT NULL DEFAULT '{}'::jsonb,
  completed_count      INT NOT NULL DEFAULT 0 CHECK (completed_count BETWEEN 0 AND 7),
  total_count          INT NOT NULL DEFAULT 7,
  started_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at         TIMESTAMPTZ,
  dismissed_at         TIMESTAMPTZ,
  dismissed_permanent_after TIMESTAMPTZ,  -- set to dismissed_at + INTERVAL '7 days'
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS agency_onboarding_state_dismissed_idx
  ON agency_onboarding_state (dismissed_at)
  WHERE dismissed_at IS NOT NULL;
```

**Deliberately DISTINCT from `agent_onboarding_state`** (the `[BE-BLOCKER-20]` table from the AGT-ONB family). Reasons:
1. Different keys — `agency_onboarding_state.agency_id` vs `agent_onboarding_state.user_id`. Same user might own an agency AND be an agent under a different agency; their two checklists are unrelated.
2. Different checklist shape — agency tasks (branding / invites / billing / portal / listing / roles / 2FA) vs agent tasks (WhatsApp intake / manual wizard / import / first listing / celebration). Overlapping only trivially (2FA is in both).
3. Different auto-detection sources — agency checklist joins `agencies`, `agency_invitations`, `paddle_customers`; agent checklist joins `agent_onboarding_state` step transitions.
4. Different personas — owner-level governance decisions vs. individual-agent activation.

Piggybacking on `agent_onboarding_state` would force a `scope: 'agent' | 'agency'` discriminator + polymorphic checklist JSONB + confusing joins. Keeping them separate is cheap (one migration + two endpoint sets) and correct.

File as `[BE-BLOCKER-30] agency_onboarding_state table + read/write endpoints + auto-detection query`. Estimated 1.5-2 days:
- 0.5 day — migration.
- 0.5 day — endpoint pair (GET + PATCH).
- 0.5 day — auto-detection query (7 sub-joins).
- 0.5 day — daily cron to flip `dismissed_at + 7 days` into `dismissed_permanent_after` state + defensive tests.

**Grep-verified today (2026-09-08):**
- `grep -rn "agent_onboarding_state\|onboarding_state" backend/src` — zero hits for `agent_onboarding_state` (the [BE-BLOCKER-20] table is not yet built; will be built in Week 4). Existing infra is `backend/src/server.js` lines 1005-1216 with an `onboarding_stage` + `onboarding_steps` column on the `agents` table — this is the LEGACY agent-only single-column shape that both AGT-ONB and AGN-DSH-002 supersede.
- No existing `agency_onboarding_state` table. New migration required.
- `agencies` table has `logo_url`, `description`, `address` columns (verified via schema); `business_license_url` column may need a follow-up migration if missing (grep at implementation time — file as extension of [BE-BLOCKER-30] if needed).

---

## Downstream implementation (Cursor prompt handoff notes)

### File creation

- **New route:** `web/src/pages/agency/AgencyOnboardingPage.tsx`.
- **Route registration:** `web/src/App.tsx` — add `/agency/onboarding` guarded by `useAgencyRole('owner' | 'admin')`.
- **Overlay integration:** `web/src/pages/agency/AgencyDashboardPage.tsx` (AGN-DSH-001) — mount `<AgencyOnboardingOverlay />` when state incomplete + not dismissed.
- **Restore link:** `web/src/components/agency/AgencySetupMenu.tsx` — dashboard top-right menu item "Restore setup checklist" appears when dismissed (< 7 days).

### Shared components (new, live in `web/src/components/agency/onboarding/`)

1. **`<AgencyOnboardingChecklist mode="fullscreen" | "overlay" />`** — the whole surface.
2. **`<ProgressRing value max size />`** — the C3 SVG ring. Reusable — likely needed by other agency progress surfaces.
3. **`<TaskCard task state onCta />`** — individual card, C5-C6.
4. **`<DismissConfirmPopover onDismiss onKeep />`** — C8 popover.
5. **`<UndoDismissToast dismissedAt onUndo />`** — C9 toast wrapper.
6. **`<CompletionConfetti fire />`** — canvas-confetti wrapper respecting `prefers-reduced-motion`.
7. **`useAgencyOnboardingState()` hook** — SWR-backed hook exposing `{ state, patch, dismiss, undo, isLoading, isError }`. Similar shape to (but distinct from) `useOnboardingState()` — the agent-side hook from the AGT-ONB family.

### Test discipline

- Unit: ProgressRing renders correct arc percentage; announces via `role="progressbar"`.
- Unit: TaskCard renders 3 status variants (todo / in-progress / done) with correct glyph + CTA copy.
- Unit: DismissConfirmPopover — Escape closes without dismissing; Keep it button dismisses popover only.
- Integration: full-screen route load — assert 7 cards render with correct completions from mocked state.
- Integration: dismiss + undo — assert PATCH called with `dismissed_at`; undo restores.
- Integration: 100% state — assert confetti fires ONCE + placeholder becomes navigator card.
- Integration: admin persona — assert Tasks 3 + 7 render read-only with helper.
- Integration: overlay variant — assert sheet renders; Close-X does NOT patch dismissed_at.
- RTL: layout mirrors; progress ring stays LTR.
- Broadcast: `no-raw-hex.test.ts` stays green.
- a11y: axe-core smoke test on all states + progressbar role verified.

### Behavior contracts

- `useAgencyOnboardingState()` MUST tolerate 404 on first fetch — return zero-progress state.
- Task auto-completion is the SERVER'S job. Client never sets a `done: true` flag except in the rare manual-mark path (Task 6 roles + Task 7 2FA may need manual marking if the auto-detector lags).
- Confetti fires only on the 7/7 transition in a single session — client tracks last-seen `completed_count` to avoid re-fire on refresh with existing 7/7 state.
- Overlay sheet close-X and dismiss are DIFFERENT actions — do not conflate.
- Placeholder card on 100% must be a button, not an auto-nav — user must click to celebrate + navigate.

---

## Broadcast alignment callouts summary

- C1 hero greeting — `--lc-type-display` desktop, `--lc-type-heading-1` mobile.
- C2 hero sub — `--lc-type-body-lg` + `--lc-text-secondary`.
- C3 progress ring — SVG, orange arc on `--lc-border-strong` track, mono numeric center.
- C4 task-card grid — 2×4 desktop, 1-col mobile, `--lc-surface-raised` + `--lc-elevation-sm`, `--lc-radius-lg`.
- C5 task-card anatomy — glyph well + title + description + time + CTA.
- C6 completed styling — `--lc-surface-sunken` wash + strikethrough + ghost CTA.
- C7 section overline — `--lc-type-overline` + `--lc-text-muted`.
- C8 dismiss link — `<Button variant="link">` with confirm popover.
- C9 undo toast — `<Sonner>` with 7-day action.
- C10 financial badge — `--lc-text-brand` + `Coins` glyph.
- C11 motion — 320ms emphasis on status flip (rare legal use); 240ms ring arc.
- C12 focus ring — base-CSS two-tone.
- C13 layout — `max-width: 960px` desktop centered.
- C14 overlay variant — `<Sheet side="right">` 480px desktop, `side="bottom"` mobile.

---

## Handoff instruction to v0

Framing prompt:

```
I'm designing the WingCaster agency onboarding checklist screen
(AGN-DSH-002) — MENA real-estate B2B SaaS. It's the AGENCY-SIDE
sibling of the agent onboarding checklist (AGT-ONB-005). Stack:
React 18 + shadcn/ui + Radix + lucide-react + Tailwind + Broadcast
theme (--lc-* tokens; no raw hex).

First pass: render the desktop 1440px full-screen route at
/agency/onboarding for agency "Elite Real Estate" with 2/7 tasks
complete (Tasks 1 "Complete profile" and 3 "Set up billing" DONE, the
other 5 TODO). Hero band: greeting "Welcome to WingCaster, Elite Real
Estate", sub about "7 steps, most under 2 minutes each", progress ring
top-right showing 2/7 with orange arc. Section overline "Set up your
agency workspace". 7 task cards in 2×4 grid + 1 placeholder card in
the 8th slot reading "You're on your way — 2 of 7 done." Completed
cards have sunken wash + strikethrough title + Review ghost CTA;
Task 3 also shows the "Financial setup" badge. TODO cards show their
respective primary CTAs (Invite → / Connect → / New listing → /
Configure → / Enable 2FA →). Dismiss link bottom-right; trust footer
at bottom.

LTR English light mode only. I'll ask for the 100% completion state,
the overlay-on-dashboard variant, the dismiss confirm popover, mobile,
RTL, and dark mode as follow-ups.

Follow the copy table exactly. Do NOT invent tasks — 7 tasks in the
priority order given.

DESIGN BRIEF FOLLOWS:
```

Iteration order:
1. `Now the 100% completion state — all 7 cards done, placeholder becomes "All set. Take me to my dashboard →" as primary CTA. Confetti in mid-fall.`
2. `Now the overlay-on-dashboard variant — right-side sheet 480px wide over an AGN-DSH-001 dashboard (dashboard visible behind, slightly dimmed). Compact hero "Setup — 3/7 complete" + small 48×48 ring + 7 stacked cards + dismiss link.`
3. `Now the dismiss confirm popover open (from the overlay variant). Popover attached to Dismiss link with "Hide this checklist?" title and two buttons.`
4. `Now mobile 375px full-screen — hero stacks, ring centered, 7 cards full-width single column, dismiss link centered.`
5. `Now RTL Arabic desktop — mirror everything. Progress ring stays LTR.`
6. `Now dark mode versions of desktop and mobile.`
7. `Now the admin-persona variant — Tasks 3 (Billing) and 7 (2FA) render read-only with the "Owner-only setup" helper, no CTA.`

Save to `docs/design/mockups/v0-outputs/AGN-DSH-002/` + screenshots to `docs/design/mockups/AGN-DSH-002-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 has produced all 7 iteration states.
- [ ] Screenshots + JSX committed.
- [ ] Shared components extracted at `web/src/components/agency/onboarding/`.
- [ ] `[BE-BLOCKER-30]` filed in kickoff §5a — `agency_onboarding_state` table + endpoints + auto-detection query + dismiss cron.
- [ ] `useAgencyOnboardingState()` hook implemented.
- [ ] Overlay integrated on AGN-DSH-001 + restore link on the dashboard's Setup menu.
- [ ] `no-raw-hex.test.ts`, `screens.rtl.test.tsx`, a11y smoke tests pass.
- [ ] Cross-referenced in AGT-ONB-005 brief (family sibling) — one line in each brief acknowledging the parallel.
- [ ] Ships as its own PR (Week 7) — NOT bundled with AGN-ROL-*.
