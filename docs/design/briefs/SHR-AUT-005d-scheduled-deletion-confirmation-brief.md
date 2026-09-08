# Screen Brief — SHR-AUT-005d · Scheduled account-deletion confirmation (public / token-authed)

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

Companion to `SCREEN_MATRIX_SHARED.md` §Auth entry `SHR-AUT-005d` and `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` Rev 9 §5 row 40 + §6 Week 3. Terminates WF-04 initiator side — when the delete-account flow has scheduled a deletion, this is the screen the user lands on when they follow the confirmation link from their email while signed out.

**Do NOT confuse with `SHR-SET-005d`** — that is the *in-app* terminator shown immediately after the 4-step in-session delete flow (SHR-SET-005 → 005b → 005c → 005d). This brief specifies the **public, token-authed, out-of-session** counterpart addressable by a link in the confirmation email + the pre-deletion reminder emails (day-23 and day-29 of the cool-down).

Inherits the `<StatusHero>` pattern from `AGT-REC-004-application-outcome-brief.md`. Inherits sobriety-tone rules from `SHR-SET-005-delete-account-brief.md`.

---

## Broadcast alignment

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`.** All color / font / spacing / motion / radii / elevation references below are governed by that reference. Never introduce raw hex; never use a `--lc-orange-*` primitive alias; never use a Tailwind palette class that isn't already remapped to a Broadcast semantic in `web/tailwind.config.js`.

**Screen-specific Broadcast callouts:**

- **`<StatusHero>` band** — lifted verbatim from AGT-REC-004 anchor. State-typed surface:
  - `VALID_PENDING` (the primary state): `background: var(--lc-surface-sunken)` with a `4px solid var(--lc-status-underOffer-fg)` top-border. Glyph `Hourglass` in `var(--lc-status-underOffer-fg)` (amber, cautious — never `--lc-status-unpublished-fg` red; scheduled deletion is destructive-but-cancellable, not an emergency).
  - `ALREADY_CANCELLED`: `background: var(--lc-surface-raised)`, `4px solid var(--lc-status-published-fg)` top-border, glyph `CheckCircle2` in `var(--lc-status-published-fg)`.
  - `ALREADY_DELETED`: `background: var(--lc-surface-inverse)`, ink `var(--lc-text-inverse)`, glyph `XCircle` in `var(--lc-text-inverse)`. Sombre, terminal.
  - `INVALID_TOKEN` / `EXPIRED_TOKEN`: `background: var(--lc-surface-sunken)`, `4px solid var(--lc-text-muted)` top-border, glyph `LinkOff` (or `Unlink`) in `var(--lc-text-muted)`.
  - `OFFLINE`: banner-only (no hero swap), see §State variants.
- **Countdown display** — the "N days and HH:MM:SS until deletion" figure is the emotional and functional focus of the `VALID_PENDING` state. Rendered via `<Numeric>` at `var(--lc-type-display)` (Archivo 800 32/38) with `tabular-nums` — the digits must NOT reflow as they tick. Amber tint `var(--lc-status-underOffer-fg)` for the entire cool-down; flips to `var(--lc-status-unpublished-fg)` red-emphasis at T-24h. Day/hour/minute/second labels beneath in `var(--lc-type-overline)` `var(--lc-text-muted)`.
- **Amber caution band** (VALID_PENDING only) — a sub-hero strip: `background: var(--lc-status-underOffer-bg)`, glyph + one-line explainer, radii `var(--lc-radius-md)`. Announces "This account will be deleted on {date} unless you cancel below."
- **Cancel-deletion primary CTA** (VALID_PENDING) — `<Button variant="default" size="lg">`, fill `var(--lc-action-primary)`, hover DARKER to `var(--lc-action-primary-hover)`. The action is *constructive* (cancels a destructive scheduled event), so it uses the standard primary orange — **not** a danger red. Full-width on mobile, right-aligned max-width 320px on desktop.
- **Sign-in secondary CTA** — `<Button variant="outline">`. On mobile, sits above the primary as a stacked block. On desktop, sits to the left of the primary in a right-aligned action row.
- **Impact-list card** — `--lc-surface-raised` + `--lc-elevation-sm` + `var(--lc-radius-lg)`. Lifted from SHR-SET-005 §3 (Deleted / Kept / Effective now) so a returning user re-sees the same commitment they made.
- **Reminder-badge chip** (visible when the user landed via a T-7 or T-1 reminder email) — small pill above the hero, `var(--lc-type-caption)`, `var(--lc-surface-sunken)`, glyph `Bell`, copy "Reminder: 7 days left" / "Reminder: 24 hours left".
- **Focus rings + 44px tap floor** — automatic via base CSS.
- **Motion** — countdown digits tick at `var(--lc-duration-instant)` (no easing, atomic swap of the seconds glyph). Hero cross-fade between states (e.g. after successful Cancel POST) at `var(--lc-duration-base)` with `var(--lc-easing-out)`. Respect `prefers-reduced-motion`: skip the cross-fade, keep the tick.
- **Sobriety** — NO confetti on cancel, NO "we'll miss you" on view, NO emoji. Same tone as SHR-SET-005. This is a legal, dignified action.

---

## Meta

| | |
|---|---|
| Screen ID | SHR-AUT-005d |
| Screen name | Scheduled account-deletion confirmation |
| Persona | Public / anonymous (token-authed; user is signed out during the cool-down per SHR-SET-005c behavior) |
| Device targets | Mobile 375px (primary — this is opened from a phone email client), tablet 768px, desktop 1440px |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark, respect `prefers-color-scheme` |
| Route | `/account/scheduled-deletion/:token` |
| Current state | MISSING — Week 3 dispatch per Kickoff §6. |
| Workflow role | WF-04 role=Recipient (out-of-session terminator + cancel affordance). |
| Backend prerequisites | ✅ `deletion_requests` table (SHR-SET-005 flow) · ✅ `POST /api/auth/delete-account/cancel` (SHR-SET-005b) · ⏳ NEW: `GET /api/auth/scheduled-deletion/:token` (public, token-authed, no session cookie required) · ⏳ NEW: signed-token minting for the scheduled-deletion email links (T+0 confirmation, T-7 reminder, T-1 reminder — one token type, three send moments) · ⏳ NEW: `POST /api/auth/scheduled-deletion/:token/cancel` (public, token-authed variant of the existing cancel endpoint) — see §Backend contract. |

---

## Purpose

A user whose account has been scheduled for deletion (via the SHR-SET-005 flow, or via a support-initiated deletion booked through PA-ACR) opens a link from one of three system emails and lands here to:

1. **Confirm scheduling** — landing from the T+0 confirmation email sent moments after they completed SHR-SET-005c. Verifies "yes, this was really me."
2. **Reconsider mid cool-down** — landing from the T-7 reminder email (7 days before deletion). Reminds them what's about to happen and offers a one-tap cancel.
3. **Final grace** — landing from the T-1 reminder email (24 hours before deletion). Same UI, urgency-tinted countdown.

Success outcome per state:
- `VALID_PENDING` → user reviews countdown + impact; either taps **Cancel deletion** (→ POST /cancel → hero cross-fades to `ALREADY_CANCELLED`) or leaves the tab (deletion proceeds on schedule).
- `ALREADY_CANCELLED` → confirms nothing further to do, offers Sign-in CTA to return to app.
- `ALREADY_DELETED` → confirms deletion is complete; offers Sign-up CTA if they want to start fresh, and support link.
- `INVALID_TOKEN` / `EXPIRED_TOKEN` → routes to `/account-recovery` (SHR-AUT-005) so a genuinely locked-out user isn't dead-ended.

Emotional stakes: the user made a hard choice; this screen respects that choice without pressuring them either way. Cancel is offered plainly, not sold.

---

## Design goals

1. **State legible in the first 200ms.** The `<StatusHero>` at the top answers "am I still deletable? cancelled? gone?" before the user reads a word.
2. **Countdown is the emotional focus** — not a fine-print detail. In `VALID_PENDING`, the days/hours/minutes/seconds figure is the largest thing on the screen after the hero label.
3. **Cancel is one deliberate tap** — not two, not a confirm dialog (they've been through a 4-factor delete flow to get here; asking them to confirm again is condescending). But cancel is *never* auto-triggered by page load — the tap is explicit.
4. **Impact list re-shown**, not hidden, so the user re-sees the same commitment they made in SHR-SET-005 and can weigh cancel against it fresh.
5. **Never leaks sensitive data** — email is masked, no full name, no listing count, no financial specifics. This link may sit in a shared inbox.
6. **RTL Arabic first-class** — countdown digits stay LTR bidi-embedded; date rendering follows locale.
7. **Token-authed, no cookies** — this screen must work in an incognito tab, on a different device, from a signed-out state.

---

## Layout

### Mobile 375px (primary)

Single scrolling column, no persistent chrome:

1. **Wordmark bar** — thin sticky top strip: WingCaster wordmark centered (32px tall). No back arrow (this is a public entry, nowhere to go back to). Language selector top-right if space allows; otherwise omitted for this screen.
2. **Reminder-badge chip** — visible only when `?src=reminder-t-minus-7` or `?src=reminder-t-minus-1` is in the URL (email link carries the source). Small pill above the hero: `Reminder: 7 days left` / `Reminder: 24 hours left`.
3. **`<StatusHero>` band** — full-bleed, ~160px tall on mobile. Glyph 28×28, label `var(--lc-type-heading-2)`, sub-line `var(--lc-type-body-sm)` muted. Surface per state per Broadcast callouts.
4. **Countdown block** (VALID_PENDING only) — centered, edge-to-edge padding. Composition:
   - Top label `var(--lc-type-overline)` muted: "Deletion scheduled for"
   - Absolute date line `var(--lc-type-heading-3)`: e.g. `Sunday, 07 October 2026, 14:22 GST`
   - Countdown digits row: 4 mono-numeric blocks (DD : HH : MM : SS), each with an overline label (`DAYS` / `HOURS` / `MINUTES` / `SECONDS`) beneath. Total height ~120px. Digits tick every second via `useEffect`.
5. **Amber caution strip** (VALID_PENDING only) — one-line sub-hero: "This account will be deleted unless you cancel below."
6. **Cancel-deletion CTA** (VALID_PENDING) — primary orange full-width button, `Cancel deletion`. Positioned prominently below the caution strip.
7. **Sign-in secondary CTA** (VALID_PENDING + ALREADY_CANCELLED) — outline button, `Sign in to your account`. Positioned below primary with `var(--lc-space-sm)` gap.
8. **Masked email confirmation line** — small centered text `var(--lc-type-body-sm)` muted: "Deletion was requested for `s•••@propertyfinder.ae`". Reassures the user this is the right account without leaking the full address.
9. **Impact-list card** — collapsible on mobile, collapsed by default with a "What happens when the account is deleted" toggle. Once opened, shows the same three-group list from SHR-SET-005 §3 (Deleted / Kept / Effective now).
10. **Contact support link** — `var(--lc-text-brand)` link, centered, `var(--lc-type-body-sm)`: "Something not right? Contact WingCaster support."
11. **Small print block** — request reference ID (`<Numeric>`), scheduled-on timestamp, both muted `var(--lc-type-caption)`. For support-ticket citations.

### Tablet 768px & Desktop 1440px

Centered single-column layout, max-width `640px`, all content in a page-centered stack (this is a focus screen — no sidebars, no marketing panel). The absence of a right-column marketing panel is deliberate: nothing on this screen should feel like an upsell.

Extra desktop-only affordances:
- Impact-list card is expanded by default (screen real estate allows it).
- Countdown block digits scale up to `var(--lc-type-display-xl)` (Archivo 800 40/44) with the DD/HH/MM/SS labels beneath.
- CTA row inline: Sign-in outline on the left, Cancel-deletion primary on the right, both max-width 240px, right-aligned pair.

### RTL

Full mirror. Countdown digits row stays LTR bidi-embedded (DD:HH:MM:SS reads left-to-right even in Arabic context — matching international convention for timers). Absolute date follows Arabic locale formatting via `Intl.DateTimeFormat('ar-AE')`. Reminder chip glyph flips to the trailing edge in RTL.

---

## Explicit copy (English)

Fill Arabic strings during MENA copywriter pass — mark `[TRANSLATION-PENDING]` in the AR mirror MDX for now.

| Slot | Copy |
|---|---|
| Wordmark aria | WingCaster |
| Reminder chip — T-7 | Reminder: 7 days left |
| Reminder chip — T-1 | Reminder: 24 hours left |
| Hero label — VALID_PENDING | Your account is scheduled for deletion |
| Hero sub — VALID_PENDING | You can still cancel below. |
| Hero label — ALREADY_CANCELLED | This deletion has already been cancelled |
| Hero sub — ALREADY_CANCELLED | Your account is active. You can sign in below. |
| Hero label — ALREADY_DELETED | This account has been deleted |
| Hero sub — ALREADY_DELETED | The cool-down ended and the account was removed. |
| Hero label — INVALID_TOKEN | This link isn't valid |
| Hero sub — INVALID_TOKEN | It may have been tampered with or copied wrong. |
| Hero label — EXPIRED_TOKEN | This link has expired |
| Hero sub — EXPIRED_TOKEN | Reminder links stay valid until the deletion date. |
| Countdown label — top | Deletion scheduled for |
| Countdown block — days label | DAYS |
| Countdown block — hours label | HOURS |
| Countdown block — minutes label | MINUTES |
| Countdown block — seconds label | SECONDS |
| Amber caution strip | This account will be deleted unless you cancel below. |
| Amber caution strip — T-1 variant | Final 24 hours — deletion runs at {absolute time}. |
| Primary CTA — cancel | Cancel deletion |
| Primary CTA — cancelling | Cancelling… |
| Primary CTA — cancelled toast | Deletion cancelled. Your account is active. |
| Secondary CTA — sign in | Sign in to your account |
| Secondary CTA — sign up (deleted state) | Start a new account |
| Masked email line | Deletion was requested for {masked_email}. |
| Impact toggle | What happens when the account is deleted |
| Impact — Deleted heading | Deleted at the end of the cool-down: |
| Impact — Deleted profile | Your profile and login |
| Impact — Deleted listings | Your listings — archived, then removed |
| Impact — Deleted contacts | Your contacts — pseudonymized per GDPR |
| Impact — Deleted credits | Any unspent credits — forfeited |
| Impact — Kept heading | Kept for legal reasons: |
| Impact — Kept invoices | Invoices and payment records (7 years) |
| Impact — Kept audit | Aggregate audit trail (redacted) |
| Impact — Effective heading | Effective right now: |
| Impact — Effective signout | You are signed out of every device |
| Impact — Effective public | Your public profile is hidden |
| Contact support link | Something not right? Contact WingCaster support |
| Small print — reference | Request reference: {request_id} |
| Small print — scheduled on | Scheduled on {absolute_datetime} |
| Recovery link — INVALID_TOKEN | If you're locked out, use account recovery. |
| Recovery link — EXPIRED_TOKEN | Sign in to view your deletion status. |
| Offline banner | You're offline — the cancel button won't work until you reconnect. |

---

## Component palette (shadcn / Radix / lucide-react)

| Element | Primitive |
|---|---|
| Wordmark bar | Custom sticky `<header>` — matches SHR-AUT-001 minimal auth-page header |
| Reminder chip | `Badge` variant="outline" with `Bell` glyph |
| `<StatusHero>` | Anchor pattern from `web/src/components/recipient/StatusHero.tsx` (AGT-REC-004) — extend state map with `deletion_pending` / `deletion_cancelled` / `deletion_done` / `link_invalid` / `link_expired` |
| Countdown block | Custom `<DeletionCountdown>` — 4 `<Numeric>` blocks + labels; single `useEffect` for the 1s tick |
| Amber caution strip | `Alert` variant="warning" — from shadcn (Broadcast-tokenized already) |
| Primary CTA | `Button` variant="default" size="lg" |
| Secondary CTA | `Button` variant="outline" size="lg" |
| Impact list toggle | `Collapsible` from Radix — animated height at 200ms |
| Impact list content | `<ul>` semantic, grouped by three `<h4>` sub-headings |
| Contact support link | `<a>` styled as brand link |
| Small print | `<dl>` for reference id + scheduled-on |
| Toast (post-cancel) | `Sonner` |
| Loading state | `Skeleton` mirroring hero + countdown + CTA row |
| Offline banner | Custom `<div role="status">` with `WifiOff` glyph |

---

## Sample content (for v0 / mockup)

Show the mobile 375px layout with:
- **State:** `VALID_PENDING`
- **Reminder chip:** hidden (assume T+0 confirmation landing, no `?src=reminder-*`)
- **Status hero:** amber-band sunken surface, `Hourglass` glyph, label "Your account is scheduled for deletion", sub "You can still cancel below."
- **Countdown block:** top label "Deletion scheduled for", absolute date "Sunday, 07 October 2026, 14:22 GST", digits `29 : 18 : 47 : 12` mono, labels DAYS / HOURS / MINUTES / SECONDS beneath.
- **Amber caution strip:** "This account will be deleted unless you cancel below."
- **Primary CTA:** orange full-width "Cancel deletion"
- **Secondary CTA:** outline "Sign in to your account"
- **Masked email line:** "Deletion was requested for `s•••@propertyfinder.ae`."
- **Impact toggle:** collapsed, chevron pointing right, "What happens when the account is deleted"
- **Contact support link:** centered at bottom
- **Small print:** `Request reference: DEL-01H8XZ4NQR2E9K` / `Scheduled on 07 Sep 2026, 14:22 GST`

Iteration order for v0 after first pass:
1. Same mobile viewport, state = `VALID_PENDING` with reminder-chip `Reminder: 7 days left`, countdown showing `06 : 23 : 12 : 08`.
2. Same mobile viewport, state = `VALID_PENDING`, T-1 variant: countdown `00 : 22 : 14 : 33` with red-emphasis tint, caution strip reads "Final 24 hours — deletion runs at Sunday, 07 October 2026, 14:22 GST."
3. Same mobile viewport, state = `ALREADY_CANCELLED`: green-tinted hero, no countdown, only Sign-in CTA + impact card auto-collapsed away.
4. Same mobile viewport, state = `ALREADY_DELETED`: inverse-surface sombre hero, "Start a new account" primary + support link.
5. Same mobile viewport, state = `INVALID_TOKEN`: muted hero with `Unlink` glyph, recovery link visible.
6. Same mobile viewport, state = `EXPIRED_TOKEN`: muted hero, "Sign in to view your deletion status" link.
7. Desktop 1440px, state = `VALID_PENDING`: single-column max-640 layout, countdown digits at display-xl, impact list expanded, CTA row inline.
8. RTL Arabic mirror at mobile 375px, state = `VALID_PENDING`, `[TRANSLATION-PENDING]` copy — countdown digits stay LTR bidi-embedded.
9. Dark mode desktop, state = `VALID_PENDING`.
10. Post-cancel toast overlay on `VALID_PENDING` transitioning to `ALREADY_CANCELLED` via hero cross-fade.

Save each output's JSX to `web/src/components/auth/ScheduledDeletionPage/` + screenshot to `docs/design/mockups/SHR-AUT-005d-<state>.png`.

---

## Interactions

**On page load:**
- Extract `:token` from route. GET `/api/auth/scheduled-deletion/:token`. Show skeleton mirror during fetch.
- Response drives state (VALID_PENDING / ALREADY_CANCELLED / ALREADY_DELETED / INVALID_TOKEN / EXPIRED_TOKEN).
- If 200 with `state = 'pending'`: start the countdown tick (single `useEffect`, 1000ms interval, cleared on unmount).

**Countdown tick:**
- Compute `Math.max(0, deletion_at - now)` on each tick. Format as DD/HH/MM/SS.
- At T-24h boundary: flip caution strip copy + tint countdown digits `var(--lc-status-unpublished-fg)` red-emphasis. Do not restart interval.
- At T-0 (countdown hits zero while user is looking at the page): re-fetch `/api/auth/scheduled-deletion/:token` — server may return `ALREADY_DELETED` or (rare race) still `VALID_PENDING` for a few seconds until the cron catches up. Cross-fade hero.

**On tapping Cancel deletion (VALID_PENDING primary):**
- POST `/api/auth/scheduled-deletion/:token/cancel`. Button shows `Loader2` + label "Cancelling…". Entire action row disabled.
- On success: hero cross-fades to `ALREADY_CANCELLED` state at `var(--lc-duration-base)`. Toast "Deletion cancelled. Your account is active." Countdown block disappears. Primary CTA is replaced by the Sign-in outline button.
- On failure (network / token race / already cancelled elsewhere): destructive toast + re-fetch to reconcile state. No confirm dialog required — the user's tap is deliberate.

**On tapping Sign in / Sign up:**
- Navigate to `/login` (SHR-AUT-001) with a `?returnTo=/account/scheduled-deletion/{token}` query param (so post-sign-in the user lands back here if they want). For the ALREADY_DELETED "Start a new account" variant, navigate to `/register` (SHR-AUT-006) with no return-to.

**On tapping impact toggle:**
- Expand/collapse via `Collapsible` primitive with 200ms height transition. State persisted in URL hash `#impact-expanded` so a link-share opens with the toggle where the sharer left it (nice-to-have, not blocking).

**On tapping Contact support:**
- Navigate to `/support/new` with `?context=deletion&request_id={reference}` query params. Never open `mailto:` — support flow lives in-app.

**On offline:**
- Show top banner. Cancel button `aria-disabled="true"` with tooltip explaining connectivity requirement. Countdown continues ticking client-side (doesn't need network).

**On visibility change (user tabs away then back after > 60s):**
- Silently re-fetch to catch out-of-band state changes (e.g. user tapped Cancel on another device). If state changed, cross-fade.

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Loading** | Initial fetch in flight | Skeleton mirroring hero + countdown + CTA row. |
| **VALID_PENDING** | `state = 'pending' AND deletion_at > now` | Amber hero + countdown ticking + Cancel primary + Sign-in secondary + Impact collapsed (mobile) / expanded (desktop). |
| **VALID_PENDING — reminder-t-7** | Query param `?src=reminder-t-minus-7` present | Adds reminder chip above hero; otherwise same as VALID_PENDING. |
| **VALID_PENDING — reminder-t-1** | Query param `?src=reminder-t-minus-1` present | Adds T-1 reminder chip; countdown digits already in red-emphasis tint via T-24h boundary rule. |
| **ALREADY_CANCELLED** | `state = 'cancelled'` | Green-tinted hero, no countdown, only Sign-in CTA + support link. |
| **ALREADY_DELETED** | `state = 'deleted'` | Inverse-surface sombre hero, "Start a new account" CTA + support link. Impact list omitted (nothing to preview any more). |
| **INVALID_TOKEN** | 404 or 400 from GET endpoint | Muted hero with `Unlink` glyph, recovery-link CTA to `/account-recovery`. No countdown, no cancel. |
| **EXPIRED_TOKEN** | 410 from GET endpoint | Muted hero, "Sign in to view your deletion status" — routes to `/login?returnTo=/settings/account`. |
| **Cancelling — POST in flight** | User tapped Cancel | Primary button shows `Loader2` + "Cancelling…"; secondary disabled. |
| **Post-cancel** | POST /cancel 200 | Hero cross-fades to ALREADY_CANCELLED; toast appears; countdown block unmounts. |
| **T-0 crossed while viewing** | Countdown ticks to zero | Re-fetch triggers; hero cross-fades to ALREADY_DELETED when server catches up. |
| **Offline** | `navigator.onLine === false` | Top banner + primary CTA disabled. Countdown keeps ticking. |
| **Rate-limited** | 429 from POST /cancel | Toast "Too many attempts — try again in {seconds}s." Button re-enables after countdown. |
| **RTL** | Locale = ar | Full mirror per §Layout. Countdown digits stay LTR bidi-embedded. |
| **Dark mode** | prefers-color-scheme dark | Broadcast tokens swap automatically. Amber → dark-mode amber; inverse-surface hero shifts appropriately. |

---

## Accessibility

- Hero is `<section aria-labelledby="status-hero-label">`. Screen reader hits status first, always.
- Countdown block wrapped in `<div role="timer" aria-live="off" aria-atomic="true" aria-label="Time until deletion: 29 days, 18 hours, 47 minutes">`. `aria-live` is intentionally **off** — a ticking timer that announces every second would be intolerable. Instead, at T-24h and T-1h boundaries, a single polite announcement fires via a separate `aria-live="polite"` region ("Final 24 hours until deletion").
- Every tap target ≥ 44×44 CSS px including the impact toggle chevron and the support link (add padding-Y to text links).
- Cancel primary CTA has descriptive `aria-label="Cancel deletion of account for {masked_email}"` so a screen reader user hears the target of the action.
- Impact list uses `<ul>` with three `<h4>` sub-headings; toggle button has `aria-expanded` + `aria-controls`.
- Focus rings visible on every interactive element — two-tone Broadcast focus ring via base CSS, do not override.
- No color-only status differentiation — every state uses glyph + label + surface tint together.
- Motion: `prefers-reduced-motion` skips hero cross-fade; countdown tick keeps (it's information, not decoration).
- Link masking: masked email is rendered as text (not an image), so screen readers announce "s dot dot dot at propertyfinder dot a e" — acceptable trade-off vs. leaking full address in the accessibility tree.
- Sign-in/Sign-up secondary is a real `<a>` with visible focus, not a `<button>`.

---

## Anti-patterns (do not do these)

- Do NOT show a confirmation dialog on Cancel. The user has been through a 4-factor delete flow to schedule this. Asking "are you sure?" again is condescending. Tap = cancel.
- Do NOT auto-cancel on page load, ever. Landing on this URL must never mutate state. Only the explicit Cancel tap POSTs.
- Do NOT show marketing content, "here's what you'll miss" copy, or feature comparisons. This is not a retention screen — it is a legal-status screen.
- Do NOT reveal the full email address. Always mask (first char + last char of local part + full domain: `s•••@propertyfinder.ae`).
- Do NOT reveal listing counts, contact counts, tenant names, or financial specifics. Link may sit in a shared inbox.
- Do NOT use `var(--lc-status-unpublished-fg)` (red) for the primary hero surface. Cool-down is reversible → amber caution, not red alarm. Red is reserved for T-24h emphasis and the "ALREADY_DELETED" glyph.
- Do NOT put the countdown digits in the UI font. Every numeral → `<Numeric>` mono tabular-nums. Digits must not reflow when ticking.
- Do NOT use emphasis easing on any transition here. Cool-down elapsing is not a "broadcast moment" — it's a solemn one. `--lc-easing-out` only.
- Do NOT include a "Delete now" affordance. The 30-day cool-down is a legal promise; no early-execute button.
- Do NOT open `mailto:` for support. Route to `/support/new` in-app.
- Do NOT include analytics beacons that would fire on the CANCEL action beyond a single "deletion_cancelled" event (no marketing pixels, no retention-team hooks — this is a private legal action).
- Do NOT show a language selector on the desktop layout if it interferes with the centered focus. Prefer omitting it; the email link itself carries `?lang=ar|en` if needed.

---

## Reference designs

Draw structural cues from — do NOT copy 1:1:
- **GitHub "account is scheduled for deletion" landing page** — sober amber hero, single cancel button, no marketing.
- **Google Takeout / Delete Account cool-down confirmation** — clear countdown emphasis + impact reminder.
- **Notion delete-workspace scheduled state** — countdown UI + cancel affordance.
- **Stripe "your account is scheduled for closure" email-linked page** — the tone: dignified, non-persuasive.

Do NOT match:
- Any B2C "we'll miss you 😢 come back" retention screen (Adobe, Netflix cancellation flows) — tone-inappropriate for legal action.
- Any full-page interstitial that requires solving a puzzle to cancel — cancel must be one deliberate tap.

---

## Backend contract

**Endpoint 1:** `GET /api/auth/scheduled-deletion/:token` — public, no session cookie required.

**Response 200:**
```json
{
  "state": "pending" | "cancelled" | "deleted",
  "request_id": "DEL-01H8XZ4NQR2E9K",
  "masked_email": "s•••@propertyfinder.ae",
  "scheduled_at": "2026-09-07T14:22:15Z",
  "deletion_at": "2026-10-07T14:22:15Z",
  "cancelled_at": null | "2026-09-20T09:14:22Z",
  "deleted_at": null | "2026-10-07T14:22:15Z"
}
```

**Response 404 `INVALID_TOKEN`** — token signature invalid, tampered, or unknown.
**Response 410 `EXPIRED_TOKEN`** — token signature valid but the encoded deletion-window has already been cleaned up (edge: token > 60 days old, past the retention window even for cancelled/deleted records).

Never leaks whether an email/account exists for a given token beyond `masked_email` — the server refuses to render a real email address for an invalid/expired token.

**Endpoint 2:** `POST /api/auth/scheduled-deletion/:token/cancel` — public, token-authed.

**Response 200:**
```json
{
  "state": "cancelled",
  "cancelled_at": "2026-09-20T09:14:22Z"
}
```

**Response 409 `ALREADY_CANCELLED`** — cancel-race; UI reconciles by refetching.
**Response 409 `ALREADY_DELETED`** — cool-down already elapsed before the POST landed; UI cross-fades to ALREADY_DELETED.
**Response 429 rate-limit** — max 3 cancel attempts per token per 60s.

**Signed-token minting:** the token is a scheme-versioned HMAC-signed payload:
```
v1.<base64url(payload)>.<hmac_sha256(server_secret, payload)>
```
payload = `{ "request_id": "DEL-01H8...", "purpose": "scheduled_deletion_view", "issued_at": 1725712935, "expires_at": 1730900535 }`

**Piggybacks on existing token infrastructure.** WingCaster already mints signed tokens with the identical scheme for:
- SHR-SET-005c (delete-account email confirmation, TTL 15 min)
- SHR-AUT-005c (account-recovery-complete link, TTL 24h)
- SHR-AUT-003b (password-reset link, TTL 60 min)

This new token type simply uses a NEW `purpose` string (`scheduled_deletion_view`) and a LONGER TTL (60 days from issuance to cover the 30-day cool-down + 30-day cancelled-record retention). **No new crypto library, no new signing key, no new verification middleware.** The token is issued once at scheduling time (SHR-SET-005c success) and reused verbatim in the T+0 confirmation email, the T-7 reminder email, and the T-1 reminder email. **Reissue on cancel is not required** — a cancelled token continues to resolve to `ALREADY_CANCELLED` for the retention window so a bookmarked link stays informative.

**Backend prerequisite surfaced (NOT already tracked):** the public `GET /api/auth/scheduled-deletion/:token` endpoint, the public `POST /:token/cancel` counterpart, the token-purpose enum extension (`scheduled_deletion_view`), and the three email templates (T+0, T-7, T-1) with signed links. `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` §5a currently tracks the SHR-SET-005 flow's `POST /api/auth/delete-account/cancel` (session-cookie-authed) but does NOT call out the public token-authed variant. **File as `[BE-BLOCKER-07] Public scheduled-deletion view + cancel endpoints (token-authed)` — Week 3 dependency.** Estimated backend effort: 2-3 days (endpoints piggyback on existing `deletion_requests` table and existing signed-token utility; email templates piggyback on existing Microsoft Graph transport per user memory).

**Reminder-email cron:** a daily cron scans `deletion_requests WHERE state = 'pending' AND deletion_at BETWEEN now() + interval '6 days 23 hours' AND now() + interval '7 days 1 hour'` (T-7 window) and the same for `interval '23 hours' / '25 hours'` (T-1 window). Emits the templated email. Idempotent via a `reminders_sent` array column on `deletion_requests` (`['t_minus_7', 't_minus_1']`).

---

## Downstream implementation (Cursor prompt handoff notes)

- **File to create:** `web/src/pages/ScheduledDeletionPage.tsx`.
- **Route:** add to `web/src/App.tsx` — `<Route path="/account/scheduled-deletion/:token" element={<ScheduledDeletionPage />} />`. Register the route OUTSIDE any auth guard (public, token-authed).
- **Component decomposition:**
  - `web/src/components/auth/ScheduledDeletionPage/index.tsx` — top-level, state-machine wrapper.
  - `web/src/components/auth/ScheduledDeletionPage/DeletionCountdown.tsx` — the ticking 4-block countdown.
  - `web/src/components/auth/ScheduledDeletionPage/ImpactList.tsx` — collapsible three-group list (lifted from SHR-SET-005 §3; extract a shared component under `web/src/components/account/DeletionImpactList.tsx` if a shared component makes sense across both briefs).
  - Reuses `<StatusHero>` from `web/src/components/recipient/StatusHero.tsx` (AGT-REC-004 anchor).
- **Data hook:** `web/src/hooks/useScheduledDeletion.ts` — fetches on mount + refetches on visibility change + T-0 crossing. Uses React Query with 60s stale time.
- **Cancel action:** `web/src/hooks/useCancelScheduledDeletion.ts` — POST + optimistic UI (hero cross-fades before server responds; reconcile on response).
- **Countdown logic:** single `useEffect` with `setInterval(1000)`; cleared on unmount and on state !== 'pending'. Avoid a per-digit component (unnecessary re-render fan-out).
- **Test discipline:**
  - Unit: each of the 3 sub-components renders all its state variants + accessibility structure.
  - Integration: full screen renders correctly across all 5 primary state variants (VALID_PENDING, ALREADY_CANCELLED, ALREADY_DELETED, INVALID_TOKEN, EXPIRED_TOKEN). Parameterize.
  - Cancel flow: POST → hero cross-fades → toast shows once → countdown unmounts.
  - T-0 crossing: mock clock, tick past deletion_at, assert refetch fires + hero flips to ALREADY_DELETED.
  - Reminder chip: URL query params `?src=reminder-t-minus-7` / `?src=reminder-t-minus-1` render the correct chip.
  - Offline: `navigator.onLine = false` → banner + button disabled + countdown continues.
  - Real-Postgres: at least one end-to-end scenario (user schedules deletion via SHR-SET-005c → user opens `/account/scheduled-deletion/:token` in a signed-out browser → cancels → hero cross-fades → user signs in and lands on active-account dashboard).
  - RTL: verified via `screens.rtl.test.tsx` extension.
- **Broadcast tokens:** `no-raw-hex.test.ts` must stay green.
- **Copy discipline:** all strings live in `web/src/i18n/en/scheduled-deletion.json` + `web/src/i18n/ar/scheduled-deletion.json` (AR marked `[TRANSLATION-PENDING]` for the MENA copywriter pass).

---

## Broadcast alignment callouts

Every callout below is a Broadcast-token-specific instruction that the design AI or downstream Cursor implementation MUST honor. Non-negotiable.

- Hero surface for VALID_PENDING is `var(--lc-surface-sunken)` + `4px solid var(--lc-status-underOffer-fg)` top-border. Never `var(--lc-status-unpublished-*)` red for the surface.
- Countdown digits use `<Numeric>` — mono, tabular-nums, no reflow on tick. Font size `var(--lc-type-display)` mobile / `var(--lc-type-display-xl)` desktop.
- Digit tint amber `var(--lc-status-underOffer-fg)` for the cool-down; flip to `var(--lc-status-unpublished-fg)` red-emphasis at T-24h.
- Cancel primary CTA is `var(--lc-action-primary)` orange — because the action itself is constructive (cancels a destructive scheduled event). Hover DARKER to `var(--lc-action-primary-hover)`. Never lighten. Never destructive-red.
- Impact-list card `var(--lc-surface-raised)` + `var(--lc-elevation-sm)` + `var(--lc-radius-lg)`. No 12+px rounding anywhere.
- Elevations offset, not blurred — `var(--lc-elevation-sm)` only. Never a soft blur shadow.
- Reminder chip `var(--lc-surface-sunken)` + `var(--lc-radius-pill)` + `var(--lc-type-caption)`. Glyph `Bell` in `var(--lc-text-muted)`.
- Amber caution strip `var(--lc-status-underOffer-bg)` + `var(--lc-radius-md)`. Never full-bleed; always inset with `var(--lc-space-md)` gutters.
- Focus rings two-tone via base CSS. Do not override.
- Motion: hero cross-fade `var(--lc-duration-base)` with `var(--lc-easing-out)`; countdown tick `var(--lc-duration-instant)`; NEVER `var(--lc-easing-emphasis)` on this screen — no "broadcast moment" here.
- Radii: hero `0` (full-bleed on mobile) / `var(--lc-radius-lg)` (inset on desktop); buttons `var(--lc-radius-md)`; reminder chip `var(--lc-radius-pill)`.
- Every timestamp + request-id via `<Numeric>` — mono + tabular-nums.

---

## Handoff instruction to v0

Paste this brief in full into a fresh v0.app chat. Framing prompt (paste before this brief):

```
I'm designing the WingCaster "Scheduled account-deletion confirmation" screen (SHR-AUT-005d) — MENA real-estate B2B SaaS. It's the public, token-authed, out-of-session screen a user lands on when they follow a link from the deletion-confirmation or reminder emails during the 30-day cool-down. Five states: VALID_PENDING (countdown active + cancel), ALREADY_CANCELLED, ALREADY_DELETED, INVALID_TOKEN, EXPIRED_TOKEN. Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind.

This screen reuses the <StatusHero> anchor component defined in AGT-REC-004. Design the countdown block as a reusable primitive.

Tone: sober, dignified, non-persuasive. No marketing, no retention pressure, no emoji, no "we'll miss you." This is a legal-status screen.

First pass: render the MOBILE 375px layout for state = VALID_PENDING. Sunken amber-band status hero with Hourglass glyph and "Your account is scheduled for deletion" heading. Below hero: 4-block countdown (DD:HH:MM:SS) with an absolute date line above. Amber caution strip. Primary orange "Cancel deletion" button (full-width). Outline "Sign in to your account" button below. Masked-email line. Impact-list collapsed toggle. Contact-support link at bottom. Small-print request ID.

LTR English only for this pass — I'll ask for other states, T-1 variant, RTL Arabic, desktop, and dark mode as separate follow-ups.

Follow the copy table in the brief exactly. Do not fabricate impact list items beyond the sample content section.

DESIGN BRIEF FOLLOWS:
```

Iteration order after first pass:
1. `Same mobile viewport, VALID_PENDING with reminder chip "Reminder: 7 days left" above the hero and countdown showing 06:23:12:08.`
2. `Same mobile viewport, VALID_PENDING T-1 variant — countdown 00:22:14:33 with red-emphasis tint on digits, caution strip reads "Final 24 hours — deletion runs at Sunday, 07 October 2026, 14:22 GST."`
3. `Same mobile viewport, ALREADY_CANCELLED. Green-tinted hero, no countdown, only Sign-in outline CTA + support link.`
4. `Same mobile viewport, ALREADY_DELETED. Inverse-surface sombre hero. "Start a new account" primary + support link.`
5. `Same mobile viewport, INVALID_TOKEN. Muted hero with Unlink glyph. Recovery-link CTA.`
6. `Desktop 1440px, VALID_PENDING. Centered single-column max-640px. Countdown digits scale up to display-xl. Impact list expanded by default. CTA row inline (Sign-in outline left, Cancel primary right).`
7. `RTL Arabic mirror at mobile 375px, VALID_PENDING. [TRANSLATION-PENDING] copy. Countdown digits stay LTR bidi-embedded.`
8. `Dark mode desktop, VALID_PENDING.`
9. `Post-cancel toast overlay + hero cross-fading from VALID_PENDING to ALREADY_CANCELLED.`

Save each output's JSX to `web/src/components/auth/ScheduledDeletionPage/` + screenshot to `docs/design/mockups/SHR-AUT-005d-<state>.png`.

---

## Definition of done for this brief

- [ ] v0 has produced all 9 iteration states (mobile VALID_PENDING + T-7 + T-1 + ALREADY_CANCELLED + ALREADY_DELETED + INVALID_TOKEN; desktop VALID_PENDING; RTL mobile VALID_PENDING; dark desktop VALID_PENDING; post-cancel cross-fade).
- [ ] Screenshots committed under `docs/design/mockups/SHR-AUT-005d-<state>.png`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/SHR-AUT-005d/`.
- [ ] Cursor Week-3 dispatch prompt references this brief + the mockup paths + the `<StatusHero>` anchor reuse from AGT-REC-004.
- [ ] `[BE-BLOCKER-07]` (public scheduled-deletion GET + POST /cancel token-authed endpoints + 3 email templates + token-purpose enum extension + reminder cron) filed in kickoff §5a as a Week-3 dependency.
- [ ] `<DeletionCountdown>` extracted as a reusable primitive at `web/src/components/auth/ScheduledDeletionPage/DeletionCountdown.tsx` in case AGT-REC-006 (ownership-transfer offered) or other terminal-with-cooldown screens want it later.
- [ ] Optional shared extraction: `<DeletionImpactList>` under `web/src/components/account/` if both SHR-SET-005 and this brief agree on the wording (coordinate at implementation time).
