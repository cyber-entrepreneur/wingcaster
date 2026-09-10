// @vitest-environment jsdom
/**
 * PA-PVA-008 / 008b WF-05 tests.
 * Proves: bulk bar omits confirm-remove/quarantine; detail exposes all 4 decisions;
 * reporter-pattern amber affordance; token-only styling (no raw hex in module).
 */
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BadComparableQueuePage, WF05_BULK_ACTIONS } from './BadComparableQueuePage'
import { BadComparableDetailPage } from './BadComparableDetailPage'
import { ReporterPatternDot } from './ReporterPatternDot'
import { MarketImpactChip } from './MarketImpactChip'
import type { ComparableReportDetail, ComparableReportListItem } from './types'

const sampleReport: ComparableReportListItem = {
  id: 'cmr_001',
  created_at: new Date(Date.now() - 3600_000).toISOString(),
  sla_hours_remaining: 46.9,
  sla_hours_total: 48,
  status: 'pending',
  reason_category: 'already_sold',
  severity: 'high',
  reporter: {
    id: 'usr_ak',
    display_name: 'Ahmed Khan',
    avatar_url: null,
    agency: { id: 'agy_1', name: 'Abu Dhabi Prime' },
    pattern_flag: true,
    pattern_signals: {
      reports_against_agency_last_30d: 4,
      days_window: 21,
      agency_name: 'Saadiyat Homes',
    },
  },
  comparable: {
    id: 'cmp_1',
    title: 'Villa · Saadiyat',
    address_line: 'Saadiyat Beach, Abu Dhabi',
    thumb_url: null,
    source: 'external_scrape',
    source_display: 'OLX',
    owning_agency: { id: 'agy_2', name: 'Saadiyat Homes' },
  },
  market_impact: {
    tier: 'high',
    valuations_affected: 34,
    pct_move_median: -11.2,
    pct_move_max: -18.7,
  },
  evidence: { file_count: 3, files: [] },
  is_own: false,
  requires_two_person: true,
  env: 'live',
}

const sampleDetail: ComparableReportDetail = {
  ...sampleReport,
  reporter_claim: {
    reported_field: 'status',
    observed_value: 'sold',
    observed_at: '2026-08-14',
    reason_text: 'Sold per DLD record.',
    field_diffs: [
      { field: 'status', current: 'active', observed: 'sold' },
      { field: 'sale_date', current: null, observed: '2026-08-14' },
    ],
  },
  comparable: {
    ...sampleReport.comparable,
    current_fields: {
      price: 5200000,
      status: 'active',
      area_sqm: 380,
    },
    source_url: 'https://example.com/listing',
  },
  market_impact: {
    ...sampleReport.market_impact,
    top_markets: [
      { market: 'Saadiyat', count: 22 },
      { market: 'Yas', count: 7 },
    ],
  },
}

const apiMock = vi.hoisted(() => ({
  list: vi.fn(async () => ({
    reports: [sampleReport],
    pagination: { page: 1, page_size: 25, total: 1, has_next: false },
    counts: {
      pending: 1,
      pending_at_risk: 0,
      high_impact_awaiting_two_person: 1,
      confirmed_removed_this_week: 0,
      confirmed_quarantined_this_week: 0,
      rejected_this_week: 0,
    },
  })),
  get: vi.fn(async () => sampleDetail),
  reporterHistory: vi.fn(async () => ({ reports: [] })),
  auditTrail: vi.fn(async () => ({ events: [] })),
  affectedValuations: vi.fn(async () => ({ valuations: [] })),
  bulkRejectAsInvalid: vi.fn(async () => ({ status: 200, succeeded: [], failed: [] })),
  bulkRequestInfo: vi.fn(async () => ({ status: 200, succeeded: [], failed: [] })),
  confirmRemove: vi.fn(async () => ({ status: 'confirmed_removed' })),
  confirmQuarantine: vi.fn(async () => ({ status: 'confirmed_quarantined' })),
  rejectAsInvalid: vi.fn(async () => ({ status: 'rejected' })),
  requestInfo: vi.fn(async () => ({ status: 'awaiting_info' })),
  undoDecision: vi.fn(async () => ({})),
  exportCsvPath: vi.fn(() => '/admin/pricing/reports.csv'),
}))

vi.mock('./api', () => ({ comparableReportsApi: apiMock }))

const authMock = vi.hoisted(() => ({ isAdmin: true, agent: { id: 'admin-1' } }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authMock,
}))

vi.mock('@/hooks/useEnv', () => ({
  useEnv: () => ({ env: 'live' as const }),
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast: vi.fn(), removeToast: vi.fn(), toasts: [] }),
}))

function wrapQueue(ui: ReactElement = <BadComparableQueuePage />) {
  return render(<MemoryRouter initialEntries={['/admin/valuation/comparable-reports']}>{ui}</MemoryRouter>)
}

function wrapDetail() {
  return render(
    <MemoryRouter initialEntries={['/admin/valuation/comparable-reports/cmr_001']}>
      <Routes>
        <Route path="/admin/valuation/comparable-reports/:reportId" element={<BadComparableDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('WF-05 bulk-safety (PA-PVA-008)', () => {
  beforeEach(() => {
    cleanup()
    authMock.isAdmin = true
    apiMock.list.mockClear()
  })

  it('WF05_BULK_ACTIONS excludes confirm-remove and confirm-quarantine', () => {
    expect(WF05_BULK_ACTIONS).toEqual(['reject', 'request_info'])
    expect(WF05_BULK_ACTIONS).not.toContain('approve')
    expect(WF05_BULK_ACTIONS as readonly string[]).not.toContain('confirm-remove')
    expect(WF05_BULK_ACTIONS as readonly string[]).not.toContain('confirm-quarantine')
  })

  it('bulk bar does not expose confirm-remove / confirm-quarantine / Approve', async () => {
    wrapQueue()
    await screen.findByText('Villa · Saadiyat')

    // Select the row
    const checkbox = screen.getByLabelText(/Select row cmr_001/i)
    fireEvent.click(checkbox)

    const bulk = screen.getByRole('status', { name: undefined })
    // Prefer the bulk bar by data attribute
    const bar = document.querySelector('[data-pa-queue-bulk-actions]') as HTMLElement
    expect(bar).toBeTruthy()
    expect(bar.getAttribute('data-pa-queue-bulk-actions')).toBe('reject,request_info')

    const barText = bar.textContent ?? ''
    expect(barText).toMatch(/Reject as invalid/i)
    expect(barText).toMatch(/Request more info/i)
    expect(barText).not.toMatch(/Confirm and remove/i)
    expect(barText).not.toMatch(/Confirm and quarantine/i)
    expect(barText).not.toMatch(/\bApprove\b/)
    // Ensure no confirm-remove / quarantine buttons inside bar
    expect(within(bar).queryByRole('button', { name: /confirm and remove/i })).toBeNull()
    expect(within(bar).queryByRole('button', { name: /confirm and quarantine/i })).toBeNull()
    expect(within(bar).queryByRole('button', { name: /^Approve/i })).toBeNull()

    // Silence unused
    void bulk
  })

  it('queue rows have Open only — no inline Approve/Reject', async () => {
    wrapQueue()
    await screen.findByText('Villa · Saadiyat')
    expect(screen.getByRole('button', { name: /^Open$/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Confirm and remove/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /Reject as invalid/i })).toBeNull()
  })
})

describe('WF-05 detail decisions (PA-PVA-008b)', () => {
  beforeEach(() => {
    cleanup()
    authMock.isAdmin = true
    apiMock.get.mockClear()
  })

  it('exposes all 4 decision affordances', async () => {
    wrapDetail()
    await screen.findByText('Villa · Saadiyat')

    const panel = document.querySelector('[data-arbitration-decision-panel]') as HTMLElement
    expect(panel).toBeTruthy()

    expect(panel.querySelector('[data-decision="confirm-remove"]')).toBeTruthy()
    expect(panel.querySelector('[data-decision="confirm-quarantine"]')).toBeTruthy()
    expect(panel.querySelector('[data-decision="reject-as-invalid"]')).toBeTruthy()
    expect(panel.querySelector('[data-decision="request-info"]')).toBeTruthy()

    expect(screen.getByRole('button', { name: /Confirm and remove/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Confirm and quarantine/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Reject as invalid/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Request more info/i })).toBeTruthy()
  })

  it('surfaces two-person banner for high market-impact', async () => {
    wrapDetail()
    await screen.findByText(/second PA approval is required/i)
    expect(document.querySelector('[data-two-person-banner]')).toBeTruthy()
  })
})

describe('Reporter-pattern amber affordance', () => {
  beforeEach(() => cleanup())

  it('renders warning-token amber dot when pattern_flag is true', () => {
    const { container } = render(
      <ReporterPatternDot
        patternFlag
        signals={{
          reports_against_agency_last_30d: 4,
          days_window: 21,
          agency_name: 'Saadiyat Homes',
        }}
      />,
    )
    const dot = container.querySelector('[data-reporter-pattern="true"]') as HTMLElement
    expect(dot).toBeTruthy()
    expect(dot.className).toMatch(/--lc-status-warning-dot/)
    expect(dot.getAttribute('aria-label') ?? '').toMatch(/possible pattern/i)
  })

  it('is present on queue rows when reporter has multi-report flag', async () => {
    wrapQueue()
    await screen.findByText('Villa · Saadiyat')
    expect(document.querySelector('[data-reporter-pattern="true"]')).toBeTruthy()
  })

  it('does not render when pattern_flag is false', () => {
    const { container } = render(<ReporterPatternDot patternFlag={false} />)
    expect(container.querySelector('[data-reporter-pattern]')).toBeNull()
  })
})

describe('Token-only styling (valuation module)', () => {
  it('MarketImpactChip uses status tokens, not raw hex', () => {
    const { container } = render(
      <MarketImpactChip
        impact={{
          tier: 'high',
          valuations_affected: 34,
          pct_move_median: 11,
          pct_move_max: 18,
        }}
      />,
    )
    const chip = container.querySelector('[data-market-impact-tier="high"]') as HTMLElement
    expect(chip.className).toMatch(/--lc-status-danger-bg/)
    expect(chip.className).not.toMatch(/#[0-9A-Fa-f]{3,8}/)
  })

  it('valuation page sources contain no raw hex', () => {
    const dir = path.dirname(fileURLToPath(import.meta.url))
    const HEX = /#[0-9A-Fa-f]{3,8}\b/
    const offenders: string[] = []
    const walk = (d: string) => {
      for (const name of readdirSync(d)) {
        const full = path.join(d, name)
        if (statSync(full).isDirectory()) walk(full)
        else if (/\.(tsx|ts)$/.test(name) && !name.includes('.test.')) {
          const src = readFileSync(full, 'utf8')
          if (HEX.test(src)) offenders.push(name)
        }
      }
    }
    walk(dir)
    expect(offenders).toEqual([])
  })
})
