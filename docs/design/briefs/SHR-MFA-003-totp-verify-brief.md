# Screen Brief — SHR-MFA-003 · TOTP setup verify — DELTA

**Delta brief.** Inherits from `SHR-MFA-001-2fa-settings-brief.md` (enrollment anchor) for layout + tokens, and reuses the `<OtpInput>` primitive extracted in `SHR-MFA-004-2fa-challenge-brief.md`. Specifies ONLY what differs.

---

## 🎨 Broadcast alignment

**Inherits from `BROADCAST_ALIGNMENT_REFERENCE.md`.** Delta callouts only:

- Reuse the `<OtpInput>` 6-cell primitive (same tokens, same cell sizing).
- Stepper: `1 Set up · [2] Verify · 3 Save codes` — cell `[2]` filled with `--lc-action-primary` background.
- Verify CTA: `--lc-action-primary` fill; on success shows a brief 120ms `ShieldCheck` in `--lc-status-published-fg` before routing forward.

---

## Meta (delta only)

| | |
|---|---|
| Screen ID | SHR-MFA-003 |
| Screen name | TOTP setup — verify code |
| Route | `/settings/2fa/enroll?stage=verify` |
| Current state | PARTIAL — embedded in existing TotpSettingsPage stage='scan' verify sub-block. Extract to routed stage. |
| Backend prerequisites | ✅ `POST /api/auth/2fa/totp/verify` MERGED — validates `{ secret, code }` against a fresh TOTP window. On success: persists encrypted secret, sets `totp_enabled=true`, DELETES prior backup codes, mints and RETURNS 10 fresh backup codes (once). |

---

## Purpose

Prove the QR was actually scanned by having the user enter a live 6-digit code. On success, the backend enables 2FA + mints backup codes, and the response includes those 10 codes — the user is FORCED to save them in SHR-MFA-005 before returning to SHR-MFA-001.

---

## Delta from anchors

**Layout** — single-column, ~640px max-width (same as SHR-MFA-002):

- **Stepper**: `1 Set up · [2] Verify · 3 Save codes` — step 2 active.
- **H1**: "Enter the code from your app"
- **Sub**: "Open your authenticator app and type the 6-digit code you see for WingCaster."
- **OtpInput** — the same 6-cell primitive from SHR-MFA-004. Autofocus first cell on mount.
- **Verify CTA** — primary orange, "Verify and enable". Enabled when all 6 cells filled.
- **Back link** — ghost link "← Go back to QR" — routes to SHR-MFA-002 preserving the secret in a router-state hop so the user doesn't have to re-do the password gate.

**Secret continuity note:** SHR-MFA-002 hands the secret + code cells to SHR-MFA-003 via router state (same-session in-memory), NOT via URL — the secret must never appear in the address bar. If the route is reached without a secret in state (e.g., page reload or direct URL), redirect to SHR-MFA-002 with a friendly toast: "Let's start setup again."

**Copy delta:**

| Slot | Copy |
|---|---|
| Stepper labels | Set up · **Verify** · Save codes |
| H1 | Enter the code from your app |
| Sub | Open your authenticator app and type the 6-digit code you see for WingCaster. |
| Verify CTA | Verify and enable |
| Verify CTA (loading) | Verifying… |
| Back link | ← Go back to QR |
| Error — wrong code | That code did not match. Check your device clock and try the next one. |
| Error — expired setup session | Setup session expired. Please start again. |
| Success announce | Two-factor authentication enabled. |

**Interactions delta:**

- Autofocus first cell.
- Same paste + backspace + auto-advance behavior as SHR-MFA-004.
- On Verify click: POST `/api/auth/2fa/totp/verify` with `{ secret, code }`.
- On 200: backend responds with `{ totp_enabled: true, totp_enrolled_at, backup_codes: [...10 codes...], backup_codes_remaining: 10 }`. Show a 120ms `ShieldCheck` success animation, then immediately route to `/settings/2fa/backup-codes?first-view=1` (SHR-MFA-005 in mandatory-save mode) with the fresh codes passed via router state.
- On 401: shake cells + clear + error text above CTA. NO attempts counter here — backend doesn't rate-limit enrollment verify (fresh secret, no security-critical failure mode). User can retry freely, or click Back to re-scan.
- On 503 `credential_encryption_unavailable`: show error banner with copy from backend: "Two-factor authentication cannot be enabled until CREDENTIALS_ENCRYPTION_KEY is configured on the server." + Contact-support CTA. This is an operational bug, not a user error.
- On 409 `totp_already_enabled`: redirect to SHR-MFA-001 with toast: "Two-factor is already enabled on this account."

**State variants delta:**

| Variant | Behavior |
|---|---|
| **Idle** | Cells empty, first focused, Verify disabled. |
| **Ready** | 6 filled, Verify enabled. |
| **Verifying** | Cells + button disabled, spinner in button. |
| **Success** | 120ms shield checkmark then forward-navigate. |
| **Error — bad code** | Cells shake + clear + inline error above CTA. |
| **Error — expired** | Toast + redirect to SHR-MFA-002. |
| **Error — encryption unavailable** | Full-card error banner with support link. |
| **Missing secret in state** | Redirect to SHR-MFA-002. |

**Anti-patterns delta:**

- ❌ Do not put the secret in the URL. Always via router state.
- ❌ Do not celebrate with confetti — a brief shield check is enough.
- ❌ Do not route back to SHR-MFA-001 on success. Route FORWARD to SHR-MFA-005 in first-view mode. User must save codes.
- ❌ Do not persist the secret in localStorage — even between SHR-MFA-002 and SHR-MFA-003 hop, keep it in memory only.

**Backend contract delta:**

`POST /api/auth/2fa/totp/verify` — auth required, body `{ secret, code }`. Response 200 includes `backup_codes: [...]` — SHOWN ONCE (auth-2fa.js line 400). SHR-MFA-005 must receive them via router state; there is NO endpoint to fetch them again.

**Shared primitives:**

- `<OtpInput>` — same primitive as SHR-MFA-004.
- `EnrollmentStepper` — same as SHR-MFA-002.
- `SuccessCheckAnimation` — 120ms shield-check pulse, potentially reusable for other "enrollment completed" moments.

**Definition of done:** idle + ready + verifying + success + error + mobile + RTL + dark states rendered; JSX committed; router-state secret hop verified with real form.
