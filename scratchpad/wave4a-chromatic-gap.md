# Wave 4A Chromatic gap

Chromatic / Storybook are **not** configured in `cyber-entrepreneur/wingcaster`
(same as Wave 0 / Wave 1 / Wave 2 / Wave 3).

Wave 4A Agent 7 therefore ships:

- `web/src/theme/wave4a-screens.a11y.test.tsx` — jest-axe + keyboard + aria-live
- `web/src/theme/wave4a-screens.visual.test.tsx` — Vitest DOM snapshots
  (15 surfaces × light/dark, plus RTL and ONB-005 Pro / WLB-004 fallback)

If a Chromatic workflow is added later, hook these fixtures into it. Do not
add Storybook solely for this wave.

## Follow-up: real-page snapshots in the visual budget

`web/src/theme/wave4a-screens.visual.test.tsx` is a **synchronous** DOM-snapshot
matrix — it `render()`s and serializes on the same tick and never awaits. The
five data-driven funnel pages (ONB-003 FirstListingReviewPage, WLB-005
ListingDraftingPage ready-state, ACT-002 ActivationWhatsAppPage, ACT-003
ActivationFirstListingPage, ACT-005 ActivationInviteTeamPage) load their content
through fetch/SSE round-trips that resolve on a later microtask, so a real mount
in that matrix would only capture the loading skeleton. Their `*Surface()`
fixtures therefore stay primitive compositions, with per-page rationale in the
header of `web/src/theme/wave4a-fixtures.tsx`.

Real-page render + axe (async, `waitFor`) already covers these pages in:
- `web/src/theme/wave4a-onb-act-pages.a11y.test.tsx`
- `web/src/theme/wave4a-wlb-pages.a11y.test.tsx`

When a Chromatic/Storybook pipeline lands, add async real-page stories for these
five screens so the visual budget snapshots the real pages (post-fetch), then
the primitive fixtures can be retired from the visual matrix.
