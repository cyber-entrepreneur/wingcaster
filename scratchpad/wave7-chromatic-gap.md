# Wave 7 — Chromatic / Storybook gap (WF-31 + AGN-ROL + AGN-DSH + AGN-MEM)

**Date:** 2026-09-16
**Owner:** Wave 7 quality scaffold PR (batch replacement)
**Branch:** `scaffold/wave6-wave7-quality-e2e-prep`

## Status

Chromatic and Storybook remain unconfigured in `web/` (same as prior waves —
see `scratchpad/wave5-chromatic-gap.md`, `scratchpad/wave6-chromatic-gap.md`).

## What we ship instead — Option D matrix pattern

Same shape as Wave 6. Tokens parsed from `docs/design-tokens/broadcast-theme.css`
via `parseLcSnapshotTokensFromCss` (`web/src/theme/visualSerialize.ts`). Serialized
DOM carries `data-lc-mode`, `data-lc-tokens`, `data-viewport`, `dir`, `lang` so
byte-diff across axes is real.

## Scaffold in this PR

- `web/src/theme/wave7-fixtures.ts` — enumerates 9 target surfaces with
  per-page async-blocker rationale. **3 of 9 (AGN-MEM-002/002b/005) map to
  existing pages** — the family agent must verify delta before rebuilding.
- `web/src/theme/wave7-screens.visual.test.tsx` — `describe.skip` per surface,
  cites which brief unblocks each. Live scaffold-integrity test + WF-31 shared-primitive assertion.

## Wave 7 specifics

### WF-31 ownership transfer (3 screens)

All three consume shared primitives:
- **AGN-SET-005 initiator** + **AGN-SET-005b recipient** consume
  `<OwnershipTransferChallenge>` (already at `web/src/components/agency/`).
  Do NOT recreate.
- **AGT-REC-006 outcome** consumes REC-family primitives from #128:
  `<StatusHero>`, `<OutcomeTimeline>`, `<ResolverMessage>`, `<PrimaryCtaPerState>`.
  Import from `@/components/recipient`.

The scaffold's `WF-31 surfaces cite shared primitive consumption` test locks
this — every WF-31 surface must declare its `consumesShared` primitives in
`wave7-fixtures.ts`.

### AGN-MEM verify-before-rebuild

Cursor's #181-follow-up batch-2 verification report flagged:
> AGN-MEM briefs may overlap with existing `pages/agency/Application*Page.tsx`.

`WAVE7_SURFACES` entries for AGN-MEM-002/002b/005 point at the existing files.
Family agent MUST diff the brief against the existing page before implementing
new work — the rationale docstring in each surface entry names this explicitly.

## Unskip protocol

Identical to Wave 6 (see `wave6-chromatic-gap.md`). Additional for WF-31:
- Assert `<OwnershipTransferChallenge>` mounted on both initiator + recipient.
- Assert AGT-REC-006 imports from `@/components/recipient` (REC-family).
- 3-factor challenge test: send-OTP → verify → complete flow with jsdom fakes.
