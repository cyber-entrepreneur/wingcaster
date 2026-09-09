# Wave 3 — Chromatic / Storybook gap (WF-04 a11y + PII-safety)

**Date:** 2026-09-09  
**Owner:** Wave 3 Agent 5 (a11y + PII-safety visual)  
**Branch:** `feat/wave-3-quality`

## Status

Chromatic and Storybook are **still not configured** in `web/` (same as Wave 0 / Wave 1 / Wave 2 —
see `scratchpad/wave0-chromatic-gap.md`). `package.json` has no `chromatic` /
`@storybook/*` scripts or deps; no `.storybook/` directory.

## What we shipped instead

| Layer | Location | Notes |
|---|---|---|
| A11y contract | `web/src/theme/wf04-account-recovery.a11y.test.tsx` | 44px tap floor, focus rings, DeletionCountdown aria-live (timer off + polite boundary), cast-vote modal focus trap + Escape, PII reveal SR announcement, jest-axe on all 5 SHR-AUT-005d states + ACR queue/detail |
| Visual matrix | `web/src/theme/wf04-account-recovery.visual.test.tsx` | **15** Vitest DOM snapshots = Chromatic stand-ins; **PII-safe by default** |
| Fixtures | `web/src/theme/wf04-fixtures.ts` | Masked sample payloads + `assertNoPlaintextPii` gate |
| Phase A discovery | `web/src/theme/wf04-phase-a-discovery.ts` | Confirms Agents 1–3 page modules (`readyCount: 4`) |
| Token hygiene | `web/src/theme/no-raw-hex.test.ts` | Must stay green |

## Snapshot checklist (Chromatic target when tooling lands)

1. **SHR-AUT-005d** VALID_PENDING — mobile light LTR (masked email)
2. **SHR-AUT-005d** ALREADY_CANCELLED — mobile light LTR
3. **SHR-AUT-005d** ALREADY_DELETED — mobile light LTR
4. **SHR-AUT-005d** INVALID_TOKEN — mobile light LTR
5. **SHR-AUT-005d** EXPIRED_TOKEN — mobile light LTR
6. **SHR-AUT-005d** VALID_PENDING — mobile dark RTL
7. **SHR-AUT-005d** VALID_PENDING — desktop light LTR
8. **PA-ACR-001** pending queue — desktop light LTR (masked PII)
9. **PA-ACR-001** pending queue — desktop dark RTL
10. **PA-ACR-001** high-value row — desktop light LTR
11. **PA-ACR-002** pending detail — desktop light LTR (masked PII)
12. **PA-ACR-002** pending detail — desktop dark RTL
13. **PA-ACR-002** high-value two-person progress — desktop light LTR
14. **PA-ACR-002** cast-vote approve modal — desktop light LTR
15. **PA-ACR-001** mobile gate (<1024px) — light LTR

## PII-audit (mandatory)

Every default-state snapshot is gated by `assertNoPlaintextPii` against a forbidden
list (full email / phone / username / IP / UA). Revealed states are **not** snapshotted
into the Chromatic budget — reveal is covered by a11y interaction tests only.

## Phase A wait gate — COMPLETE (local merge)

Merged into `feat/wave-3-quality` for snapshot targets:
- #113 `cursor/wave-3-deletion-confirm-6a45` (SHR-AUT-005d)
- #114 `feat/wave-3-acr-queue` (PA-ACR-001)
- #115 `feat/wave-3-acr-detail` (PA-ACR-002)

Prefer rebasing onto merged `main` once Phase A lands; until then local merge provides
the screen modules under test.
