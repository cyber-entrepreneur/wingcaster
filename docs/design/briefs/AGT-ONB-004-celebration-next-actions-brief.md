# Screen Brief — AGT-ONB-004 · Celebration + Next Actions (first listing live)

**Layer-2 Brief — DELTA screen. References anchor AGT-ONB-001.**

Companion to `SCREEN_MATRIX_AGENT.md` §1 entry `AGT-ONB-004`. Ships in the AGT-ONB PR bundle (Week 4).

Upstream: `AGT-ONB-003` on Publish success.
Downstream (via next-action cards): `AGT-PUB-002` (Instagram/social share), `AGT-CHN-001` (channels connect), `AGT-DSH-001` (dashboard). "Later" also routes to dashboard.

This is the payoff. The agent bet 3 minutes on WingCaster; the bet just paid off.

---

## 🎨 Broadcast alignment

**Inherits Broadcast callouts A1-A12 from `AGT-ONB-001` (anchor) and reuses `<CelebrationHeader>` + `<DraftListingPreview>` from AGT-ONB-003.** This delta adds:

- **D1 · Confetti moment.** Full-screen confetti burst on mount using `canvas-confetti` (already installed for AGT-PUB celebration events). Broadcast palette only — confetti particles cycle through `--lc-action-primary`, `--lc-accent-bold`, `--lc-status-published-fg`, `--lc-text-brand`. Duration 1.2s + fade. Respects `prefers-reduced-motion`: NO confetti, instead a static burst SVG with the same colors. Confetti runs ONCE per session (guarded by a `sessionStorage` flag).
- **D2 · Celebration header (loud tone).** Reuses `<CelebrationHeader tone="loud">` from -003. H1: `Your first listing is live!` in `--lc-type-display` (Archivo 800, 32/38 desktop; drops to `--lc-type-heading-1` on mobile). **This is the only screen in the family with an exclamation mark in the H1** — Broadcast voice rule: celebration earns the punctuation. Sub: `Sara — you turned a voice memo into a live listing in {elapsedMinutes} minutes.` in `--lc-type-body-lg`. The elapsed time is computed from `onboarding_state.started_at`; if unavailable, drop the parenthetical.
- **D3 · Live-listing thumbnail card.** Compact `<Card>` on `--lc-surface-raised` + `--lc-elevation-sm`. 96px square photo (first image) on the left, price + address on the right in `--lc-type-heading-3` + `--lc-type-body-sm`, right-most: a **signal-lamp published dot** — teal `--lc-accent-bold` inside its `--lc-focus-ring-contrast` boundary — pulsing at `--lc-duration-slow`. **Broadcast rule: the signal-lamp is legal here** — this is literally the "listing went live" moment the motif is reserved for. Tap card → `AGT-LST-003` in a new tab (the user comes back to pick a next action).
- **D4 · Next-action tri-card grid.** Below the thumbnail. Reuses `<IntakePathCard>` component from AGT-ONB-001 but with `variant="nextAction"` — three cards in a horizontal row on desktop, 3-row stack on mobile. Each card:
  - **Card N1 — Share on Instagram** — icon `<ChannelMark channel="instagram">`, label `Share on your Instagram`, sub `We'll turn your listing into a shareable post — you approve before it goes out.`, CTA `Connect Instagram →` (routes to `AGT-PUB-002` if channels connected, or `AGT-CHN-001` if not).
  - **Card N2 — Connect other channels** — icon Facebook + Messenger + WhatsApp channel-marks clustered, label `Connect your other channels`, sub `Publish once, syndicate everywhere. Facebook, Messenger, TikTok, LinkedIn.`, CTA `Set up channels →` (routes to `AGT-CHN-001`).
  - **Card N3 — Explore your dashboard** — icon `LayoutDashboard` from lucide in a `--lc-surface-sunken` well, label `Explore your dashboard`, sub `See leads, quotas, and what's next — one screen, one tap each.`, CTA `Go to dashboard →` (routes to `/dashboard`).
  Unlike AGT-ONB-001, all three cards render their CTA at all times — no radio-select model. Selecting a card here IS the destination.
- **D5 · Later link** — `<Button variant="link">` labeled `Skip for now — take me to the dashboard`, `--lc-text-muted`. Below the next-action grid, centered on mobile / right-aligned on desktop. Same route as N3's CTA but signals a different analytics intent (deferred vs explored).
- **D6 · Progress marker** (anchor A9) — `Step 4 of 4 · You're set` — the final step, marker uses `--lc-status-published-fg` for the check ✓.
- **D7 · Onboarding-state finalization.** On mount, the screen PATCHes `onboarding_state` with `{ step: 'complete', completed_at: NOW(), checklist_delta: { first_listing_published: true } }`. Any next-action click subsequently PATCHes the relevant checklist item (Instagram → `channels_connected: true` (partial credit), Dashboard → no delta). AGT-ONB-005 (the persistent checklist) reads this state to decide whether to keep showing.

All other tokens inherit anchor A1-A12.

---

## Meta

| | |
|---|---|
| Screen ID | AGT-ONB-004 |
| Screen name | Onboarding — Celebration + Next Actions |
| Persona | Agent, `onboarding_state.step = 'first_published'` (transitional — screen finalizes to `complete` on mount) |
| Device targets | Mobile 375px (primary), tablet 768px, desktop 1440px |
| Locale | English + Arabic (RTL) |
| Theme | Light + Dark |
| Route | `/onboarding/first-listing/published` |
| Current state | MISSING. |
| Workflow role | WF-01 (Onboarding) terminal screen. |
| Backend prerequisites | ✅ `PATCH /api/user/onboarding-state` (anchor's `[BE-NEW-06]`) · ✅ Published listing already exists from -003's approve call. |

---

## Purpose

Reward the just-published moment with an unmistakable "you did it" — confetti, big headline, live-listing thumbnail with the signal-lamp — then hand the agent three clear next actions that expand the value they just got.

Never a dead-end: "Later" always works and lands on the dashboard where AGT-ONB-005 keeps the momentum going.

---

## Design goals

1. **The moment is the moment.** Confetti, `Your first listing is live!` at display scale, the signal-lamp on the thumbnail — Broadcast's loudest allowed voice. Once.
2. **Elapsed time is a proof point.** "in 2 minutes" beats any marketing claim. Compute from `started_at`; drop gracefully if unavailable.
3. **Three next actions, not eight.** Instagram / channels / dashboard. Each is a real jump into value, not a "learn more" trap.
4. **The listing is real and clickable.** Show it. Let the agent tap through to see it live on `AGT-LST-003`.
5. **Later never punishes.** Skipping is normal — the dashboard has AGT-ONB-005 waiting.
6. **Signal-lamp appears exactly once — on the thumbnail card's live-dot.** Broadcast rule.

---

## Layout

### Mobile 375px (primary)

- Confetti overlay (D1) plays on mount, then dismisses.
- Top bar: progress marker `Step 4 of 4 · You're set` ✓ + language + color mode.
- **Celebration header (D2)** — H1 + sub.
- **Live-listing thumbnail (D3)** — 88px photo + right-side text + signal-lamp pulsing.
- **Next-action tri-card stack (D4)** — 3 rows, each full-width, ~120px tall.
- **Later link (D5)** — centered below the stack.

### Desktop / tablet ≥768px

Single-column, centered, max-width 720px:
- Confetti (D1) full-viewport.
- Celebration header, thumbnail, tri-card row (horizontal), Later link right-aligned.

No two-column split here — this screen is a moment, not a form. Centering focuses the eye.

---

## Explicit copy

| Slot | Copy |
|---|---|
| Progress marker | Step 4 of 4 · You're set ✓ |
| H1 | Your first listing is live! |
| Sub (with elapsed) | {firstName} — you turned a voice memo into a live listing in {elapsedMinutes} minutes. |
| Sub (no elapsed) | {firstName} — you just turned a voice memo into a live listing. |
| Thumbnail signal-lamp label | Live now |
| Thumbnail tap hint | Tap to view your listing → |
| Section label (before D4) | What's next |
| N1 label | Share on your Instagram |
| N1 sub | We'll turn your listing into a shareable post — you approve before it goes out. |
| N1 CTA | Connect Instagram → |
| N2 label | Connect your other channels |
| N2 sub | Publish once, syndicate everywhere. Facebook, Messenger, TikTok, LinkedIn. |
| N2 CTA | Set up channels → |
| N3 label | Explore your dashboard |
| N3 sub | See leads, quotas, and what's next — one screen, one tap each. |
| N3 CTA | Go to dashboard → |
| Later link (D5) | Skip for now — take me to the dashboard |
| Error — state finalize failed | Nice work — but we couldn't save your progress. Your listing is still live. |
| Offline banner | You're offline. Your listing is live; next actions will work once you reconnect. |

**Voice** — this is the ONLY screen in the family with an exclamation in H1. Sub is warm and personal (uses first name). Never "Congratulations" — too generic. Never "You crushed it" — off-brand.

---

## Component palette

| Element | Primitive |
|---|---|
| Confetti | `canvas-confetti` (existing dep) OR fallback static SVG on reduced-motion |
| Celebration header | `<CelebrationHeader tone="loud">` (shared with -003 in `tone="subdued"`) |
| Live-listing thumbnail | Custom `<PublishedListingCard>` — photo + text + signal-lamp |
| Signal-lamp | `<SignalLampDot>` (shared component introduced in -002) |
| Next-action cards | `<IntakePathCard variant="nextAction">` (shared component from -001, extended) |
| Channel-marks | `<ChannelMark channel="instagram|facebook|messenger|whatsapp">` |
| Later link | `<Button variant="link">` |
| Progress marker | `<OnboardingProgressMarker step={4} complete>` (shared) |

---

## Sample content (for v0 / mockup)

Show mobile 375px, ~1s after mount (confetti dismissed):
- Progress: "Step 4 of 4 · You're set ✓"
- H1: "Your first listing is live!"
- Sub: "Sara — you turned a voice memo into a live listing in 2 minutes."
- Thumbnail: 2BR Downtown Dubai photo + "AED 2.4M · Burj Vista Tower 1" + pulsing signal-lamp on right + "Live now" caption
- 3 next-action cards stacked, each with icon + label + sub + CTA button
- Later link at bottom

Also show:
- **Confetti in flight** (D1 active, mid-burst).
- **Reduced-motion state** (static SVG burst behind H1).
- **Desktop 1440px** (single-column centered, tri-card horizontal row).
- **RTL Arabic** (layout mirrors; confetti particles mirror-safe; channel-marks stay LTR).

---

## Interactions

**On mount:**
- Trigger D1 confetti (only if `sessionStorage.getItem('agtOnb004ConfettiPlayed') !== 'true'`).
- Set the flag so a refresh doesn't re-fire.
- PATCH `/api/user/onboarding-state` with `{ step: 'complete', checklist_delta: { first_listing_published: true } }`.
- On PATCH failure: silent — the celebration still shows. Toast with the "we couldn't save" copy but no blocking behavior.

**On thumbnail tap:**
- Open `/listings/:propertyId` (AGT-LST-003) in a **new tab** on desktop / **same tab with history back** on mobile.

**On next-action card CTA click:**
- Route to the destination. Also PATCH `onboarding_state.checklist_delta` per card (see D7 spec).
- Fire analytics `onboarding.next_action_selected` with `action_id`.

**On Later link click:**
- Route to `/dashboard`. Fire `onboarding.next_action_deferred`.

**On reduced-motion:**
- Skip D1 confetti animation; render static burst SVG behind H1.
- Signal-lamp on D3 becomes a solid dot (no pulse).

**On offline:**
- Banner appears. Cards still show; CTAs still route (destination pages handle their own offline state). PATCH queues.

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Initial** | Screen mounted, first time this session | Confetti fires. State PATCH fires. All content rendered. |
| **Refresh** | Screen mounted, `sessionStorage` flag set | No confetti replay. Everything else renders normally. |
| **Reduced motion** | `prefers-reduced-motion: reduce` | Static SVG burst instead of confetti; signal-lamp static. |
| **State PATCH failed** | Response 500 | Soft toast; no impact on screen behavior. |
| **Loading thumbnail** | Property data GET in flight | Skeleton thumbnail. |
| **Thumbnail 404** | Property was deleted between publish and this screen (extreme edge case) | Hide thumbnail; show generic celebration; log to analytics. |
| **Offline** | Network unreachable | Banner. Everything else renders (client-side celebration). |
| **RTL Arabic** | Locale = ar | Layout mirrors. Confetti particles fine. Channel-marks stay LTR. Arabic-Indic numerals in the elapsed-time. |
| **Dark mode** | prefers-color-scheme dark | Tokens swap. Confetti palette stays broadcast-orange + teal (readable on cobalt bg). |
| **Missing first name** | `req.user.name` null | Drop the vocative — sub reads "You turned a voice memo…" |
| **Missing elapsed time** | `started_at` unavailable | Drop the parenthetical — sub reads "You just turned a voice memo into a live listing." |

---

## Accessibility

- Confetti has `aria-hidden="true"` — it's decorative. Screen readers hear the H1 first.
- H1 announced via `role="status"` + `aria-live="polite"` so a screen reader user hears the celebration when the screen mounts.
- Signal-lamp on D3 has `aria-label="Live now"` and does not rely on color alone.
- Reduced-motion honored strictly — no confetti, no pulse.
- Next-action cards are full anchor tags OR buttons wrapping the whole card region — the entire card is one 44+px tap target.
- Focus order: language → color mode → thumbnail card → N1 → N2 → N3 → Later.
- Confetti animation is capped at 1.2s — well under the 3s auto-play accessibility ceiling.

---

## Anti-patterns

- ❌ Do NOT loop the confetti or play it > 1.2s.
- ❌ Do NOT replay confetti on refresh (sessionStorage guard).
- ❌ Do NOT use the signal-lamp anywhere on this screen except the thumbnail's live-dot.
- ❌ Do NOT fabricate stats ("You're in the top 10% of new agents!"). This screen celebrates a real event, not synthetic gamification.
- ❌ Do NOT add a 4th next-action card. Three is the cap.
- ❌ Do NOT use `MessageCircle` for WhatsApp in the channel-mark cluster on N2.
- ❌ Do NOT include a "share this celebration" button or social-brag mechanic — this is the agent's win, not marketing.
- ❌ Do NOT block the user from leaving if state PATCH fails — the celebration is authoritative, the state row is bookkeeping.
- ❌ Do NOT auto-redirect to dashboard after N seconds — this screen has no time limit.

---

## Backend contract

**Endpoints reused:**
- `PATCH /api/user/onboarding-state` (anchor `[BE-NEW-06]`) — finalize step, mark checklist.
- `GET /api/properties/:id` — thumbnail data.
- Analytics events fire client-side to existing PostHog wire.

**No new backend prerequisites** — this screen consumes what anchor + -003 already introduced.

**Source-channel note:** the thumbnail may show a source tag (Bazaar / OLX / Bayut / PF / Direct). This depends on `[BE-BLOCKER-04] conversations.source_channel decomposition` — the kickoff doc §5a already flags Week 4 as the slot to decompose the column, and this screen is one of the reasons. If the decomposition slips, the thumbnail hides the source tag rather than falling back to the current single-column value (which conflates source with transport).

---

## Downstream implementation

- **New route:** `web/src/pages/onboarding/CelebrationPage.tsx`.
- **Confetti util:** `web/src/lib/confetti.ts` — shared with future celebration screens (AGT-HTX-002 close, first inquiry, etc.). Extract now.
- **`<IntakePathCard variant="nextAction">`** — extends the shared component from -001 to accept an always-visible CTA prop.
- **Analytics events:** `onboarding.completed`, `onboarding.next_action_selected`, `onboarding.next_action_deferred`.
- **Tests:** confetti fires once per session; signal-lamp appears only on the thumbnail; reduced-motion path exercised; a11y smoke.

---

## Handoff to v0

Framing:

```
Screen 4 of 5 in WingCaster's agent onboarding family (AGT-ONB-004).
Anchor is AGT-ONB-001. This is the celebration screen after the agent
publishes their first listing (from AGT-ONB-003). Confetti moment,
big H1 "Your first listing is live!", a thumbnail of the actual
listing with a pulsing teal signal-lamp indicating "Live now", and
three next-action cards (Instagram, other channels, dashboard).
There is a "Later" link that goes to the dashboard.

Only screen in the family with an exclamation mark in the H1.
Only screen where the Broadcast signal-lamp motif is legal outside
of AGT-ONB-002.

First pass: mobile 375px, ~1s after mount (confetti already dismissed).
Sample data: first name "Sara", elapsed time 2 minutes, listing thumbnail
= 2BR Downtown Dubai / AED 2.4M / Burj Vista Tower 1. Three next-action
cards stacked. Later link at bottom.

LTR English light mode only for pass 1 — I'll ask for the confetti-mid-burst
state, reduced-motion static burst, desktop layout, RTL Arabic, and dark
mode as follow-ups.

Confetti particles use --lc-action-primary, --lc-accent-bold,
--lc-status-published-fg, --lc-text-brand — no other colors.

DESIGN BRIEF FOLLOWS:
```

Iterations:
1. Confetti mid-burst.
2. Reduced-motion static SVG burst.
3. Desktop 1440px (single-column centered, tri-card horizontal).
4. RTL Arabic + dark mode.

---

## Definition of done

- [ ] 4 v0 iterations produced + committed.
- [ ] Confetti util extracted.
- [ ] Signal-lamp appears exactly once on this screen (thumbnail live-dot) — enforced by test.
- [ ] `sessionStorage` guard prevents confetti replay on refresh.
- [ ] `onboarding_state → complete` PATCH fires on mount + is retried on network failure.
- [ ] Reduced-motion path exercised in a11y test.
