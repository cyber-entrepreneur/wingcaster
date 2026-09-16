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
| A11y (isolated) | `web/src/theme/wave8-listings-fallback.a11y.test.tsx` | Full `ListingsPage` Guided fallback `<768` (separate file — ListingsPage module graph hangs shared jsdom workers) |
| A11y (isolated) | `web/src/theme/wave8-dashboard-fallback.a11y.test.tsx` | **Real** `AgentDashboardPage` Guided fallback `<768` mounted + axe (replaces the prior `<div>` stand-in). Stable hoisted hook mocks avoid the `useCallback`-invalidation render loop that OOMed the 4GB worker |
| A11y (dialogs) | `web/src/theme/wave8-activation-dialogs.a11y.test.tsx` | Per-dialog **Shift+Tab reverse** N+1 trap + reverse-wrap-to-last + close-restore for Relationships create, Relationships cancel-request, ProListings customize-columns |
| Visual matrix | `web/src/theme/wave8-activation.visual.test.tsx` | **Option A** orthogonal matrix: 3 core fixtures (Consent-landing, ProListingsTable, InboxRow) × 4 variants = **12** byte-diff-verifiable snaps, plus 3 state snaps + a token probe. Each single-axis pair (dark≠light, rtl≠ltr, mobile≠desktop) is diffable on the *same* fixture. PII substring sweep (`assertNoPlaintextPiiSubstring`) runs on every snap |
| Fixtures | `web/src/theme/wave8-fixtures.ts` | Sample listings, consent terms, inbox row, relationships |
| Phase A discovery | `web/src/theme/wave8-phase-a-discovery.ts` | Confirms Agents 1–5 page modules (`readyCount: 10`) |
| Token hygiene | `web/src/theme/no-raw-hex.test.ts` | Must stay green |
| Public consent | `RelationshipConsentPage` | `<main data-public-viewer>` landmark; bare chrome via `/public/` |

## Snapshot matrix (Option A — orthogonal, byte-diff verifiable)

Three core fixtures each ship the same 4-variant orthogonal set so any single
axis is diffable on the *same* fixture (no cross-fixture diffs):

| Fixture | light-ltr-desktop | dark-ltr-desktop | light-rtl-desktop | light-ltr-mobile |
|---|---|---|---|---|
| **AGT-CTC-007b** Consent-landing | ✓ (EN) | ✓ | ✓ (AR copy) | ✓ |
| **AGT-LST-002** ProListingsTable | ✓ | ✓ | ✓ | ✓ |
| **AGT-INB-005** InboxRow dual-badge | ✓ | ✓ | ✓ | ✓ |

Byte-diff proofs asserted in-test per fixture:
`dark-ltr-desktop ≠ light-ltr-desktop` (tokens), `light-rtl-desktop ≠
light-ltr-desktop` (dir + AR on consent), `light-ltr-mobile ≠ light-ltr-desktop`
(viewport). Consent `light-rtl-desktop` additionally asserts Arabic copy is
present (`#145` LOGIN_COPY pattern reaches this surface via `useLocale`).

State + probe snaps (not part of the orthogonal set):
- **D-S-06** Guided listings fallback (`ui_mode=pro`, `<768`) — mobile (real `ListingsPage`)
- **AGT-CTC-007b** Consent missing token — light LTR
- **AGT-CTC-007** Relationships editor pending — light LTR (masked name in header + prose; `assertNoPlaintextPiiSubstring` → grep `Omar Hassan` = 0)
- Token probe (theatrical dark≠light resolved palette)

### Why not a 12-cell Pro-dashboard/Pro-listings-dark matrix
Full `ProDashboard` / `AgentDashboardPage` renders OOM the forks worker at
`--max-old-space-size=4096` (reproduced: heap climbs to 4 GB, dies ~155 s). The
guided `AgentDashboardPage` is now axe'd for real in
`wave8-dashboard-fallback.a11y.test.tsx` after neutralizing the mock-induced
render loop; the orthogonal *visual* matrix uses the three light-weight core
fixtures that mount cleanly.

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
