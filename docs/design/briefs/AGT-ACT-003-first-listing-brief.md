# Screen Brief — AGT-ACT-003 · Activation wizard — First listing (delta)

**Layer-2 Brief for design AI consumption. DELTA on `AGT-ACT-001-activation-welcome-brief.md`.**

Companion to `SCREEN_MATRIX_AGENT.md` entry `AGT-ACT-003` (row 56 in `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` §5). Wave-4 Phase-1 add-on per Rev 8.

**Inherits everything from AGT-ACT-001.** Read that anchor first — Broadcast callouts, ACT-vs-ONB coexistence contract, progress-bar persistence, backend `activation_state` contract, anti-patterns, and DoD all apply verbatim. Deltas below.

---

## Meta

| | |
|---|---|
| Screen ID | AGT-ACT-003 |
| Screen name | Activation wizard — First listing |
| Route | `/activate/first-listing` |
| Backend prerequisites | ✅ Listing composer (AGT-LST-004) shipped · ✅ Model B WhatsApp intake (PR #50) shipped |
| Depends on | AGT-ACT-001 + AGT-LST-004 (manual composer) + AGT-WLB flow (voice intake) |
| Current state | MISSING — new sub-screen |

---

## Purpose

Give the agent a two-path fork — **type it or dictate it** — that leads to their first published listing without forcing either style on them. Neither path is embedded here; both are shortcuts to existing screens. This screen is deliberately a **router**, not a composer.

---

## What this screen is (and is NOT)

**IS:** a two-card fork screen. Left card routes to the manual composer (AGT-LST-004). Right card routes to the voice-intake flow (AGT-WLB-001 or the equivalent WhatsApp voice-note entry point).

**IS NOT:** a listing composer of its own. Do NOT rebuild the listing form here. Do NOT rebuild the voice intake here. Both destinations already exist; this screen picks between them.

---

## Layout deltas from AGT-ACT-001

Single-column, centered, max-width 720px (a touch wider than AGT-ACT-002 because the two path cards need room).

**Zone 1 — Header + breadcrumb:** identical shape to AGT-ACT-002. Breadcrumb: `Activation wizard → Step 2 · Publish your first listing`.

**Zone 2 — Persistent progress bar:** same as AGT-ACT-002.

**Zone 3 — Task intro:**
- H1: "How do you want to create your first listing?"
- Sub: "Either path counts. You can always use the other one later."

**Zone 4 — Two-card fork (2-column on desktop/tablet ≥640px, stacked on mobile):**

**Card A — Type it out (manual composer):**
- Icon: `Keyboard` (lucide, 40×40, `--lc-text-heading`).
- Title: "Type it out" — `var(--lc-type-heading-3)`.
- Description: "Fill in the classic listing form — property type, price, beds, baths, photos. Best if you're at your desk."
- Meta line: `~5 minutes` — `<Numeric>5</Numeric>`, `--lc-text-muted`, `var(--lc-type-caption)`.
- CTA: `<Button variant="default">` "Open the composer →" — navigates to `/listings/new` (AGT-LST-004) with query `?source=activation` for attribution.

**Card B — Dictate it (WhatsApp voice intake):**
- Icon: `<ChannelMark channel="whatsapp">` at 40×40 (pairs `--lc-channel-whatsapp` bg with `--lc-channel-whatsapp-on` ink).
- Title: "Dictate it via WhatsApp" — `var(--lc-type-heading-3)`.
- Description: "Send a voice note to your bound WhatsApp — WingCaster transcribes and drafts the listing. Best if you're on-site or in the car."
- Meta line: `~90 seconds` — `<Numeric>90</Numeric>`, `--lc-text-muted`, `var(--lc-type-caption)`.
- CTA: `<Button variant="default">` "Send a voice note →" — navigates to `/whatsapp/onboarding/voice-intake` (or wherever the AGT-WLB voice-intake entry lives) with query `?source=activation`.
- **Locked variant** — if `activation_state.steps[whatsapp].state !== "complete"`, this card renders in the Locked step-card variant from AGT-ACT-001 with helper "Connect WhatsApp first — go to Step 1." The helper is a link back to `/activate/whatsapp`.

**Zone 5 — Alternative row (below the two cards):**
- Small text link: "Already published a listing elsewhere? **Mark this step complete** →" — for the edge case where a listing was created via API, admin import, or another surface not tracked by `activation_state` auto-complete triggers. Opens a `<Dialog>` confirming "You're telling us your first listing already exists. This will mark Step 2 complete." with primary "Yes, mark complete" + secondary "Cancel."
- Below that: `<Button variant="ghost">` "I'll do this later" — POSTs defer + returns to `/activate`.

---

## Explicit copy deltas

| Slot | Copy |
|---|---|
| Breadcrumb | Activation wizard → Step 2 · Publish your first listing |
| H1 | How do you want to create your first listing? |
| Sub | Either path counts. You can always use the other one later. |
| Card A title | Type it out |
| Card A description | Fill in the classic listing form — property type, price, beds, baths, photos. Best if you're at your desk. |
| Card A meta | ~**5** minutes |
| Card A CTA | Open the composer → |
| Card B title | Dictate it via WhatsApp |
| Card B description | Send a voice note to your bound WhatsApp — WingCaster transcribes and drafts the listing. Best if you're on-site or in the car. |
| Card B meta | ~**90** seconds |
| Card B CTA | Send a voice note → |
| Card B locked helper | Connect WhatsApp first — **go to Step 1** → |
| Alternative link | Already published a listing elsewhere? **Mark this step complete** → |
| Alt confirm dialog title | Mark first listing as complete? |
| Alt confirm dialog body | You're telling us your first listing already exists. This will mark Step 2 complete. |
| Alt confirm primary | Yes, mark complete |
| Alt confirm secondary | Cancel |
| Defer CTA | I'll do this later |
| Auto-complete banner | You already published your first listing on **{date}** — via **{source}**. Nothing to do here. |

---

## State variants (deltas)

| Variant | Trigger | Behavior |
|---|---|---|
| **Already complete on load** | `activation_state.steps[first_listing].state === "complete"` | Skip both fork cards. Show auto-complete banner + a "See your listings →" secondary CTA + a "Return to activation wizard →" primary CTA. |
| **Fresh — both paths available** | WhatsApp bound + no listings yet | Both cards active. |
| **Fresh — WhatsApp not bound** | `activation_state.steps[whatsapp].state !== "complete"` | Card A active; Card B in Locked variant with the "go to Step 1" helper. |
| **Deferred** | User clicked "I'll do this later" or the tertiary skip | Return to `/activate`; card renders Skipped in the welcome hub. |
| **Manual mark-complete confirmed** | User confirmed the alt dialog | POST `activation_state/complete` with `completed_via: direct`. Return to `/activate`. |

---

## Interactions (deltas)

**On card CTA click:**
- Navigate immediately. Do NOT prompt "are you sure" — the user's intent is clear.
- The destination screen is responsible for calling `activation_state/complete` on successful listing publication (see the auto-complete trigger contract in AGT-ACT-001 §Backend contract).
- When the user returns to `/activate` post-publish, the wizard shows Step 2 as Complete with `completed_via: dashboard_action` or `completed_via: whatsapp_intake` depending on which path was taken.

**On "Mark this step complete" alt-link click:**
- Open the confirmation dialog. Focus-trap, Escape closes.
- On confirm, POST `activation_state/complete` with `completed_via: direct`, return to `/activate`.

**No auto-nav on this screen.** This screen is a fork — user must actively pick a path. Do not auto-select based on device (mobile ≠ voice, desktop ≠ manual). Both cards visible on both devices.

---

## Reuse map

| Destination | Screen | Notes |
|---|---|---|
| Card A "Open the composer" | AGT-LST-004 (`/listings/new`) | Existing screen. Pass `?source=activation` for attribution. |
| Card B "Send a voice note" | AGT-WLB voice-intake entry | Existing flow. Pass `?source=activation`. |
| Card B locked helper "go to Step 1" | AGT-ACT-002 (`/activate/whatsapp`) | Direct link. |

This screen owns ~zero business logic. If it grows business logic, that logic belongs on AGT-LST-004 or the WhatsApp intake side, not here.

---

## Anti-patterns (deltas)

- ❌ Do not embed the listing composer inline. This screen is a router — it navigates.
- ❌ Do not auto-select based on device class. Users on mobile can and do prefer the manual composer for their first listing; users on desktop can prefer voice.
- ❌ Do not gate Card A behind WhatsApp binding. Manual composer is always available.
- ❌ Do not surface the alt-link "Mark this step complete" prominently — it's a rescue path for edge cases, not the happy path. Small link, subdued style.
- ❌ Do not omit the Card B locked state when WhatsApp is not bound. Rendering a dead-end CTA is worse than rendering a clear "prerequisite pending" state.

---

## Downstream implementation notes (deltas)

- **New file:** `web/src/pages/ActivationFirstListingPage.tsx` — route `/activate/first-listing`.
- **Data hook:** reuse `useActivationState()` from AGT-ACT-001.
- **Attribution:** the `?source=activation` query param on downstream nav must be picked up by AGT-LST-004's publish handler and passed into the `activation_state/complete` POST as `completed_via: dashboard_action` (or `completed_via: activation_wizard` if a distinct source is preferred — coordinate with backend owner).
- **Test discipline:** integration test — click Card A → navigates to `/listings/new?source=activation`. Click Card B (bound) → navigates correctly. Click Card B (unbound) → helper link goes to `/activate/whatsapp`. Alt-link → dialog → confirm → POST fires + returns to `/activate`.
- All Broadcast + a11y + RTL + dark-mode requirements from AGT-ACT-001 apply verbatim.

---

## Definition of done (deltas)

- [ ] v0 iteration states: both-paths-available (desktop + mobile), WhatsApp-not-bound (Card B locked), already-complete-on-load, alt-mark-complete dialog, RTL, dark.
- [ ] Cross-brief regression test: publishing a listing from AGT-LST-004 with `?source=activation` correctly updates `activation_state` and the welcome hub reflects Complete on return.
