// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ImpactPanel } from './ImpactPanel'
import { WeightingPanel } from './WeightingPanel'
import { mapComparableOutcomeState } from './mapComparableOutcomeState'
import { mapPriceOutcomeState } from './mapPriceOutcomeState'

describe('mapComparableOutcomeState → StatusHero emphasis', () => {
  it('maps confirmed_removed to approved + loud', () => {
    const m = mapComparableOutcomeState({ id: 'r1', status: 'confirmed_removed' })
    expect(m.variant).toBe('approved_removed')
    expect(m.heroState).toBe('approved')
    expect(m.emphasis).toBe('loud')
  })

  it('maps confirmed_quarantined to approved + default', () => {
    const m = mapComparableOutcomeState({ id: 'r1', status: 'confirmed_quarantined' })
    expect(m.variant).toBe('approved_quarantined')
    expect(m.heroState).toBe('approved')
    expect(m.emphasis).toBe('default')
  })

  it('maps awaiting_info to more_info', () => {
    const m = mapComparableOutcomeState({ id: 'r1', status: 'awaiting_info' })
    expect(m.heroState).toBe('more_info')
    expect(m.emphasis).toBe('default')
  })

  it('maps pending with picked_up_at to pending_in_review', () => {
    const m = mapComparableOutcomeState({
      id: 'r1',
      status: 'pending',
      picked_up_at: '2026-09-02T14:00:00Z',
    })
    expect(m.variant).toBe('pending_in_review')
    expect(m.heroState).toBe('pending')
  })
})

describe('mapPriceOutcomeState → StatusHero emphasis', () => {
  it('maps incorporated to approved + loud (weight 100)', () => {
    const m = mapPriceOutcomeState({ id: 'p1', status: 'incorporated', incorporated: true })
    expect(m.variant).toBe('approved_incorporated')
    expect(m.heroState).toBe('approved')
    expect(m.emphasis).toBe('loud')
    expect(m.weight).toBe(100)
  })

  it('maps verified (signal-only) to approved + default with weight < 100', () => {
    const m = mapPriceOutcomeState({
      id: 'p1',
      status: 'verified',
      incorporated: false,
      data: { signal_weight: 50 },
    })
    expect(m.variant).toBe('approved_signal_only')
    expect(m.heroState).toBe('approved')
    expect(m.emphasis).toBe('default')
    expect(m.weight).toBe(50)
  })

  it('defaults verified without weight field to 50', () => {
    const m = mapPriceOutcomeState({ id: 'p1', status: 'verified' })
    expect(m.emphasis).toBe('default')
    expect(m.weight).toBe(50)
  })
})

describe('ImpactPanel', () => {
  it('renders removed copy with Numeric count and listings link', () => {
    render(
      <MemoryRouter>
        <ImpactPanel count={4} mode="removed" affectedListingsHref="/listings?x=1" />
      </MemoryRouter>,
    )
    expect(screen.getByLabelText('4 listings')).toHaveTextContent('4')
    expect(screen.getByText(/had valuation recomputed/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view affected listings/i })).toHaveAttribute(
      'href',
      '/listings?x=1',
    )
  })

  it('renders quarantined copy', () => {
    render(
      <MemoryRouter>
        <ImpactPanel count={2} mode="quarantined" />
      </MemoryRouter>,
    )
    expect(screen.getByText(/data under review/i)).toBeInTheDocument()
  })

  it('renders zero-affected fallback', () => {
    render(
      <MemoryRouter>
        <ImpactPanel count={0} mode="removed" />
      </MemoryRouter>,
    )
    expect(
      screen.getByText(/No listings of yours use this comparable/i),
    ).toBeInTheDocument()
  })
})

describe('WeightingPanel', () => {
  it('exposes role=meter with aria value attributes', () => {
    render(
      <WeightingPanel
        weight={75}
        mode="signal_only"
        marketSegmentLabel="Downtown Dubai · 1BR"
      />,
    )
    const meter = screen.getByRole('meter')
    expect(meter).toHaveAttribute('aria-valuenow', '75')
    expect(meter).toHaveAttribute('aria-valuemin', '0')
    expect(meter).toHaveAttribute('aria-valuemax', '100')
    expect(meter).toHaveAttribute(
      'aria-label',
      'Signal weight applied by Platform Administrator',
    )
    expect(screen.getByLabelText('75 percent')).toHaveTextContent('75%')
    expect(screen.getByText(/weighted alongside other signals/i)).toBeInTheDocument()
  })

  it('renders authoritative copy + effective-on for incorporated', () => {
    render(
      <WeightingPanel
        weight={100}
        mode="incorporated"
        marketSegmentLabel="Marina · 2BR"
        effectiveOn="2026-09-05T00:00:00Z"
      />,
    )
    expect(screen.getByText(/authoritative/i)).toBeInTheDocument()
    expect(screen.getByText(/platform pricing model from/i)).toBeInTheDocument()
  })
})
