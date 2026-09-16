// @vitest-environment jsdom
/**
 * Wave 6 (PA-PKG + PA-POR) visual matrix scaffold — Chromatic stand-ins.
 *
 * All 7 target surfaces are `.skip` until their family PRs land. Skip blocks
 * cite `WAVE6_SURFACES[key]` from `./wave6-fixtures` so the unblocker knows
 * exactly which family PR flips each skip → real render.
 *
 * When unskipping:
 *   1. Import the real page component named in `WAVE6_SURFACES[key].realComponent`
 *   2. Mirror the Wave 5 pattern (`wf05-wf06-valuation.matrix.visual.test.tsx`) for
 *      per-variant `applyLcMode` + `installMatchMediaFixture` + `stampLcTokens` +
 *      `serializeVisualRoot` + `assertNoPlaintextPiiInHtml` + theatrical-mode guard.
 *   3. Add same-fixture orthogonal pair coverage: light-ltr-desktop / dark-ltr-desktop /
 *      light-rtl-desktop / light-ltr-mobile. Different fixtures under the same axis
 *      prove nothing (see hard-won lesson 6).
 *   4. Freeze `Date.now` in `beforeAll` to `FIXED_NOW` (hard-won lesson 8 — clock drift).
 */
import { describe, it, expect } from 'vitest'
import { WAVE6_SURFACES } from './wave6-fixtures'

describe('Wave 6 visual matrix — awaiting family PRs', () => {
  for (const surface of WAVE6_SURFACES) {
    describe.skip(`${surface.key} orthogonal matrix (waits on ${surface.brief})`, () => {
      it.skip('light-ltr-desktop', () => {
        // Placeholder — unskip when family PR lands.
        expect(surface.realComponent).toBeDefined()
      })
      it.skip('dark-ltr-desktop', () => {
        expect(surface.realComponent).toBeDefined()
      })
      it.skip('light-rtl-desktop', () => {
        expect(surface.realComponent).toBeDefined()
      })
      it.skip('light-ltr-mobile', () => {
        expect(surface.realComponent).toBeDefined()
      })
    })
  }

  // Theatrical-mode guard — this test WILL run to prove the pattern is wired
  // correctly at the scaffold layer. When family PRs land, the same guard shape
  // extends to every real fixture.
  it('theatrical-mode guard scaffold — surface enumeration is stable', () => {
    expect(WAVE6_SURFACES.length).toBe(7)
    const keys = WAVE6_SURFACES.map((s) => s.key)
    expect(keys).toEqual(['PA-PKG-001', 'PA-PKG-002', 'PA-PKG-003', 'PA-PKG-004', 'PA-POR-001', 'PA-POR-002', 'PA-POR-003'])
    for (const s of WAVE6_SURFACES) {
      expect(s.brief, `${s.key}: brief must reference a docs/design/briefs file`).toMatch(/\.md$/)
      expect(s.a11ySuite, `${s.key}: a11ySuite must be named`).toBeTruthy()
      expect(s.syntheticRationale, `${s.key}: rationale required (no blanket "later phase")`).toMatch(/blocker/i)
    }
  })
})
