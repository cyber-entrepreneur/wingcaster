# Screen Brief — AGT-WLB-004 · Live listing drafting — delta of AGT-WLB-001

**Layer-2 Brief for design AI consumption.** Delta of the AGT-WLB-001 anchor. Inherits the anchor's Broadcast alignment, `<TourFrame>`, `<StepHero>` (neutral emphasis), and `<LiveDraftCanvas>` patterns verbatim.

Wave 4, step 5 of 5-visible + transitions to -005 completion. The "magic moment" — the agent watches AI draft their listing in real time from a WhatsApp message.

---

## 🎨 Broadcast alignment

Same as AGT-WLB-001 anchor. Additional callouts:

- **Emphasis-easing on field-complete check icons** — as declared in the anchor, this is the ONE screen in the WLB family (and one of the very few on the whole product) where `var(--lc-easing-emphasis)` (cubic-bezier(0.34, 1.4, 0.64, 1)) is legal. Used only on the fade-in of the per-field `Check` icon when a field transitions from `streaming` / `thinking` → `complete`. One-shot per field. Respect `prefers-reduced-motion` (skip).
- **Text-streaming caret** — the description field's streaming caret is a `|` character in mono via `<Numeric>` so its width doesn't cause the surrounding text to reflow every keystroke. Blinks at 500ms interval; halts under reduced motion.

---

## Meta

| | |
|---|---|
| Screen ID | AGT-WLB-004 |
| Screen name | Live listing drafting |
| Persona | Agent (mid-tour, message received, AI drafting) |
| Device targets | Mobile 375px (primary), tablet 768px, desktop 1440px |
| Locale | English + Arabic (RTL) |
| Theme | Light + Dark |
| Route | `/onboarding/whatsapp/drafting/:sessionId` (tour step 5 visible; -005 is the completion moment reached without a step change). |
| Current state | MISSING — ships in Wave 4. |
| Workflow role | WF-01 step 5 + entry to WF-04 (draft → publish). |
| Backend prerequisites | ⏳ `[BE-BLOCKER-07]` **Live draft-progress endpoint** — filed in AGT-WLB-001 §Backend contract. This screen's fidelity depends on it. Three viable backends (see -001 §Backend contract for the tradeoff): (1) SSE preferred, (2) polling acceptable v1, (3) determinate-spinner fallback. Screen must degrade gracefully to whichever ships. |

---

## Purpose

The agent's inbound WhatsApp content has been claimed by the intake pipeline. This screen surfaces AI progress AS IT HAPPENS — every field populating feels like the AI reading the agent's mind. On draft-ready, the screen transitions (via cross-fade, NOT navigation — same route) to -005 completion state.

The magic-moment surface. Get this right and the agent's brain wires "WingCaster = magic". Get it wrong and it's just another loading screen.

---

## Layout (deltas from -001)

Everything from -001 stays: `<TourFrame>` with dot 5 active (dots 1-4 completed), close-X, screen title.

**Body replaces `<BenefitList>` with `<LiveDraftCanvas>` (see anchor §5 for full anatomy).** Above the canvas: a compact `<StepHero>` (neutral):
- Glyph: `Sparkles` from lucide-react in a raised circle chip with border. (Not the WhatsApp mark — the content has left WhatsApp and is now in WingCaster.)
- Title (mobile heading-1 / desktop display): "Turning your message into a listing"
- Body: "You'll see each field fill in as I read your photos, voice, and pin. You can review and edit everything on the next screen."

**Below the canvas** — a small `--lc-surface-sunken` panel showing the inbound-message summary as a chat-bubble aesthetic:
- Overline `var(--lc-type-overline)` + `--lc-text-muted`: "Message received {relative-time}"
- Content pills: `<Badge>` chips for each attachment type — e.g. `[7 photos]` `[Voice note · 0:42]` `[Location pin]` — using `<Numeric>` for counts + durations.
- Small "View original message on WhatsApp" ghost link that opens `wa.me/<intl-number>` (returns the agent to the WhatsApp thread if they want to double-check).

**Sticky mobile bottom bar:**
- Primary CTA: `<Button variant="default" size="lg">` full-width — **disabled** while any field is `thinking` or `streaming`. Label swaps by state:
  - While drafting: "Drafting… ({N}/{total} fields)" — the `{N}/{total}` via `<Numeric>`.
  - When all fields complete: "Review & publish →" — enabled. This is the moment the screen transitions to -005 layout via cross-fade + auto-tap-progression (see -005 for the completion visual).
- Above the primary: two ghosts side-by-side (or stacked on narrow):
  - Ghost 1: "Cancel this draft" — opens confirm Dialog. On confirm: `DELETE /api/whatsapp-listings/drafts/:sessionId` (verify endpoint exists at branch time; if not, add to `[BE-BLOCKER-07]`).
  - Ghost 2: "Edit later" — completes the tour immediately without waiting for the draft to finish. Draft stays in `AGT-LST-004` drafts list. Toast: "We'll keep drafting — find it in your Drafts tab."

**Desktop layout:** two-column, 60/40 — `<LiveDraftCanvas>` full-width across BOTH columns (fields need horizontal room to be scannable). Above the canvas: hero on the left column; inbound-message summary panel on the right column.

**RTL:** full mirror. Field labels flip; description streaming direction flips (RTL text-align). The blinking caret stays at the END of the text run (which is the LEFT edge in RTL).

---

## Explicit copy (deltas only)

| Slot | Copy |
|---|---|
| Hero title | Turning your message into a listing |
| Hero body | You'll see each field fill in as I read your photos, voice, and pin. You can review and edit everything on the next screen. |
| Inbound-message overline | Message received {relative-time} |
| Field label — address | Address |
| Field label — bedrooms | Bedrooms |
| Field label — bathrooms | Bathrooms |
| Field label — price | Price |
| Field label — area | Area (sqft) |
| Field label — description | Description |
| Field label — photos | Photos |
| Field state — idle | Waiting for input… |
| Field state — thinking | Thinking… |
| Primary CTA (drafting) | Drafting… ({N}/{total} fields) |
| Primary CTA (complete) | Review & publish → |
| Ghost — cancel | Cancel this draft |
| Ghost — edit later | Edit later |
| Cancel dialog title | Cancel this draft? |
| Cancel dialog body | We'll delete what's been drafted so far. You can send a new WhatsApp message anytime to start over. |
| Cancel dialog confirm | Cancel draft |
| Cancel dialog cancel | Keep drafting |
| Edit-later toast | We'll keep drafting — find it in your Drafts tab. |
| Fallback caption (polling) | Live view is degraded — refreshing every 3s. |
| Fallback caption (determinate) | Drafting your listing… this usually takes 15-30s. |

---

## Interactions (deltas)

**On mount:**
- Route state carries `{ sessionId }` from -003.
- Establish the draft-progress connection per backend availability:
  - **SSE mode:** `new EventSource('/api/whatsapp-listings/drafts/:sessionId/progress')`. Handle events: `field_start`, `field_complete`, `field_stream` (description only, carries `partial_text`), `draft_ready`, `error`.
  - **Polling mode:** `GET /api/whatsapp-listings/drafts/:sessionId/state` every 1s until `draft_ready: true`. Uses the field snapshot in each response to compute delta transitions.
  - **Determinate-spinner mode:** single indeterminate `Loader2` + copy "Drafting your listing… this usually takes 15-30s." No field-by-field canvas. Cross-fades to -005 when the completed draft appears in `GET /drafts/:sessionId`.
- Screen degrades gracefully — the `<LiveDraftCanvas connection>` prop drives the caption line at the bottom.

**On field state change:**
- Field card cross-fades at `var(--lc-duration-base)`. On `complete`, the `Check` icon fades in with `var(--lc-easing-emphasis)` — the one legal use of emphasis easing on this screen (one-shot per field).
- Screen reader announces "Address: 42 Marina Walk, Dubai" as each field completes (NOT during streaming — would spam).

**On draft-ready:**
- Primary CTA enables + label swaps to "Review & publish →".
- Automatic wait of 1200ms (giving the agent's brain time to register the "wow, done"), then screen cross-fades into -005 completion visual on the SAME route. -005 renders the assembled listing preview + a big loud-orange `<StepHero emphasis="success">` band.
- If the agent taps the primary CTA before the 1200ms window, cross-fade immediately.

**On cancel:**
- Open confirm Dialog. On confirm: `DELETE /api/whatsapp-listings/drafts/:sessionId` → toast → navigate back to `/dashboard`. Resume banner drops.

**On edit-later:**
- Immediate toast + navigate to `/listings/drafts`. Draft continues on the backend; agent finds it when it's done.

**On close-X:**
- Same as edit-later semantically. Safe-exit; the backend keeps drafting.

---

## State variants (deltas)

| Variant | Trigger | Behavior |
|---|---|---|
| **Connecting** | Initial mount, connection handshake | All fields in `idle` state. Muted "Connecting…" caption at bottom. |
| **Drafting** | ≥1 field in `thinking` / `streaming` | Live canvas animating. Primary CTA disabled with count label. |
| **Draft-ready** | All fields `complete` | Primary enables; 1200ms delay then cross-fade to -005. |
| **Connection-degraded** | SSE dropped → auto-fallback to polling | Small caption at bottom updates to "Live view is degraded — refreshing every 3s." No user action needed. |
| **Determinate-fallback** | Backend doesn't support streaming at all | Single `Loader2` + timeframe copy; canvas hidden; transitions to -005 on completion. |
| **Draft-error** | Backend emits `error` event OR draft returns with `status: 'failed'` | Full-screen fallback: `AlertOctagon` + "We couldn't finish your draft — {reason}. Send another WhatsApp message to try again." + primary "Back to WhatsApp" + secondary "Contact support". |
| **Cancelling** | Cancel confirm in-flight | Overlay `Loader2` + "Cancelling…"; whole screen `aria-busy`. |
| **Poll-idle** | Message ingested but pipeline hasn't started (rare) | Same as `Connecting` state; timeout at 30s → warning banner "Draft hasn't started — [Contact support]". |
| **Offline** | Network unreachable | Top-of-page banner; SSE / polling paused; resumes on reconnect. Draft continues server-side. |
| **RTL / Dark** | Locale / mode | Full mirror + token swap. Streaming caret stays at text-end. |

---

## Anti-patterns (deltas)

- ❌ Do not fake the streaming when the backend doesn't support it. Better to show the honest determinate spinner than pretend-stream fields on a client-side timer (breaks trust when the agent notices the timing is arbitrary).
- ❌ Do not run the streaming caret at faster than ~40 chars/sec even if the backend can go faster — reading speed caps around 300 wpm. Rushing the caret breaks the "magic" feel.
- ❌ Do not disable the "Edit later" ghost. An agent whose phone rings mid-draft should always have an escape hatch.
- ❌ Do not close SSE / stop polling on tab-blur. The draft continues; the screen should catch up on tab-refocus with an instant snapshot of current state.
- ❌ Do not use `variant="destructive"` for "Cancel this draft". Cancelling isn't destruction — it's a routine reset. Use ghost.
- ❌ Do not use the signal-lamp pulse motif on this screen. AGT-WLB-003 already used it for "listening"; here the metaphor is "drafting" not "watching" — no pulse.
- ❌ Do not gate the transition to -005 behind an explicit tap. Auto-progress after the 1200ms delay — the reward should feel earned, not manual.

---

## Downstream implementation notes (deltas)

- **File:** `web/src/pages/onboarding/WhatsAppDraftingPage.tsx`. Hosts BOTH the drafting state AND the -005 completion cross-fade — see AGT-WLB-005 brief for the completion visual.
- **Reuses:** `<TourFrame>`, `<StepHero>` (neutral here, `success` on -005 cross-fade), `<LiveDraftCanvas>` (heavy anchor primitive).
- **New primitive:** `<InboundMessageSummary>` — small `web/src/components/onboarding/whatsapp/InboundMessageSummary.tsx`. Props: `{ received_at, attachments: Array<{type, count?, duration?}>, wa_me_link }`.
- **Streaming hook:** `web/src/hooks/useDraftProgress.ts` — abstracts SSE / polling / determinate-fallback behind one interface returning `{ fields, connection, isReady }`. Detects backend capability via a `HEAD` on the SSE endpoint at mount and falls back gracefully.
- **Test discipline:**
  - Unit: `<LiveDraftCanvas>` renders all four field states + emphasis-easing on complete + reduced-motion halt.
  - Integration: full field-by-field progression from `idle` → `thinking` → `streaming` (description) → `complete` → `draft-ready` cross-fade to -005.
  - Fallback: SSE unavailable → polling; polling unavailable → determinate spinner.
  - Real-Postgres: real inbound webhook + real intake pipeline → real draft appears; the screen catches every state.
  - RTL: verified via `screens.rtl.test.tsx`.
