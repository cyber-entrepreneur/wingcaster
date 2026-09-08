# Cursor dispatch — Screen Matrix Wave 3: WF-04 Account Recovery cluster

**PR title:** `feat(screen-wave-3): WF-04 account-recovery — scheduled-deletion confirmation + PA review (both sides)`

**Base branch:** `main` of `cyber-entrepreneur/wingcaster`

**Estimated effort:** ~4-6 days with parallel agents; ~8-10 days serial

**Rev 1 — 2026-09-08**

**Depends on:**
- **Wave 0 (PR #52 + PR #53) merged.**
- **Wave 0.5 backend prereqs merged.** Specifically `[BE-BLOCKER-19]` scheduled-deletion public endpoints + email templates + reminder cron.
- **Shared Components Prep merged.** REC-family + PA-queue-family + PII primitives (`<PIIMask>`, `<TwoPersonProgress>`, `<Timeline>`).
- **Week 3 backend bundle merged.** Specifically:
  - `[BE-BLOCKER-21]` WF-04 account-recovery backend bundle (13 items — ~15-18 days) — SUBSTANTIAL
  - `[BE-BLOCKER-22]` **CRITICAL SECURITY FIX** — two-person-rule bypass in existing `POST /:caseId/approve` at `backend/src/server.js:7041` must be refactored through cast-vote endpoint BEFORE PA-ACR-002 UI ships. Without this, the UI exposes a security downgrade.

**Screen Matrix workstream context:** Week 3 of the workflow-cluster dispatch model. Resolves the WF-04 account-recovery **deadlock cycle** — support ops can't function today.

---

## 1. Why this dispatch

Account recovery is broken end-to-end today: a user can request recovery via SHR-AUT-005, PA has no queue to review it, no per-case detail page, and no confirmation surface after scheduled deletion. Support tickets stall.

**Deadlock resolution:** user requests recovery via existing SHR-AUT-005 → email link takes them to SHR-AUT-005d (new: confirms scheduled deletion, offers cancel) → simultaneously PA sees the case in PA-ACR-001 queue → PA reviews per-case detail in PA-ACR-002 → decision executes (with two-person for high-value accounts).

**Security prerequisite:** [BE-BLOCKER-22] two-person bypass MUST be fixed before PA-ACR-002 ships or the UI exposes a downgrade.

## 2. Read these files FIRST

**Wave 3 briefs (3):**
1. [`docs/design/briefs/SHR-AUT-005d-scheduled-deletion-confirmation-brief.md`](../design/briefs/SHR-AUT-005d-scheduled-deletion-confirmation-brief.md) — Public token-authed deletion confirmation
2. [`docs/design/briefs/PA-ACR-001-account-recovery-queue-brief.md`](../design/briefs/PA-ACR-001-account-recovery-queue-brief.md) — PA queue (PA-queue-family delta)
3. [`docs/design/briefs/PA-ACR-002-account-recovery-detail-brief.md`](../design/briefs/PA-ACR-002-account-recovery-detail-brief.md) — PA per-case detail with cast-vote UI

**Shared references (mandatory):**
- [`BROADCAST_ALIGNMENT_REFERENCE.md`](../design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md)
- [`docs/design/BACKEND_BLOCKER_INDEX.md`](../design/BACKEND_BLOCKER_INDEX.md) — verify Week 3 backend items landed, especially [BE-BLOCKER-22]

## 3. Parallelization directive

**Phase A — spawn concurrently (3 agents):**

1. **SHR-AUT-005d public deletion confirmation agent** — build `web/src/pages/public/ScheduledDeletionConfirmationPage.tsx`. Public route, token-authed only (no session cookie). Imports `<StatusHero>` from REC-family (Shared Prep). Introduces `<DeletionCountdown>` primitive with mono tabular-nums digits that don't reflow on tick (extract to `components/deletion/`). 5 states: VALID_PENDING (countdown active, cancel available) / ALREADY_CANCELLED / ALREADY_DELETED / INVALID_TOKEN / EXPIRED_TOKEN. Route: `/account/scheduled-deletion/:token`. Touches only `pages/public/ScheduledDeletionConfirmationPage.tsx` + `components/deletion/DeletionCountdown.tsx`.

2. **PA-ACR-001 queue agent** — build `web/src/pages/admin/AccountRecoveryQueuePage.tsx`. **PA-queue-family with WF-04 deliberate deviations** — bulk-action bar OMITTED (`showBulk={false}`) for PII safety. Uses `<PAQueueFilterStrip>`, `<PAQueueTable>`, `<PAQueueKeyboardShortcutsPanel>` from Shared Prep. Introduces `<PIIMask>` on every applicant email/phone/username display (from Shared Prep). Env badge always visible per PA-NAV-001. Route: `/admin/support/account-recovery`. Touches only `pages/admin/AccountRecoveryQueuePage.tsx`.

3. **PA-ACR-002 detail agent** — build `web/src/pages/admin/AccountRecoveryDetailPage.tsx`. Per-case arbitration surface with 4 decision affordances (Approve — triggers recovery / Reject with reason / Request more info / Withdraw own vote). Uses `<TwoPersonProgress>` from Shared Prep for the WF-04 two-person cast-vote UI (SECURITY-CRITICAL — [BE-BLOCKER-22] refactor must have landed). Imports `<PIIMask>` for evidence display + authenticated-image proxy on evidence photos. Includes `<Timeline>` for case history. Route: `/admin/support/account-recovery/:caseId`. Touches only `pages/admin/AccountRecoveryDetailPage.tsx`.

**Phase B — sequential AFTER Phase A merges:**

4. **WF-04 integration + cross-loop test agent** — end-to-end: user hits SHR-AUT-005 (existing) → gets email → clicks link → lands on SHR-AUT-005d → PA sees case in PA-ACR-001 → PA reviews PA-ACR-002 → two admins cast vote → recovery executes OR is rejected → user sees state on next SHR-AUT-005d visit. Test all 5 SHR-AUT-005d states. Test PII reveal audit-log write on every `<PIIMask>` unmask. Test two-person cast-vote flow rejects self-approval + escalation path.

5. **A11y + PII-safety visual regression agent** — per-brief a11y checks + Chromatic snapshots. Extra scrutiny on PII masking (default state must never leak plaintext identifiers in snapshots) and on the 5 SHR-AUT-005d states which face public/anonymous viewers.

## 4. Non-negotiables

1. **[BE-BLOCKER-22] SECURITY refactor MUST have landed before PA-ACR-002 dispatch.** Cursor must grep for the old `POST /:caseId/approve` at `backend/src/server.js:7041` and confirm it's been replaced with the cast-vote pattern. If not, HALT Phase A Agent 3 and file a blocking issue.
2. **`<PIIMask>` default state is MASKED.** Reveal requires explicit user interaction + audit-log write. NEVER pre-reveal via URL param or default prop.
3. **Public route (SHR-AUT-005d) NEVER trusts URL query params** — only the signed token in the path is authoritative.
4. **PA-queue-family invariants honored** with WF-04 deviations documented in code (`showBulk={false}` on ACR queue — bulk-approve on account recovery is unsafe due to PII per-case scrutiny).
5. **Deletion countdown** uses `tabular-nums` + fixed-width digits to prevent layout shift on tick.
6. **Public confirmation page** works offline for the "already cancelled" and "already deleted" states (they don't need a live server).
7. **`no-raw-hex.test.ts` green + RTL + dark + a11y.**
8. **Zero touches to Wave 0 / 1 / 2 / Shared Prep files.**
9. **Real-Postgres + Chromatic CI green.**

## 5. Coordination table

| # | Agent | Branch | Owns | Depends on | Est. days |
|---|---|---|---|---|---|
| 1 | SHR-AUT-005d | `feat/wave-3-deletion-confirm` | `pages/public/ScheduledDeletionConfirmationPage.tsx` + `components/deletion/` | Wave 0.5 [BE-BLOCKER-19] merged | 1-2 |
| 2 | PA-ACR-001 | `feat/wave-3-acr-queue` | `pages/admin/AccountRecoveryQueuePage.tsx` | Shared Prep + Week 3 backend | 1-2 |
| 3 | PA-ACR-002 | `feat/wave-3-acr-detail` | `pages/admin/AccountRecoveryDetailPage.tsx` | Shared Prep + Week 3 backend + **[BE-BLOCKER-22] SHIPPED** | 2 |
| 4 | Integration test | `feat/wave-3-e2e` | test file | Agents 1-3 merged | 1 |
| 5 | A11y + PII-safety | `feat/wave-3-quality` | test files | Agents 1-3 merged | 1 |

## 6. Test discipline

**Unit:** every state variant renders; `<PIIMask>` defaults to masked; `<DeletionCountdown>` no-reflow verified.
**Integration:** SHR-AUT-005d token validation + cancel flow; PA-ACR-001 filter + row-click; PA-ACR-002 cast-vote endpoint contract.
**End-to-end:** full recovery loop from request → email → confirmation → PA review → decision → user sees resolution. Test both approval + rejection.
**A11y:** 44px tap floor, focus rings, aria-live for countdown, focus traps in cast-vote modal, screen-reader announcement of PII reveal action.
**Visual:** ~15 Chromatic snapshots. **CRITICAL:** PII-safety review — every snapshot must be verified for zero plaintext identifier leakage.
**Real-Postgres:** cast-vote lifecycle including two-person flow + self-approval rejection + escalation.

## 7. Definition of done

1. All 3 primary screens land in one PR pair.
2. `<DeletionCountdown>` primitive extracted under `components/deletion/`.
3. Cross-loop test proves WF-04 end-to-end.
4. Every PII display is masked-by-default + audit-logs on reveal.
5. Security refactor from [BE-BLOCKER-22] verified merged in main before PA-ACR-002 dispatch.
6. `no-raw-hex.test.ts` + fast + integration + a11y + Real-Postgres + Chromatic CI green.
7. Vercel preview attached; PII-audit snapshot verification in PR body.
8. Blocker index updated: mark [BE-BLOCKER-19/21/22] as **UI-CONSUMED**.

## 8. Follow-ups (do NOT include in this PR pair)

- **Bulk PA-side actions** on account recovery — deferred permanently per WF-04 PII-safety design.
- **PA-USR / PA-SUP / PA-KYC** — future PA surfaces will REUSE `<PIIMask>` extracted here.
- **Recovery via SMS OTP** — Phase 2 (v1 uses email + TOTP + typed liveness word).

## 9. Out of scope

- Anything in Wave 0/1/2 files or Shared Prep primitives (import-only).
- Any Wave 4+ screen.
- Backend prereqs — landed via Wave 0.5 + Week 3 backend dispatch.
- Marketing site.
- Multi-language public confirmation copy (English + [TRANSLATION-PENDING] Arabic).
