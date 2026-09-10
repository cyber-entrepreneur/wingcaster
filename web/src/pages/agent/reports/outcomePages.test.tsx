// @vitest-environment jsdom
/**
 * Page-level StatusHero emphasis + panel visibility for AGT-REC-002 / 003.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ComparableReportRow, AgentPriceReportRow } from './outcomeTypes'

const comparableHook = vi.hoisted(() => ({
  report: null as ComparableReportRow | null,
  loading: false,
  notFound: false,
  error: null as string | null,
  refetch: vi.fn(),
}))

const priceHook = vi.hoisted(() => ({
  report: null as AgentPriceReportRow | null,
  loading: false,
  notFound: false,
  error: null as string | null,
  refetch: vi.fn(),
}))

vi.mock('./useComparableReportOutcome', () => ({
  useComparableReportOutcome: () => comparableHook,
}))

vi.mock('./usePriceReportOutcome', () => ({
  usePriceReportOutcome: () => priceHook,
}))

vi.mock('@/lib/usePageTitle', () => ({
  usePageTitle: () => undefined,
}))

import { ComparableReportOutcomePage } from './ComparableReportOutcomePage'
import { PriceReportOutcomePage } from './PriceReportOutcomePage'

function renderComparable() {
  return render(
    <MemoryRouter initialEntries={['/reports/comparables/cmr_1/outcome']}>
      <Routes>
        <Route
          path="/reports/comparables/:reportId/outcome"
          element={<ComparableReportOutcomePage />}
        />
      </Routes>
    </MemoryRouter>,
  )
}

function renderPrice() {
  return render(
    <MemoryRouter initialEntries={['/reports/prices/apr_1/outcome']}>
      <Routes>
        <Route path="/reports/prices/:reportId/outcome" element={<PriceReportOutcomePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ComparableReportOutcomePage — StatusHero emphasis + ImpactPanel', () => {
  beforeEach(() => {
    comparableHook.loading = false
    comparableHook.notFound = false
    comparableHook.error = null
    comparableHook.report = null
  })

  it('APPROVED-AND-REMOVED uses loud hero and shows ImpactPanel', () => {
    comparableHook.report = {
      id: 'cmr_1',
      status: 'confirmed_removed',
      comparable_id: 'cmp_1',
      submitted_at: '2026-09-01T10:00:00Z',
      decided_at: '2026-09-03T09:00:00Z',
      reviewed_at: '2026-09-03T09:00:00Z',
      data: {
        comparable: {
          address_label: 'The Address Downtown, unit 2312',
          market_label: 'Downtown Dubai',
          source_label: 'Bayut',
        },
        decision: {
          action: 'removed',
          notes: 'Removed after verification.',
          market_impact: { valuations_affected: 4 },
          resolver: { display_name: 'PA-Layla', avatar_url: null },
        },
      },
    }

    const { container } = renderComparable()
    expect(screen.getByRole('heading', { name: /We removed this comparable/i })).toBeInTheDocument()
    const hero = container.querySelector('section[aria-labelledby="status-hero-label"]')
    expect(hero?.className).toMatch(/bg-\[var\(--lc-action-primary\)\]/)
    expect(screen.getByTestId('impact-panel')).toHaveAttribute('data-impact-mode', 'removed')
  })

  it('APPROVED-AND-QUARANTINED uses default (sunken) hero and shows ImpactPanel', () => {
    comparableHook.report = {
      id: 'cmr_1',
      status: 'confirmed_quarantined',
      comparable_id: 'cmp_1',
      submitted_at: '2026-09-01T10:00:00Z',
      decided_at: '2026-09-03T09:00:00Z',
      reviewed_at: '2026-09-03T09:00:00Z',
      data: {
        decision: {
          action: 'quarantined',
          market_impact: { valuations_affected: 2 },
          resolver: { display_name: 'PA-Layla', avatar_url: null },
        },
      },
    }

    const { container } = renderComparable()
    expect(
      screen.getByRole('heading', { name: /flagged this comparable for further verification/i }),
    ).toBeInTheDocument()
    const hero = container.querySelector('section[aria-labelledby="status-hero-label"]')
    expect(hero?.className).toMatch(/bg-\[var\(--lc-surface-sunken\)\]/)
    expect(hero?.className).not.toMatch(/bg-\[var\(--lc-action-primary\)\]/)
    expect(screen.getByTestId('impact-panel')).toHaveAttribute('data-impact-mode', 'quarantined')
  })

  it('hides ImpactPanel for pending / rejected', () => {
    comparableHook.report = {
      id: 'cmr_1',
      status: 'pending',
      submitted_at: '2026-09-01T10:00:00Z',
      expires_at: '2026-10-01T10:00:00Z',
    }
    const { rerender } = renderComparable()
    expect(screen.queryByTestId('impact-panel')).toBeNull()

    comparableHook.report = {
      id: 'cmr_1',
      status: 'rejected',
      decided_at: '2026-09-03T09:00:00Z',
      reviewed_at: '2026-09-03T09:00:00Z',
    }
    rerender(
      <MemoryRouter initialEntries={['/reports/comparables/cmr_1/outcome']}>
        <Routes>
          <Route
            path="/reports/comparables/:reportId/outcome"
            element={<ComparableReportOutcomePage />}
          />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.queryByTestId('impact-panel')).toBeNull()
  })
})

describe('PriceReportOutcomePage — StatusHero emphasis + WeightingPanel', () => {
  beforeEach(() => {
    priceHook.loading = false
    priceHook.notFound = false
    priceHook.error = null
    priceHook.report = null
  })

  it('APPROVED-AND-INCORPORATED uses loud hero and WeightingPanel at 100%', () => {
    priceHook.report = {
      id: 'apr_1',
      status: 'incorporated',
      incorporated: true,
      incorporated_at: '2026-09-05T00:00:00Z',
      reviewed_at: '2026-09-04T09:00:00Z',
      created_at: '2026-09-01T10:00:00Z',
      external_property_title: '1BR apartments · Downtown Dubai · Sep 2026',
      segment_label: 'Downtown Dubai · 1BR apartments',
      review_notes: 'Methodology is sound.',
      data: { resolver: { display_name: 'PA-Karim', avatar_url: null } },
    }

    const { container } = renderPrice()
    expect(
      screen.getByRole('heading', { name: /Your price signal is now live/i }),
    ).toBeInTheDocument()
    const hero = container.querySelector('section[aria-labelledby="status-hero-label"]')
    expect(hero?.className).toMatch(/bg-\[var\(--lc-action-primary\)\]/)
    expect(screen.getByTestId('weighting-panel')).toHaveAttribute('data-weight-mode', 'incorporated')
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '100')
  })

  it('APPROVED-AS-SIGNAL-ONLY uses default hero and WeightingPanel <100%', () => {
    priceHook.report = {
      id: 'apr_1',
      status: 'verified',
      incorporated: false,
      reviewed_at: '2026-09-04T09:00:00Z',
      created_at: '2026-09-01T10:00:00Z',
      external_property_title: '1BR apartments · Downtown Dubai · Sep 2026',
      segment_label: 'Downtown Dubai · 1BR apartments',
      data: {
        signal_weight: 50,
        resolver: { display_name: 'PA-Karim', avatar_url: null },
      },
    }

    const { container } = renderPrice()
    expect(
      screen.getByRole('heading', { name: /accepted as one of several inputs/i }),
    ).toBeInTheDocument()
    const hero = container.querySelector('section[aria-labelledby="status-hero-label"]')
    expect(hero?.className).toMatch(/bg-\[var\(--lc-surface-sunken\)\]/)
    expect(hero?.className).not.toMatch(/bg-\[var\(--lc-action-primary\)\]/)
    expect(screen.getByTestId('weighting-panel')).toHaveAttribute('data-weight-mode', 'signal_only')
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '50')
  })

  it('hides WeightingPanel for pending / rejected', () => {
    priceHook.report = {
      id: 'apr_1',
      status: 'pending_review',
      created_at: '2026-09-01T10:00:00Z',
      expires_at: '2026-10-01T10:00:00Z',
    }
    const { rerender } = renderPrice()
    expect(screen.queryByTestId('weighting-panel')).toBeNull()

    priceHook.report = {
      id: 'apr_1',
      status: 'rejected',
      reviewed_at: '2026-09-04T09:00:00Z',
      reason_code: 'insufficient_sample',
    }
    rerender(
      <MemoryRouter initialEntries={['/reports/prices/apr_1/outcome']}>
        <Routes>
          <Route path="/reports/prices/:reportId/outcome" element={<PriceReportOutcomePage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.queryByTestId('weighting-panel')).toBeNull()
  })
})
