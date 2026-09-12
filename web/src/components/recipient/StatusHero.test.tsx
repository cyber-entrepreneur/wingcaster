// @vitest-environment jsdom

/**
 * Locks REC-family StatusHero emphasis doctrine for Wave 5.
 *
 * Anchor: AGT-REC-004. Calm approved surfaces required by:
 * - AGT-REC-002 APPROVED-AND-QUARANTINED -> emphasis="default"
 * - AGT-REC-003 APPROVED-AS-SIGNAL-ONLY -> emphasis="default"
 * Loud primary band is reserved for APPROVED-AND-REMOVED /
 * APPROVED-AND-INCORPORATED (emphasis="loud" only).
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusHero } from './StatusHero'

const LOUD_BAND = /--lc-action-primary/
const SUNKEN = /--lc-surface-sunken/
const ACCENT_EDGE = /--lc-accent-bold-edge/

describe('StatusHero', () => {
  it('renders pending calmly without loud primary background', () => {
    const { container } = render(
      <StatusHero state="pending" label="Awaiting Elite Real Estate's response" timestamp="2026-09-05T09:14:22Z" timestampPrefix="Submitted" />,
    )
    const section = container.querySelector('section')
    expect(section).toHaveAttribute('data-rec-status', 'pending')
    expect(section).toHaveAttribute('data-rec-emphasis', 'default')
    expect(section?.className).not.toContain('--lc-action-primary)')
    expect(screen.getByRole('heading', { name: /Awaiting Elite/i })).toBeInTheDocument()
  })

  it('uses loud primary band only for approved + emphasis=loud', () => {
    const { container, rerender } = render(
      <StatusHero state="approved" label="You've been accepted" emphasis="loud" />,
    )
    expect(container.querySelector('section')?.className).toContain('bg-[var(--lc-action-primary)]')

    rerender(<StatusHero state="approved" label="Provisional" emphasis="default" />)
    expect(container.querySelector('section')?.className).not.toContain('bg-[var(--lc-action-primary)]')

    rerender(<StatusHero state="rejected" label="Declined" emphasis="loud" />)
    expect(container.querySelector('section')?.className).not.toContain('bg-[var(--lc-action-primary)]')
  })

  it('rejected uses closed status border, not danger alone', () => {
    const { container } = render(
      <StatusHero state="rejected" label="Agency decided not to proceed" />,
    )
    const cls = container.querySelector('section')?.className || ''
    expect(cls).toContain('--lc-status-closed-fg')
    expect(cls).not.toContain('--lc-status-danger')
  })

  it('expired and withdrawn use muted framing', () => {
    const { container, rerender } = render(
      <StatusHero state="expired" label="This application timed out" />,
    )
    expect(container.querySelector('section')).toHaveAttribute('data-rec-status', 'expired')

    rerender(<StatusHero state="withdrawn" label="You withdrew this application" />)
    expect(container.querySelector('section')).toHaveAttribute('data-rec-status', 'withdrawn')
  })

  it('state=approved emphasis=loud renders the full-bleed primary band', () => {
    const { container } = render(
      <StatusHero state="approved" label="We removed this comparable" emphasis="loud" />,
    )
    const section = container.querySelector('section')
    expect(section).toBeTruthy()
    expect(section!.className).toMatch(LOUD_BAND)
    expect(section!.className).toMatch(/--lc-action-primary-text/)
    expect(section!.className).not.toMatch(SUNKEN)

    const glyphWrap = section!.querySelector('[aria-hidden="true"]')
    expect(glyphWrap?.className).toMatch(/--lc-action-primary-text/)
  })

  it('state=approved emphasis=default uses sunken + accent-bold-edge (quarantine / signal-only)', () => {
    const { container } = render(
      <StatusHero
        state="approved"
        label="We flagged this comparable for further verification"
        emphasis="default"
      />,
    )
    const section = container.querySelector('section')
    expect(section).toBeTruthy()
    expect(section!.className).toMatch(SUNKEN)
    expect(section!.className).not.toMatch(/bg-\[var\(--lc-action-primary\)\]/)

    const glyphClass = section!.querySelector('svg')?.getAttribute('class') ?? ''
    expect(glyphClass).toMatch(ACCENT_EDGE)
  })

  it('omitted emphasis defaults to calm approved surface (no accidental loud orange)', () => {
    const { container } = render(
      <StatusHero state="approved" label="Your signal is accepted as one of several inputs" />,
    )
    const section = container.querySelector('section')
    expect(section).toHaveAttribute('data-rec-emphasis', 'default')
    expect(section!.className).toMatch(SUNKEN)
    expect(section!.className).not.toMatch(LOUD_BAND)
  })

  it('requires label and surfaces it as the accessible heading', () => {
    render(<StatusHero state="pending" label="Waiting on review" />)
    const heading = screen.getByRole('heading', { level: 1, name: 'Waiting on review' })
    expect(heading).toHaveAttribute('id', 'status-hero-label')
    expect(screen.getByRole('region')).toHaveAttribute('aria-labelledby', 'status-hero-label')
  })

  it('rejected and more_info surfaces use status tokens (no raw hex)', () => {
    const { container: rejectedContainer } = render(
      <StatusHero state="rejected" label="Report declined" />,
    )
    const rejected = rejectedContainer.querySelector('section')!
    expect(rejected.className).toMatch(/--lc-status-closed-fg/)
    expect(rejected.className).toMatch(/--lc-surface-raised/)
    expect(rejected.className).not.toMatch(/#[0-9a-fA-F]{3,8}/)

    const { container: moreInfoContainer } = render(
      <StatusHero state="more_info" label="More information needed" />,
    )
    const moreInfo = moreInfoContainer.querySelector('section')!
    expect(moreInfo.className).toMatch(/--lc-status-warning-fg/)
    expect(moreInfo.className).toMatch(/--lc-surface-raised/)
    expect(moreInfo.className).not.toMatch(/#[0-9a-fA-F]{3,8}/)
  })
})
