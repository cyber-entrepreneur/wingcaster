# Screen Brief — SHR-MFA-004b · Sign in with backup code — DELTA

**Delta brief.** Inherits from `SHR-MFA-004-2fa-challenge-brief.md` (operational anchor). Specifies ONLY what differs from the TOTP challenge screen. **P0 per kickoff §5 row 9** — the recovery path is what makes SHR-MFA-004 non-hostile.

---

## 🎨 Broadcast alignment

**Inherits from `BROADCAST_ALIGNMENT_REFERENCE.md` + delta from SHR-MFA-004:**

- Single wide text input (NOT the 6-cell OtpInput). `var(--lc-font-mono)` + `tabular-nums`, `letter-spacing: 0.1em`, uppercase enforcement via CSS `text-transform: uppercase`.
- Input width: `320px` desktop / full-width mobile. Height 56px.
- Header icon: `KeySquare` from lucide-react at 32px, tinted `--lc-text-brand`.

---

## Meta (delta only)

| | |
|---|---|
| Screen ID | SHR-MFA-004b |
| Screen name | Sign in with backup code |
| Route | `/login?stage=backup` (same route as SHR-MFA-004; stage param switches variant) |
| Current state | MISSING. Backend accepts backup code through the same `/api/auth/2fa/challenge` endpoint — no new backend work required. |
| Backend prerequisites | ✅ `POST /api/auth/2fa/challenge` MERGED — accepts EITHER a TOTP code or a backup code against a signin-purpose challenge. Backup code path decrements the unused-code count and marks the code as consumed. |

---

## Purpose

Give a user who no longer has their authenticator (lost phone, changed device) a way to sign in using one of the 10 one-time backup codes they saved during enrollment. Each successful use burns exactly one code and reduces `backup_codes_remaining` by 1. On success, a post-sign-in banner nudges the user to view remaining codes and consider regenerating.

---

## Delta from anchor

**Layout** — mostly identical to SHR-MFA-004 with these changes:

- **Header icon** — swap `ShieldCheck` for `KeySquare` (visually distinct from the TOTP challenge to reduce confusion).
- **H1** — "Enter a backup code"
- **Sub** — "Type one of the 10 one-time codes you saved when you set up two-factor. Each code works only once."
- **Input** — SINGLE wide text input (NOT 6 cells). Placeholder: `XXXX-XXXX-XXXX`. Auto-uppercase + auto-format with dashes as user types. Accept variants (with/without dashes, mixed case) — the backend's `matchBackupCode` normalizes.
- **Verify CTA** — same "Verify" primary orange, full-width on mobile.
- **Recovery block** — swap the "backup code" link for:
  - Primary link: `Try my authenticator code instead` — routes back to SHR-MFA-004 with same challenge_id.
  - Divider dot (·)
  - Muted link: `I've lost my codes too — recover my account` — routes to SHR-AUT-005 (account recovery).
  - Divider dot (·)
  - Muted link: `Sign in as different user` (same as SHR-MFA-004).

**Copy delta:**

| Slot | Copy |
|---|---|
| H1 | Enter a backup code |
| Sub | Type one of the 10 one-time codes you saved when you set up two-factor. Each code works only once. |
| Input placeholder | XXXX-XXXX-XXXX |
| Input aria-label | Backup code |
| Verify CTA | Verify |
| Try authenticator link | Try my authenticator code instead |
| Lost codes link | I've lost my codes too — recover my account |
| Different user link | Sign in as different user |
| Trust footer | Backup codes are one-time only. Once you use one, it's gone. |
| Error — invalid code | That backup code did not match. Check for typos and try another. |
| Error — no codes left | This account has no unused backup codes. Recover your account instead. |
| Success post-signin toast | You used a backup code. You have {n} codes left. [Manage codes →] |

**Interactions delta:**

- Autofocus the input on mount.
- Format on type: strip whitespace, uppercase, insert dashes every 4 chars up to `XXXX-XXXX-XXXX` (assumes 12-char alphanumeric codes; verify backend format with `backup-codes.js` — brief assumes 12-char base32-ish based on typical implementations, adjust if `BACKUP_CODE_COUNT`/format differs).
- On Verify: POST `/api/auth/2fa/challenge` with `{ challenge_id, code }` — same endpoint, same challenge_id passed forward from SHR-MFA-004's "Use a backup code instead" link.
- On 200: response has `factor_used: "backup_code"`. Set auth state, redirect to `/`, then show a persistent toast at the top: "You used a backup code. You have {n} codes left. [Manage codes →]". Toast dismissable but re-appears on next session if remaining ≤ 2.
- Post-sign-in banner: appears on the landing screen (SHR-NAV-001 dashboard) as an attention card for 24 hours, styled with `--lc-status-warning-*` tokens if remaining ≤ 2.
- On 401 with remaining_attempts: shake input + clear + error text. Same 5-attempt lockout as SHR-MFA-004.

**State variants delta:**

Same set as SHR-MFA-004, plus:

| Variant | Behavior |
|---|---|
| **All codes exhausted** | Backend responds with a specific error the UI translates to: "This account has no unused backup codes. Recover your account instead." + only "Recover my account" link enabled. |

**Anti-patterns delta:**

- ❌ Do not require the user to type dashes. Auto-insert them.
- ❌ Do not force upper or lower case — normalize on submit.
- ❌ Do not shame the user for using a backup code. Copy is neutral, informational.
- ❌ Do not silently consume a backup code without telling the user afterward. The post-sign-in toast MUST appear.
- ❌ Do not offer a "resend backup code" — codes are static and were shown once during enrollment; there is no resend.

**Backend contract delta:**

Same endpoint as SHR-MFA-004: `POST /api/auth/2fa/challenge`. Backend distinguishes TOTP vs backup code internally via `matchBackupCode` fallback (auth-2fa.js line 228-239). Response `factor_used` field tells the client which path succeeded — UI uses it to decide whether to show the "You used a backup code" toast.

**Shared primitives:**

- Reuse `<TrustFooter>` from SHR-MFA-004.
- Reuse `<RateLimitBanner>` from SHR-MFA-004.
- NEW: `<BackupCodeInput>` — the single wide auto-formatting input, potentially reusable in SHR-MFA-006 disable modal.
- NEW: `<PostSigninAttentionCard>` — the persistent toast/banner on dashboard, reusable for other post-sign-in attention nudges.

**Definition of done:** idle + typing + ready + verifying + error + all-codes-exhausted + rate-limited + mobile + RTL + dark states rendered; JSX committed; `<BackupCodeInput>` primitive extracted.
