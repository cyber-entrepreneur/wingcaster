# Screen Brief — AGT-ONB-002 · WhatsApp Intake Tour (aha moment)

**Layer-2 Brief — DELTA screen. References anchor AGT-ONB-001.**

Companion to `SCREEN_MATRIX_AGENT.md` §1 entry `AGT-ONB-002`. Ships in the AGT-ONB PR bundle (Week 4 per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md`). Implements the **aha moment** — the agent binds their personal WhatsApp to WingCaster's shared Business number via PR #50 Model B activation-code flow, then sees WingCaster draft their first listing live.

Upstream: `AGT-ONB-001` when user picks the WhatsApp card.
Downstream: `AGT-ONB-003` (First-listing review) once a draft appears in the pipeline.

---

## 🎨 Broadcast alignment

**Inherits Broadcast callouts A1-A12 from `AGT-ONB-001` (anchor).** This delta adds the following screen-specific callouts:

- **B1 · Activation-code card** — the hero of this screen. Large `<Card>` on `--lc-surface-raised` + `--lc-elevation-md` (one step above default cards for prominence). Radius `--lc-radius-xl` (10px). Interior split top-to-bottom: (i) big activation code, (ii) shared Business number, (iii) countdown + status pill.
- **B2 · Big activation code** — `font: var(--lc-type-display)` mono variant (`--lc-font-mono` @ 32px, 800 weight, tabular-nums). Copy example: `WC-A7K3`. Color `--lc-text-heading`. Renders through `<Numeric>` even though it's alphanumeric — the mono + tabular-nums treatment is what makes it copyable-scannable. A copy-to-clipboard button lives at the top-right of the card (`Copy` icon from lucide, 44×44 tap target).
- **B3 · Shared Business number** — `var(--lc-type-heading-2)` mono. Example: `+971 4 555 0199`. Country flag prefix rendered as a `<ChannelMark channel="whatsapp">` **inside** the same code block for visual bundling (WhatsApp green square, 24×24). Second copy-to-clipboard button.
- **B4 · Countdown + status pill.** `Code expires in 09:42` — updates every second, `var(--lc-type-body-sm)` + `--lc-text-muted`. When binding succeeds, this row is replaced with a status pill: bg `--lc-status-published-bg`, fg `--lc-status-published-fg`, glyph ● `--lc-status-published-dot`, label "Connected · +971 5X XXX ####" (last 4 digits of the agent's WhatsApp number, masked otherwise). When code expires unbound: pill switches to `--lc-status-draft-bg`/`fg`/`dot` + label "Code expired · get a new one".
- **B5 · Deep-link CTA** ("Open WhatsApp with a pre-filled message"). Primary `<Button>` full-width. Fill `--lc-action-primary`. Icon leading: `<ChannelMark channel="whatsapp">` 20px. On tap: opens `https://wa.me/{shared_number_e164}?text={preset}` where `preset` = `"WingCaster {activation_code}"` URL-encoded. On desktop non-tablet: also shows a QR code (`react-qr-code`) below the CTA labeled "Or scan on your phone".
- **B6 · Progress stepper** — the tour has 4 sub-steps rendered as a horizontal stepper below the activation card:
  1. **Get code** (auto-complete on card render — always ✓ by the time the user sees the screen)
  2. **Send code to WingCaster** (auto-complete when `binding-status` returns `bound`)
  3. **Send photos + voice memo** (auto-complete when `whatsapp-listings/drafts` returns ≥ 1 draft in `collecting` or `awaiting_approval` state)
  4. **We draft your listing** (auto-complete when a draft's status flips to `awaiting_approval` — this immediately routes to AGT-ONB-003)
  Stepper item styling: pending `--lc-border` circle + `--lc-text-muted` label; active `--lc-action-primary` ring + `--lc-text-heading` label + pulsing signal-lamp teal dot (`--lc-accent-bold` 8px inside a `--lc-focus-ring-contrast` boundary — Broadcast's signal-lamp motif is legal here because this IS the "listing about to go live" moment); complete ✓ glyph in `--lc-status-published-fg`.
- **B7 · Live poll indicator.** Below the stepper: a compact "Listening for your message…" line with a subtle 3-dot animation (each dot pulses at `--lc-duration-slow` staggered by 100ms). Respects `prefers-reduced-motion` (static three dots).
- **B8 · Progress marker** (anchor A9) shows `Step 2 of 4 · WhatsApp intake`.
- **B9 · Escape hatch** — "Prefer to type it yourself? Add manually →" — `<Button variant="link">` at the bottom, `--lc-text-brand` ink. Routes to `/listings/new` (AGT-LST-004) and updates `onboarding_state.path` to `manual`.

All other tokens (colors, radii, spacing, focus rings, motion) inherit anchor A1-A12.

---

## Meta

| | |
|---|---|
| Screen ID | AGT-ONB-002 |
| Screen name | Onboarding — WhatsApp Intake Tour |
| Persona | Agent, `onboarding_state.step = 'whatsapp_intake_pending'` |
| Device targets | Mobile 375px (primary), tablet 768px, desktop 1440px |
| Locale | English + Arabic (RTL) |
| Theme | Light + Dark |
| Route | `/onboarding/whatsapp` |
| Current state | MISSING. |
| Workflow role | Bridges WF-01 (Onboarding) → WF-03 (WhatsApp intake → draft generation). |
| Backend prerequisites | ✅ PR #50 activation-code + binding APIs · ✅ `/api/agent/whatsapp-listings/drafts` polling · ⏳ `agent_onboarding_state` (anchor's `[BE-NEW-06]`) |

---

## Purpose

The agent has committed to the WhatsApp path. This screen hands them the two pieces of information they need — an activation code and WingCaster's shared Business number — then waits, live, for them to send a message that binds their phone number to their WingCaster account (PR #50 Model B). Once bound, it waits for their first listing message (photos + voice memo). Once WingCaster's pipeline emits a draft, this screen routes to AGT-ONB-003.

The screen's job is to **make the wait not feel like a wait.** Live progress, a countdown, a clear escape hatch.

---

## Design goals

1. **Zero-friction handoff to WhatsApp.** One tap opens WhatsApp with the code pre-filled — the agent's job is just Send.
2. **Live progress, not a static instruction sheet.** The four-step stepper animates in real time; the agent watches themselves succeed.
3. **The activation code is copyable AND scannable.** Big, mono, tabular-nums. QR on desktop so agents holding their phone can scan.
4. **Countdown honesty.** Codes expire (default 15 min per PR #50). Show the countdown; don't hide the expiry until it's too late.
5. **Escape hatch never disappears.** If the agent's WhatsApp is broken / not installed / they change their mind, the manual path is one link away — and they don't lose progress.
6. **The signal-lamp is legal here.** The "waiting for your first message" state is exactly the Broadcast moment the signal-lamp motif is reserved for. Use it once, sparingly.

---

## Layout

### Mobile 375px (primary)

Top-to-bottom in a single scroll:
- Top bar: progress marker `Step 2 of 4 · WhatsApp intake` (left) + language pill + `<ColorModeToggle>` (right).
- Sub-heading `var(--lc-type-heading-1)`: "Bind your WhatsApp to WingCaster."
- Sub-line `var(--lc-type-body-lg)` + `--lc-text-secondary`: "Send the code below to our WhatsApp. Then send photos + a voice memo of the property."
- **Activation-code card (B1-B4).**
- **Deep-link CTA (B5)** — full-width button below the card. No QR on mobile (they're already on the phone).
- **Stepper (B6)** — 4 horizontal steps, compact icons + short labels stacked vertically per step on 375px.
- **Live poll indicator (B7)** — below stepper.
- **Escape hatch (B9)** — bottom.

### Desktop / tablet ≥768px

Two-column split, 60/40:
- **Left column (60%)** — activation-code card (B1-B4) + CTA (B5) + stepper (B6, horizontal) + poll indicator (B7) + escape hatch (B9).
- **Right column (40%)** — instructional illustration OR a 3-frame walkthrough (Save contact → Send code → Send listing) rendered as three stacked mini-cards with `--lc-elevation-sm`. Below: QR code (`react-qr-code`) 200×200 centered with caption "Or scan on your phone → opens WhatsApp with the code."

---

## Explicit copy (English — Arabic mirror pending)

| Slot | Copy |
|---|---|
| Progress marker | Step 2 of 4 · WhatsApp intake |
| H1 | Bind your WhatsApp to WingCaster. |
| Sub | Send the code below to our WhatsApp. Then send photos + a voice memo of the property. |
| Activation-code label | Your activation code |
| Activation-code copy tooltip | Copy code |
| Shared-number label | WingCaster's WhatsApp |
| Shared-number copy tooltip | Copy number |
| Countdown | Code expires in {mm:ss} |
| Countdown expired | This code expired. Get a new one → |
| Status pill — pending | Waiting for your first message… |
| Status pill — bound | Connected · {maskedPhone} |
| Status pill — expired | Code expired · get a new one |
| Get-new-code CTA | Get a new code |
| Primary CTA (B5) | Open WhatsApp with the code |
| QR caption (desktop) | Or scan on your phone → opens WhatsApp with the code. |
| Stepper 1 | Get code |
| Stepper 2 | Send code to WingCaster |
| Stepper 3 | Send photos + voice memo |
| Stepper 4 | We draft your listing |
| Poll indicator | Listening for your message… |
| Right-column card 1 | Save +971 4 555 0199 as "WingCaster" in your contacts. |
| Right-column card 2 | Send us the code above. |
| Right-column card 3 | Send photos and a voice note about the property. |
| Escape hatch (B9) | Prefer to type it yourself? Add manually → |
| Error — code fetch failed | We couldn't generate a code. Try again? |
| Error — poll failed | We're having trouble checking status. Refreshing in {n}s… |
| Offline banner | You're offline. We can't check for new messages until you reconnect. |

---

## Component palette

| Element | Primitive |
|---|---|
| Activation-code card | `<ActivationCodeBanner>` (shared component — see AGT-ONB-001 §Shared components) |
| Code + number blocks | `<Numeric>` primitive with mono + tabular-nums |
| Copy buttons | `<Button variant="ghost" size="icon">` + `Copy` from lucide + `<Sonner>` toast on success |
| Countdown | Custom `<Countdown expires_at />` — updates every 1s |
| Status pill | `<Badge>` with Broadcast status tokens |
| Primary CTA | `<Button variant="default" size="lg">` |
| QR code | `react-qr-code` (already installed for AGT-LST-007) |
| Stepper | Custom `<OnboardingStepper steps={[…]} activeIndex={n} />` — reused in AGT-ONB-003 |
| Signal-lamp dot | Custom `<SignalLampDot>` — Broadcast-legal ONLY in the active stepper item on this screen |
| Poll indicator | Custom `<LivePollIndicator />` — 3 dots pulsing staggered; freezes on `prefers-reduced-motion` |
| Escape hatch | `<Button variant="link">` |
| Offline banner | `<OfflineBanner>` (shared) |

---

## Sample content (for v0 / mockup)

Show mobile 375px layout with:
- Progress: "Step 2 of 4 · WhatsApp intake"
- Activation code: `WC-A7K3` (big mono)
- Shared number: `+971 4 555 0199` with WhatsApp channel-mark leading
- Countdown: "Code expires in 12:34"
- CTA: "Open WhatsApp with the code" (full-width, primary)
- Stepper state: Step 1 complete (✓), Step 2 active (pulsing signal-lamp), Steps 3+4 pending
- Poll indicator: "Listening for your message…" with animated dots
- Escape hatch: visible at bottom

Also show desktop layout with QR code visible in the right column.

Also show the **bound state** — after user sends the code:
- Status pill replaces countdown: "Connected · +971 5X XXX 4321" (Broadcast published green)
- Stepper: Steps 1 + 2 complete (✓), Step 3 active (pulsing), Step 4 pending
- Poll indicator copy changes: "Waiting for your first listing message…"

---

## Interactions

**On page load:**
- Read `useOnboardingState()`. If `step !== 'whatsapp_intake_pending'`, redirect appropriately (welcome / draft-review / dashboard).
- POST `/api/auth/whatsapp/activation-code` → renders code + number + expiry.
- Start two polls:
  - **Binding poll:** `GET /api/auth/whatsapp/binding-status` every 3s until `bound: true` OR code expires. On bound, advance stepper to step 3.
  - **Draft poll:** `GET /api/agent/whatsapp-listings/drafts` every 5s (only starts once bound). When first draft with `status IN ('collecting', 'awaiting_approval')` appears, advance stepper. When a draft flips to `awaiting_approval`, immediately PATCH `onboarding_state → 'draft_review'` and navigate to `/onboarding/first-listing/:draftId` (AGT-ONB-003).

**On copy button click:**
- Copy to clipboard via `navigator.clipboard.writeText()`.
- Show toast: "Copied to clipboard." Auto-dismiss 2s.
- Announce via `aria-live="polite"`.

**On CTA click:**
- Open `https://wa.me/{shared_number_e164}?text=WingCaster%20{activation_code}` in a new tab.
- On mobile Capacitor build: use `wa.me` URI too — the OS routes to the WhatsApp app.
- Do NOT close/replace this tab — the user comes back to watch progress.

**On countdown reaching 0:**
- Countdown row swaps to expired pill + "Get a new code" CTA.
- Clicking "Get a new code" re-POSTs the activation-code endpoint and resets the countdown.

**On escape hatch click:**
- PATCH `onboarding_state` with `{ step: 'manual_wizard', path: 'manual' }`.
- Navigate to `/listings/new` (AGT-LST-004).

**On binding success:**
- Signal-lamp dot pulses on the active stepper item for `var(--lc-duration-slow)` × 3, then settles into a static ✓.
- Toast: "WhatsApp connected. Now send us photos and a voice memo about the property."

**On offline:**
- Banner appears. Polls pause. Copy buttons stay functional (clipboard is local).

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Initial** | Screen mounted, code fetched | Activation card shown, stepper at step 2 active. Poll running. |
| **Bound** | `binding-status` returns bound | Status pill replaces countdown. Stepper advances to step 3. Copy changes to "Now send photos + voice memo…". |
| **Draft appeared** | `drafts` returns ≥ 1 in `collecting` | Stepper advances to step 4 (active). Copy: "We're drafting your listing… almost there." |
| **Draft ready** | `drafts` returns ≥ 1 in `awaiting_approval` | PATCH state + redirect to AGT-ONB-003 immediately (no user tap needed). |
| **Code expired** | Countdown reached 0, still unbound | Expired pill + "Get a new code" CTA. Polls paused until a new code is issued. |
| **Bound but no draft after 5 min** | Binding OK, drafts empty for 5+ min | Add a soft nudge card below the poll indicator: "Still no message? Make sure you saved the number correctly, and send a photo to start." Do NOT auto-time-out the screen — some agents are slow. |
| **Loading — code fetch** | POST in flight | Skeleton activation card. |
| **Error — code fetch failed** | POST 500 | Destructive toast + retry button in place of the code. |
| **Error — poll failed** | GET 500 | Silent retry with exponential backoff (3s → 6s → 12s, max 30s). After 3 failures show a soft error banner with a manual retry. |
| **Offline** | Network unreachable | Banner. Polls paused. Auto-resume on reconnect. |
| **RTL Arabic** | Locale = ar | Layout mirrors. Activation code + shared number stay LTR (numeric ID / phone number). WhatsApp glyph stays LTR. |
| **Dark mode** | prefers-color-scheme dark | Tokens swap automatically. Signal-lamp dot polarity is legal on the dark surface (teal on cobalt). |

---

## Accessibility

- Activation code and shared number in `<code>` elements with `aria-label` explaining what each is ("Your WingCaster activation code, W C dash A 7 K 3").
- Copy buttons have `aria-label` and announce success via `aria-live`.
- Countdown updates announced only every 60s (not every second) via `aria-live="polite"` to avoid screen-reader spam.
- Stepper items have `role="listitem"` inside a `role="list"`; active step has `aria-current="step"`.
- Signal-lamp respects `prefers-reduced-motion` (no pulse; solid dot).
- QR code has `alt` describing what it does (never just "QR").
- Escape hatch is a real link with focus ring — not a hidden safety net.
- Tap targets ≥ 44×44 including the copy buttons.

---

## Anti-patterns

- ❌ Do NOT auto-redirect if the code expires — the user is looking at this screen; let them consciously get a new code.
- ❌ Do NOT hide the escape hatch even briefly. Some agents will bail after 30s.
- ❌ Do NOT poll faster than 3s (binding) or 5s (drafts). WhatsApp inbound latency is measured in seconds, not milliseconds — faster polls just cost.
- ❌ Do NOT show the signal-lamp on more than the currently active stepper item. Broadcast rule: this motif appears once per screen at most.
- ❌ Do NOT put the activation code in the URL, `document.title`, or the `text` of the toast — someone screen-sharing must be safe.
- ❌ Do NOT show a "%complete" progress bar. Stepper is more honest — the wait time is unbounded.
- ❌ Do NOT use `MessageCircle` for WhatsApp; use the official `<ChannelMark channel="whatsapp">`.

---

## Backend contract

Reuses existing PR #50 endpoints (see anchor §Backend contract). Specifically:

**Get / regenerate code:**
```
POST /api/auth/whatsapp/activation-code
  auth: session
  → 200 { display_code: "WC-A7K3", shared_number_e164: "+9714555019", expires_at: "…" }
```

**Poll binding status:**
```
GET /api/auth/whatsapp/binding-status
  auth: session
  → 200 { bound: true|false, phone_e164?: "+971…", bound_at?: "…" }
```

**Poll for drafts:**
```
GET /api/agent/whatsapp-listings/drafts
  auth: session
  → 200 [{ id, status: 'collecting'|'awaiting_approval'|'published'|'discarded', created_at, ... }, ...]
```

**State transition** (on draft-ready or escape-hatch):
```
PATCH /api/user/onboarding-state
  body: { step: 'draft_review' | 'manual_wizard', path: 'whatsapp' | 'manual' }
```

**Backend prerequisites (verify before ship):**
1. ✅ Activation-code endpoint returns `display_code` — verified in `backend/src/modules/whatsapp-listings/binding/routes.js:16-27`.
2. ✅ Binding-status endpoint exists — verified in `.../routes.js:29-35`.
3. ✅ Drafts endpoint returns status — verified in `.../interface/agent-routes.js:10-18`.
4. ⏳ `agent_onboarding_state` write endpoint (anchor's `[BE-NEW-06]`).

**Gap noted:** the binding-status endpoint doesn't currently return `bound_at` — filed as `[BE-NICE-02]` (v1.1 nicety, not blocking). Client can synthesize from the first bound-true poll if needed.

---

## Downstream implementation

- **New route:** `web/src/pages/onboarding/WhatsAppTourPage.tsx`.
- **Shared component created here (reused elsewhere):** `<ActivationCodeBanner>` — put in `web/src/components/onboarding/`, also imported by future AGT-SET-004 (settings → re-bind WhatsApp).
- **Shared component created here (reused in -003):** `<OnboardingStepper>` — 4-item stepper primitive.
- **Polls:** use SWR with `refreshInterval` OR `useEffect` + `setInterval`. Both polls MUST clear on unmount and pause on offline.
- **Analytics:** fire `onboarding.whatsapp_code_generated`, `onboarding.whatsapp_bound`, `onboarding.first_draft_appeared` events for the funnel — same schema as existing PostHog events in `web/src/lib/analytics.ts`.
- **Test discipline:** mock `/api/auth/whatsapp/activation-code` + `/binding-status` + `/drafts` and exercise each state variant. Real-Postgres test spanning welcome → -002 bind → mock inbound message → -003 render.

---

## Handoff to v0

Framing prompt to paste before the brief:

```
I'm designing screen 2 of 5 in the WingCaster agent onboarding family
(AGT-ONB-002). Anchor is AGT-ONB-001 which established the visual language
(--lc-* tokens, Broadcast alignment callouts A1-A12). This screen implements
the "aha moment" — the agent binds their WhatsApp to WingCaster's shared
Business number using an activation code (PR #50 Model B).

First pass: render the MOBILE 375px layout in the "bound, waiting for
first message" state — activation code WC-A7K3 shown, WingCaster number
+971 4 555 0199 shown with WhatsApp channel-mark, Broadcast published
green "Connected · +971 5X XXX 4321" status pill in place of the countdown,
4-step stepper with steps 1+2 complete (✓) and step 3 active (pulsing
teal signal-lamp), poll indicator "Waiting for your first listing message…",
escape hatch "Prefer to type it yourself? Add manually →" visible at bottom.

LTR English light mode only for this pass — I'll ask for the initial
(unbound) state, the code-expired state, desktop with QR, RTL Arabic,
and dark mode as follow-ups.

Follow the copy table exactly. Do NOT use MessageCircle for WhatsApp —
use the official WhatsApp SVG in <ChannelMark channel="whatsapp">.

DESIGN BRIEF FOLLOWS:
```

Iterations:
1. Initial state (unbound, countdown running, step 2 active).
2. Code-expired state.
3. Desktop 1440px with QR + right-column 3-frame walkthrough.
4. RTL Arabic + dark mode.

---

## Definition of done

- [ ] All 4 v0 iterations produced + screenshots + JSX exports committed.
- [ ] `<ActivationCodeBanner>` + `<OnboardingStepper>` shared components extracted per anchor §Shared components.
- [ ] Poll logic covered by unit + integration tests with mocked endpoints.
- [ ] `no-raw-hex.test.ts` + `screens.rtl.test.tsx` green.
- [ ] Broadcast signal-lamp motif appears ONLY on the active stepper item — enforced by a component-level test.
