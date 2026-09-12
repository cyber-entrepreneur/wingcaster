# Wave 8 — Chromatic / Storybook gap (activation polish a11y + visual)

**Date:** 2026-09-12  
**Owner:** Wave 8 Phase B Agent 7 (a11y + visual)  
**Branch:** `feat/wave-8-quality`

## Status

Chromatic and Storybook are **still not configured** in `web/` (same as Wave 0–5 —
see `scratchpad/wave0-chromatic-gap.md`). `package.json` has no `chromatic` /
`@storybook/*` scripts or deps; no `.storybook/` directory.

## What we shipped instead

| Layer | Location | Notes |
|---|---|---|
| A11y contract | `web/src/theme/wave8-activation.a11y.test.tsx` | Pro dashboard keyboard + density; Pro listings table semantics / j-k / space; Guided fallback `<768` with `ui_mode=pro`; public consent (no auth chrome); inbox dual-badge + relationships smoke; RTL + dark; jest-axe |
| Visual matrix | `web/src/theme/wave8-activation.visual.test.tsx` | **12** Vitest DOM snapshots = Chromatic stand-ins |
| Fixtures | `web/src/theme/wave8-fixtures.ts` | Sample listings, consent terms, inbox row, relationships |
| Phase A discovery | `web/src/theme/wave8-phase-a-discovery.ts` | Confirms Agents 1–5 page modules (`readyCount: 10`) |
| Token hygiene | `web/src/theme/no-raw-hex.test.ts` | Must stay green |
| Public consent | `RelationshipConsentPage` | `<main data-public-viewer>` landmark; bare chrome via `/public/` |

## Snapshot checklist (Chromatic target when tooling lands)

1. **AGT-DSH-002** Pro dashboard comfortable — light LTR desktop
2. **AGT-DSH-002** Pro dashboard compact — dark RTL desktop
3. **AGT-LST-002** Pro listings table — light LTR desktop
4. **AGT-LST-002** Pro listings table bulk-selected — light LTR
5. **D-S-06** Guided dashboard fallback (`ui_mode=pro`, `<768`) — mobile
6. **D-S-06** Guided listings fallback (`ui_mode=pro`, `<768`) — mobile
7. **AGT-CTC-007b** Consent ready — light LTR
8. **AGT-CTC-007b** Consent ready — dark RTL
9. **AGT-CTC-007b** Consent missing token — light LTR
10. **AGT-INB-005** Dual-badge inbox row — light LTR
11. **AGT-CTC-007** Relationships editor pending — light LTR
12. **AGT-LST-002** Pro listings table — dark RTL (+ owner column)

## Highest-scrutiny checklist

- [x] Pro dense table: `role="table"` + `aria-sort` headers + region label
- [x] Keyboard nav: `j`/`k` focus, `Space` select, bulk bar live region
- [x] Pro dashboard: density radiogroup + `?` shortcuts dialog
- [x] Guided fallback when `ui_mode=pro` but viewport `<768` (dashboard + listings)
- [x] Public consent: token-only auth, no nav / bottom tabs / skip-link chrome
- [x] Inbox dual-badge accessible name (`WhatsApp from Bayut`)
- [x] Relationships editor smoke axe
- [x] `no-raw-hex.test.ts` remains the token gate

## Phase A wait gate — COMPLETE (via `feat/wave-8-e2e`)

Quality branch tips from #152 `feat/wave-8-e2e`, which already merges:
- #148 `feat/wave-8-pro`
- #151 `feat/wave-8-listing`
- #150 `feat/wave-8-inbox`
- #144 `feat/wave-8-relationships`
- #145 `feat/wave-8-dsh-mount`
- Agent 6 funnel integration tests

Prefer rebasing onto merged `main` once Phase A + e2e land; until then the e2e tip
provides the integrated Wave 8 surface under test.

## Docs note

- **BE-BLOCKER-04** already **UI-CONSUMED** (inbox dual-read).
- **BE-BLOCKER-36** marked **UI-CONSUMED** on this quality PR (relationships + consent UI).
- Kickoff Phase 1 status: **not** flipped to `PHASE 1 SHIPPED` until Phase A/e2e merge to
  `main`. Wording: Wave 8 quality landed / ready to merge.
