# Wave 6 — Chromatic / Storybook gap (PA-PKG + PA-POR a11y + visual)

**Date:** 2026-09-16
**Owner:** Wave 6 quality scaffold PR (batch replacement)
**Branch:** `scaffold/wave6-wave7-quality-e2e-prep`

## Status

Chromatic and Storybook are **still not configured** in `web/` (same as Wave 0–5, 8 —
see `scratchpad/wave5-chromatic-gap.md`). `package.json` has no `chromatic` /
`@storybook/*` scripts or deps; no `.storybook/` directory.

## What we ship instead — Option D matrix pattern

Established on Wave 5 #131 + Wave 8 #153 + Wave 6 anchor #181. jsdom's
`getComputedStyle` does not honor `[data-lc-mode="dark"]` selector-conditional
rules, so token-level color palette maps are parsed directly from
`docs/design-tokens/broadcast-theme.css` via `parseLcSnapshotTokensFromCss`
(see `web/src/theme/visualSerialize.ts`). Serialized DOM carries `data-lc-mode`,
`data-lc-tokens` (JSON of resolved hexes), `data-viewport`, `dir`, `lang` so
byte-diff across axes is real, not theatrical.

## Scaffold in this PR

- `web/src/theme/wave6-fixtures.ts` — enumerates 7 target surfaces with
  per-page async-blocker rationale (real-mount when the family PR lands;
  parallel a11y suite covers real-page axe + behavior in the interim).
- `web/src/theme/wave6-screens.visual.test.tsx` — `describe.skip` per surface,
  cites which brief unblocks each. One live scaffold-integrity test asserts
  the surface enumeration is stable.
- `web/src/theme/pa-queue-family-invariants.ts` + `.test.ts` — production-usable
  harness. Codifies the 7 PA-queue-family invariants from project memory
  (`project_pa_queue_family.md`) as executable checks. When PA-PKG-003 and
  PA-POR-001 land, their quality tests call `assertPaQueueFamilyInvariants`
  on the real page render.

## Unskip protocol

When a Wave 6 family PR (PA-PKG-001..004 or PA-POR-001..003) lands:

1. In `wave6-screens.visual.test.tsx`, change the corresponding `describe.skip`
   → `describe`. Import the real page from `WAVE6_SURFACES[key].realPagePath`.
2. Mirror the shape at `wf05-wf06-valuation.matrix.visual.test.tsx`:
   - `beforeAll`: `vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW)`, install
     match-media fixture, set stable clock helpers.
   - `beforeEach`: `applyLcMode(mode)`; `installMatchMediaFixture(viewport)`;
     seed `localStorage['wingcaster.locale']` = `dir === 'rtl' ? 'ar' : 'en'`.
   - Serialize via `serializeVisualRoot(root, { mode })`.
   - Assert `assertNoPlaintextPiiInHtml(html, label)` with the fixture's PII
     values (`WAVE6_PII_FIXTURES`).
3. For PA-PKG-003 + PA-POR-001, ALSO call `assertPaQueueFamilyInvariants` from
   `./pa-queue-family-invariants` with the correct `hasBulk` + `hasTypeToConfirm`
   flags (per the brief) + `briefRef`.
4. Add per-surface a11y test suite `wave6-pa-{pkg,por}-pages.a11y.test.tsx` with
   real page mount + axe scan (following the Wave 4A `wave4a-onb-act-pages.a11y.test.tsx`
   pattern).

## Chromatic-proper migration path

When Chromatic-proper is eventually adopted, the Option D matrix migrates
1:1: the `data-lc-*` stamped attributes become Chromatic viewport / theme /
direction diffs, and the fixture rationale docstrings become Chromatic story
descriptions. The jsdom snapshots stay as CI-in-repo guards for
non-Chromatic regressions (routing, imports, structural HTML).
