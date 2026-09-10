# Wave 5 — Chromatic / Storybook gap (WF-05/WF-06 a11y + visual)

**Date:** 2026-09-10  
**Owner:** Wave 5 Agent 7 (a11y + visual)  
**Branch:** `feat/wave-5-quality`

## Status

Chromatic and Storybook are **still not configured** in `web/` (same as Wave 0 / Wave 1 /
Wave 2 / Wave 3 — see `scratchpad/wave0-chromatic-gap.md`). `package.json` has no
`chromatic` / `@storybook/*` scripts or deps; no `.storybook/` directory.

## What we shipped instead

| Layer | Location | Notes |
|---|---|---|
| A11y contract | `web/src/theme/wf05-wf06-valuation.a11y.test.tsx` | Tap floor, StatusHero loud vs default axe, WeightingPanel `role="meter"`, WF-05 bulk bar excludes confirm-remove (a11y tree), TwoPersonProgress on high-impact remove, PIIMask reveal SR, jest-axe on all 8 primary screens, EN+AR RTL + dark smoke |
| Visual matrix | `web/src/theme/wf05-wf06-valuation.visual.test.tsx` | **16** Vitest DOM snapshots = Chromatic stand-ins; **PII-safe by default** |
| Fixtures | `web/src/theme/wf05-wf06-fixtures.ts` | Masked sample payloads + `assertNoPlaintextPii` gate |
| Phase A discovery | `web/src/theme/wf05-wf06-phase-a-discovery.ts` | Confirms Agents 1–5 page modules (`readyCount: 8`) |
| Token hygiene | `web/src/theme/no-raw-hex.test.ts` | Must stay green |

## Snapshot checklist (Chromatic target when tooling lands)

1. **StatusHero** loud approved — light LTR
2. **StatusHero** default approved (quarantine / signal-only) — light LTR
3. **WeightingPanel** incorporated `role="meter"` 100% — light LTR
4. **WeightingPanel** signal-only 50% — dark RTL (panel stays `dir=ltr`)
5. **AGT-APR-004** submit — light LTR
6. **AGT-APR-005** submit (Pro) — light LTR
7. **AGT-REC-002** approved-removed (loud) — light LTR
8. **AGT-REC-002** approved-quarantined (default) — dark RTL
9. **AGT-REC-003** incorporated — light LTR
10. **AGT-REC-003** signal-only — light LTR
11. **PA-PVA-008** queue + bulk-select (reject/request-info only) — light LTR
12. **PA-PVA-008** queue — dark RTL
13. **PA-PVA-008b** detail pending — light LTR (masked reporter)
14. **PA-PVA-008b** high-impact two-person progress — light LTR
15. **PA-PVA-009** queue — light LTR (masked reporter)
16. **PA-PVA-009b** detail two-person — light LTR

## PII-audit (mandatory)

Every default-state snapshot is gated by `assertNoPlaintextPii` against the full
serialized DOM (including `.sr-only`). Visible `<PIIMask>` regions must show
masked reporter names only; reveal states are covered by a11y interaction tests.

**Quality fix:** PA-PVA-009b `sr-only` `<h1>` no longer echoes `agent.display_name`
(uses segment label only; identity remains on `<PIIMask>`).

## Highest-scrutiny checklist (WF-05)

- [x] Bulk actions ONLY for low-impact decisions — confirm-remove absent from bulk bar
- [x] Market-wide implications / affected valuations copy readable (aria-label + visible text)
- [x] Two-person progress indicator — `role="progressbar"` + accessible name + valuemin/max/now
- [x] Reporter-pattern amber signal is not color-only (`role="img"` + aria-label text)
- [x] `<PIIMask>` masked accessible name present; plaintext absent until deliberate reveal

## WF-05 bulk-safety (highest risk)

Visual snap 11 + a11y role queries assert the bulk bar `data-pa-queue-bulk-actions`
is exactly `reject,request_info` — confirm-remove / confirm-quarantine / Approve
are absent from the a11y tree.

## Phase A wait gate — COMPLETE (local merge)

Merged into `feat/wave-5-quality` for snapshot targets:
- #126 `feat/wave-5-rec-extension` (StatusHero emphasis=default)
- #127 `feat/wave-5-submitters` (AGT-APR-004/005)
- #128 `feat/wave-5-outcomes` (AGT-REC-002/003)
- #130 `feat/wave-5-wf05-pa` (PA-PVA-008/008b)
- #129 `feat/wave-5-wf06-pa` (PA-PVA-009/009b)

Prefer rebasing onto merged `main` once Phase A lands; until then local merge provides
the screen modules under test.

## Blocker index note (docs only — not edited here)

Prior wave quality PRs did **not** flip blocker rows to **UI-CONSUMED**. Once Phase A
screens merge to `main`, BE-BLOCKER-24/25/26/27/28 should be marked **UI-CONSUMED**
in `docs/design/BACKEND_BLOCKER_INDEX.md` (follow-up docs PR, not this quality branch).
