# Wave 2 — Chromatic / Storybook gap (WF-03 quality)

**Date:** 2026-09-08  
**Owner:** Wave 2 Agent 7 (a11y + visual)  
**Branch:** `feat/wave-2-quality`

## Status

Chromatic and Storybook are **still not configured** in `web/` (same as Wave 0 —
see `scratchpad/wave0-chromatic-gap.md`). `package.json` has no `chromatic` /
`@storybook/*` scripts or deps; no `.storybook/` directory.

## What we shipped instead

| Layer | Location | Notes |
|---|---|---|
| A11y contract | `web/src/theme/wf03-portal-moderation.a11y.test.tsx` | Tap floors, focus rings, receipt aria-live, tracker density semantics, PA queue J/K/A/R/I + shortcuts panel, PA-MOD-002 diff + modal focus trap, jest-axe |
| Visual matrix | `web/src/theme/wf03-portal-moderation.visual.test.tsx` | **≥20** Vitest DOM snapshots = 8 receipt aggregates + tracker + PA queue bulk-select + PA-MOD-002 @ 1440/1024 × selected LTR/RTL × light/dark |
| Fixtures | `web/src/theme/wf03-fixtures.tsx` | Shared Prep compositions (REC + portals + queue) until Phase A pages land |
| Phase A discovery | `web/src/theme/wf03-phase-a-discovery.ts` | Activates page-level axe smoke when Agents 1–5 files exist |
| Token hygiene | `web/src/theme/no-raw-hex.test.ts` | Must stay green |

## Snapshot checklist (Chromatic target when tooling lands)

1. **AGT-PUB-003** — 8 aggregates: ALL_SUCCEEDED / MIXED / ALL_FAILED / IN_REVIEW_ONLY / PARTIAL / cross-country / retry-in-flight / offline
2. **AGT-PUB-003** — MIXED × dark × RTL (mobile); ALL_SUCCEEDED desktop
3. **AGT-PUB-006** — dense tracker desktop 1440 + tablet 1024 + dark/RTL
4. **PA-MOD-001** — pending queue; **bulk-select mode**; shortcuts panel; TEST env bulk
5. **PA-MOD-002** — payload diff panel desktop 1440 + tablet 1024 + dark/RTL

## Phase A wait gate

Agent 7 must wait for:
`feat/wave-2-receipt`, `feat/wave-2-tracker`, `feat/wave-2-pa-mod-queue`,
`feat/wave-2-pa-mod-detail`, `feat/wave-2-submit-refactor`.

Until those land, fixtures cover Shared Prep contracts. After merge, re-run
page-level suites (discovery) and prefer page snapshots over fixtures.
