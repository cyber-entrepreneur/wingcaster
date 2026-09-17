/**
 * Unit tests for the PA-queue-family invariant harness itself.
 *
 * Verifies each of the 7 invariant checks fires correctly on synthetic DOM.
 * When PA-PKG-003 and PA-POR-001 land (Wave 6), those pages' own quality tests
 * will import `assertPaQueueFamilyInvariants` from `./pa-queue-family-invariants`
 * and run it against the real page render.
 */
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { assertPaQueueFamilyInvariants } from './pa-queue-family-invariants'

function makeSyntheticQueueDom({
  status = 'complete',
}: {
  status?: 'complete' | 'no-hero' | 'no-count' | 'no-filter' | 'no-empty' | 'no-shortcuts' | 'no-table' | 'no-bulk'
} = {}): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = `
    ${status === 'no-hero' ? '' : `
      <div data-status-hero>
        <h1>Queue</h1>
        ${status === 'no-count' ? '' : '<p data-status-hero-subtitle>12 pending</p>'}
      </div>`}
    ${status === 'no-filter' ? '' : '<div data-pa-queue-filter-strip>filters</div>'}
    ${status === 'no-empty' ? '' : '<div data-pa-queue-empty-hero hidden>Empty</div>'}
    ${status === 'no-shortcuts' ? '' : '<div data-pa-queue-shortcuts-panel>?</div>'}
    ${status === 'no-table' ? '' : '<table data-pa-queue-table></table>'}
    ${status === 'no-bulk' ? '' : '<div data-pa-queue-bulk-actions>bulk</div>'}
  `
  document.body.appendChild(root)
  return root
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('assertPaQueueFamilyInvariants', () => {
  it('passes on a complete PA queue DOM with bulk on and type-to-confirm off', () => {
    const root = makeSyntheticQueueDom()
    expect(() =>
      assertPaQueueFamilyInvariants(root, {
        hasBulk: true,
        hasTypeToConfirm: false,
        briefRef: 'TEST-QUEUE-001',
      }),
    ).not.toThrow()
  })

  it('invariant 1: fails when hero missing', () => {
    const root = makeSyntheticQueueDom({ status: 'no-hero' })
    expect(() =>
      assertPaQueueFamilyInvariants(root, { hasBulk: true, hasTypeToConfirm: false, briefRef: 'X' }),
    ).toThrow(/invariant 1: hero/)
  })

  it('invariant 1: fails when count subtitle missing digits', () => {
    const root = makeSyntheticQueueDom({ status: 'no-count' })
    expect(() =>
      assertPaQueueFamilyInvariants(root, { hasBulk: true, hasTypeToConfirm: false, briefRef: 'X' }),
    ).toThrow(/invariant 1: hero subtitle must include a count digit/)
  })

  it('invariant 2: fails when filter strip missing', () => {
    const root = makeSyntheticQueueDom({ status: 'no-filter' })
    expect(() =>
      assertPaQueueFamilyInvariants(root, { hasBulk: true, hasTypeToConfirm: false, briefRef: 'X' }),
    ).toThrow(/invariant 2: PAQueueFilterStrip/)
  })

  it('invariant 3: fails when empty-state hero not declared', () => {
    const root = makeSyntheticQueueDom({ status: 'no-empty' })
    expect(() =>
      assertPaQueueFamilyInvariants(root, { hasBulk: true, hasTypeToConfirm: false, briefRef: 'X' }),
    ).toThrow(/invariant 3: empty-state hero/)
  })

  it('invariant 4: fails when shortcuts signals all missing', () => {
    const root = makeSyntheticQueueDom({ status: 'no-shortcuts' })
    expect(() =>
      assertPaQueueFamilyInvariants(root, { hasBulk: true, hasTypeToConfirm: false, briefRef: 'X' }),
    ).toThrow(/invariant 4: shortcuts panel or trigger/)
  })

  it('invariant 5: fails when table primitive missing', () => {
    const root = makeSyntheticQueueDom({ status: 'no-table' })
    expect(() =>
      assertPaQueueFamilyInvariants(root, { hasBulk: true, hasTypeToConfirm: false, briefRef: 'X' }),
    ).toThrow(/invariant 5: PAQueueTable/)
  })

  it('invariant 6: fails when hasBulk=true but bulk bar missing', () => {
    const root = makeSyntheticQueueDom({ status: 'no-bulk' })
    expect(() =>
      assertPaQueueFamilyInvariants(root, { hasBulk: true, hasTypeToConfirm: false, briefRef: 'X' }),
    ).toThrow(/invariant 6/)
  })

  it('invariant 6: passes when hasBulk=false and bulk bar absent (deliberate omit)', () => {
    const root = makeSyntheticQueueDom({ status: 'no-bulk' })
    expect(() =>
      assertPaQueueFamilyInvariants(root, {
        hasBulk: false,
        hasTypeToConfirm: false,
        briefRef: 'WF-04-DELIBERATE-OMIT',
      }),
    ).not.toThrow()
  })

  it('invariant 6: fails when hasBulk=true and bulk bar present (bar wins over flag disagreement)', () => {
    const root = makeSyntheticQueueDom() // bulk bar IS present
    expect(() =>
      assertPaQueueFamilyInvariants(root, {
        hasBulk: false,
        hasTypeToConfirm: false,
        briefRef: 'X',
      }),
    ).toThrow(/invariant 6 \(omit\)/)
  })

  it('invariant 7: fails when hasTypeToConfirm=true but input missing', () => {
    const root = makeSyntheticQueueDom()
    expect(() =>
      assertPaQueueFamilyInvariants(root, {
        hasBulk: true,
        hasTypeToConfirm: true,
        briefRef: 'HIGH-VALUE',
      }),
    ).toThrow(/invariant 7/)
  })

  it('invariant 7: fails when hasTypeToConfirm=false but input present (over-apply anti-pattern)', () => {
    const root = makeSyntheticQueueDom()
    const ttc = document.createElement('input')
    ttc.setAttribute('data-type-to-confirm', 'true')
    root.appendChild(ttc)
    expect(() =>
      assertPaQueueFamilyInvariants(root, {
        hasBulk: true,
        hasTypeToConfirm: false,
        briefRef: 'X',
      }),
    ).toThrow(/invariant 7.*over-apply/)
  })

  it('invariant 7: passes when hasTypeToConfirm=true and input present', () => {
    const root = makeSyntheticQueueDom()
    const ttc = document.createElement('input')
    ttc.setAttribute('data-type-to-confirm', 'true')
    root.appendChild(ttc)
    expect(() =>
      assertPaQueueFamilyInvariants(root, {
        hasBulk: true,
        hasTypeToConfirm: true,
        briefRef: 'HIGH-VALUE',
      }),
    ).not.toThrow()
  })
})
