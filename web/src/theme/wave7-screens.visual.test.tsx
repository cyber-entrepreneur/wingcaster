// @vitest-environment jsdom
/**
 * Wave 7 (WF-31 + AGN-ROL + AGN-DSH + AGN-MEM) visual matrix scaffold.
 *
 * All 9 target surfaces `.skip` until their family PRs land. Skip blocks cite
 * `WAVE7_SURFACES[key]` from `./wave7-fixtures`.
 *
 * Unskip protocol identical to Wave 6 — see `scratchpad/wave7-chromatic-gap.md`.
 *
 * IMPORTANT: 3 of the 9 surfaces (AGN-MEM-002/002b/005) map to existing pages
 * already on main. When unskipping those, the family agent verifies delta first
 * per `WAVE7_SURFACES[key].syntheticRationale` (don't rebuild what exists).
 */
import { describe, it, expect } from 'vitest'
import { WAVE7_SURFACES } from './wave7-fixtures'

describe('Wave 7 visual matrix — awaiting family PRs', () => {
  for (const surface of WAVE7_SURFACES) {
    describe.skip(`${surface.key} orthogonal matrix (waits on ${surface.brief})`, () => {
      it.skip('light-ltr-desktop', () => {
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

  it('theatrical-mode guard scaffold — surface enumeration stable', () => {
    expect(WAVE7_SURFACES.length).toBe(9)
    const keys = WAVE7_SURFACES.map((s) => s.key)
    expect(keys).toEqual([
      'AGN-SET-005',
      'AGN-SET-005b',
      'AGT-REC-006',
      'AGN-ROL-001',
      'AGN-ROL-002',
      'AGN-DSH-002',
      'AGN-MEM-002',
      'AGN-MEM-002b',
      'AGN-MEM-005',
    ])
    for (const s of WAVE7_SURFACES) {
      expect(s.brief, `${s.key}: brief must reference a docs/design/briefs file`).toMatch(/\.md$/)
      expect(s.a11ySuite, `${s.key}: a11ySuite must be named`).toBeTruthy()
      expect(
        s.syntheticRationale,
        `${s.key}: rationale required (no blanket "later phase")`,
      ).toMatch(/blocker|verify|existing|delta/i)
    }
  })

  it('WF-31 surfaces cite shared primitive consumption', () => {
    const wf31Keys = ['AGN-SET-005', 'AGN-SET-005b', 'AGT-REC-006']
    for (const key of wf31Keys) {
      const surface = WAVE7_SURFACES.find((s) => s.key === key)!
      expect(
        surface.consumesShared,
        `${key} must cite shared primitives consumed (OwnershipTransferChallenge / REC-family)`,
      ).toBeDefined()
      expect(surface.consumesShared!.length, `${key} consumesShared list non-empty`).toBeGreaterThan(0)
    }
  })
})
