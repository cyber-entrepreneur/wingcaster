# Screen Brief — AGT-WLB-001 · Connect WhatsApp intake — ANCHOR for AGT-WLB family

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

Companion to `SCREEN_MATRIX_AGENT.md` §23 (AGT-WLB — re-scoped per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` Rev 9 §5 row 22 to mean the **WhatsApp intake tour family**, NOT the read-mostly white-label-site view historically documented under that ID; that older AGT-WLB-001 scope is retired). Wave 4 anchor bundled with the AGT-ONB cluster. Rides on top of the WhatsApp intake backend that landed in PR #50 (shared-number pool + activation-code binding, Model B).

**ANCHOR NOTICE.** This brief is the pattern anchor for the entire AGT-WLB family (WhatsApp intake tour: -002 activation code, -003 first-message waiting, -004 live drafting, -005 listing ready). AGT-WLB-002/003/004/005 briefs inherit the five reusable Broadcast patterns defined below and spell out only per-screen deltas:

1. **`<TourFrame>`** — 5-step progress rail + safe-exit menu that wraps every tour screen. §Reusable WLB-family patterns.
2. **`<StepHero>`** — glyph + title + one-line body header for the step. Reuses `<StatusHero>` semantics from AGT-REC-004 but tuned for guidance (not outcome). §Reusable WLB-family patterns.
3. **`<BenefitList>`** — 3-line iconified value-prop stack; only rendered on step 1 (this screen). §Reusable WLB-family patterns.
4. **`<WhatsAppHandshakePanel>`** — the code + shared-number display block reused by -002 and any settings-based re-issue flow. §Reusable WLB-family patterns.
5. **`<LiveDraftCanvas>`** — the streaming-field composition used on -004 to surface AI drafting progress. §Reusable WLB-family patterns.

---

## 🎨 Broadcast alignment

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`.** All color / font / spacing / motion / radii / elevation references below are governed by that reference. Never introduce raw hex, never introduce a `--lc-orange-*` primitive alias, never use a Tailwind palette class that isn't already remapped to a Broadcast semantic in `web/tailwind.config.js`.

**Screen-specific Broadcast callouts:**

- **Tour frame chrome** — top thin bar `--lc-surface-raised` + bottom-border `--lc-border`. Progress dots sit in the top bar, 5 dots × 8×8, gap `var(--lc-space-xs)`, active dot `--lc-action-primary`, completed dots `--lc-accent-bold` with `--lc-accent-bold-edge` outline, pending dots `--lc-border-strong` open ring. Close (X) affordance top-right, tap 44×44, ghost variant.
- **Step hero band** — full-bleed on mobile, edge-to-edge inside container on desktop. Background `--lc-surface-sunken`, no color emotion (this is guidance not outcome — reserve the loud-orange hero for AGT-WLB-005 completion moment). Glyph 32×32 desktop / 28×28 mobile, `--lc-text-brand` for the WhatsApp channel icon (paired with the OFFICIAL WhatsApp channel mark from `<ChannelMark channel="whatsapp">`, 24×24, NEVER Lucide's generic message-circle).
- **Hero title** — `var(--lc-type-display)` (Archivo 800 32/38) desktop, `var(--lc-type-heading-1)` (26/32) mobile. Tracking `var(--lc-tracking-display)`.
- **Hero body one-liner** — `var(--lc-type-body-lg)` (16/24) with `--lc-text-secondary`. Max-width 52ch for scan comfort.
- **BenefitList** — vertical stack, 3 items, each row is: icon 24×24 in a `--lc-accent-bold` circle chip (`--lc-accent-bold-edge` boundary — accent bold ALWAYS needs a boundary per Broadcast reference) + label `var(--lc-type-body)` weight 600 + supporting sub-line `var(--lc-type-body-sm)` with `--lc-text-muted`. Gap between rows `var(--lc-space-lg)`. Card wrapper `--lc-surface-raised` + `--lc-elevation-sm` + `var(--lc-radius-lg)` (7px) + padding `var(--lc-space-xl)` all sides.
- **Primary CTA "Set up WhatsApp intake"** — `<Button variant="default" size="lg">` full-width on mobile, right-aligned max-width 360px on desktop. Fill `var(--lc-action-primary)`, hover DARKER to `var(--lc-action-primary-hover)`. Icon-leading with `<ChannelMark channel="whatsapp" size="sm">` 20×20 inside the button on the label's inline-start.
- **Secondary "Not now, remind me later" affordance** — `<Button variant="ghost">` with `--lc-text-muted` label. Never `variant="destructive"` — deferring is not an error.
- **Trust footer** — one line `var(--lc-type-caption)` + `--lc-text-muted`: "You'll share the same WingCaster number as other agents. Your listings stay yours."
- **Focus rings + 44px tap floor** — automatic via base CSS. Do not override.
- **Motion** — hero glyph enters with a 180ms `var(--lc-duration-base)` + `var(--lc-easing-out)` fade+lift (`translateY(4px) → 0`). Benefit rows stagger in at 60ms intervals, same duration/easing. Respect `prefers-reduced-motion`: skip stagger.

---

## Meta

| | |
|---|---|
| Screen ID | AGT-WLB-001 |
| Screen name | Connect WhatsApp intake |
| Persona | Agent (post-signup, first-listing not yet drafted OR settings re-entry point) |
| Device targets | Mobile 375px (primary — this is where new agents live), tablet 768px, desktop 1440px |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark, respect `prefers-color-scheme` |
| Route | Primary: `/onboarding/whatsapp` (step 2 of AGT-ONB tour). Standalone entry: `/settings/channels/whatsapp/connect` (deep-linkable from AGT-SET-002 channels list). |
| Current state | MISSING — must ship in Wave 4 (Week 4 cluster) bundled with AGT-ONB per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` §6 Week 4. |
| Workflow role | WF-01 (Onboarding) step 2 initiator. |
| Backend prerequisites | ✅ `POST /api/auth/whatsapp/activation-code` (PR #50 §2.5) — generates the code + returns shared-number E.164 + expires_at. ✅ `GET /api/auth/whatsapp/binding-status` (PR #50 §2.5) — poll target for -003. ✅ Shared-number pool floor of 3 numbers (PR #50 §2.1 CFG `WHATSAPP_INTAKE_SHARED_NUMBERS`). ⏳ **No SSE/WebSocket endpoint exists** for live draft-field streaming — see §Backend contract §Draft-progress endpoint. Blocker `[BE-BLOCKER-07]`. |

---

## Purpose

The Agent has just finished SHR-AUT-006 (signup) and landed in the AGT-ONB tour. Step 1 (AGT-ONB-001 welcome) has introduced WingCaster in one screen. This screen — step 2 of the tour and the anchor of the AGT-WLB family — is where the tour pivots from marketing prose to real activation: **it invites the agent to bind their phone to WingCaster's shared WhatsApp intake number**.

Tapping the primary CTA fires `POST /api/auth/whatsapp/activation-code` and transitions to AGT-WLB-002 (the code + number display). Deferring lands the agent on AGT-DSH-001 with a persistent inbox banner nudging them back to `/settings/channels/whatsapp/connect`.

**The "aha moment"** — send photos + voice + a pin to a WhatsApp number and get a listing draft back — starts here. Every design choice on this screen exists to make the agent WANT to hit the primary CTA, not because they were pushed but because the value is legible in 5 seconds.

---

## Design goals

1. **Value first, mechanic second.** The three benefits (drafting speed, voice + photo + pin fluency, keeps working when you're driving) sell the outcome; the "how it works" (shared number + code) is deferred to -002. This screen is not a technical explainer.
2. **The WhatsApp brand mark carries the intuition.** Real-estate agents in MENA already run their day on WhatsApp — putting the official green channel mark on the primary CTA is a wordless "yes, it's the app you already use."
3. **Deferring is a first-class option, not a hidden one.** New agents who aren't ready to activate WhatsApp shouldn't feel trapped in the tour. "Not now, remind me later" is prominent enough to click, unobtrusive enough to not distract.
4. **The tour frame doesn't nag.** 5 dots at the top show progress without a percentage bar. Close-X exits the tour cleanly — never a modal-confirm before letting an agent out.
5. **RTL first-class.** Full mirror; benefit-row icon on the right in RTL; WhatsApp mark on the CTA respects RTL button-icon-order.
6. **Anchor discipline.** The five reusable patterns (tour frame, step hero, benefit list, handshake panel, live-draft canvas) are lifted verbatim by -002/003/004/005. Any change to those patterns lands here first.

---

## Layout

### Mobile 375px (primary)

Single scrolling column, no chrome distractions:

1. **`<TourFrame>` top bar** — 48px tall including safe area. Close (X) left in RTL / right in LTR at 44×44 tap. Progress dots centered (5 dots, dot 2 active, dot 1 completed). Screen title "Set up WhatsApp intake" centered under progress dots at `var(--lc-type-caption)` + `--lc-text-muted`.
2. **`<StepHero>` band** — full-bleed, ~200px tall on mobile. Contents (stacked, centered):
   - WhatsApp channel mark 48×48 in a `--lc-surface-raised` circle chip with `--lc-border` outline.
   - Title: "Draft listings by chatting to WingCaster on WhatsApp"
   - Sub: "Send photos, a voice note, and a location pin. We'll turn them into a listing you can review and publish."
3. **`<BenefitList>` card** — `var(--lc-space-md)` gutter below hero. Three rows:
   - **Icon `Zap`** — "**Drafts in under 60 seconds** — from voice note to filled fields."
   - **Icon `Mic`** — "**Voice, photos, and pin work together** — no forms while you're showing a unit."
   - **Icon `Car`** — "**Built for the road** — reply on WhatsApp the same way you already do."
4. **Primary CTA** — full-width, sticky bottom bar `var(--lc-surface-raised)` + top-border `--lc-border` + safe-area padding. Above the primary sits the ghost "Not now, remind me later" affordance as a text link at `var(--lc-type-body-sm)` centered.
5. **Trust footer** — one line, `var(--lc-type-caption)` muted, centered above the sticky bar.

### Tablet 768px & Desktop 1440px

Two-column layout, 60 / 40 split, max-width `1080px` centered, min-height `640px`:

- **Left column (60%):** step hero (glyph + title + sub) top-aligned + benefit list below + primary CTA right-aligned + ghost affordance left-aligned + trust footer full-width at the bottom.
- **Right column (40%):** illustrative panel — a 3-frame vertical mock showing:
  - Frame 1: WhatsApp chat bubble from agent — a voice note waveform + 3 photo thumbnails + a pin.
  - Frame 2: `Loader2` icon + "WingCaster is drafting…"
  - Frame 3: A listing card preview (address, beds, baths, price) with a green "Ready to publish" chip.
  Static illustration — no animation, no Lottie. Card `--lc-surface-raised` + `--lc-elevation-sm` + `var(--lc-radius-lg)`.

### RTL

Full mirror. Progress dots stay left-to-right chronologically (dots don't mirror because they represent sequence). Close-X flips to the LEFT. WhatsApp mark on the CTA precedes the label in reading order (i.e. sits on the RIGHT of the label in RTL). Illustration panel mirrors so the chat bubble points into the correct direction.

---

## Reusable WLB-family patterns (anchor definitions — WLB-002/003/004/005 inherit)

**These five components live under `web/src/components/onboarding/whatsapp/` and are shared across every AGT-WLB screen. Any change to them lands here first, in this brief. Downstream WLB briefs reference this section by name.**

### 1. `<TourFrame>` — tour chrome

**Purpose:** the single wrapper that gives every tour step consistent progress + safe-exit affordances. Wraps every AGT-WLB screen and any future AGT-ONB tour steps.

**Props:**
```ts
type TourFrameProps = {
  step: 1 | 2 | 3 | 4 | 5;
  totalSteps: 5;
  title: string;
  onExit: () => void;            // navigates to fallback route with a persistent "resume tour" banner
  children: React.ReactNode;
};
```

**Anatomy:** thin top bar (`--lc-surface-raised` + bottom-border `--lc-border`, 48px + safe-area), progress-dot row centered, screen title beneath, X close button positioned per LTR/RTL rules. Body content renders as a full-height scrolling region below. No sticky footer chrome — sticky CTAs are the child screen's responsibility (kept out of TourFrame to allow per-screen variance).

**Exit semantics:** X close does NOT open a confirm dialog. It fires `onExit`, which navigates to `/dashboard` and drops a persistent banner ("Resume WhatsApp setup →") that lives until the tour is completed OR the agent explicitly dismisses it in AGT-SET-002.

**A11y:** progress rendered as `<ol role="progressbar" aria-valuenow={step} aria-valuemax={totalSteps} aria-valuetext="Step 2 of 5: Set up WhatsApp intake">`. Close button `aria-label="Exit setup — you can resume from settings"`.

### 2. `<StepHero>` — step header

**Purpose:** the calm guidance header for a tour step. Distinct from AGT-REC-004's `<StatusHero>` (which carries emotional state); StepHero is always neutral.

**Props:**
```ts
type StepHeroProps = {
  glyph: LucideIcon | 'whatsapp-mark' | 'listing-mark';  // 'whatsapp-mark' resolves to <ChannelMark channel="whatsapp">
  title: string;
  body: string;
  emphasis?: 'neutral' | 'success';   // 'success' only on -005 completion (allows loud orange background)
};
```

Typography: title `var(--lc-type-display)` desktop / `var(--lc-type-heading-1)` mobile. Body `var(--lc-type-body-lg)` + `--lc-text-secondary`. Glyph 48×48 desktop / 40×40 mobile in a chip.

**Neutral variant** (this screen, -002, -003, -004): background `--lc-surface-sunken`, glyph in a `--lc-surface-raised` circle chip with `--lc-border` outline.

**Success variant** (-005 only): background `--lc-action-primary` full-bleed, glyph in a white circle chip. This is the ONE screen in the family where the loud-orange band is legal — mirrors AGT-REC-004's approval-hero discipline.

**A11y:** `<section aria-labelledby="step-hero-title">`. Glyph is `aria-hidden="true"` (title carries the meaning).

### 3. `<BenefitList>` — value-prop stack

**Purpose:** the 3-line iconified benefit stack used to sell the WhatsApp intake pattern before the agent commits. Only rendered on AGT-WLB-001; other WLB screens don't need it.

**Props:**
```ts
type Benefit = {
  icon: LucideIcon;
  label: string;                // bold weight-600 line
  sub: string;                  // muted sub-line
};

type BenefitListProps = {
  items: Benefit[];             // exactly 3 — enforced by TypeScript tuple type
};
```

Card wrapper `--lc-surface-raised` + `--lc-elevation-sm` + `var(--lc-radius-lg)` + padding `var(--lc-space-xl)`. Rows gap `var(--lc-space-lg)`. Row icon 24×24 in a `--lc-accent-bold` circle chip with `--lc-accent-bold-edge` 1px outline.

**A11y:** `<ul>` semantics, `<li>` per benefit; icons `aria-hidden="true"`; the label + sub are the accessible text.

### 4. `<WhatsAppHandshakePanel>` — code + shared-number display

**Purpose:** the composite block used on AGT-WLB-002 (primary usage) and any future settings re-issue flow. Displays the activation code, the shared-number-to-send-to, a copy affordance, a tel: link for one-tap-dial-on-mobile, and a QR code that encodes the pre-filled WhatsApp deep-link `https://wa.me/<number>?text=<display_code>` so the agent can scan from a second device.

**Props:**
```ts
type WhatsAppHandshakePanelProps = {
  displayCode: string;           // e.g. "WC-A4K9-JAMIL" — the parseable + human hint form
  sharedNumberE164: string;      // e.g. "+971 4 XXX XXXX" — formatted for display
  expiresAt: string;             // ISO 8601 — drives the countdown pill
  onRegenerate: () => Promise<void>;   // "I didn't get it" → POST /activation-code again
  regenerating?: boolean;
};
```

**Anatomy:** two-column card on desktop (60/40 code + QR), stacked on mobile (code block on top, QR below). Card `--lc-surface-raised` + `--lc-elevation-md` (raised more than a normal card to signal "this is the important block") + `var(--lc-radius-lg)`.

Code block:
- Overline label `var(--lc-type-overline)` + `--lc-text-muted`: "Your activation code"
- Code render: `var(--lc-type-display)` in `var(--lc-font-mono)` with `tabular-nums` — this is a token literal, NOT text — via `<Numeric>`. Selectable (`user-select: all`) so a long-press or triple-click grabs the whole string.
- Copy button inline: `<Button variant="outline" size="sm">` with `<Clipboard>` icon → copies on click, swaps to `<Check>` + "Copied" for 2s, then reverts.
- Overline label: "Send it to this WhatsApp number"
- Shared number render: `var(--lc-type-heading-2)` mono via `<Numeric>`. Wrapped in an `<a href="https://wa.me/<intl-number>?text=<display_code>">` on mobile so one tap opens WhatsApp with the message pre-filled.
- Fallback `tel:` link on desktop.
- Countdown pill: `<Badge variant="outline">` next to the code — `Expires in <mm>:<ss>` with a mono numeric via `<Numeric>`. Live-updates every second.
- "I didn't get it" ghost button below the code: fires `onRegenerate` → shows `Loader2` + "Getting a fresh code…" → new code renders + toast "New code ready — send WC-XXXX-YOU to activate."

QR block:
- 200×200 QR encoding the wa.me deep-link.
- Caption below: "Or scan from another phone."
- Uses `qrcode.react` (already a dep in the wingcaster-website project — verify at branch time and add if missing).

**A11y:** code block is `<section aria-labelledby="handshake-code-label">`. Copy button `aria-label="Copy activation code to clipboard"`. Countdown `aria-live="polite"` and announces once per minute (not once per second — screen-reader spam).

### 5. `<LiveDraftCanvas>` — streaming AI draft surface

**Purpose:** the live-updating field grid on AGT-WLB-004 that shows the AI populating listing fields as the WhatsApp message is processed. THIS is the "magic moment" surface — every field appearing feels like the AI reading the agent's mind.

**Props:**
```ts
type DraftField = {
  key: 'address' | 'bedrooms' | 'bathrooms' | 'price' | 'area_sqft' | 'description' | 'photos';
  label: string;
  state: 'idle' | 'thinking' | 'streaming' | 'complete';
  value?: string | number | string[];   // photos as array of URLs
  streamedText?: string;                 // for description — partial text during streaming
};

type LiveDraftCanvasProps = {
  fields: DraftField[];
  connection: 'sse' | 'ws' | 'polling-fallback';   // surfaces a small caption if fallback (transparency)
  onCancel: () => void;
  onEditLater: () => void;                          // completes the tour without waiting for the draft
};
```

**Anatomy:** 2-column grid on desktop (address + description span full width; others span single columns), single-column stack on mobile. Each field renders in a mini-card with:
- Label overline `var(--lc-type-overline)`.
- Value area with state-driven render:
  - **idle** — muted placeholder `Waiting for input…` in `--lc-text-muted`.
  - **thinking** — 3-dot animated ellipsis `Thinking…` + shimmer skeleton in the value slot.
  - **streaming** (description only) — text streams in character-by-character at ~40 chars/sec with a blinking `|` caret at the end; uses `var(--lc-type-body)` mono for the caret to keep width stable.
  - **complete** — final value rendered via `<Numeric>` for numerics, plain text for the rest. Small green `<Check>` icon top-right of the card, fades in over `var(--lc-duration-fast)`.

**Motion:** field state transitions cross-fade at `var(--lc-duration-base)` (180ms) with `var(--lc-easing-out)`. Complete-check icon uses `var(--lc-easing-emphasis)` (the ONLY legal emphasis-easing on this screen, one-shot per field). Respect `prefers-reduced-motion`: no shimmer, no caret blink, instant state swaps.

**Connection caption:** if `connection === 'polling-fallback'`, tiny caption at the bottom `var(--lc-type-caption)` muted: "Live view is degraded — refreshing every 3s." — never hide the truth from the agent when the backend can't stream.

**A11y:** grid is `<ol aria-live="polite">` — each field-value change announces "Address: 42 Marina Walk, Dubai" as the value completes. NOT during streaming (would spam). `aria-busy` on the whole canvas while any field is in-flight.

---

## Explicit copy (English)

Fill Arabic strings during MENA copywriter pass — mark `[TRANSLATION-PENDING]` in the AR mirror MDX for now.

| Slot | Copy |
|---|---|
| Top bar title | Set up WhatsApp intake |
| Hero title | Draft listings by chatting to WingCaster on WhatsApp |
| Hero sub | Send photos, a voice note, and a location pin. We'll turn them into a listing you can review and publish. |
| Benefit 1 label | Drafts in under 60 seconds |
| Benefit 1 sub | From voice note to filled fields — no forms while you work. |
| Benefit 2 label | Voice, photos, and pin work together |
| Benefit 2 sub | Send everything as you normally would on WhatsApp. |
| Benefit 3 label | Built for the road |
| Benefit 3 sub | Reply on WhatsApp the same way you already do — WingCaster reads it. |
| Primary CTA | Set up WhatsApp intake |
| Secondary ghost | Not now, remind me later |
| Trust footer | You'll share the same WingCaster number as other agents. Your listings stay yours. |
| Exit-tour resume banner (on AGT-DSH-001 after skip) | Resume WhatsApp setup — 60 seconds to your first draft. |

---

## Sample content (for v0 / mockup)

Show the MOBILE 375px layout with:
- **`<TourFrame>` top bar:** X close on the right (LTR), 5 progress dots centered with dot 2 filled orange + dot 1 filled accent-bold-with-edge + dots 3/4/5 muted open rings. Screen title "Set up WhatsApp intake" beneath the dots.
- **`<StepHero>`:** neutral sunken background. WhatsApp official channel mark in a raised white circle chip with border. Title "Draft listings by chatting to WingCaster on WhatsApp" in Archivo 800 heading. Sub-line beneath.
- **`<BenefitList>`:** three rows — Zap / Mic / Car icons in accent-bold circle chips with edge outlines. Labels bold; sub-lines muted.
- **Sticky bottom bar:** ghost "Not now, remind me later" as text link on top; below it primary orange full-width "Set up WhatsApp intake" with the WhatsApp mark 20×20 leading the label.
- **Trust footer:** one muted line above the sticky bar.

Iteration order for v0 after first pass:
1. Same mobile viewport, dark mode (Broadcast tokens swap; orange CTA becomes `#FF7440`).
2. Desktop 1440px LTR — two-column layout with the 3-frame illustration panel on the right.
3. Desktop 1440px dark mode.
4. RTL Arabic at mobile 375px — full mirror; X close on the LEFT; WhatsApp mark on the RIGHT of the CTA label.
5. RTL Arabic at desktop 1440px.
6. State where the tour is being resumed from the persistent banner — same screen but the top-bar title changes to "Resume WhatsApp setup".

Save each output's JSX to `web/src/components/onboarding/whatsapp/ConnectScreen/` + screenshot to `docs/design/mockups/AGT-WLB-001-<state>.png`.

---

## Component palette (shadcn / Radix / lucide-react)

| Element | Primitive |
|---|---|
| Tour frame | Custom (anchor pattern — see §Reusable patterns) — composes progress dots + close button |
| Step hero | Custom (anchor pattern) — reuses `<ChannelMark channel="whatsapp">` for the glyph |
| Benefit list | Custom (anchor pattern) — composes `Card` + custom row layout |
| Primary CTA | `Button variant="default" size="lg"` + leading `<ChannelMark>` |
| Ghost secondary | `Button variant="ghost"` with `--lc-text-muted` label |
| Sticky mobile CTA bar | Custom `<div>` with `position: sticky; bottom: 0` + safe-area padding + `--lc-elevation-md` upward |
| Illustration panel (desktop) | `Card` + 3 nested mini-cards with `--lc-surface-sunken` and `<img>` placeholders |
| Toast (regenerate confirm on -002) | `Sonner` |
| Loading state (page mount) | `Skeleton` mirroring hero + benefit-list card shape |

---

## Interactions

**On mount:**
- No network call. Purely static content. Screen renders instantly.
- `<TourFrame>` progress dots show step 2 active with a subtle enter animation (staggered per dot at 30ms).

**On primary CTA tap:**
- Button shows `Loader2` + "Setting up…" label. Whole screen goes `aria-busy="true"`.
- POST `/api/auth/whatsapp/activation-code` (PR #50 endpoint) → returns `{ display_code, shared_number_e164, expires_at }`.
- On success (200): navigate to `AGT-WLB-002` (`/onboarding/whatsapp/code`) with the response payload passed as router state.
- On failure: destructive toast "Couldn't reach WingCaster. Try again in a moment." + button re-enables.
- On rate-limit (429): informative toast "You just requested a code — check WhatsApp or tap 'I didn't get it' on the next screen." + navigate to -002 anyway (existing active code is still valid per PR #50 partial unique index).

**On secondary ghost tap ("Not now, remind me later"):**
- Fires `POST /api/users/me/onboarding-events` with `{ event: 'whatsapp_setup_deferred' }` (fire-and-forget — do NOT block on this).
- Navigate to `/dashboard` with a persistent banner ("Resume WhatsApp setup →") that lives in the AGT-DSH-001 attention-cards region until either the tour is completed OR the agent dismisses it explicitly from `/settings/channels/whatsapp/connect`.

**On close-X tap:**
- Same as ghost secondary — this is a "safe exit" not a "cancel." Never a confirm dialog.

**On locale change (rare — mid-tour):**
- Re-render with mirrored layout. Preserve any button-loading state.

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Initial** | Route mount | Static render. Primary CTA enabled. |
| **CTA-loading** | Primary tapped, POST in flight | Button `Loader2` + "Setting up…"; screen `aria-busy`. |
| **CTA-error-network** | POST failed (timeout / 5xx) | Destructive toast + button re-enables. |
| **CTA-rate-limited** | POST returned 429 | Info toast + still navigate to -002. |
| **Deferred** | Ghost tapped | Navigate away with banner. |
| **Loading — page** | Route transition in progress | Skeleton mirroring hero + benefit-list shape. |
| **Offline** | Network unreachable | Top-of-page thin banner: "You're offline — connect to set up WhatsApp." Primary CTA disabled. Ghost still tappable (defers locally, syncs on reconnect). |
| **RTL** | Locale = ar | Full mirror per §Layout. |
| **Dark mode** | prefers-color-scheme dark | Broadcast tokens swap automatically. Orange CTA becomes `#FF7440`. |
| **Resume-from-banner** | Route entered via `?resume=1` | Top-bar title changes to "Resume WhatsApp setup". Otherwise identical. |

---

## Accessibility

- `<TourFrame>` progress bar has `role="progressbar"` with numeric + text values.
- Close-X carries a descriptive `aria-label` — never just "close".
- Hero title is the `<h1>` of the page — screen reader reads it first after the progress announcement.
- Benefit list is a semantic `<ul>` with `<li>` per item; icons `aria-hidden`.
- Primary CTA leading icon is `aria-hidden`; the button's accessible name is the visible label.
- Ghost "Not now" affordance MUST NOT read as a destructive action — no destructive semantics.
- Focus rings visible on every interactive element — two-tone Broadcast focus ring, do not override.
- `prefers-reduced-motion` respected: no stagger on benefit-row enter; no hero glyph lift.
- Every tap target ≥ 44×44 CSS pixels including the ghost text link (padding-Y on the ghost variant).
- Color-only signalling avoided — active progress dot is BOTH orange AND larger than the pending dots.

---

## Anti-patterns (do not do these)

- ❌ Do not use a generic Lucide message-circle icon in place of the official WhatsApp channel mark. Use `<ChannelMark channel="whatsapp">`.
- ❌ Do not gate the close-X behind a confirm dialog. Deferring is a safe first-class action.
- ❌ Do not use `variant="destructive"` for the ghost secondary. Deferring is not destruction.
- ❌ Do not run the loud-orange hero band on this screen. Reserve for AGT-WLB-005 (completion). Neutral sunken hero here.
- ❌ Do not preload the activation-code POST on mount to "save a click." Explicit CTA tap is the consent moment for issuing an activation code.
- ❌ Do not surface the shared-number-pool mechanics ("you share a number with other agents") in the hero copy. That's PR #50's Model B truth but it's a mid-tour "how" — the trust footer covers it in one muted line.
- ❌ Do not add a "learn more" link that opens a marketing page in a new tab. The whole point of the anchor screen is to be self-contained.
- ❌ Do not run the tour with only 4 dots or 6 dots. AGT-WLB is a 5-step tour: -001, -002, -003, -004, -005. Anchor discipline.
- ❌ Do not render the primary CTA with a shadcn `variant="secondary"` for "softness." This is the activation moment — full orange.
- ❌ Do not use the signal-lamp pulse motif on the progress-dot active state. Reserved for the "listing went live" moment + AGT-REC-004 current-timeline-node. Progress dots are just filled, not pulsing.

---

## Reference designs

Draw structural cues from — do NOT copy 1:1:
- **WhatsApp Business onboarding** (Meta's own) — the calm-neutral hero + channel-mark treatment.
- **Notion "connect a workspace" step** — 3-benefit list pattern, clean and pragmatic.
- **Linear onboarding step 2** — safe-exit "close" that trusts the user.
- **Duolingo lesson-start screen** — 5-dot progress rail without a percentage bar.
- **Stripe Connect onboarding intros** — the two-column layout with a static illustrative panel on the right.

Do NOT match:
- Any SaaS that hides the close-X or requires a modal confirm to skip a step (Salesforce Trailhead pattern — user-hostile).
- Any onboarding that runs a full-screen loud hero on step 2 (loud is reserved for the completion moment).
- Slack channel-add flow (too playful for a MENA B2B real-estate context).

---

## Backend contract

**Screen-triggered endpoints:**

- `POST /api/auth/whatsapp/activation-code` (from PR #50 §2.5) — fires on primary CTA tap.
  - Request: no body (auth token identifies the user).
  - Response 200: `{ display_code: "WC-A4K9-JAMIL", parseable_code: "A4K9", shared_number_e164: "+9714XXXXXXX", expires_at: "2026-09-08T14:22:15Z" }`
  - Response 429: `{ error: "RATE_LIMITED", retry_after_seconds: 60 }` — an active code already exists; screen still navigates to -002 with the existing code (backend returns the existing code in the same 200 shape when a valid one is still active, per PR #50's partial-unique-index behavior — VERIFY at branch time; if the PR #50 endpoint returns 409 instead of the existing code, add a follow-up `GET /activation-code/current` fetcher).
  - Response 5xx: generic error toast.

- `POST /api/users/me/onboarding-events` (fire-and-forget) — fires on defer/close.
  - Request: `{ event: "whatsapp_setup_deferred", tour_step: 2 }`
  - Response: 202 accepted, no body.
  - **Prerequisite:** this endpoint MAY not exist yet. Verify at branch time. If missing, file as `[BE-BLOCKER-08] Onboarding events endpoint` — Week 4 task. Fallback: local-storage flag `wingcaster.onboarding.whatsapp_deferred_at` for the resume banner logic on AGT-DSH-001.

**Draft-progress endpoint (blocker for AGT-WLB-004 — surfaced HERE because it's an anchor-family dependency):**

**PR #50 does NOT provide any SSE / WebSocket endpoint for live draft-field streaming.** The existing intake pipeline in `backend/src/modules/whatsapp-listings/application/webhook.js` processes the WhatsApp message end-to-end and writes the completed draft as a single database row. There is no per-field streaming hook. AGT-WLB-004 needs one of the following (product/eng decision, but the brief must NOT assume any of them work today):

1. **Preferred:** add `GET /api/whatsapp-listings/drafts/:sessionId/progress` as an SSE endpoint emitting `field_start`, `field_complete`, `draft_ready` events. Requires refactoring the intake pipeline to emit per-phase events into an in-memory pub/sub OR Redis channel.
2. **Acceptable v1:** add `GET /api/whatsapp-listings/drafts/latest?since=<ts>` polling endpoint returning the current draft state. AGT-WLB-004 polls every 1s. Poll shows a bouncy "Thinking…" animation between polls to mask latency.
3. **Fallback:** no live streaming — AGT-WLB-004 shows a determinate spinner "Drafting your listing… this usually takes 15-30s" and transitions to -005 when the draft appears (poll `/binding-status` extension returning `draft_ready: true`).

**File as `[BE-BLOCKER-07] Live draft-progress endpoint`** in `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` §5a. Blocks AGT-WLB-004's design fidelity. Week 4 dependency. Recommended: option 2 (polling) for v1 — good-enough magic without new infra risk; option 1 for v2 once WingCaster has a reason to add SSE elsewhere.

---

## Notification hook

None on this screen. AGT-WLB-003 (waiting) is where the push-notification arrival matters. This screen is a pure onboarding-tour step with no server-side triggers.

---

## Downstream implementation (Cursor prompt handoff notes)

- **File to create:** `web/src/pages/onboarding/WhatsAppConnectPage.tsx`.
- **Route:** add to `web/src/App.tsx` — `<Route path="/onboarding/whatsapp" element={<WhatsAppConnectPage />} />`. Also register `/settings/channels/whatsapp/connect` mapping to the same component with a `mode="settings"` prop that hides the `<TourFrame>` chrome (settings-entry doesn't need the 5-dot progress).
- **Component decomposition (anchor pattern, lifted verbatim by -002/-003/-004/-005):**
  - `web/src/components/onboarding/whatsapp/TourFrame.tsx` — anchor.
  - `web/src/components/onboarding/whatsapp/StepHero.tsx` — anchor.
  - `web/src/components/onboarding/whatsapp/BenefitList.tsx` — anchor.
  - `web/src/components/onboarding/whatsapp/WhatsAppHandshakePanel.tsx` — anchor (heavy — used on -002 primarily).
  - `web/src/components/onboarding/whatsapp/LiveDraftCanvas.tsx` — anchor (heavy — used on -004).
  - `web/src/components/onboarding/whatsapp/ConnectScreen/` — WLB-001-specific composition.
- **Hook:** `web/src/hooks/useOnboardingTour.ts` — tracks tour progress + resume-banner logic; persists to backend via `POST /onboarding-events` (or local-storage fallback).
- **Test discipline:**
  - Unit: each of the 5 anchor components renders all its declared prop variants + accessibility structure.
  - Integration: full-tour flow (mount -001 → tap primary → navigate -002 → -003 waiting → -004 drafting → -005 ready → tap "Review & publish" → land on AGT-ONB-003 / AGT-LST-003).
  - Defer flow: tap "Not now" → banner persists on AGT-DSH-001 → tap banner → resume at -001 with `?resume=1`.
  - Rate-limit: mock POST to return 429 → screen still navigates to -002 with the existing-code payload.
  - Real-Postgres: at least one end-to-end scenario using a real PR #50 code + a stubbed inbound-webhook to exercise the tour transitions.
  - RTL: verified via `screens.rtl.test.tsx` extension.
- **Broadcast tokens:** `no-raw-hex.test.ts` must stay green.
- **Guard:** an assertion test that verifies `<StepHero emphasis="success">` is only used on AGT-WLB-005. Enforces anchor discipline.

---

## Broadcast alignment callouts

Every callout below is a Broadcast-token-specific instruction that the design AI or downstream Cursor implementation MUST honor. Non-negotiable.

- Step hero uses `--lc-surface-sunken` on -001/-002/-003/-004 (neutral); ONLY -005 may use `--lc-action-primary` full-bleed (the success moment).
- WhatsApp channel mark comes from `<ChannelMark channel="whatsapp">` — never a Lucide substitute.
- Benefit-row icon chips use `--lc-accent-bold` with the mandatory `--lc-accent-bold-edge` 1px outline.
- Primary CTA fill `--lc-action-primary`; hover DARKER to `--lc-action-primary-hover`. Never lighten.
- Ghost secondary uses `variant="ghost"` with `--lc-text-muted`. Never `variant="destructive"`.
- Sticky mobile CTA bar `--lc-surface-raised` + top-border `--lc-border` + upward `--lc-elevation-md`. Safe-area padding for iOS home indicator.
- Progress dots: active `--lc-action-primary`, completed `--lc-accent-bold` + edge outline, pending `--lc-border-strong` open ring. No pulse.
- Radii: cards `var(--lc-radius-lg)` (7px); buttons `var(--lc-radius-md)`; badges `var(--lc-radius-pill)`. No 12+px rounding anywhere.
- Elevations offset, not blurred — `--lc-elevation-sm` for the benefit-list card, `--lc-elevation-md` for the handshake panel on -002, `--lc-elevation-md` upward for the sticky mobile CTA bar.
- Motion: hero glyph enter `var(--lc-duration-base)` + `var(--lc-easing-out)`; benefit-row stagger 60ms intervals; complete-check icons on -004 use `var(--lc-easing-emphasis)` (the ONE legal emphasis usage on this family, and only on -004). Respect `prefers-reduced-motion` everywhere.
- Focus rings two-tone via base CSS. Do not override.
- Typography: title Archivo 800 via `var(--lc-type-display)` desktop / `var(--lc-type-heading-1)` mobile; body IBM Plex Sans via `var(--lc-type-body-lg)`; numerics (code, expiry countdown, shared number) via `<Numeric>` mono + tabular-nums.

---

## Handoff instruction to v0

Paste this brief in full into a fresh v0.app chat. Framing prompt (paste before this brief):

```
I'm designing the WingCaster "Connect WhatsApp intake" screen (AGT-WLB-001) — MENA real-estate B2B SaaS. Step 2 of a 5-step onboarding tour that ends with the agent's first AI-drafted listing. Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind.

This screen is the ANCHOR for the AGT-WLB family (WhatsApp intake tour) — five reusable components defined here (TourFrame, StepHero, BenefitList, WhatsAppHandshakePanel, LiveDraftCanvas) will be lifted verbatim by -002/-003/-004/-005. Design them as reusable primitives, not one-off compositions.

First pass: render the MOBILE 375px layout. TourFrame at top with 5 progress dots (dot 2 active), close-X on the right, screen title. Neutral sunken StepHero with the official WhatsApp channel mark in a circle chip, Archivo 800 title, muted sub-line. BenefitList card below with 3 rows (Zap / Mic / Car icons in accent-teal chips with edge outlines). Sticky bottom CTA bar: ghost "Not now, remind me later" as a text link + primary orange full-width "Set up WhatsApp intake" with the WhatsApp mark leading the label. Muted trust-footer line above the sticky bar.

LTR English only for this pass — I'll ask for RTL Arabic, desktop, dark mode, and the resume-from-banner state as separate follow-ups.

Follow the copy table in the brief exactly. Use the OFFICIAL WhatsApp brand mark (green speech bubble with phone), not a Lucide substitute.

DESIGN BRIEF FOLLOWS:
```

Iteration order after first pass:
1. `Same mobile viewport, dark mode. Broadcast tokens swap; primary CTA orange becomes #FF7440.`
2. `Desktop 1440px LTR. Two-column layout 60/40. Left column: hero + benefit list + primary CTA right-aligned + ghost left-aligned. Right column: 3-frame vertical illustration (chat bubble with voice+photos+pin → "drafting…" → listing card preview).`
3. `Desktop 1440px dark mode.`
4. `RTL Arabic mirror at mobile 375px. Close-X on the LEFT. WhatsApp mark on the RIGHT of the CTA label. [TRANSLATION-PENDING] where Arabic copy is not yet supplied but MIRROR the whole layout.`
5. `RTL Arabic mirror at desktop 1440px.`
6. `Resume-from-banner state: same mobile screen but TourFrame title changes to "Resume WhatsApp setup".`

Save each output's JSX to `web/src/components/onboarding/whatsapp/ConnectScreen/` + screenshot to `docs/design/mockups/AGT-WLB-001-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 has produced all 6 iteration states (mobile LTR, mobile dark, desktop LTR, desktop dark, mobile RTL, desktop RTL, resume-banner variant).
- [ ] Screenshots committed under `docs/design/mockups/`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/`.
- [ ] Cursor Wave-4 dispatch prompt references this brief + the mockup paths + the five reusable anchor components.
- [ ] `[BE-BLOCKER-07]` (Live draft-progress endpoint for AGT-WLB-004) filed in kickoff §5a.
- [ ] `[BE-BLOCKER-08]` (Onboarding events endpoint for defer/resume tracking) filed in kickoff §5a if the endpoint doesn't yet exist.
- [ ] AGT-WLB-002/003/004/005 briefs written subsequently reference this brief's §Reusable WLB-family patterns section by name and only spell out per-screen deltas.
