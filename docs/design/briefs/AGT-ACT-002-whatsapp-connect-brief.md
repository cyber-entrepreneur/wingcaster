# Screen Brief — AGT-ACT-002 · Activation wizard — WhatsApp connect (delta)

**Layer-2 Brief for design AI consumption. DELTA on `AGT-ACT-001-activation-welcome-brief.md`.**

Companion to `SCREEN_MATRIX_AGENT.md` entry `AGT-ACT-002` (row 55 in `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` §5). Wave-4 Phase-1 add-on per Rev 8.

**Inherits everything from AGT-ACT-001.** Read that anchor first — the Broadcast callouts, ACT-vs-ONB coexistence contract, progress-bar persistence contract, backend `activation_state` contract, anti-patterns, and definition-of-done all apply verbatim. Deltas below.

---

## Meta

| | |
|---|---|
| Screen ID | AGT-ACT-002 |
| Screen name | Activation wizard — WhatsApp connect |
| Route | `/activate/whatsapp` |
| Backend prerequisites | ✅ Model B shared-number WhatsApp binding (PR #50, merged 2026-08-31) — the same activation-code flow used in AGT-WLB-002 |
| Depends on | AGT-ACT-001 (welcome hub) + AGT-WLB-002 primitives (activation-code sheet) |
| Current state | MISSING — new sub-screen |

---

## Purpose

Give the agent the shortest possible path from "Connect WhatsApp" step-card click → "your business WhatsApp is bound, leads will land in your inbox from now on." Uses the same activation-code binding UI as AGT-WLB but stripped to essentials — no free-form intake demo, no listing preview, just the bind.

---

## What this screen is (and is NOT)

**IS:** a condensed, single-purpose version of the AGT-WLB-002 activation-code screen — reuses the same primitives (`ActivationCodeCard`, `WhatsAppQrPanel`, `BoundConfirmation`), same backend, same idempotency guarantees.

**IS NOT:** a re-teach of what WingCaster's WhatsApp intake does. That story was told during AGT-ONB-002. This screen assumes the user knows why they're binding and just wants the mechanical binding done fast.

---

## Layout deltas from AGT-ACT-001

Single-column, centered, max-width 640px (narrower than the welcome hub — this is a focused task screen).

**Zone 1 — Header:** identical to AGT-ACT-001 header (wordmark + language + color mode + Skip wizard) but ADD a breadcrumb: `Activation wizard → Step 1 · Connect WhatsApp`.

**Zone 2 — Persistent progress bar:** the `X of 5 complete` bar from AGT-ACT-001 reappears here, at 60% of its welcome-hub size. Sits under the breadcrumb. Non-negotiable per the progress-persistence contract in §Progress persistence of the anchor.

**Zone 3 — Task body:**
- H1: "Connect your business WhatsApp" — `var(--lc-type-heading-1)`.
- Sub: "Text this activation code from the WhatsApp account you want to use. It expires in 10 minutes."
- **ActivationCodeCard** (reused primitive from AGT-WLB-002):
  - The 6-character activation code, `var(--lc-type-display)` mono, letter-spaced.
  - "Copy code" button + "Send via WhatsApp" deep-link button (opens `wa.me/<shared_number>?text=<code>`).
  - Countdown timer `10:00 → 0:00` using `<Numeric>`, `--lc-text-muted`.
  - Regenerate link once expired.
- **Live status pill** below the card: pulsing `--lc-accent-bold` dot + label — cycles: "Waiting for your message…" → "Message received — verifying…" → "Bound." The dot pulse uses `--lc-duration-slow` and is the ONE place in this screen where the signal-lamp motif is legal (per Broadcast alignment reference: this is a live-data moment).
- On bind success: card swaps to the `BoundConfirmation` primitive — WhatsApp channel-mark + bound phone number (masked, e.g. `+971 5X XXX XX23`) + "Change number" secondary link.

**Zone 4 — Footer CTAs:**
- Primary: "Mark step complete →" (only enabled after bind success). On click, POSTs `activation_state/complete` with `completed_via: dashboard_action` and returns to `/activate`.
- Secondary: "I'll do this later" (ghost) — POSTs `activation_state/defer` and returns to `/activate`.
- Tertiary link: "Skip — I don't use WhatsApp for business" — same behavior as defer but records `reason: no_business_whatsapp` for analytics.

**Mobile:** same stack, full-width. ActivationCodeCard becomes vertically laid out with the "Send via WhatsApp" deep-link as the primary in-card CTA.

---

## Explicit copy deltas

| Slot | Copy |
|---|---|
| Breadcrumb | Activation wizard → Step 1 · Connect WhatsApp |
| H1 | Connect your business WhatsApp |
| Sub | Text this activation code from the WhatsApp account you want to use. It expires in 10 minutes. |
| Card code label | Your activation code |
| Copy button | Copy code |
| Deep-link button | Send via WhatsApp |
| Countdown label | Expires in **{mm:ss}** |
| Regenerate link | Code expired — get a new one |
| Status — waiting | Waiting for your message… |
| Status — verifying | Message received — verifying… |
| Status — bound | WhatsApp connected · **{masked_number}** |
| Change number link | Use a different number |
| Primary CTA (enabled after bind) | Mark step complete → |
| Secondary CTA | I'll do this later |
| Tertiary skip link | Skip — I don't use WhatsApp for business |
| Auto-complete banner (if already bound) | You already connected WhatsApp on **{date}**. Nothing to do here. |

---

## State variants (deltas)

| Variant | Trigger | Behavior |
|---|---|---|
| **Already bound on load** | `activation_state.steps[whatsapp].state === "complete"` on entry | Skip the ActivationCodeCard entirely. Show the auto-complete banner + `BoundConfirmation` + a large "Return to activation wizard →" primary CTA. Do NOT re-issue a code. |
| **Fresh — no code yet** | First entry | Generate + display code on mount. Timer starts at 10:00. |
| **Code expired** | Countdown hits 0:00 | Card dims to 60% opacity. Regenerate link becomes the primary in-card affordance. Live status pill hides. |
| **Waiting** | Code active, no inbound WhatsApp yet | Signal-lamp dot pulsing, status = "Waiting for your message…" |
| **Verifying** | Backend received the message, running the bind | Status pill swaps to "Message received — verifying…", primary CTA remains disabled. |
| **Bound** | Backend confirms | Card → BoundConfirmation. Primary CTA "Mark step complete →" enables. Signal-lamp dot stops pulsing (steady state now). |
| **Bind rejected** | Number already claimed by another tenant | Destructive toast: "That WhatsApp number is already bound to another WingCaster account. Use a different number or contact support." Regenerate link becomes primary. |
| **Deferred** | User clicked "I'll do this later" or the tertiary skip | Return to `/activate`; card renders in Skipped variant. |

---

## Reuse map (non-negotiable — DO NOT rebuild)

| Primitive | Source file | Notes |
|---|---|---|
| `ActivationCodeCard` | Extract from AGT-WLB-002 implementation | If not yet extracted, this brief's Cursor prompt owns the extraction — move from `AgentWhatsAppOnboardingPage.tsx` (or wherever it lives post-PR-#50) into `web/src/components/whatsapp/ActivationCodeCard.tsx`. AGT-WLB-002 and AGT-ACT-002 both consume. |
| `WhatsAppQrPanel` | Same as above (for the deep-link + QR display) | Same extraction rule. |
| `BoundConfirmation` | Same as above | Same extraction rule. |
| `<ChannelMark channel="whatsapp">` | Already in `web/src/components/ui/` | Use as-is. |
| Backend endpoints | Reuse `POST /api/whatsapp/activation-codes` + `GET /api/whatsapp/activation-codes/{id}/status` (per PR #50) | No new endpoints needed. |

If any of these primitives do not yet exist as extracted, standalone components, this brief's Cursor prompt MUST include the extraction as a required step — the shared primitives cannot live inside a single page component.

---

## Anti-patterns (deltas)

- ❌ Do not re-explain what WhatsApp intake does. AGT-ONB-002 owns that education. This screen is task-focused.
- ❌ Do not skip the persistent progress bar. Every AGT-ACT sub-screen shows it — that's what makes them feel like a family.
- ❌ Do not auto-navigate away on bind success. The user still has to click "Mark step complete →". Auto-nav feels like the app is deciding for them.
- ❌ Do not fire the signal-lamp motif outside the "Waiting for your message" state. Once bound, the dot goes steady.
- ❌ Do not gate the "Mark step complete" button behind a follow-up test message. Bind = complete. Optionally add a "Send yourself a test message" secondary link BELOW the primary CTA, but never as a blocker.

---

## Downstream implementation notes (deltas)

- **New file:** `web/src/pages/ActivationWhatsAppPage.tsx` — route `/activate/whatsapp`.
- **Extraction PR (if needed):** move `ActivationCodeCard`, `WhatsAppQrPanel`, `BoundConfirmation` into `web/src/components/whatsapp/`. Update AGT-WLB-002 imports.
- **Data hook:** reuse `useActivationState()` from AGT-ACT-001 for step-completion POST. Reuse the PR #50 WhatsApp binding hooks for the code + status polling.
- **Test discipline:** integration test — complete the bind flow end-to-end against a mocked backend, assert `activation_state/complete` fires with `step_id: "whatsapp"` + correct `completed_via`.
- All Broadcast + a11y + RTL + dark-mode requirements from AGT-ACT-001 apply verbatim.

---

## Definition of done (deltas)

- [ ] Shared WhatsApp primitives extracted (or confirmed already extracted from AGT-WLB-002).
- [ ] v0 iteration states: fresh code (desktop), waiting-signal-pulsing, bound-confirmation, code-expired, already-bound-on-load, mobile, RTL, dark.
- [ ] Screenshots + JSX exports committed.
- [ ] Cross-brief regression test: completing this step correctly updates AGT-ACT-001's welcome-hub progress bar on return-nav.
