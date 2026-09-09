# Wave 4A Chromatic gap

Chromatic / Storybook are **not** configured in `cyber-entrepreneur/wingcaster`
(same as Wave 0 / Wave 1 / Wave 2 / Wave 3).

Wave 4A Agent 7 therefore ships:

- `web/src/theme/wave4a-screens.a11y.test.tsx` — jest-axe + keyboard + aria-live
- `web/src/theme/wave4a-screens.visual.test.tsx` — Vitest DOM snapshots
  (15 surfaces × light/dark, plus RTL and ONB-005 Pro / WLB-004 fallback)

If a Chromatic workflow is added later, hook these fixtures into it. Do not
add Storybook solely for this wave.
