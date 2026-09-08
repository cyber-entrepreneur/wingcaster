# Screen Brief — AGT-WLB-002 · Activation code — delta of AGT-WLB-001

**Layer-2 Brief for design AI consumption.** Delta of the AGT-WLB-001 anchor. Inherits the anchor's Broadcast alignment, `<TourFrame>`, `<StepHero>` (neutral emphasis), and `<WhatsAppHandshakePanel>` patterns verbatim.

Wave 4, step 3 of 5 in the AGT-WLB WhatsApp intake tour. Renders the activation code + shared-number handshake from PR #50.

---

## 🎨 Broadcast alignment

Same as AGT-WLB-001 anchor. No new tokens introduced. The `<WhatsAppHandshakePanel>` is the visual centerpiece — refer to its anchor spec (AGT-WLB-001 §Reusable WLB-family patterns → §4) for full styling.

---

## Meta

| | |
|---|---|
| Screen ID | AGT-WLB-002 |
| Screen name | Activation code |
| Persona | Agent (post-signup, mid-tour) |
| Device targets | Mobile 375px (primary), tablet 768px, desktop 1440px |
| Locale | English + Arabic (RTL) |
| Theme | Light + Dark |
| Route | `/onboarding/whatsapp/code` (tour step 3). Standalone: `/settings/channels/whatsapp/code` for re-issue after expiry. |
| Current state | MISSING — ships in Wave 4. |
| Workflow role | WF-01 step 3. |
| Backend prerequisites | ✅ `POST /api/auth/whatsapp/activation-code` — PR #50 §2.5. Screen is the primary consumer. ✅ `GET /api/auth/whatsapp/binding-status` — PR #50 §2.5. Screen mounts a poll that hands off to AGT-WLB-003 on `bound: true`. |

---

## Purpose

The agent has just tapped "Set up WhatsApp intake" on -001. This screen shows the activation code + shared WhatsApp number and instructs them to send the code as their first WhatsApp message. The moment the backend detects the binding, the tour advances to AGT-WLB-003 (waiting for first content message).

**Product truth:** the code is a token the agent sends INSIDE WhatsApp. On desktop, the tel-link + QR are the two paths to move the code into the phone; on mobile the wa.me deep-link opens WhatsApp with the message pre-filled — one tap.

---

## Layout (deltas from -001)

Everything from -001 stays: `<TourFrame>` with dot 3 active (dot 1 + 2 completed), close-X, screen title.

**Body replaces `<BenefitList>` with `<WhatsAppHandshakePanel>` (see anchor §4 for full anatomy).** Above the panel: a compact `<StepHero>` (neutral):
- Glyph: `<ChannelMark channel="whatsapp">` (unchanged)
- Title (mobile heading-1 / desktop display): "Send this code to activate"
- Body: "Copy the code below, open WhatsApp, and send it to the WingCaster number. We'll take it from there."

Below the panel: a small "How this works" collapsible (`<Collapsible>` primitive, closed by default). Content when open:
- Line 1: "WingCaster uses one shared WhatsApp number to keep intake fast and free."
- Line 2: "Your listings, leads, and conversations stay tied to your account."
- Line 3: "You can disconnect anytime from Settings → Channels."

**Sticky mobile bottom bar** (replaces -001's CTA stack):
- Primary: `<Button variant="default" size="lg">` full-width — "Open WhatsApp with code pre-filled" — leading `<ChannelMark>`. On tap opens `https://wa.me/<intl-number>?text=<display_code>` (relies on wa.me deep-link; safe on both iOS and Android).
- Secondary ghost above primary: "I'll send it manually" — dismisses the tour to a passive waiting state (still on this screen, but the primary CTA collapses to a `<Numeric>` display "Waiting for your message on WhatsApp…" with a `Loader2` spinner).

**Desktop layout:** two-column, 55/45 — `<WhatsAppHandshakePanel>` left column (code + tel-link + copy button); QR block right column with the caption "Or scan from another phone." The wa.me primary CTA sits below the handshake panel in the left column; ghost "I'll send it manually" beside it.

**RTL:** full mirror. The `<WhatsAppHandshakePanel>` mirrors so the copy button is on the LEFT of the code in RTL context; QR block stays on the RIGHT (it's a code, not layout).

---

## Explicit copy (deltas only)

| Slot | Copy |
|---|---|
| Hero title | Send this code to activate |
| Hero body | Copy the code below, open WhatsApp, and send it to the WingCaster number. We'll take it from there. |
| Panel overline (code) | Your activation code |
| Panel overline (number) | Send it to this WhatsApp number |
| Panel countdown | Expires in {mm}:{ss} |
| Panel copy button | Copy code |
| Panel copy button — success | Copied |
| Panel regenerate ghost | I didn't get it — get a new code |
| Regenerate loading | Getting a fresh code… |
| Regenerate success toast | New code ready — send {display_code} to activate. |
| QR caption | Or scan from another phone. |
| Collapsible label | How this works |
| Collapsible line 1 | WingCaster uses one shared WhatsApp number to keep intake fast and free. |
| Collapsible line 2 | Your listings, leads, and conversations stay tied to your account. |
| Collapsible line 3 | You can disconnect anytime from Settings → Channels. |
| Primary CTA | Open WhatsApp with code pre-filled |
| Ghost secondary | I'll send it manually |
| Passive waiting state | Waiting for your message on WhatsApp… |

---

## Interactions (deltas)

**On mount:**
- If route state carries `{ displayCode, sharedNumberE164, expiresAt }` from -001, render immediately.
- If not (direct entry, page refresh, re-issue path): fetch via `GET /api/auth/whatsapp/activation-code/current` if implemented, else `POST /api/auth/whatsapp/activation-code` (PR #50's endpoint returns the existing active code idempotently — verify at branch time; if it doesn't, this becomes `[BE-BLOCKER-09] GET current activation-code endpoint` filed in kickoff).
- Start polling `GET /api/auth/whatsapp/binding-status` every 3s (PR #50 §2.5). Backoff to 10s after 60s. Cap total polling at 24h (matches code TTL). On `bound: true`, navigate to AGT-WLB-003.

**On countdown expiry:**
- Panel pill turns muted "Expired". Primary CTA disables. Toast: "Your code expired. Tap 'I didn't get it' to get a fresh one."
- Auto-regenerate is NOT triggered — the agent must consent (H1 hardening from PR #50 decision doc).

**On copy button tap:**
- Uses `navigator.clipboard.writeText(displayCode)`. If unsupported (older browsers / iOS Safari in an in-app WebView): fallback to a hidden `<input>` + `document.execCommand('copy')`. On success swap icon to `Check` + label "Copied" for 2s.

**On regenerate ghost tap:**
- POST `/api/auth/whatsapp/activation-code` → invalidates prior code (PR #50 `invalidated_reason='REGENERATED'`) + returns new code. Panel re-renders. Reset countdown. Toast confirms.

**On primary CTA tap (mobile):**
- `window.location.href = 'https://wa.me/<intl-number>?text=<display_code>'`. On iOS, this deep-links to WhatsApp if installed; falls back to App Store otherwise.
- Do NOT navigate away from this screen after the tap. The agent will come back to WingCaster via the OS-level app switcher; the mounted poll on `binding-status` continues to run. The moment the backend registers the binding, the screen advances to -003.

**On primary CTA tap (desktop):**
- Copy the code to clipboard + open a small `Dialog` explaining "Open WhatsApp on your phone — the code is copied. Or scan the QR." Closes automatically on `bound: true`.

**On ghost "I'll send it manually" tap:**
- Primary CTA collapses to the passive waiting state (Loader + copy). Poll continues.

**On close-X:**
- Same safe-exit as -001. Resume banner drops on AGT-DSH-001.

---

## State variants (deltas)

| Variant | Trigger | Behavior |
|---|---|---|
| **Fresh-code** | Initial mount with route-state | Full render with active countdown. |
| **Waiting-passive** | Ghost tapped OR primary tapped and returned | Primary collapses to `Loader2 + "Waiting for your message on WhatsApp…"`. |
| **Code-expired** | Countdown hit 0 | Pill "Expired" muted; primary disabled; regenerate ghost is the only path forward. |
| **Regenerating** | Regenerate POST in flight | Panel dims + `Loader2` overlay; countdown pauses. |
| **Binding-detected** | `binding-status` returns `bound: true` | Navigate to AGT-WLB-003 with the bound-phone info in route state. No user action needed. |
| **Poll-error** | 3 consecutive poll failures | Non-destructive banner at top: "Checking your WhatsApp… reconnect to keep watching." Continues polling with 30s intervals. |
| **Poll-cap-reached** | 24h elapsed | Screen switches to a "It's been 24 hours" state with a primary "Get a new code" CTA. Poll stops. |
| **Offline** | Network unreachable | Banner + primary disabled; copy button still works; poll pauses; resumes on reconnect. |
| **RTL / Dark** | Locale = ar / prefers-color-scheme dark | Full mirror + token swap. QR stays black-on-white in both light and dark (QR contrast requirement). |

---

## Anti-patterns (deltas)

- ❌ Do not auto-copy the code on mount without a user gesture — silent clipboard writes fail in most modern browsers and confuse the agent.
- ❌ Do not open WhatsApp on mount. The primary CTA is the consent moment.
- ❌ Do not hide the QR block on mobile — an agent may be on their PC laptop reading the screen from a phone across the desk. Both paths render always.
- ❌ Do not swap the QR to a dark-mode-inverted version — QR scanners depend on high-contrast dark-on-light. Keep the QR always black-on-white; the surrounding chrome swaps with dark mode.
- ❌ Do not display the parseable code alone (`A4K9`). Always show the `WC-A4K9-JAMIL` display form so the copy looks intentional in the WhatsApp chat.
- ❌ Do not fabricate the sample display-code hint — the hint comes from the agent's first name per PR #50 §2.4.

---

## Downstream implementation notes (deltas)

- **File:** `web/src/pages/onboarding/WhatsAppActivationCodePage.tsx`.
- **Reuses:** all five anchor components from AGT-WLB-001; `<WhatsAppHandshakePanel>` is the primary usage site.
- **Poll hook:** `web/src/hooks/useBindingStatusPoll.ts` — parameterized backoff schedule; cancels on unmount; syncs with tab-visibility API (pauses when tab is hidden, resumes on focus).
- **Deep-link builder:** `web/src/lib/whatsapp/waMeLink.ts` — pure function `(e164: string, text: string) → string`. Strips non-digits from the phone; URL-encodes the text.
- **Test discipline:** unit tests for the countdown formatter (mono + tabular-nums), the regenerate flow, the wa.me link builder edge cases (spaces, plus sign, RTL characters in the display code). Real-Postgres test that end-to-end mocks an inbound webhook to trigger the binding-detected transition.
