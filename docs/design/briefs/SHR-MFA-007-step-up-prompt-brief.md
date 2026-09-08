# Screen Brief — SHR-MFA-007 · Step-up authentication prompt — DELTA

**Delta brief.** Inherits from `SHR-MFA-004-2fa-challenge-brief.md` (operational anchor) for tokens + `<OtpInput>` primitive. Renders as a **modal** invoked by `<StepUpProvider>` from anywhere in the app before a sensitive action. Per kickoff §5 row 7, this is bundled in the same MFA PR as enrollment. Audit-and-align pass because the design context assumed an existing brief — this brief is authored fresh but written to be swap-in compatible with any prior draft.

---

## 🎨 Broadcast alignment

**Inherits from `BROADCAST_ALIGNMENT_REFERENCE.md` + delta from SHR-MFA-004:**

- Modal shell: `<Dialog>` primitive with `--lc-elevation-lg`, `var(--lc-radius-lg)` corners, `--lc-surface-raised` background, max-width `440px`.
- Header icon: `ShieldCheck` at 24px in `--lc-text-brand` for authenticator variant; `Mail` at 24px in `--lc-text-secondary` for email variant.
- Reuse `<OtpInput>` primitive from SHR-MFA-004.
- Reason line (context about what needs step-up) rendered in `--lc-surface-sunken` inset well, small font.

---

## Meta (delta only)

| | |
|---|---|
| Screen ID | SHR-MFA-007 |
| Screen name | Step-up authentication prompt (modal) |
| Route | Modal invoked by `<StepUpProvider>` — no dedicated route |
| Current state | PARTIAL — `useStepUp()` hook may exist per prior work. Modal UI needs verification. |
| Backend prerequisites | ✅ `POST /api/auth/step-up` MERGED — for TOTP-enrolled users returns a challenge for authenticator; for non-enrolled users emails an OTP. `POST /api/auth/step-up/verify` MERGED — returns `{ elevated_token, expires_in, expires_at, factor_used }`. Elevated token TTL is `ELEVATION_TTL_SECONDS`. |

---

## Purpose

Give the app a single, consistent modal that re-proves identity before a sensitive action — disable 2FA, delete account (SHR-SET-005), grant credits (PA), regenerate backup codes (SHR-MFA-005), transfer ownership (agency), view credit history (per matrix note). The modal is factor-adaptive: TOTP-enrolled users see a 6-cell code input; non-enrolled users see a single-line 6-digit input with a "we emailed you a code" helper.

---

## Delta from anchor

**Precondition:** Any component that requires step-up wraps its sensitive action in a call to `useStepUp({ reason: "Disable two-factor authentication" })` which returns `{ requireStepUp: () => Promise<{ elevatedToken }> }`. Calling `requireStepUp()` opens this modal, initiates the backend challenge via POST `/api/auth/step-up`, and resolves with the elevated token on success (or rejects on cancel/timeout).

**Layout — modal, 440px max-width:**

- Header row: icon (ShieldCheck for TOTP variant; Mail for email variant) + title "Verify it's you" — `var(--lc-type-heading-3)`.
- **Reason well** — a small `--lc-surface-sunken` block: `var(--lc-type-body-sm)` + `--lc-text-secondary`, text: "Confirm your identity to continue: **{reason}**". The reason comes from the calling code, e.g. "Turn off two-factor authentication" / "Delete your account" / "Grant credits to a tenant" / "Regenerate backup codes".
- **Method-adaptive body**:
  - **TOTP variant** (when `method === 'totp'`): sub-line "Enter the 6-digit code from your authenticator app." + `<OtpInput count={6}>` reused from SHR-MFA-004.
  - **Email variant** (when `method === 'email'`): sub-line "We sent a 6-digit code to {maskedEmail}. Enter it below." + `<OtpInput count={6}>` + small "Resend code" ghost link with 60s cool-down (email variant only — TOTP has no resend concept).
- **Attempts hint** (visible after first wrong attempt): `var(--lc-type-caption)` + `--lc-text-muted`: "{n} attempts remaining."
- **Actions row** — right-aligned: `Cancel` (ghost) + `Verify` (primary orange). Verify enabled when all 6 cells filled.
- **Fallback link** (TOTP variant only): "Use a backup code instead" — swaps the input for a `<BackupCodeInput>` (from SHR-MFA-004b primitive) and continues to use the same step-up POST endpoint.

**Copy delta:**

| Slot | Copy |
|---|---|
| Title | Verify it's you |
| Reason well template | Confirm your identity to continue: **{reason}** |
| TOTP sub | Enter the 6-digit code from your authenticator app. |
| Email sub template | We sent a 6-digit code to {maskedEmail}. Enter it below. |
| Resend link | Resend code |
| Resend cool-down | Resend in {seconds}s |
| Verify CTA | Verify |
| Verify CTA (loading) | Verifying… |
| Cancel | Cancel |
| Fallback link (TOTP) | Use a backup code instead |
| Attempts hint | {n} attempts remaining. |
| Error — invalid code | That code did not match. Try again. |
| Error — expired | This verification session expired. Please try again. |
| Error — rate-limited | Too many attempts. Wait {minutes} minutes and try again. |
| Error — email send failed | Could not send the verification code. Contact your administrator. |

**Interactions delta:**

- Modal opens with focus on first OTP cell.
- **Email variant**: on mount, backend has ALREADY sent the code (POST /api/auth/step-up triggered by useStepUp hook returns `{ method: 'email' }` after sending). "Resend code" link fires POST /api/auth/step-up again (invalidates prior challenge per backend `createChallenge` DELETE-prior semantics).
- **TOTP variant**: no resend. Code is device-generated.
- Paste + backspace + auto-advance same as SHR-MFA-004.
- On Verify click: POST `/api/auth/step-up/verify` with `{ challenge_id, code }`.
- On 200: `{ elevated_token, expires_in, expires_at, factor_used }` — modal closes, promise from `useStepUp` resolves with the token. Calling component uses the token in the `X-Elevated-Token` header of its subsequent sensitive-action POST.
- On 401 with remaining_attempts: shake + clear + error above CTA + update attempts hint. Modal stays open.
- On 429 lockout: banner (`--lc-status-warning-*`) replaces the input, Verify disabled. Cancel remains active. The calling promise stays pending (does not reject) until user cancels — this is critical so the calling code doesn't fire a follow-up prompt loop.
- On 410 expired: banner + a "Try again" button that re-triggers POST /api/auth/step-up (issues a fresh challenge).
- On Cancel: modal closes + promise rejects with `{ reason: 'user_cancelled' }`. Calling code must handle rejection gracefully (leave user on the same screen without the sensitive action).
- On backdrop click / Escape: same as Cancel.
- **Elevated token lifespan**: `ELEVATION_TTL_SECONDS` (backend constant). Calling code should use the elevated token IMMEDIATELY — do not queue it or defer. `useStepUp` MUST NOT cache the elevated token beyond the immediate action.

**State variants delta:**

| Variant | Behavior |
|---|---|
| **Idle — TOTP** | Cells empty, first focused, Verify disabled. |
| **Idle — email** | Same shape, plus "We sent a code" helper + Resend link with 60s cool-down. |
| **Typing** | Cells filling, Verify disabled until 6th. |
| **Ready** | All 6 filled, Verify enabled. |
| **Verifying** | Cells + Verify disabled, spinner in button. |
| **Error — invalid code** | Cells shake + clear + inline error, modal stays open. |
| **Error — expired** | Banner + "Try again" button. |
| **Error — rate-limited** | Warning banner replaces input, Verify disabled, Cancel active. |
| **Backup-code fallback (TOTP variant)** | Input swaps to single-line `<BackupCodeInput>`. |
| **Email resend** | Button loading state, then success toast "Code resent to {maskedEmail}", cool-down begins. |
| **Cancel** | Modal closes, promise rejects. |
| **Success** | Modal closes, promise resolves with elevated token. |
| **RTL** | Modal mirrors; cells stay LTR. |
| **Dark mode** | Tokens swap; reason well stays legible. |

**Anti-patterns delta:**

- ❌ Do not cache the elevated token in localStorage or React state. Use immediately then discard.
- ❌ Do not auto-close the modal on a returning-focus-loss (blur) event — user might be checking their authenticator.
- ❌ Do not skip the reason well. Users deserve to know WHY re-authentication is needed. If a caller doesn't pass a reason, fall back to "an additional check on your account" — but every caller should pass one.
- ❌ Do not include a "Remember me for 15 minutes" checkbox. Elevation is short-lived and single-use per action, by design.
- ❌ Do not skip the fallback to backup code for TOTP-enrolled users — the user might have forgotten their phone at their desk.
- ❌ Do not offer email variant to users who have TOTP enrolled. Backend enforces this (see auth-2fa.js top comment: "Once TOTP is enrolled, email OTP is NOT accepted"). UI reflects it.
- ❌ Do not offer "Resend code" for TOTP variant. There is nothing to resend.
- ❌ Do not treat Cancel as a soft dismissal — the calling promise MUST reject, and the caller MUST NOT proceed with the sensitive action.

**Backend contract delta:**

`POST /api/auth/step-up` — auth required, no body. Returns:
- TOTP-enrolled: `{ challenge_id, method: 'totp', expires_at }`
- Not enrolled: `{ challenge_id, method: 'email', expires_at }` — email OTP was sent as a side effect.

`POST /api/auth/step-up/verify` — auth required, body `{ challenge_id, code }`. Returns:
- Success: `{ elevated_token, expires_in, expires_at, factor_used }`.
- 401: `{ error: 'Invalid code', remaining_attempts: N }`.
- 429: `{ error: 'Too many failed attempts' }`.
- 410: `{ error: 'Challenge has expired' }`.

**Elevated token usage:** Callers must include the token as `X-Elevated-Token: <token>` header on the sensitive action POST. Backend `requireElevated()` middleware validates and rejects if missing/expired.

**Shared primitives:**

- `<StepUpModal>` — this modal component, imported by `<StepUpProvider>`.
- `<StepUpProvider>` — React context provider, exposes `useStepUp()` hook. Wraps app at the root level.
- Reuse `<OtpInput>` from SHR-MFA-004.
- Reuse `<BackupCodeInput>` from SHR-MFA-004b (fallback path).
- Reuse `<Dialog>` from ui/dialog.

**Callers of this modal (as of Wave 4):**
- SHR-MFA-001 → SHR-MFA-006 chain (disable 2FA)
- SHR-MFA-005 (regenerate backup codes)
- SHR-SET-005 (delete account)
- SHR-SET-004 (revoke all other sessions)
- PA credit-grant surfaces (matrix rows PA-CRD-*)
- Agency ownership transfer (matrix row AGN-SET-*)

**Definition of done:** TOTP idle + email idle + typing + ready + verifying + error + rate-limited + expired + fallback-to-backup + email-resend + mobile + RTL + dark states rendered; JSX committed; `useStepUp` hook + `StepUpProvider` verified working end-to-end with SHR-MFA-006 as first caller; documented in `docs/design/patterns/step-up.md` as the canonical pattern for all future sensitive actions.
