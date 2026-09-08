# Screen Brief — AGT-WLB-003 · Waiting for your first WhatsApp message — delta of AGT-WLB-001

**Layer-2 Brief for design AI consumption.** Delta of the AGT-WLB-001 anchor. Inherits the anchor's Broadcast alignment, `<TourFrame>`, and `<StepHero>` (neutral emphasis) patterns verbatim.

Wave 4, step 4 of 5 in the AGT-WLB WhatsApp intake tour. The waiting state between "binding confirmed" (end of -002) and "AI is drafting" (start of -004).

---

## 🎨 Broadcast alignment

Same as AGT-WLB-001 anchor. Additional callouts:

- **Live-broadcast signal-lamp motif** — the "listening…" state renders a single `--lc-accent` (teal) dot pulsing at `var(--lc-duration-slow)` on a small surface. This is one of the two legal uses of the signal-lamp pulse on Broadcast (the other being AGT-DSH-001's attention card when a listing just went live per Broadcast reference §Motion). Wrap the dot in a `--lc-accent-bold-edge` outline chip because accent bold always needs a boundary.
- Do NOT run the pulse anywhere else on this screen. Progress dots stay static.

---

## Meta

| | |
|---|---|
| Screen ID | AGT-WLB-003 |
| Screen name | Waiting for your first WhatsApp message |
| Persona | Agent (mid-tour, phone bound) |
| Device targets | Mobile 375px (primary), tablet 768px, desktop 1440px |
| Locale | English + Arabic (RTL) |
| Theme | Light + Dark |
| Route | `/onboarding/whatsapp/waiting` (tour step 4). |
| Current state | MISSING — ships in Wave 4. |
| Workflow role | WF-01 step 4. |
| Backend prerequisites | ✅ `GET /api/auth/whatsapp/binding-status` (PR #50 §2.5) — poll target. ⏳ **Inbound-message detection endpoint** — needs `GET /api/whatsapp-listings/drafts/latest` or a poll extension to `binding-status` returning `latest_message_at` + `draft_session_id`. File as `[BE-BLOCKER-07a] Inbound-message poll endpoint` (a sibling to `[BE-BLOCKER-07]` for the draft-progress endpoint filed in AGT-WLB-001). |

---

## Purpose

The agent's phone is bound. The tour is now waiting for them to send actual listing content — photos, a voice note, a location pin — as their first real content message on the bound WhatsApp line. This screen is a **calm, confident waiting state** with a signal-lamp pulse conveying "we're listening" and a lightweight tip card explaining what to send.

Success = an inbound content message arrives → poll returns `latest_message_at IS NOT NULL` → screen navigates to AGT-WLB-004 with the `draft_session_id` in route state.

---

## Layout (deltas from -001)

Everything from -001 stays: `<TourFrame>` with dot 4 active (dots 1-3 completed), close-X, screen title.

**Body replaces `<BenefitList>` with a waiting composition:**

- **`<StepHero>` (neutral):**
  - Glyph: `<ChannelMark channel="whatsapp">` in a raised circle chip (unchanged from anchor).
  - Title: "Listening on WhatsApp"
  - Body: "Send photos, a voice note, and a pin to any listing you want to draft first. I'll turn them into a draft you can review."
- **Live signal-lamp badge** — small chip below the hero, centered: teal `--lc-accent-bold` dot 12×12 (with `--lc-accent-bold-edge` outline) pulsing at `var(--lc-duration-slow)` + label `"Live — connected to +9714XXXXXXX"` via `<Numeric>` for the phone number. `var(--lc-type-body-sm)` + `--lc-text-muted`.
- **Bound-phone confirmation line** — a small `--lc-surface-sunken` card with `Check` icon + "Bound to {phone_e164_masked}" — reassurance that the previous step succeeded. Masked: `+971 5X XXX XX67` (show country code + last 2 digits only, per privacy guidance).
- **"What to send" tip card** — `--lc-surface-raised` + `--lc-elevation-sm` + `var(--lc-radius-lg)`. Renders a 3-item checklist with lucide icons:
  - `Camera` — "3-8 photos of the unit — wide shots, kitchen, bathroom, view."
  - `Mic` — "A voice note with the address, beds, baths, and price."
  - `MapPin` — "A location pin so we can auto-fill the neighborhood."
- **Timeout affordance** (revealed after 60s waiting with no message): a small muted line "Not seeing a reply? [Send WC-LIST to check your bindings]" — links to a Dialog explaining the WC-LIST command from PR #50 §2.7.

**Sticky mobile bottom bar:**
- No primary CTA — this is a passive waiting state. Bar contains only:
  - Ghost "Change WhatsApp number" — opens a Dialog with instructions to send `WC-UNBIND` from the current phone, then restart the tour.
  - Ghost "I'll come back later" — safe-exit; same as close-X.

**Desktop layout:** single column, max-width `720px`, centered. Illustration on -001 desktop is replaced with the same waiting composition — no split. Keeps focus on the "one thing" happening (the wait).

**RTL:** full mirror. Signal-lamp badge stays centered.

---

## Explicit copy (deltas only)

| Slot | Copy |
|---|---|
| Hero title | Listening on WhatsApp |
| Hero body | Send photos, a voice note, and a pin to any listing you want to draft first. I'll turn them into a draft you can review. |
| Live-lamp label | Live — connected to {phone_e164_masked} |
| Bound-phone card | Bound to {phone_e164_masked} |
| Tip card overline | What to send |
| Tip 1 | 3-8 photos of the unit — wide shots, kitchen, bathroom, view. |
| Tip 2 | A voice note with the address, beds, baths, and price. |
| Tip 3 | A location pin so we can auto-fill the neighborhood. |
| Timeout hint (after 60s) | Not seeing a reply? [Send WC-LIST to check your bindings] |
| WC-LIST dialog title | Check your WhatsApp bindings |
| WC-LIST dialog body | Send `WC-LIST` from your bound phone. WingCaster will reply with all the accounts currently linked to it. |
| WC-LIST dialog close | Got it |
| Ghost — change number | Change WhatsApp number |
| Ghost — leave | I'll come back later |
| Change-number dialog title | Change your WhatsApp number |
| Change-number dialog body | Send `WC-UNBIND` from your current phone. Then come back and restart WhatsApp setup from a new phone. |
| Change-number dialog confirm | Copy WC-UNBIND to clipboard |
| Change-number dialog cancel | Not yet |

---

## Interactions (deltas)

**On mount:**
- Route state carries `{ phone_e164 }` from -002.
- Start polling `GET /api/whatsapp-listings/drafts/latest` (new endpoint per `[BE-BLOCKER-07a]`) OR the extended `binding-status` every 2s. Backoff to 5s after 30s, 10s after 90s. Cap at 24h.
- On `latest_message_at IS NOT NULL`, navigate to AGT-WLB-004 with `{ draft_session_id }` in route state.
- Pause polling when tab is hidden (Visibility API); resume on focus.

**On live-lamp render:**
- Pulse loops at `var(--lc-duration-slow)` (240ms per pulse cycle) using `var(--lc-easing-in-out)`. Halts if `prefers-reduced-motion`; replaced with a static filled dot.

**On 60s timeout:**
- Reveal the timeout hint line + WC-LIST dialog link. Non-blocking — the wait continues.

**On "Change WhatsApp number" tap:**
- Open Dialog. Copy button in the dialog copies literal `WC-UNBIND` to clipboard. Confirm swaps to `Check` + "Copied".
- User handles the physical send from their phone. On next backend poll returning `bound: false`, the screen redirects to AGT-WLB-002 (with a fresh code generated on-arrival).

**On close-X / "I'll come back later":**
- Same safe-exit as -001. Resume banner on AGT-DSH-001.

---

## State variants (deltas)

| Variant | Trigger | Behavior |
|---|---|---|
| **Listening** | Initial mount, poll in-flight, no message | Signal lamp pulses; tip card visible. |
| **Listening — after 60s** | 60s elapsed with no message | Timeout hint revealed below the tip card. |
| **Message-detected** | Poll returns `latest_message_at IS NOT NULL` | Navigate to -004. Cross-fade transition at `var(--lc-duration-base)`. |
| **Poll-error** | 3 consecutive poll failures | Live lamp turns muted; label becomes "Reconnecting…"; polls with 15s intervals. Recovers automatically. |
| **Poll-cap-reached** | 24h elapsed | Screen switches to "It's been a while" state: primary "Get a fresh code" → AGT-WLB-002. |
| **Binding-lost** | Poll returns `bound: false` (rare — server-side deactivation) | Navigate back to -002 with a soft toast: "Your phone was disconnected. Get a fresh code to reconnect." |
| **Offline** | Network unreachable | Live lamp turns muted "Offline"; polls pause; resume on reconnect. |
| **RTL / Dark** | Locale / mode | Full mirror + token swap. Live lamp remains centered. |

---

## Anti-patterns (deltas)

- ❌ Do not add a "Skip and draft manually" CTA. That path exists but belongs to AGT-LST-004 (manual composer) — accessed from settings, not from the tour. Adding it here dilutes the tour's activation intent.
- ❌ Do not display the full phone number on-screen. Mask per privacy guidance.
- ❌ Do not spam the live-lamp motif across the screen. One dot, one label. That's it.
- ❌ Do not use a countdown timer for "expected first message." There's no deadline — the wait is open-ended. The 60s timeout only *reveals a hint*, not a threat.
- ❌ Do not auto-navigate away on tab-blur. The agent is switching to WhatsApp; when they come back, this screen must still be the top of the tour.

---

## Downstream implementation notes (deltas)

- **File:** `web/src/pages/onboarding/WhatsAppWaitingPage.tsx`.
- **Reuses:** `<TourFrame>`, `<StepHero>` (neutral). No `<BenefitList>` or `<WhatsAppHandshakePanel>` on this screen.
- **New primitive:** `<SignalLampBadge>` — small component under `web/src/components/ui/signal-lamp-badge.tsx`. Props: `state: 'listening' | 'reconnecting' | 'offline' | 'live-broadcast'`. Only two consumers ship in this cluster: this screen and AGT-DSH-001's attention card. Guard: an assertion test that limits the component's importers to those two files.
- **Poll hook:** shared with -002's `useBindingStatusPoll` — parameterize the endpoint URL + backoff schedule.
- **Phone masker:** `web/src/lib/phone/mask.ts` — pure function `(e164: string) → string`. Preserves country code + last 2 digits.
- **Test discipline:** unit test the phone masker + signal-lamp motion halt under reduced-motion; integration test the 60s-timeout hint reveal; real-Postgres end-to-end test that stubs an inbound webhook to trigger the -004 navigation.
