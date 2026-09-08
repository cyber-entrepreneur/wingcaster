# Cursor dispatch — Screen Matrix Wave 4B: MFA + Settings shell

**PR title:** `feat(screen-wave-4b): MFA operational flows + Settings shell (11+ screens)`

**Base branch:** `main` of `cyber-entrepreneur/wingcaster`

**Estimated effort:** ~6-8 days with parallel agents; ~10-14 days serial

**Rev 1 — 2026-09-08**

**Depends on:**
- **Wave 0, Wave 1 merged.** Nav chrome + signup infrastructure.
- **Wave 0.5 backend merged.** Specifically `[BE-BLOCKER-18]` regenerate-backup-codes endpoint + `[BE-BLOCKER-23]` `GET /api/settings/index`.
- **Shared Components Prep merged.** MFA family + Settings shell primitives.
- **[BE-VERIFY-18]** confirmed backup-codes fetch endpoint is intentionally absent by design (regenerate-only).

**Parallel to Wave 4A** — touches different subtree entirely.

---

## 1. Why this dispatch

Enrolling 2FA is worthless without operational surfaces to use it (challenge at sign-in + backup codes + disable). Delete-account brief exists but the whole Settings shell (SET-001..004) doesn't. GDPR compliance + false-security-promise fix + self-service.

## 2. Read briefs

**Wave 4B briefs (11):**
- SHR-MFA-001..007 (7 files) — anchors: SHR-MFA-001 (settings), SHR-MFA-004 (challenge)
- SHR-SET-001..005d (SHR-SET-001 anchor; -002/003/004 deltas; -005 anchor already existed on disk)

Shared: [BROADCAST_ALIGNMENT_REFERENCE.md](../design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md), [BACKEND_BLOCKER_INDEX.md](../design/BACKEND_BLOCKER_INDEX.md)

## 3. Parallelization

**Phase A — spawn concurrently (3 agents):**

1. **SHR-MFA family agent** — build all 7 MFA screens. Uses MFA-family primitives from Shared Prep (`<OtpInput>`, `<BackupCodeInput>`, `<StepUpModal>` + provider + hook, `<TwoFactorStatusHero>`, `<EnrollmentStepper>`, `<PasswordGateCard>`, `<RevealableSecret>`, `<BackupCodeGrid>`). Route: `/security/2fa/*` sub-routes per brief. Backup-codes viewer (SHR-MFA-005) is REGENERATE-ONLY — codes shown exactly once at verify time per [BE-VERIFY-18]. Add `web/src/print.css` for backup-codes print. Touches only `pages/security/mfa/` + `components/mfa/` + `print.css`.

2. **SHR-SET shell + inner pages agent** — build `<SettingsShell>` mount at `pages/SettingsPage.tsx` + inner pages SHR-SET-001 (home), -002 (account), -003 (billing/notif), -004 (sessions/devices). Uses Settings-shell primitives from Shared Prep. SHR-SET-005 (delete account) already exists as a brief with existing partial implementation — refactor to fit the shell. `<StepUpModal>` from MFA-family used on SET-004 sign-out-everywhere action. Backend: `GET /api/settings/index` (from [BE-BLOCKER-23]) drives capability-gated menu server-side. Route: `/settings/*`. Touches only `pages/SettingsPage.tsx` + `pages/settings/*` + `components/settings/`.

3. **Session/device backend integration agent** — SHR-SET-004 needs `user_sessions` table + `POST /auth/sign-out-everywhere` endpoint. Grep to confirm what exists today — if the current auth is stateless JWT with `token_version`, decide whether to introduce `user_sessions` or use `token_version` bump. File the finding as a follow-up backend blocker if needed. Touches only backend if extension required.

**Phase B — sequential AFTER Phase A merges:**

4. **Integration test agent** — enroll 2FA → challenge at sign-in → use backup code → sign-out-everywhere → sign back in → 2FA challenge → disable 2FA. Settings sidebar reflects capability changes.

5. **A11y + visual agent** — MFA screens especially — code-entry a11y (screen-reader announcement of digit progression), backup-code print layout, focus trap on step-up modal.

## 4. Non-negotiables

1. **MFA-family invariants** — `<StepUpModal>` reused across every high-privilege action (SET-004 sign-out, SET-005 delete, PA credit surfaces, AGN ownership transfer).
2. **Backup codes shown exactly once** — never persisted after view; regenerate-only on demand.
3. **Print stylesheet works for backup-codes viewer** — verify a physical print or print-preview render.
4. **Settings menu is server-driven** via `GET /api/settings/index` — client never gates visibility from `session.role`.
5. **`no-raw-hex.test.ts` + RTL + dark + a11y.**
6. **Zero touches to Wave 4A files.**

## 5. Coordination

| # | Agent | Branch | Est. days |
|---|---|---|---|
| 1 | MFA | `feat/wave-4b-mfa` | 3-4 |
| 2 | Settings | `feat/wave-4b-settings` | 2-3 |
| 3 | Session backend | `feat/wave-4b-sessions-be` | 1-2 |
| 4 | Integration test | `feat/wave-4b-e2e` | 1 |
| 5 | A11y + visual | `feat/wave-4b-quality` | 1 |

## 6. Definition of done

1. All 11 screens + shell primitive extraction land.
2. Full 2FA lifecycle proven via integration test.
3. Backup-code print verified.
4. CI + Chromatic green.
5. Blocker index: mark [BE-BLOCKER-18/23] as **UI-CONSUMED**.

## 7. Out of scope

- Wave 4A (activation funnel).
- Any Wave 5+ screen.
- MFA enrollment via SMS (Phase 2).
