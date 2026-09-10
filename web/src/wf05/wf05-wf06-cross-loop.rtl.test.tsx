// @vitest-environment jsdom
/**
 * WF-05 + WF-06 cross-loop UI e2e (Wave 5 Agent 6).
 *
 * Proves both valuation review deadlocks are resolved across Phase A screens
 * without inventing product UI:
 *
 * WF-05: AGT-APR-004 submitter → PA-PVA-008 queue (bulk NEVER confirm-remove)
 *   → PA-PVA-008b confirm-remove (+ two-person high impact) → AGT-REC-002 ImpactPanel
 *
 * WF-06: AGT-APR-005 submitter → PA-PVA-009 queue → PA-PVA-009b incorporate=true
 *   → AGT-REC-003 WeightingPanel showing PA weight
 *
 * Chromatic / a11y snapshots are owned by Agent 7 (feat/wave-5-quality).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'
import { PAQueueBulkBar } from '@/components/queue'
import { BadComparableQueuePage, WF05_BULK_ACTIONS } from '@/pages/admin/valuation'
import { BadComparableDetailPage } from '@/pages/admin/valuation/BadComparableDetailPage'
import { PriceReportDetailPage } from '@/pages/admin/valuation/PriceReportDetailPage'
import {
  ComparableReportOutcomePage,
  ImpactPanel,
  PriceReportOutcomePage,
  WeightingPanel,
} from '@/pages/agent/reports'
import type { ComparableReportRow, AgentPriceReportRow } from '@/pages/agent/reports/outcomeTypes'
import type { PriceReportDetail } from '@/pages/admin/valuation/priceReportTypes'

const {
  listComparableMock,
  getComparableMock,
  confirmRemoveMock,
  getPriceReportMock,
  reviewPriceMock,
  addToastMock,
} = vi.hoisted(() => ({
  listComparableMock: vi.fn(),
  getComparableMock: vi.fn(),
  confirmRemoveMock: vi.fn(),
  getPriceReportMock: vi.fn(),
  reviewPriceMock: vi.fn(),
  addToastMock: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  api: {
    listAdminComparableReports: listComparableMock,
    getAdminComparableReport: getComparableMock,
    getAdminComparableReportReporterHistory: vi.fn(async () => ({ reports: [] })),
    getAdminComparableReportAuditTrail: vi.fn(async () => ({ events: [] })),
    getAdminComparableReportAffectedValuations: vi.fn(async () => ({
      valuations: [],
      pagination: { total: 0 },
    })),
    confirmAdminComparableReportRemove: confirmRemoveMock,
    confirmAdminComparableReportQuarantine: vi.fn(),
    rejectAdminComparableReportAsInvalid: vi.fn(),
    requestAdminComparableReportInfo: vi.fn(),
    undoAdminComparableReportDecision: vi.fn(),
    bulkRejectAdminComparableReportsAsInvalid: vi.fn(),
    bulkRequestAdminComparableReportsInfo: vi.fn(),
    getAdminAgentPriceReport: getPriceReportMock,
    getAdminPricingBenchmarkSeries: vi.fn(async () => ({
      points: [],
      currency: 'AED',
      segment_id: 'seg_wf06',
    })),
    reviewAdminAgentPriceReport: reviewPriceMock,
    undoAdminAgentPriceReportReview: vi.fn(),
    getAdminAgentPriceReportEvidenceUrl: vi.fn(),
    reportComparable: vi.fn(),
    submitAgentPriceReport: vi.fn(),
  },
  API_BASE: '/api',
  getElevatedToken: () => 'elevated-test-token',
}))

vi.mock('@/pages/admin/valuation/api', async () => {
  const actual = await vi.importActual<typeof import('@/pages/admin/valuation/api')>(
    '@/pages/admin/valuation/api',
  )
  return {
    ...actual,
    comparableReportsApi: {
      ...actual.comparableReportsApi,
      list: listComparableMock,
      get: getComparableMock,
      confirmRemove: confirmRemoveMock,
      reporterHistory: vi.fn(async () => ({ reports: [] })),
      auditTrail: vi.fn(async () => ({ events: [] })),
      affectedValuations: vi.fn(async () => ({ valuations: [], pagination: { total: 0 } })),
    },
  }
})

const comparableOutcome = vi.hoisted(() => ({
  report: null as ComparableReportRow | null,
  loading: false,
  notFound: false,
  error: null as string | null,
  refetch: vi.fn(),
}))

const priceOutcome = vi.hoisted(() => ({
  report: null as AgentPriceReportRow | null,
  loading: false,
  notFound: false,
  error: null as string | null,
  refetch: vi.fn(),
}))

vi.mock('@/pages/agent/reports/useComparableReportOutcome', () => ({
  useComparableReportOutcome: () => comparableOutcome,
}))

vi.mock('@/pages/agent/reports/usePriceReportOutcome', () => ({
  usePriceReportOutcome: () => priceOutcome,
}))

vi.mock('@/lib/usePageTitle', () => ({
  usePageTitle: () => undefined,
}))

const authMock = vi.hoisted(() => ({
  isAdmin: true,
  agent: { id: 'pa_current', name: 'Priya', platform_role: 'platform_admin' as const },
}))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authMock,
}))

vi.mock('@/hooks/useEnv', () => ({
  useEnv: () => ({
    env: 'live' as const,
    isLive: true,
    isTest: false,
    switching: false,
    confirmLiveOpen: false,
    sessionChangedElsewhere: false,
    error: null,
    openLiveConfirm: vi.fn(),
    closeLiveConfirm: vi.fn(),
    selectEnv: vi.fn(),
    confirmSwitchToLive: vi.fn(),
    clearError: vi.fn(),
  }),
  getWingcasterEnv: () => 'live' as const,
  WINGCASTER_ENV_HEADER: 'X-Wingcaster-Env',
}))

vi.mock('@/hooks/useLocale', () => ({
  useLocale: () => ({
    locale: 'en' as const,
    setLocale: vi.fn(async () => ({ ok: true as const })),
    dir: 'ltr' as const,
    isArabic: false,
  }),
}))

vi.mock('@/context/StepUpContext', () => ({
  useStepUp: () => ({
    requireElevation: async () => true,
    runElevated: async <T,>(action: () => Promise<T>) => action(),
  }),
}))

vi.mock('@/components/ui/toast', async () => {
  const actual = await vi.importActual<typeof import('@/components/ui/toast')>(
    '@/components/ui/toast',
  )
  return {
    ...actual,
    useToast: () => ({
      addToast: addToastMock,
      toasts: [],
      removeToast: vi.fn(),
    }),
  }
})

vi.mock('@/components/nav/EnvBadge', () => ({
  EnvBadge: ({ env }: { env: string }) => <span data-testid="env-badge">{env}</span>,
}))

function queueRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cmr_wf05',
    created_at: new Date(Date.now() - 3_600_000).toISOString(),
    sla_hours_remaining: 20,
    sla_hours_total: 48,
    status: 'pending',
    reason_category: 'already_sold',
    severity: 'high',
    reporter: {
      id: 'usr_rep',
      display_name: 'Omar Khoury',
      avatar_url: null,
      agency: { id: 'agy_1', name: 'Blue Door' },
      pattern_flag: false,
    },
    comparable: {
      id: 'cmp_1',
      title: 'Villa · Saadiyat',
      address_line: 'Saadiyat Island, Abu Dhabi',
      thumb_url: null,
      source: 'external_scrape',
      source_display: 'Bayut',
      owning_agency: { id: 'agy_2', name: 'Saadiyat Homes' },
    },
    market_impact: {
      tier: 'high',
      valuations_affected: 34,
      pct_move_median: -11,
      pct_move_max: -18,
    },
    evidence: { file_count: 1, files: [] },
    is_own: false,
    requires_two_person: true,
    env: 'live',
    ...overrides,
  }
}

function detailPayload(overrides: Record<string, unknown> = {}) {
  return {
    ...queueRow(),
    reporter_claim: {
      reported_field: 'status',
      observed_value: 'sold',
      observed_at: '2026-08-14',
      reason_text: 'Sold per DLD record.',
      field_diffs: [
        { field: 'status', current: 'active', observed: 'sold' },
      ],
    },
    comparable: {
      ...queueRow().comparable,
      current_fields: { price: 2_400_000, status: 'active' },
      source_url: 'https://example.com/listing',
    },
    market_impact: {
      tier: 'high',
      valuations_affected: 34,
      pct_move_median: -11,
      pct_move_max: -18,
      top_markets: [{ market: 'Abu Dhabi', count: 20 }],
    },
    ...overrides,
  }
}

function priceDetail(overrides: Partial<PriceReportDetail> = {}): PriceReportDetail {
  return {
    id: 'aprt_wf06',
    submitted_at: new Date(Date.now() - 2 * 3600_000).toISOString(),
    agent: {
      id: 'usr_pro',
      display_name: 'Sara Al Mansouri',
      tier: 'pro_elite',
      tenure_days: 900,
    },
    agency: { id: 'agy_1', name: 'Elite Real Estate Dubai' },
    subject: {
      segment_label: 'Dubai Marina · 2BR apartments',
      segment_id: 'seg_wf06',
      country_code: 'AE',
      country_flag_emoji: '🇦🇪',
      property_type: 'apartment',
      bedroom_range: '2',
      comparable_listings_count: 8,
    },
    recommendation: {
      price_low: 1_000_000,
      price_point: 1_050_000,
      price_high: 1_100_000,
      currency: 'AED',
    },
    benchmark_delta: {
      benchmark_price_point: 1_000_000,
      benchmark_currency: 'AED',
      delta_pct: 5,
      delta_direction: 'above',
      delta_tier: 'low',
      benchmark_computed_at: new Date().toISOString(),
      stale: false,
    },
    sources: { comparable_count: 2, evidence_file_count: 0 },
    tenure_risk: { tier: 'low', score: 0.1 },
    composite_risk_tier: 'low',
    status: 'pending_review',
    is_own: false,
    step_up_required: false,
    two_person_required: false,
    parameters: {
      segment_definition: 'Dubai Marina 2BR',
      time_window: 'Q3 2026',
      analysis_basis: 'transactions',
      recommendation_type: 'point',
    },
    analysis: { format: 'markdown', body: 'Solid comps support 1.05M.' },
    cited_comparables: [],
    evidence_files: [],
    audit_trail: [{ action: 'submitted', at: new Date().toISOString(), actor: { name: 'Sara' } }],
    env: 'live' as const,
    ...overrides,
  }
}

describe('WF-05/06 cross-loop — Phase A screens are routed and importable', () => {
  it('submitters / outcomes / PA queues resolve (no invented screens)', async () => {
    const submitters = await import('@/pages/agent/reports/BadComparableReportPage')
    const priceSubmit = await import('@/pages/agent/reports/PriceReportPage')
    const outcomes = await import('@/pages/agent/reports')
    const wf05 = await import('@/pages/admin/valuation')
    const wf06q = await import('@/pages/admin/valuation/PriceReportQueuePage')
    const wf06d = await import('@/pages/admin/valuation/PriceReportDetailPage')

    expect(submitters.BadComparableReportPage).toBeTypeOf('function')
    expect(priceSubmit.PriceReportPage).toBeTypeOf('function')
    expect(outcomes.ComparableReportOutcomePage).toBeTypeOf('function')
    expect(outcomes.PriceReportOutcomePage).toBeTypeOf('function')
    expect(outcomes.ImpactPanel).toBeTypeOf('function')
    expect(outcomes.WeightingPanel).toBeTypeOf('function')
    expect(wf05.BadComparableQueuePage).toBeTypeOf('function')
    expect(wf05.BadComparableDetailPage).toBeTypeOf('function')
    expect(wf06q.PriceReportQueuePage).toBeTypeOf('function')
    expect(wf06d.PriceReportDetailPage).toBeTypeOf('function')
  })
})

describe('WF-05 cross-loop — bulk bar NEVER offers confirm-remove', () => {
  it('WF05_BULK_ACTIONS exclude confirm-remove / quarantine / approve', () => {
    expect(WF05_BULK_ACTIONS).toEqual(['reject', 'request_info'])
    expect(WF05_BULK_ACTIONS as readonly string[]).not.toContain('confirm-remove')
    expect(WF05_BULK_ACTIONS as readonly string[]).not.toContain('confirm-quarantine')
    expect(WF05_BULK_ACTIONS as readonly string[]).not.toContain('approve')
  })

  it('PAQueueBulkBar with WF-05 actions hides Approve / Confirm and remove', () => {
    render(
      <PAQueueBulkBar
        selectedCount={3}
        actions={[...WF05_BULK_ACTIONS]}
        rejectLabel="Reject as invalid"
        requestInfoLabel="Request more info"
      />,
    )
    const bar = document.querySelector('[data-pa-queue-bulk-actions="reject,request_info"]')
    expect(bar).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Approve/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /Confirm and remove/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /Confirm and quarantine/i })).toBeNull()
    expect(screen.getByRole('button', { name: /Reject as invalid/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Request more info/i })).toBeTruthy()
  })

  it('queue page bulk bar uses reject,request_info data attribute only', async () => {
    listComparableMock.mockResolvedValue({
      reports: [queueRow()],
      pagination: { page: 1, page_size: 25, total: 1, has_next: false },
      counts: {
        pending: 1,
        pending_at_risk: 0,
        high_impact_awaiting_two_person: 1,
        confirmed_removed_this_week: 0,
        rejected_this_week: 0,
      },
    })

    render(
      <ToastProvider>
        <MemoryRouter initialEntries={['/admin/valuation/comparable-reports']}>
          <Routes>
            <Route path="/admin/valuation/comparable-reports" element={<BadComparableQueuePage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>,
    )

    await screen.findByText('Villa · Saadiyat')
    const checkbox = screen.getByLabelText(/Select row cmr_wf05/i)
    fireEvent.click(checkbox)

    const bar = document.querySelector('[data-pa-queue-bulk-actions]') as HTMLElement
    expect(bar).toBeTruthy()
    expect(bar.getAttribute('data-pa-queue-bulk-actions')).toBe('reject,request_info')
    expect(within(bar).queryByRole('button', { name: /confirm and remove/i })).toBeNull()
    expect(within(bar).queryByRole('button', { name: /^Approve/i })).toBeNull()
  })
})

describe('WF-05 cross-loop — confirm-remove → ImpactPanel outcome', () => {
  beforeEach(() => {
    cleanup()
    confirmRemoveMock.mockReset()
    getComparableMock.mockReset()
    comparableOutcome.loading = false
    comparableOutcome.notFound = false
    comparableOutcome.error = null
    comparableOutcome.report = null
  })

  afterEach(() => cleanup())

  it('detail surfaces two-person banner + confirm-remove for high impact', async () => {
    getComparableMock.mockResolvedValue(detailPayload())

    render(
      <ToastProvider>
        <MemoryRouter initialEntries={['/admin/valuation/comparable-reports/cmr_wf05']}>
          <Routes>
            <Route
              path="/admin/valuation/comparable-reports/:reportId"
              element={<BadComparableDetailPage />}
            />
          </Routes>
        </MemoryRouter>
      </ToastProvider>,
    )

    await screen.findByText(/Villa · Saadiyat/i)
    expect(document.querySelector('[data-two-person-banner]')).toBeTruthy()
    expect(document.querySelector('[data-decision="confirm-remove"]')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Confirm and remove/i })).toBeTruthy()
  })

  it('agent outcome shows ImpactPanel after confirmed_removed', () => {
    comparableOutcome.report = {
      id: 'cmr_wf05',
      status: 'confirmed_removed',
      comparable_id: 'cmp_1',
      submitted_at: '2026-09-01T10:00:00Z',
      decided_at: '2026-09-03T09:00:00Z',
      data: {
        decision: {
          action: 'confirm_remove',
          notes: 'Sold on portal',
          market_impact: { valuations_affected: 4 },
        },
        comparable: {
          address_label: 'Saadiyat Island',
          market_label: 'Abu Dhabi',
          source_label: 'Bayut',
        },
      },
    }

    render(
      <MemoryRouter initialEntries={['/reports/comparables/cmr_wf05/outcome']}>
        <Routes>
          <Route
            path="/reports/comparables/:reportId/outcome"
            element={<ComparableReportOutcomePage />}
          />
        </Routes>
      </MemoryRouter>,
    )

    const panel = screen.getByTestId('impact-panel')
    expect(panel).toBeTruthy()
    expect(panel.getAttribute('data-impact-mode')).toBe('removed')
    expect(screen.getByText(/of your listings had valuation recomputed/i)).toBeTruthy()
  })

  it('ImpactPanel is the WF-05 outcome visual for valuation impact', () => {
    render(
      <MemoryRouter>
        <ImpactPanel count={12} mode="removed" />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('impact-panel')).toBeTruthy()
    expect(screen.getByLabelText('12 listings')).toBeTruthy()
  })
})

describe('WF-06 cross-loop — incorporate=true → WeightingPanel with PA weight', () => {
  beforeEach(() => {
    cleanup()
    getPriceReportMock.mockReset()
    reviewPriceMock.mockReset()
    priceOutcome.loading = false
    priceOutcome.notFound = false
    priceOutcome.error = null
    priceOutcome.report = null
  })

  afterEach(() => cleanup())

  it('detail incorporate posts verified + incorporate:true with PA weight', async () => {
    const user = userEvent.setup()
    getPriceReportMock.mockResolvedValue(priceDetail())
    reviewPriceMock.mockResolvedValue({
      success: true,
      status: 'incorporated',
      incorporated: true,
      benchmark_refresh_queued: true,
    })

    render(
      <ToastProvider>
        <MemoryRouter initialEntries={['/admin/valuation/price-reports/aprt_wf06']}>
          <Routes>
            <Route
              path="/admin/valuation/price-reports/:reportId"
              element={<PriceReportDetailPage />}
            />
          </Routes>
        </MemoryRouter>
      </ToastProvider>,
    )

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Incorporate into benchmark/i })).toBeTruthy(),
    )
    await user.click(screen.getByRole('button', { name: /Incorporate into benchmark/i }))

    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /^Incorporate$/i }))

    await waitFor(() => {
      expect(reviewPriceMock).toHaveBeenCalledWith(
        'aprt_wf06',
        expect.objectContaining({
          status: 'verified',
          incorporate: true,
          weight: 100,
        }),
      )
    })
  })

  it('agent outcome shows WeightingPanel at PA weight 100 after incorporate', () => {
    priceOutcome.report = {
      id: 'aprt_wf06',
      status: 'incorporated',
      incorporated: true,
      incorporated_at: '2026-09-08T12:00:00Z',
      reviewed_at: '2026-09-08T12:00:00Z',
      segment_label: 'Dubai Marina · 2BR apartments',
      external_property_title: 'Marina Gate sold',
      data: { weight: 100 },
    }

    render(
      <MemoryRouter initialEntries={['/reports/prices/aprt_wf06/outcome']}>
        <Routes>
          <Route path="/reports/prices/:reportId/outcome" element={<PriceReportOutcomePage />} />
        </Routes>
      </MemoryRouter>,
    )

    const panel = screen.getByTestId('weighting-panel')
    expect(panel).toBeTruthy()
    expect(panel.getAttribute('data-weight-mode')).toBe('incorporated')
    expect(panel.getAttribute('data-weight')).toBe('100')
    expect(screen.getByRole('meter', { name: /Signal weight applied by Platform Administrator/i }))
      .toBeTruthy()
    expect(screen.getByText(/authoritative/i)).toBeTruthy()
  })

  it('WeightingPanel meter exposes PA-assigned weight', () => {
    render(
      <WeightingPanel
        weight={75}
        mode="signal_only"
        marketSegmentLabel="Dubai Marina · 2BR apartments"
      />,
    )
    const meter = screen.getByRole('meter')
    expect(meter.getAttribute('aria-valuenow')).toBe('75')
    expect(screen.getByTestId('weighting-panel').getAttribute('data-weight')).toBe('75')
  })
})
