# Screen Brief — SHR-MFA-006 · Disable two-factor authentication — DELTA

**Delta brief.** Inherits from `SHR-MFA-001-2fa-settings-brief.md` (enrollment anchor) for layout + tokens. **P0 per kickoff §5 row 11** — the reversal path is required by security policy. Renders as a **modal from SHR-MFA-001**, not a dedicated route, per matrix note. Chained behind step-up (SHR-MFA-007) which the settings page triggers before opening this modal.

---

## 🎨 Broadcast alignment

**Inherits from `BROADCAST_ALIGNMENT_REFERENCE.md`.** Delta callouts only:

- Modal shell: `<Dialog>` primitive with `--lc-elevation-lg` shadow, `var(--lc-radius-lg)` corners, `--lc-surface-raised` background, max-width `480px`.
- Warning banner (top of modal): `--lc-status-danger-bg` + `--lc-status-danger-fg` + `⚠` glyph.
- Typed-confirmation input: standard `<Input>` with placeholder helper text.
- Destructive final CTA: `<Button variant="destructive">` — DISABLED until the confirmation text matches exactly.
- Cancel button: `<Button variant="ghost">`.

---

## Meta (delta only)

| | |
|---|---|
| Screen ID | SHR-MFA-006 |
| Screen name | Disable two-factor authentication (modal) |
| Route | Modal from `/settings/2fa` — no dedicated route |
| Current state | MISSING or partial. Backend exists — `POST /api/auth/2fa/totp/disable` requires elevation + a live TOTP or backup code. |
| Backend prerequisites | ✅ `POST /api/auth/2fa/totp/disable` MERGED — requires `requireElevated()` middleware (step-up token) AND a live TOTP/backup code in the request body. Two independent proofs required (auth-2fa.js line 410 comment: "belt and braces"). Also bumps `token_version` to evict every other outstanding session. |

---

## Purpose

Give a user a deliberately friction-heavy path to turn off 2FA, requiring (1) recent step-up authentication, (2) a live TOTP or backup code proving they still control the second factor, (3) a typed literal confirmation ("DISABLE") that filters out accidental clicks. On success, 2FA is off, backup codes are invalidated, every other session for the account is signed out, a notification email fires.

---

## Delta from anchor

**Precondition:** This modal ONLY opens AFTER a successful step-up (SHR-MFA-007) triggered from SHR-MFA-001's "Turn off" CTA. The elevated token is held in memory by the parent (SHR-MFA-001) and passed via the disable POST as `Authorization: Bearer <session>` + `X-Elevated-Token: <elevated>` header.

**Layout — modal, 480px max-width:**

- Modal title: "Turn off two-factor authentication?" — `var(--lc-type-heading-2)`.
- **Warning banner** — `--lc-status-danger-bg`, `⚠` glyph, text: "This reduces your account security. Your account will be signed out on every other device."
- **Body copy** — `var(--lc-type-body)`, muted: "You'll also lose your backup codes. If you turn two-factor back on later, you'll need to enroll a new authenticator and save a new set of codes."
- **Reason dropdown** (optional analytics — collected without gate): `<Select>` labeled "Why are you turning this off? (Optional)":
  - "Lost my authenticator"
  - "Getting a new device"
  - "It's too much friction"
  - "I don't need this level of security"
  - "Other"
  - "Prefer not to say"
- **Code confirmation input** — `<Input>` labeled "Enter a current 6-digit code from your authenticator, or a backup code". Placeholder `123456` or `XXXX-XXXX-XXXX`. Accepts both — backend tries TOTP first then backup (auth-2fa.js line 421-440).
- **Typed confirmation input** — `<Input>` labeled "Type DISABLE to confirm". Placeholder `DISABLE`. Match must be exact (case-sensitive). Sub-line: "This helps prevent accidental clicks."
- **Actions row** — right-aligned: `Cancel` (ghost) + `Turn off two-factor` (destructive). Destructive DISABLED until:
  - Code confirmation input has ≥6 characters, AND
  - Typed confirmation input equals exactly `DISABLE`.
- **Sub-line under actions** (small, muted): "You'll be signed out of every other device. This device stays signed in."

**Copy delta:**

| Slot | Copy |
|---|---|
| Modal title | Turn off two-factor authentication? |
| Warning banner | ⚠ This reduces your account security. Your account will be signed out on every other device. |
| Body | You'll also lose your backup codes. If you turn two-factor back on later, you'll need to enroll a new authenticator and save a new set of codes. |
| Reason label | Why are you turning this off? (Optional) |
| Code input label | Enter a current 6-digit code from your authenticator, or a backup code |
| Code input placeholder | 123456 or XXXX-XXXX-XXXX |
| Typed input label | Type DISABLE to confirm |
| Typed input placeholder | DISABLE |
| Typed input helper | This helps prevent accidental clicks. |
| Destructive CTA | Turn off two-factor |
| Destructive CTA (loading) | Turning off… |
| Cancel | Cancel |
| Actions sub | You'll be signed out of every other device. This device stays signed in. |
| Error — invalid code | That code did not match. Try another. |
| Error — expired elevation | Your verification session expired. Please try again. |
| Success toast | Two-factor authentication is off. A confirmation email has been sent to {email}. |

**Interactions delta:**

- Modal opens with focus on the code input.
- Reason dropdown is genuinely optional — no gate. Analytics captured to a separate event (not tied to the disable POST body).
- On code input: no format enforcement (accept 6-digit or backup format). Backend handles both.
- On typed input: exact match "DISABLE" (case-sensitive) required. Trimmed whitespace tolerated.
- On Turn-off click: POST `/api/auth/2fa/totp/disable` with `{ code }` + `X-Elevated-Token` header + `reason` (analytics separate).
- On 200: close modal. Update SHR-MFA-001 state to disabled. Show a success toast. Fire notification email (backend responsibility — do not show a separate confirm from UI). Optionally: rotate the current session token from the response (`{ token }`) since token_version was bumped — the response includes a fresh session token to keep the current device signed in (auth-2fa.js line 482-486).
- On 401 invalid code: inline error, do NOT close modal.
- On 401 expired elevation: close modal, re-trigger step-up (SHR-MFA-007) via the parent, then re-open this modal with the fresh token.
- On network error: inline error, retry available.
- Escape key: cancels + closes.

**State variants delta:**

| Variant | Behavior |
|---|---|
| **Initial** | Both inputs empty, destructive disabled. |
| **Code entered** | Code input filled, typed still empty, destructive still disabled. |
| **Confirmation typed** | Both inputs filled correctly, destructive enabled. |
| **Confirmation typo** | User typed something like "disable" or "DISABLE ", destructive stays disabled + helper text tint darker. |
| **Loading — disabling** | Both inputs + reason + buttons disabled; destructive shows spinner. |
| **Error — invalid code** | Inline error under code input, modal stays open, destructive re-enabled to retry. |
| **Error — expired elevation** | Modal closes, step-up re-triggered by parent. |
| **Success** | Modal closes, SHR-MFA-001 refreshes state, toast fires. |
| **Cancelled** | Modal closes with no side effects. |
| **RTL** | Mirrors — typed input still requires literal Latin "DISABLE" (case-sensitive) even in Arabic. **Copy alternative for Arabic**: use "تعطيل" (Arabic word for disable) — decided by copywriter pass. Brief marks this as `[TRANSLATION-DECIDE]`. |
| **Dark mode** | All tokens swap. Warning banner keeps its danger tint (danger tokens have dark-mode values). |

**Anti-patterns delta:**

- ❌ Do not skip the step-up gate. The backend REQUIRES `requireElevated()` — the modal must not even open without an elevated token in hand.
- ❌ Do not skip the code input. The backend REQUIRES a live TOTP or backup code as a second independent proof.
- ❌ Do not skip the typed confirmation. Anti-fat-finger check.
- ❌ Do not enable the destructive CTA until BOTH inputs validate.
- ❌ Do not use "confirmed" for the destructive button label — it must clearly say "Turn off two-factor" so a screen-reader user hears the action.
- ❌ Do not use color-only warning — danger banner has icon + text + tint.
- ❌ Do not offer a "Skip email notification" checkbox. Security email is non-optional (matrix note).
- ❌ Do not use `<Button variant="destructive">` with lighter fill on disable — the destructive-disabled state is muted, not colored.

**Backend contract delta:**

`POST /api/auth/2fa/totp/disable`
- Headers: `Authorization: Bearer <session>` + `X-Elevated-Token: <elevated>` (from prior SHR-MFA-007 step-up).
- Body: `{ code: "123456" }` — TOTP or backup code.
- Response 200: `{ totp_enabled: false, token: "<fresh session token>" }` — client must swap in the fresh token, current device stays signed in, all other devices are logged out via token_version bump.
- Response 401 `Invalid code`: bad TOTP/backup code — modal stays open.
- Response 403: elevated token missing/expired — modal closes, step-up re-triggered.
- Response 409 `totp_not_enabled`: race — someone else disabled 2FA in another session. Show toast, close modal, refresh SHR-MFA-001.

Notification email fires from backend (existing pattern in auth-2fa.js `logActivity({ type: '2fa_totp_disabled' })` hook drives the notification pipeline).

**Shared primitives:**

- Reuse `<Dialog>` from ui/dialog.
- Reuse `<Select>` for reason dropdown.
- Reuse `useStepUp()` hook — the parent SHR-MFA-001 triggers it before this modal opens.
- Session-token-rotation helper `rotateSessionToken(newToken)` — should be centralized; may already exist in `web/src/lib/auth.ts` — verify during implementation.

**Definition of done:** initial + code-entered + confirmation-typed + typo + loading + error + success + cancel + mobile + RTL + dark states rendered; JSX committed; end-to-end test: step-up → open modal → wrong code → correct code + typed DISABLE → success → SHR-MFA-001 shows Disabled state.
