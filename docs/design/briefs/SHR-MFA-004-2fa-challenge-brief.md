# Screen Brief — SHR-MFA-004 · Two-factor challenge at sign-in (ANCHOR — operational family)

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

Companion to `SCREEN_MATRIX_SHARED.md` entry `SHR-MFA-004`. Wave-4 anchor per `SCREEN_MATRIX_IMPLEMENTATION_KICKOFF.md` Rev 9 §5 row 8 + §6 Week 4. **This brief is the anchor for the OPERATIONAL family (004 + 004b + 007)** — SHR-MFA-004b and SHR-MFA-007 are delta briefs that inherit layout, tokens, and interaction language from here. **P0 per kickoff §5** — enrolling 2FA without being able to use it is a false security promise.

---

## 🎨 Broadcast alignment

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`.** All color / font / spacing / motion / radii references below are governed by that reference.

**Screen-specific Broadcast callouts:**

- Screen title ("Verify it's you"): `var(--lc-type-heading-1)` — IBM Plex Sans 600 26/32.
- 6-digit code input: monospace via `var(--lc-font-mono)` + `tabular-nums`; each cell is 44×48px minimum. Cell border `--lc-border-strong`; focused cell border `--lc-action-primary`.
- Verify CTA: `--lc-action-primary` fill + `--lc-action-primary-text` ink. Hover DARKENS to `--lc-action-primary-hover`. Disabled state uses primitive default (never lighter primary).
- "Use a backup code instead" link: `<Button variant="link">` — ink `--lc-text-brand`.
- Rate-limit banner: `--lc-status-warning-bg` + `--lc-status-warning-fg` + `⚠` glyph + countdown text using `<Numeric>`.
- Attempts-remaining hint: `var(--lc-type-caption)` + `--lc-text-muted`.
- Focus rings: two-tone via base CSS. Do NOT override.
- 44px tap-target floor automatic on every button and link.

---

## Meta

| | |
|---|---|
| Screen ID | SHR-MFA-004 |
| Screen name | 2FA challenge (sign-in) |
| Persona | Shared (anonymous-half-authed) — password verified, session not yet issued |
| Device targets | Mobile 375px (primary), tablet 768px, desktop 1440px |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark, respect `prefers-color-scheme` |
| Route | `/login?stage=2fa` — same route as `/login` with stage query param + `challenge_id` in state |
| Current state | MISSING / embedded in login flow — needs verification. Backend exists (`auth-2fa.js` `startSigninChallengeIfRequired` + `/api/auth/2fa/challenge`). |
| Workflow role | n/a — sign-in branch |
| Backend prerequisites | ✅ `auth-2fa.js` MERGED — `POST /api/auth/2fa/challenge` accepts `{ challenge_id, code }`, tries TOTP first then falls back to backup code, returns session on success. `MAX_CHALLENGE_ATTEMPTS = 5`. `CHALLENGE_TTL_SECONDS = 600` (10 min). |

---

## Purpose

Between "password accepted" and "session issued", give a user whose account has TOTP enrolled the fastest possible path to enter their 6-digit code. Backup code is offered as a subordinate alternative for the "I lost my phone" case (that path leads to SHR-MFA-004b). The screen must NOT reveal that 2FA is enrolled if the account doesn't exist — uniform behavior with SHR-AUT-001's failed-login copy.

---

## Design goals

1. **Focus is the code input.** Autofocus first cell on mount. No other primary control competes for attention.
2. **Paste-friendly.** Pasting a 6-digit code into any cell fills all 6 correctly. iOS SMS-style auto-fill works (though 2FA codes don't come by SMS here — user pastes from authenticator).
3. **Recovery is one tap away.** "Use a backup code instead" link is prominent below the input but visually secondary — link styling, not button.
4. **Uniform failure copy.** Backend's `redeemChallenge` returns the same error shape for invalid code / expired / already-used — UI never leaks WHY.
5. **Attempt budget is visible.** After the first failure, show "3 attempts remaining" so the user isn't blindsided by a lockout.
6. **RTL first-class.** Code cells stay LTR (numerals are LTR by convention). Everything else mirrors.
7. **No back-to-login shortcut without warning.** "Sign in as different user" resets the whole login flow and abandons the challenge — confirm before doing it on mobile.

---

## Layout

### Desktop / tablet ≥768px

Two-column split, 60/40 (mirroring SHR-AUT-001):

**Left column (60%) — challenge area, centered in a 400px column with 40px top padding:**

- Top-right of the column: language selector (SHR-NAV-006 embedded).
- Brand hero (72px tall): WingCaster wordmark + small tagline ("Verify it's you.").
- H1: "Verify it's you"
- Sub: "Enter the 6-digit code from your authenticator app."
- **Code input** — 6 cells in a row, `48px × 56px` each, `12px` gap, `var(--lc-font-mono)`, centered. Each cell has its own hidden `<input inputMode="numeric" pattern="[0-9]*" maxLength="1">`. Paste on any cell → distribute across all six.
- **Attempts hint** (visible after first wrong attempt): `var(--lc-type-caption)` + `--lc-text-muted`: "{n} attempts remaining."
- **Verify CTA**: full-width in the 400px column, primary orange, `size="lg"`, label "Verify". Disabled until all 6 cells filled with digits.
- **Recovery block**:
  - Link (primary): `Use a backup code instead` — goes to SHR-MFA-004b via `?stage=backup` param on the same route (challenge_id preserved).
  - Divider dot (·)
  - Link (muted): `Sign in as different user` — resets the flow.
- **Trust footer**: `var(--lc-type-caption)` + `--lc-text-muted`: "This code protects your account. It changes every 30 seconds."

**Right column (40%) — hero panel:**

Same shape as SHR-AUT-001: gradient background, illustration, one rotating value-prop line. Illustration can be reused / de-emphasized since this is a mid-flow screen (user has already made a commitment by getting here).

### Mobile ≤767px

Single column, no side hero:
- Top bar: WingCaster wordmark + language selector.
- H1 + sub.
- Code input centered — cells scale down to `40px × 48px` with `8px` gap to fit 375px width comfortably. Test on iPhone SE (320px effective inner width).
- Verify CTA full-width.
- Recovery links stacked vertically (backup code link on top, sign-in-as-different below).
- Trust footer at bottom above safe-area inset.

### Code-input cell anatomy

- Individual cell: `<input>` with `type="text"` + `inputMode="numeric"` + `pattern="[0-9]*"` + `maxLength="1"` + `autocomplete="one-time-code"`.
- On digit entry: auto-advance focus to next cell.
- On backspace in empty cell: focus previous cell + clear it.
- On paste of a 6-digit string: distribute one digit per cell + focus the Verify button.
- Border: `2px solid var(--lc-border-strong)`; focused: `2px solid var(--lc-action-primary)`; filled: `2px solid var(--lc-border-strong)` + filled-text-color `--lc-text-primary`; error: `2px solid var(--lc-status-danger-fg)`.

---

## Explicit copy (English)

Arabic strings marked `[TRANSLATION-PENDING]` in the AR mirror MDX until copywriter pass.

| Slot | Copy |
|---|---|
| H1 | Verify it's you |
| Sub | Enter the 6-digit code from your authenticator app. |
| Code input aria-label | 6-digit verification code |
| Attempts hint | {n} attempts remaining. |
| Verify CTA | Verify |
| Verify CTA (loading) | Verifying… |
| Backup code link | Use a backup code instead |
| Different user link | Sign in as different user |
| Trust footer | This code protects your account. It changes every 30 seconds. |
| Error — invalid code | That code did not match. Check your authenticator and try again. |
| Error — expired challenge | This verification session has expired. Please sign in again. |
| Error — already used | This verification session was already used. Please sign in again. |
| Error — rate-limited | Too many attempts. For your security, try signing in again in {minutes} minutes. |
| Error — network | We couldn't reach WingCaster. Check your connection and try again. |
| Different-user confirm modal title | Sign in as different user? |
| Different-user confirm modal body | You'll return to the sign-in screen and this verification will be cancelled. |
| Different-user confirm CTA | Yes, sign out |
| Different-user cancel | Stay here |

Copy voice: same as SHR-AUT-001 — warm, direct, second-person, no exclamation marks. Never "Oops".

---

## Component palette

| Element | Primitive |
|---|---|
| Code input | Custom `<OtpInput count={6}>` component — must exist as shared primitive (see §Shared primitives) |
| Verify CTA | `<Button variant="default" size="lg">` — full-width in column |
| Recovery links | `<Button variant="link">` — inline text-style |
| Different-user confirm | `<AlertDialog>` primitive |
| Rate-limit banner | Custom inline banner with `--lc-status-warning-*` tokens + `AlertTriangle` icon |
| Error inline | Small text above CTA, `--lc-status-danger-fg`, `AlertCircle` icon |
| Icons | `lucide-react`: `ShieldCheck`, `AlertCircle`, `AlertTriangle`, `KeySquare` |

---

## Sample content (for v0 / mockup)

**Idle state (desktop LTR, light):**
- H1 "Verify it's you" + sub.
- 6 empty cells, first cell focused (has active border).
- Verify button disabled.
- Recovery links visible below.

**Typing state:**
- First 3 cells filled with `1 · 2 · 3`, cursor in cell 4.
- Verify button still disabled.

**Ready state:**
- All 6 cells filled `123 · 456`.
- Verify button enabled.

**Loading state:**
- All cells filled but grayed out.
- Verify button shows spinner + "Verifying…".

**Error state (wrong code):**
- All cells briefly go red (border `--lc-status-danger-fg`) then reset to empty.
- Above CTA: "That code did not match. Check your authenticator and try again."
- Attempts hint: "4 attempts remaining."

**Rate-limited state:**
- All cells disabled.
- Banner above cells: "Too many attempts. For your security, try signing in again in 15 minutes."
- Verify button disabled. Backup code link REMAINS enabled (it's a separate factor path).

---

## Interactions

**On mount:**
- Read `challenge_id` from URL state (passed by SHR-AUT-001 after password success). If missing/invalid, redirect to `/login`.
- Autofocus first cell.
- Start a 10-minute expiry countdown internally (matches backend `CHALLENGE_TTL_SECONDS`). At `t-30s`, show a subtle hint: "This code will expire soon."

**On digit entry in a cell:**
- Auto-advance focus to next cell.
- On last cell filled: enable Verify button + optionally auto-submit (see §5 note below).

**On backspace in empty cell:**
- Focus previous cell + clear it.

**On paste (Cmd/Ctrl+V or long-press):**
- If pasted string has ≥6 digits: fill all 6 cells + focus Verify button.
- If <6 digits: fill starting from current cell.
- Strip non-digit characters silently.

**Auto-submit toggle:** Default OFF (do NOT auto-submit on 6th digit). User has explicit control via Verify button. This is a security-sensitive screen — accidental submit before user has visually verified their code is unacceptable. Autofill from authenticator apps (iOS one-time-code fill) still requires an explicit tap.

**On Verify click:**
- POST `/api/auth/2fa/challenge` with `{ challenge_id, code: "123456" }`.
- On 200: session token in response → set auth state → redirect per `redirect_after_login` param or default to `/`.
- On 401 with `remaining_attempts`: shake cells 200ms + clear + show error above CTA + update attempts hint.
- On 429: show rate-limit banner, disable input, keep backup code link enabled.
- On 410 (expired): redirect to `/login` with a toast: "Your verification session expired. Please sign in again."
- On network error: inline banner, retry button.

**On "Use a backup code instead" click:**
- Navigate to `/login?stage=backup&challenge_id=<same>` — SHR-MFA-004b takes over. Same `challenge_id` continues (backend accepts both TOTP and backup code against a single 'signin' challenge — see `redeemChallenge` line 208-240).

**On "Sign in as different user" click:**
- Open confirm modal.
- On confirm: DELETE any client-side challenge state, redirect to `/login` fresh (no stage param). Backend challenge remains on disk until TTL expires — harmless.

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Idle — empty** | Page load with valid challenge_id | Cells empty, first focused, Verify disabled. |
| **Typing** | User entering digits | Cells fill left-to-right; Verify enabled at 6th digit. |
| **Loading — verifying** | Verify clicked, POST in flight | All cells + Verify button + recovery links disabled; button shows spinner + "Verifying…". |
| **Error — invalid code** | 401 with remaining_attempts | Cells shake 200ms + clear + refocus first cell. Attempts hint updated. |
| **Error — expired challenge** | 410 from backend | Redirect to /login with toast. |
| **Error — already used** | 401 with 'Challenge already used' | Redirect to /login with toast. |
| **Rate-limited** | 429 from backend OR local attempt counter ≥ 5 | Banner shown, input disabled, backup link still enabled. |
| **About to expire** | Local countdown reaches T-30s | Subtle sub-line: "This code will expire soon." No modal, no interruption. |
| **Missing challenge** | No `challenge_id` in URL state | Redirect to /login immediately with a "Please sign in again" toast. |
| **Loading — page** | Route resolving | Skeleton: 6 gray cells + button placeholder. |
| **Offline** | Network unreachable | Top-of-form banner + Verify disabled. Backup link disabled too (also needs network). |
| **RTL** | Locale = ar | Whole layout mirrors. Code cells stay LTR. Numerals inside cells: Western digits (0-9) — authenticator apps output Western digits regardless of locale. |
| **Dark mode** | prefers-color-scheme dark | All tokens swap; cell borders visible against dark surface. |

---

## Accessibility

- The 6-cell code input has a single `role="group"` wrapper with `aria-label="6-digit verification code"`.
- Each cell input has an aria-label: "Digit 1 of 6", "Digit 2 of 6", etc.
- Live-region announcement after failure: `aria-live="assertive"`: "Code did not match. 4 attempts remaining."
- Rate-limit banner uses `role="alert"`.
- Tab order flows: cell 1 → cell 2 → ... → cell 6 → Verify → backup link → sign-in-as-different link → language selector.
- Escape key in the different-user confirm modal cancels + refocuses the input.
- Focus rings visible on cells + buttons (two-tone Broadcast).
- All tap targets ≥ 44×44 CSS pixels including individual cells and the recovery links.
- Screen-reader users can paste into the first cell and hear "6-digit code entered" via a live-region announcement.

---

## Anti-patterns (do not do these)

- ❌ Do not auto-submit on 6th digit. Security-sensitive input requires explicit user submit.
- ❌ Do not reveal that 2FA is enrolled if the account doesn't exist. This screen is only reachable via a valid `challenge_id` — the challenge is created only after password success (see `startSigninChallengeIfRequired`). Accounts without 2FA never see this screen. Accounts that don't exist never see this screen. Uniform behavior with SHR-AUT-001.
- ❌ Do not leak WHY a challenge failed (backend's `redeemChallenge` returns generic error shapes for a reason). Never say "backup code required" — say "That code did not match".
- ❌ Do not include a "Resend code" link. TOTP codes are not sent — they're generated by the user's authenticator. This screen has NO resend concept (unlike SHR-AUT-002 email OTP which does).
- ❌ Do not shrink code cells below 40×48px on mobile. iOS SMS-code cell convention is ~48px — smaller cells frustrate one-handed use.
- ❌ Do not use color-only error signaling — cells shake + red border + text error together.
- ❌ Do not hide the backup code link during rate-limit. Backup code is a separate factor and must remain accessible.
- ❌ Do not celebrate success on this screen with confetti or elaborate animation. A brief 120ms "verified" checkmark before redirect is enough.
- ❌ Do not persist the `challenge_id` in localStorage — keep it in memory / URL state. It expires in 10 minutes anyway.

---

## Reference designs

Draw structural cues from — do NOT copy 1:1:
- **GitHub 2FA challenge** — the clean 6-cell input pattern.
- **Google 2SV** — the paste behavior and auto-advance.
- **Stripe MFA** — the "Use a backup code instead" recessed link.
- **Vercel MFA** — the countdown-to-expiry hint pattern.
- **1Password unlock** — the calm no-shake first-attempt UX.

Do NOT match:
- Bank OTP screens with 4-digit inputs (we have 6 — TOTP standard).
- iOS Screen Time PIN (dot-style, too consumer).
- SMS carrier verification pages (too cluttered).

---

## Backend contract

**POST `/api/auth/2fa/challenge`** — NO auth required (user has no session yet)

Request:
```json
{
  "challenge_id": "uuid-from-login-response",
  "code": "123456"
}
```

Response 200 (TOTP or backup code accepted):
```json
{
  "token": "jwt...",
  "agent": { "id": "...", "email": "...", "display_name": "..." },
  "factor_used": "totp"    // or "backup_code"
}
```
Client should show a small toast if `factor_used === "backup_code"`: "You used a backup code. That code is now used up. [View backup codes →]" — the toast links to SHR-MFA-005.

Response 401 (invalid code):
```json
{
  "error": "Invalid code",
  "remaining_attempts": 4
}
```

Response 401 (already used / invalid challenge):
```json
{ "error": "Invalid or expired challenge" }
```
No `remaining_attempts` field → treat as unrecoverable, redirect to /login.

Response 410 (expired):
```json
{ "error": "Challenge has expired" }
```

Response 429 (locked):
```json
{ "error": "Too many failed attempts" }
```

**Companion endpoint (used by SHR-AUT-001 upstream):** `POST /api/auth/login` returns `{ challenge_id, method: 'totp' }` instead of `{ token }` when the account has `totp_enabled: true`. SHR-AUT-001 stores `challenge_id` in memory and navigates to `/login?stage=2fa`, passing `challenge_id` via router state.

---

## Downstream implementation (Cursor prompt handoff notes)

- **File to create:** `web/src/pages/TwoFactorChallengePage.tsx`.
- **Route:** `/login?stage=2fa` — same route as `/login` but conditional render based on `stage` query param. Both SHR-AUT-001 and SHR-MFA-004 live on `/login`.
- **Refactor** `web/src/pages/LoginPage.tsx` to store `challenge_id` in a `useReducer` state or router state after a successful password submit that returns a challenge, then conditionally render `<TwoFactorChallengePage>` instead of the login form.
- **Component decomposition:**
  - `OtpInput` — 6-cell code input, EXTRACT as shared primitive (`web/src/components/ui/otp-input.tsx`). Used by SHR-AUT-002, SHR-MFA-004, SHR-MFA-004b, SHR-MFA-006, SHR-MFA-007.
  - `TwoFactorChallengeCard` — the H1 + sub + input + button + recovery links composition (specific to this screen).
  - `RateLimitBanner` — extracted shared primitive; used by SHR-AUT-001 rate-limit state + SHR-MFA-004 + SHR-MFA-004b.
- **Test discipline:**
  - Unit: OtpInput handles paste + backspace + auto-advance correctly.
  - Unit: state transitions (idle → typing → ready → loading → error → shake+reset).
  - Integration: mock `/api/auth/2fa/challenge` — success path, wrong code path, rate-limit path, expired path.
  - Integration: "Use a backup code instead" → routes to SHR-MFA-004b with same challenge_id.
  - RTL: layout mirrors, code cells stay LTR with Western digits.
  - Broadcast: `no-raw-hex.test.ts` stays green.
- **Shared primitives extracted:**
  - `<OtpInput>` — REQUIRED extraction. Consumed by 5 screens across the MFA + AUT families.
  - `<RateLimitBanner>` — REQUIRED extraction.
  - `<TrustFooter>` — small, reused across SHR-AUT-001, SHR-AUT-006, SHR-MFA-004, SHR-MFA-004b.

---

## Broadcast alignment callouts

- Code input cells: `border: 2px solid var(--lc-border-strong)`; focused `border-color: var(--lc-action-primary)`; error `border-color: var(--lc-status-danger-fg)`; radius `var(--lc-radius-md)`; padding centered content; cell width `48px` desktop / `40px` mobile.
- Verify CTA: `var(--lc-action-primary)` fill, hover DARKER `var(--lc-action-primary-hover)`.
- Recovery link: `<Button variant="link">` — color `var(--lc-text-brand)`, underline on hover.
- Rate-limit banner: `background: var(--lc-status-warning-bg)`, foreground `var(--lc-status-warning-fg)`, glyph `⚠`, countdown via `<Numeric>`.
- Error text above CTA: `color: var(--lc-status-danger-fg)`, glyph via `AlertCircle` icon at 16px.
- Trust footer: `var(--lc-type-caption)` + `--lc-text-muted`.
- Focus ring: two-tone via base CSS, do not override per cell.
- Motion: cell shake on error `200ms` with `var(--lc-easing-in-out)`, translateX ±4px sequence. Auto-advance focus is instant. Button hover `var(--lc-duration-fast)`.
- Radii: cells + button `var(--lc-radius-md)`.

---

## Handoff instruction to v0

Paste this brief in full into a fresh v0.app chat. Framing prompt:

```
I'm designing the WingCaster 2FA challenge screen at sign-in (SHR-MFA-004) — MENA real-estate B2B SaaS. This is the operational anchor of the 2FA family; sibling screens (SHR-MFA-004b backup-code sign-in, SHR-MFA-007 step-up prompt) inherit layout + tokens from here. Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind.

First pass: render the desktop 1440px layout in IDLE state — H1 "Verify it's you", sub "Enter the 6-digit code from your authenticator app.", 6 empty code cells with the first one focused, disabled "Verify" primary CTA, and recovery links "Use a backup code instead · Sign in as different user" below.

Right column is a 40% hero panel with a subdued gradient + illustration + one value-prop line ("Your account is protected." — muted).

LTR English only for this pass — I'll ask for typing/ready/error/rate-limited/mobile/RTL/dark as follow-ups.

Follow the copy table exactly. Do NOT auto-submit on the 6th digit. Do NOT include a "resend code" link (TOTP codes are not sent).

DESIGN BRIEF FOLLOWS:
```

Iteration order:
1. Now the TYPING state — cells 1-3 filled `1 · 2 · 3`, cursor in cell 4, Verify still disabled.
2. Now READY state — all 6 filled `123 · 456`, Verify enabled + hover state.
3. Now ERROR state — cells red-bordered + shake, error text "That code did not match. Check your authenticator and try again." + attempts hint "4 attempts remaining."
4. Now RATE-LIMITED state — cells disabled, warning banner "Too many attempts. For your security, try signing in again in 15 minutes." backup-code link still enabled.
5. Now mobile 375px IDLE state — cells scale to 40×48px, recovery links stacked.
6. Now RTL Arabic desktop 1440px READY state — layout mirrored, cells stay LTR with Western digits.
7. Now dark mode desktop LTR IDLE state.

Save each output to `docs/design/mockups/SHR-MFA-004-<state>.png` and JSX to `docs/design/mockups/v0-outputs/SHR-MFA-004/`.

---

## Definition of done for this brief

- [ ] v0 produced all 7 iteration states.
- [ ] Screenshots committed under `docs/design/mockups/`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/`.
- [ ] `<OtpInput>` and `<RateLimitBanner>` extracted as shared primitives in the same PR.
- [ ] Cursor Wave-4 dispatch prompt references this brief + the mockup paths.
- [ ] Kickoff §5a updated to note SHR-MFA-004 is the OPERATIONAL anchor for the family.
