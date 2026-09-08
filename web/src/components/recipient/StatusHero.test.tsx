// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusHero } from './StatusHero'

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
})
