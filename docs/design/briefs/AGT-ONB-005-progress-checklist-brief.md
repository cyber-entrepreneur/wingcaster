# Screen Brief — AGT-ONB-005 · Progress Checklist (persistent dashboard widget)

**Layer-2 Brief — DELTA screen. References anchor AGT-ONB-001.**

Companion to `SCREEN_MATRIX_AGENT.md` §1 entry `AGT-ONB-005`. Ships in the AGT-ONB PR bundle (Week 4). Also touches `AGT-DSH-001` because this is where it lives.

**Architectural decision (settled in this brief — see §Component vs Route):** AGT-ONB-005 is a **first-class dashboard widget**, not a standalone route. It renders inside `AgentDashboardPage.tsx` when `onboarding_state.checklist` has any incomplete item AND `onboarding_state.dismissed_forever !== true`. In Pro mode (`AGT-DSH-002`) it collapses to a compact status pill in the top bar.

Upstream: AGT-DSH-001 auto-renders it when the user has any incomplete checklist item OR has skipped onboarding (`step = 'welcome_skipped'`).
Downstream (tap a step): routes to the step's screen (e.g. Connect channels → `AGT-CHN-001`; Enable notifications → `AGT-SET-003`; Public profile → `AGT-SET-005`; Upgrade to paid → `AGT-SUB-001`).

---

## 🎨 Broadcast alignment

**Inherits Broadcast callouts A1-A12 from `AGT-ONB-001` (anchor).** This delta adds:

- **E1 · Checklist card shell.** `<Card>` on `--lc-surface-raised` + `--lc-elevation-sm`. Radius `--lc-radius-lg`. Sits in the AGT-DSH-001 Zone-3 slot (empty-state) OR immediately BELOW the urgent-card in Zone 3 when there IS an urgent item. Never above the urgent card — urgent > checklist.
- **E2 · Progress ring header.** Left side of the card header: a 44×44 circular progress ring rendered as inline SVG. Ring track `--lc-surface-sunken`; ring fill `--lc-action-primary`. Center text = `{completedCount}/{totalCount}` in `--lc-type-data-sm` mono + tabular-nums. On 100% complete, the ring fill switches to `--lc-status-published-fg` and the center swaps to a check ✓ glyph.
- **E3 · Header title + collapse control.** Right of the ring: title `Finish setting up` in `--lc-type-heading-3` + `--lc-text-heading`. Below: sub `You're {pct}% there — {remainingCount} steps left.` in `--lc-type-body-sm` + `--lc-text-muted`. Right-most: `<Button variant="ghost" size="icon">` with `ChevronUp` / `ChevronDown` toggling the expand state. Card starts expanded on first ever render; collapse state persists via `sessionStorage` (per-session collapse — always re-expands next login until dismissed forever).
- **E4 · Step rows.** Each incomplete step is a 56px row. Left: 24×24 pending checkbox (`--lc-border-strong` circle, empty inside). Middle: step label `var(--lc-type-body)` + step sub `var(--lc-type-caption)` + `--lc-text-muted`. Right: `ChevronRight` in `--lc-text-muted` — tap the row to route. Completed steps hide by default; a `Show completed ({n})` link at the bottom expands them (completed rows render with a `--lc-status-published-fg` check ✓ and strikethrough label + `--lc-text-muted` color).
- **E5 · Dismiss-forever action.** Small `<Button variant="link">` at the bottom of the card, `--lc-text-muted` ink. Label: `Dismiss this checklist`. Triggers a confirm dialog (Broadcast rule: destructive-ish actions never proceed on first tap) — the dialog explains that "You can bring it back from Settings → Onboarding progress." On confirm, PATCHes `onboarding_state.dismissed_forever = true`. Card disappears from the dashboard.
- **E6 · 100% complete auto-dismiss.** When the ring hits 100%, the card animates one confetti-lite burst (much smaller than AGT-ONB-004's — just a small `--lc-accent-bold` sparkle) then fades out via `var(--lc-duration-slow)`. State PATCH sets `dismissed_forever = true` implicitly (all-checked implies done). This is the ONLY place outside AGT-ONB-004 where a celebration motif appears in the family.
- **E7 · Pro-mode collapsed pill.** When user's `ui_mode = 'pro'` (per AGT-DSH-002), the checklist doesn't render as a card at all. Instead, a compact pill lives in the top bar next to the notification bell: a 24×24 ring + `{completedCount}/{totalCount}` label. Tap → opens a `<Sheet>` from the right containing the full checklist card content. Same dismiss-forever affordance inside the sheet.
- **E8 · Progress marker** — this screen does NOT use anchor A9 (no `Step X of 4` marker) because it's a persistent widget, not a step in the onboarding flow. It's the reminder that onboarding isn't done.

All other tokens inherit anchor A1-A12.

---

## Meta

| | |
|---|---|
| Screen ID | AGT-ONB-005 |
| Screen name | Onboarding — Progress Checklist (widget) |
| Persona | Agent, ANY `onboarding_state.step` other than `complete` AND `dismissed_forever !== true`. Also renders for `complete` state ONLY if user re-enables it from settings. |
| Device targets | Mobile 375px (primary), tablet 768px, desktop 1440px |
| Locale | English + Arabic (RTL) |
| Theme | Light + Dark |
| Route | NONE — embedded widget inside `AGT-DSH-001` (`/dashboard`). Also opens as a `<Sheet>` from the pill in AGT-DSH-002 Pro mode. |
| Current state | MISSING. |
| Workflow role | Persistent nudge across sessions until onboarding is complete. |
| Backend prerequisites | ✅ `GET /api/user/onboarding-state` (anchor `[BE-NEW-06]`) with `checklist` object · ⏳ `dismissed_forever` field in the same state row (extend anchor's schema — see §Backend contract) |

---

## Component vs Route (settled here)

**Decision: first-class dashboard widget, NOT a standalone route.**

Rationale:
1. **Matrix explicitly says** `Route: card embedded in AGT-DSH-001` — so this brief just formalizes it.
2. **Discoverability lives on the dashboard** — the whole point is the agent sees it every time they open the app. A standalone route (`/onboarding/progress`) would need someone to navigate there, which defeats the persistence goal.
3. **Pro mode still gets a pill** — the widget adapts to Pro's density (E7) rather than needing a separate screen.
4. **Settings has a re-enable toggle** (AGT-SET-005 add-on) — that's the escape hatch for users who dismissed but want it back. No dedicated route needed.
5. **Fewer routes = fewer navigation surface bugs** — the widget is always in context (the dashboard).

Implementation implication: this brief owns the component; `AGT-DSH-001` (already existing brief) mounts it. Both briefs must reference each other in the shared-components table.

---

## Purpose

Between the celebration of "first listing live" (AGT-ONB-004) and the agent becoming truly self-sufficient, there's a set of setup tasks that materially improve their WingCaster experience: connect channels, enable notifications, complete the public profile, and (soft) consider upgrading to paid. This widget keeps those tasks visible without nagging — dismissible, self-collapsing at 100%, and out of the way when there's urgent work.

---

## Design goals

1. **Persistent but polite.** The card lives on the dashboard until 100% OR dismissed. It never modals, never blocks. It's a nudge, not an interruption.
2. **Every step is one tap into value.** Tapping a step routes to the exact screen that completes it — no landing pages, no explainers.
3. **Progress is honest.** The ring shows real progress against real backend state. Never fake incremental progress for gamification.
4. **Dismissible AND reversible.** Dismiss forever is one link + one confirm. Getting it back is a settings toggle — not a mystery.
5. **Auto-dismisses at 100%.** The widget knows when it's done. One small celebration flourish and it's gone.
6. **Pro mode adapts.** Dense Pro users get a pill, not a card. Same content, different container.

---

## The 5 checklist items (in display order)

| Order | Key (in `checklist` JSONB) | Label | Sub | Route on tap |
|---|---|---|---|---|
| 1 | `first_listing_published` | Publish your first listing | 2 min via WhatsApp | `/onboarding/welcome` (or `/onboarding/whatsapp` if step already whatsapp_intake_pending) |
| 2 | `channels_connected` | Connect a publishing channel | Instagram, Facebook, Messenger, portals | `/settings/channels` (AGT-CHN-001) |
| 3 | `notifications_enabled` | Turn on notifications | Never miss a new lead | `/settings/notifications` (AGT-SET-003) |
| 4 | `profile_completed` | Complete your public profile | Photo, bio, contact — for your Bazaar profile | `/settings/profile` (AGT-SET-005) |
| 5 | `subscription_active` | Upgrade to paid (optional) | Unlock unlimited listings and portal integrations | `/subscription` (AGT-SUB-001) |

**Note:** step 5 is a *soft* checklist item — it does NOT count toward the "You're 100% done" auto-dismiss (steps 1-4 do). Step 5 shows with a small `Optional` chip in `--lc-type-caption` + `--lc-text-muted` to make the softness explicit. Rationale: forcing paid conversion onto a checklist is dark-pattern territory; showing the option is honest.

**Ring math:** `completedCount / totalCount` where `totalCount = 4` (steps 1-4). Step 5 contributes to a separate `optional_completed` counter shown only in the row's own state.

---

## Layout

### On AGT-DSH-001 (Guided mode, mobile 375px)

- Widget renders as a full-width `<Card>` in Zone 3 (empty-state slot) OR immediately below the urgent card in Zone 3 when one exists.
- Header row: progress ring (44×44) + title/sub + expand/collapse chevron.
- When expanded: step rows stack top-to-bottom. Completed rows hidden behind `Show completed ({n})` link.
- Bottom row: dismiss link.

### On AGT-DSH-002 (Pro mode, all viewports)

- Widget renders as a 32×32 pill in the top bar next to the notification bell.
- Pill content: 24×24 ring + `2/4` label in `--lc-type-data-sm` mono.
- Tap → right-side `<Sheet>` (width 400px on desktop, full-width on mobile) with the same card content inside.

### Dashboard-first-render skeleton

- While `useOnboardingState()` is loading, the widget slot renders a skeleton card of the same dimensions (ring silhouette + 3-row silhouette). No content flash.

---

## Explicit copy

| Slot | Copy |
|---|---|
| Card title | Finish setting up |
| Card sub (partial) | You're {pct}% there — {remainingCount} steps left. |
| Card sub (all-done, pre-fade) | You're all set. Nice work. |
| Step 1 label | Publish your first listing |
| Step 1 sub | 2 min via WhatsApp |
| Step 2 label | Connect a publishing channel |
| Step 2 sub | Instagram, Facebook, Messenger, portals |
| Step 3 label | Turn on notifications |
| Step 3 sub | Never miss a new lead |
| Step 4 label | Complete your public profile |
| Step 4 sub | Photo, bio, contact — for your Bazaar profile |
| Step 5 label | Upgrade to paid |
| Step 5 sub | Unlock unlimited listings and portal integrations |
| Step 5 chip | Optional |
| Show completed | Show completed ({n}) |
| Hide completed | Hide completed |
| Dismiss link | Dismiss this checklist |
| Dismiss dialog title | Dismiss this checklist? |
| Dismiss dialog body | You can bring it back from Settings → Onboarding progress. |
| Dismiss dialog confirm | Yes, dismiss |
| Dismiss dialog cancel | Keep it |
| Auto-dismiss (100%) | You're all set. Nice work. |
| Pro-mode pill tooltip | Finish setting up — {completedCount} of {totalCount} steps done |
| Error — PATCH failed | We couldn't save that. Try again? |

**Voice:** friendly, present-tense, never guilt-y. Never "You still haven't…". Never a countdown or urgency prompt.

---

## Component palette

| Element | Primitive |
|---|---|
| Checklist card | `<OnboardingChecklistCard>` (shared component — see anchor §Shared) |
| Progress ring | Custom `<ProgressRing size={44} completed={n} total={4} />` — reused in AGT-DSH-002 Pro-mode pill |
| Step row | Custom `<ChecklistRow label sub completed onTap />` |
| Expand/collapse | `<Button variant="ghost" size="icon">` + `ChevronUp`/`ChevronDown` |
| Dismiss dialog | `<Dialog>` (Radix) |
| Pro-mode pill | Custom `<OnboardingPill>` — top-bar variant |
| Pro-mode sheet | `<Sheet side="right">` (Radix) |
| Small celebration on 100% | Custom `<SparkleBurst>` — Broadcast-legal ONLY here + AGT-ONB-004 |

---

## Sample content (for v0 / mockup)

**State A — Guided mode, 1 of 4 done (post -004):**
- Progress ring: 1/4 (25%)
- Sub: "You're 25% there — 3 steps left."
- Step rows (in order):
  - ✓ Publish your first listing (completed, muted, strikethrough) — hidden behind "Show completed (1)" by default
  - ⚪ Connect a publishing channel · Instagram, Facebook, Messenger, portals
  - ⚪ Turn on notifications · Never miss a new lead
  - ⚪ Complete your public profile · Photo, bio, contact — for your Bazaar profile
  - ⚪ Upgrade to paid · Unlock unlimited listings and portal integrations · [Optional chip]
- Bottom: "Dismiss this checklist" link

**State B — Guided mode, 4 of 4 done (auto-dismiss moment):**
- Progress ring: 4/4 (100%, green ✓)
- Sub: "You're all set. Nice work."
- Small SparkleBurst animation, then card fades.

**State C — Pro mode top-bar pill:**
- 32×32 pill: 24×24 ring at 25% + label "1/4"
- Tap → Sheet from right with full card content

**State D — Dismiss confirm dialog open**

Also show RTL Arabic + dark mode variants of State A.

---

## Interactions

**On dashboard mount:**
- `useOnboardingState()` fetches. Widget slot renders skeleton until data arrives.
- If `dismissed_forever === true` OR `step === 'complete'` AND `dismissed_forever` implicit (all main checklist true), widget does NOT render (dashboard uses its normal empty-state instead).
- Otherwise, render the card.

**On step-row tap:**
- Route to the step's destination (see step table).
- No inline PATCH — the destination screen is responsible for marking its own checklist item complete when the user finishes it (e.g. AGT-CHN-001 PATCHes `channels_connected: true` on first successful channel connection).
- Return to dashboard: widget re-fetches state, ring updates, row shifts into completed group.

**On expand/collapse chevron:**
- Toggle expanded state. Persist to `sessionStorage`.
- Reduced-motion: skip the height animation, snap open/closed.

**On "Show completed" link:**
- Reveals completed rows inline. Link becomes "Hide completed".

**On dismiss link:**
- Open confirm dialog. On confirm: PATCH `onboarding_state` with `{ dismissed_forever: true }`. Card fades out `var(--lc-duration-slow)`.
- Toast on dashboard: "Checklist dismissed. Bring it back from Settings → Onboarding progress." (5s auto-dismiss).

**On 100% completion (any PATCH that fills the last main-checklist item):**
- Ring fills to `--lc-status-published-fg`, center swaps to ✓, sub swaps to "You're all set. Nice work."
- SparkleBurst animation plays (respects reduced-motion — static sparkle).
- 800ms delay, then card fades out.
- No confirm — 100% is unambiguous.

**On error — PATCH failed:**
- Destructive toast; card state reverts.

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Hidden** | `dismissed_forever = true` OR all main done AND fade completed | Widget slot renders nothing (dashboard shows its own empty state). |
| **Loading** | State fetch in flight | Skeleton card. |
| **Expanded partial** | Some incomplete steps, expanded | Full card render. Completed hidden behind link. |
| **Collapsed** | User collapsed via chevron | Header row only; chevron flipped. |
| **Fully complete transient** | Last main step marked | Ring green, sub swaps, SparkleBurst, fade out 800ms later. |
| **Dismiss confirm** | Dismiss link clicked | Dialog open. |
| **Dismissed** | Confirm | PATCH, fade, toast on dashboard. |
| **Pro-mode pill** | `ui_mode = pro` | Pill in top bar; sheet on tap. |
| **Pro-mode sheet open** | Pill tapped | Right-side sheet with card content. |
| **RTL Arabic** | Locale = ar | Layout mirrors. Ring rotates same direction (SVG). Sparkle mirror-safe. |
| **Dark mode** | prefers-color-scheme dark | Tokens swap. Ring track `--lc-surface-sunken` reads well on dark cobalt. |
| **Error — PATCH** | 500 | Destructive toast, revert. |
| **State fetch failed** | `useOnboardingState()` returns error | Widget hides entirely; log to analytics. Do NOT show a broken checklist. |

---

## Accessibility

- Card has `role="region"` and `aria-label="Onboarding progress"`.
- Ring has `role="progressbar"` with `aria-valuemin=0 aria-valuemax=4 aria-valuenow={completedCount}` + `aria-label`.
- Each step row is a real `<a>` or `<button>` — full row is the tap target (≥ 44px).
- Completed rows have `aria-checked="true"` and are announced as "completed" by screen readers.
- Dismiss dialog traps focus + closes on Escape.
- Pro-mode pill has `aria-label="Onboarding progress: 1 of 4 steps complete. Open checklist."`.
- Reduced motion: no expand/collapse animation, no SparkleBurst animation (static SVG).
- Focus visible on chevron, step rows, dismiss link.
- Step tap route: destination screen must not lose focus context; use `<Link>` with proper focus management on return.

---

## Anti-patterns

- ❌ Do NOT render this widget on any screen other than `/dashboard` (or the Pro-mode sheet). No email prompts, no modals on other screens.
- ❌ Do NOT block the user's tasks with the checklist. It never modals, never overlays.
- ❌ Do NOT put the widget above the urgent card. Urgent > checklist, always.
- ❌ Do NOT fake progress ("Loading your setup..." with fake percentage). Ring reflects real backend state or is skeleton.
- ❌ Do NOT make step 5 (upgrade to paid) count toward 100%. Dark-pattern territory.
- ❌ Do NOT gate the dismiss link ("Are you sure? Once you dismiss…") beyond the one confirm dialog. One confirm is enough.
- ❌ Do NOT re-render the widget for users who dismissed unless they explicitly re-enable from settings.
- ❌ Do NOT auto-check items based on heuristics (e.g. "user has 3 channels connected, so notifications must be enabled"). Each item is checked by its own owning screen.
- ❌ Do NOT use the signal-lamp motif on this widget. That motif is reserved for the AGT-ONB-002 stepper active state and AGT-ONB-004 thumbnail.
- ❌ Do NOT show a big celebration confetti at 100% — SparkleBurst is the size cap here. AGT-ONB-004's confetti is the big celebration.

---

## Backend contract

**State fetch (anchor's endpoint, EXTENDED — see below):**

```
GET /api/user/onboarding-state
  → 200 { step, path, checklist, dismissed_forever, started_at, updated_at, completed_at }
```

**New field required** — extend the anchor's `agent_onboarding_state` schema:

```sql
ALTER TABLE agent_onboarding_state
  ADD COLUMN dismissed_forever BOOLEAN NOT NULL DEFAULT FALSE;
```

Fold this into `[BE-NEW-06]` in the kickoff doc so it ships as ONE migration alongside the anchor's schema — not a follow-up.

**Extended checklist keys** (anchor showed 4; this brief adds a 5th):

```jsonb
{
  "welcome_seen": true,
  "first_listing_drafted": false,
  "first_listing_published": false,
  "channels_connected": false,
  "notifications_enabled": false,
  "profile_completed": false,
  "subscription_active": false
}
```

**State write (anchor's endpoint, no new endpoint needed):**

```
PATCH /api/user/onboarding-state
  body: { checklist_delta: { channels_connected: true }, dismissed_forever?: true }
```

**Downstream screens each own their PATCH:**
- AGT-CHN-001 PATCHes `channels_connected: true` on first successful channel connect.
- AGT-SET-003 PATCHes `notifications_enabled: true` when the user turns on push OR email notifications.
- AGT-SET-005 PATCHes `profile_completed: true` when photo + bio + contact are all set.
- AGT-SUB-001 PATCHes `subscription_active: true` on successful paid conversion (Paddle webhook path).
- AGT-ONB-004 already PATCHes `first_listing_published: true` on mount.

**File this as `[BE-NEW-06-EXT]`** in the kickoff doc: extend anchor's migration with `dismissed_forever` + verify each downstream screen's PATCH lands.

---

## Downstream implementation

- **Component location:** `web/src/components/onboarding/OnboardingChecklistCard.tsx` (shared per anchor).
- **Pro-mode pill:** `web/src/components/onboarding/OnboardingPill.tsx`.
- **Mount point:** `AgentDashboardPage.tsx` renders `<OnboardingChecklistCard>` in Zone 3 slot conditionally. `AgentDashboardProPage.tsx` (AGT-DSH-002, future) renders `<OnboardingPill>` in top bar.
- **`AGT-DSH-001` brief must be updated** to reference this widget as its Zone-3 default when the empty state applies. (In-repo update to the existing dashboard brief — do it in this PR.)
- **`AGT-SET-005` brief add** — a "Bring back the setup checklist" toggle when `dismissed_forever = true`. Small addition; can be a paragraph appended to AGT-SET-005 in the same PR.
- **Analytics:** `onboarding.checklist_rendered`, `onboarding.checklist_step_tapped`, `onboarding.checklist_dismissed`, `onboarding.checklist_completed`.
- **Tests:**
  - Widget renders when incomplete + hides when dismissed_forever + hides when all main complete.
  - Ring math matches step completion.
  - Dismiss + confirm PATCHes correctly.
  - Pro-mode pill renders instead of card when `ui_mode = pro`.
  - Reduced-motion path exercised.
  - Real-Postgres test: signup → complete -001→-004 → widget shows on dashboard with 1/4 → tap step 2 → complete AGT-CHN-001 → widget updates to 2/4.

---

## Handoff to v0

Framing:

```
Screen 5 of 5 in WingCaster's agent onboarding family (AGT-ONB-005).
Anchor is AGT-ONB-001. This is NOT a standalone screen — it's a
persistent widget that lives on the agent dashboard (AGT-DSH-001)
until the user completes onboarding OR dismisses forever. In Pro mode
(AGT-DSH-002), it collapses to a small pill in the top bar.

First pass: mobile 375px, WIDGET VIEW inside a dashboard mock.
Show a 44×44 progress ring at "1 of 4" (25%), the title
"Finish setting up", sub "You're 25% there — 3 steps left.",
5 step rows (one completed and hidden behind "Show completed (1)"
link, four incomplete visible). The 5th row (Upgrade to paid) has
an "Optional" chip and doesn't count toward the 100%. Dismiss link
at the bottom.

Please include the dashboard chrome around the widget (greeting,
some placeholder cards above/below) so the widget is shown in
context — this is a widget, not a standalone screen.

LTR English light mode only for pass 1 — I'll ask for the 100%
auto-dismiss moment (SparkleBurst), the Pro-mode pill in the top bar,
the Pro-mode sheet open state, the dismiss confirm dialog, RTL
Arabic, and dark mode as follow-ups.

Broadcast rule: the signal-lamp motif is NOT legal on this widget.
The SparkleBurst at 100% is a smaller, single-flash accent — much
subtler than AGT-ONB-004's confetti.

DESIGN BRIEF FOLLOWS:
```

Iterations:
1. 100% state with SparkleBurst mid-flash.
2. Pro-mode pill in dashboard top bar.
3. Pro-mode sheet open with checklist inside.
4. Dismiss confirm dialog.
5. RTL Arabic + dark mode.

---

## Definition of done

- [ ] 5 v0 iterations produced + committed.
- [ ] `<OnboardingChecklistCard>` + `<OnboardingPill>` + `<ProgressRing>` shared components extracted.
- [ ] AGT-DSH-001 brief updated to reference the widget mount point.
- [ ] AGT-SET-005 brief gets a "Bring back the checklist" toggle paragraph.
- [ ] `[BE-NEW-06-EXT]` filed — anchor's migration extended with `dismissed_forever` + `subscription_active` in checklist.
- [ ] Downstream screens (CHN-001, SET-003, SET-005, SUB-001) each verified to PATCH the correct checklist key.
- [ ] Widget hides cleanly when state fetch fails — no broken empty card.
- [ ] Broadcast signal-lamp motif is NOT used on this widget — enforced by test.
