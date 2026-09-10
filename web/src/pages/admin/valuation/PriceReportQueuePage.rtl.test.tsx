// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { PriceReportQueuePage } from './PriceReportQueuePage'
import type { PriceReportListItem, PriceReportListResponse } from './priceReportTypes'

const apiMock = vi.hoisted(() => ({
  getAdminAgentPriceReports: vi.fn(),
  reviewAdminAgentPriceReport: vi.fn(),
  bulkReviewAdminAgentPriceReports: vi.fn(),
  undoAdminAgentPriceReportReview: vi.fn(),
  exportAdminAgentPriceReportsCsv: vi.fn(),
}))

vi.mock('@/api/client', () => ({ api: apiMock }))

const authMock = vi.hoisted(() => ({
  agent: { id: 'pa-1', name: 'Priya Sharma', platform_role: 'platform_admin' },
  isAdmin: true,
}))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authMock,
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}))

const toastMock = vi.hoisted(() => ({ addToast: vi.fn() }))
vi.mock('@/components/ui/toast', () => ({
  useToast: () => toastMock,
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}))

function report(overrides: Partial<PriceReportListItem> = {}): PriceReportListItem {
  return {
    id: 'aprt_1',
    submitted_at: new Date(Date.now() - 2 * 3600_000).toISOString(),
    agent: {
      id: 'usr_1',
      display_name: 'Sara Al Mansouri',
      tier: 'pro_elite',
      tenure_days: 1888,
    },
    agency: { id: 'agy_1', name: 'Elite Real Estate Dubai' },
    subject: {
      segment_label: 'Dubai Marina · 2-3BR apartments',
      segment_id: 'seg_dxb_marina',
      country_code: 'AE',
      country_flag_emoji: '🇦🇪',
      comparable_listings_count: 18,
    },
    recommendation: { price_point: 1_850_000, currency: 'AED' },
    benchmark_delta: {
      benchmark_price_point: 1_562_500,
      benchmark_currency: 'AED',
      delta_pct: 18.4,
      delta_direction: 'above',
      delta_tier: 'high',
      stale: false,
    },
    sources: { comparable_count: 12, evidence_file_count: 5 },
    tenure_risk: { tier: 'low', score: 0.09 },
    composite_risk_tier: 'high',
    status: 'pending_review',
    is_own: false,
    step_up_required: true,
    two_person_required: true,
    env: 'live',
    ...overrides,
  }
}

function listPayload(reports: PriceReportListItem[]): PriceReportListResponse {
  return {
    reports,
    pagination: { page: 1, page_size: 25, total: reports.length, has_next: false },
    counts: {
      pending: reports.filter((r) => r.status === 'pending_review').length,
      pending_high_delta: reports.filter((r) => Math.abs(r.benchmark_delta?.delta_pct || 0) >= 10).length,
      incorporated_this_month: 12,
      signal_only_this_month: 21,
      rejected_this_month: 4,
    },
  }
}

function renderQueue(initial = '/admin/valuation/price-reports?status=pending_review') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <div className="lg:block" style={{ width: 1440 }}>
        <PriceReportQueuePage />
      </div>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  authMock.isAdmin = true
  // Force desktop layout: matchMedia for lg breakpoint isn't available; page uses
  // Tailwind `lg:block` / `lg:hidden`. Tests assert via getByRole against the
  // always-present DOM (desktop block is `hidden lg:block` — still in DOM).
  apiMock.getAdminAgentPriceReports.mockResolvedValue(
    listPayload([
      report(),
      report({
        id: 'aprt_low',
        agent: { id: 'usr_2', display_name: 'Fatima Suleiman', tier: 'pro', tenure_days: 800 },
        subject: {
          segment_label: 'Muscat Hills · Townhouses',
          segment_id: 'seg_muscat',
          country_code: 'OM',
          comparable_listings_count: 4,
        },
        recommendation: { price_point: 285_000, currency: 'OMR' },
        benchmark_delta: {
          benchmark_price_point: 276_000,
          benchmark_currency: 'OMR',
          delta_pct: 3.1,
          delta_direction: 'in_band',
          delta_tier: 'low',
        },
        sources: { comparable_count: 5, evidence_file_count: 2 },
        tenure_risk: { tier: 'low' },
        composite_risk_tier: 'low',
        two_person_required: false,
        step_up_required: false,
      }),
    ]),
  )
  apiMock.reviewAdminAgentPriceReport.mockResolvedValue({
    success: true,
    status: 'incorporated',
    incorporated: true,
  })
  apiMock.bulkReviewAdminAgentPriceReports.mockResolvedValue({
    success: true,
    results: [{ id: 'aprt_low', ok: true }],
  })
})

describe('PriceReportQueuePage (PA-PVA-009)', () => {
  it('loads pending reports with PII-masked agent names and delta chips', async () => {
    renderQueue()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Agent-price-report review/i })).toBeTruthy()
    })
    expect(apiMock.getAdminAgentPriceReports).toHaveBeenCalled()
    expect(screen.getAllByLabelText(/Masked name/i).length).toBeGreaterThan(0)
    expect(screen.getByLabelText(/Above benchmark by 18.4 percent/i)).toBeTruthy()
    expect(screen.getAllByText(/Dubai Marina/i).length).toBeGreaterThan(0)
  })

  it('does not expose a bulk Incorporate action; bulk bar offers Signal only / Reject / Request info', async () => {
    const user = userEvent.setup()
    renderQueue()
    await waitFor(() => expect(screen.getByLabelText(/Select all visible rows/i)).toBeTruthy())

    await user.click(screen.getByLabelText(/Select all visible rows/i))

    const bulk = await screen.findByTestId('price-report-bulk-bar')
    expect(within(bulk).getByRole('button', { name: /Signal only/i })).toBeTruthy()
    expect(within(bulk).getByRole('button', { name: /Reject/i })).toBeTruthy()
    expect(within(bulk).getByRole('button', { name: /Request info/i })).toBeTruthy()
    expect(within(bulk).queryByRole('button', { name: /^Incorporate/i })).toBeNull()
    expect(
      within(bulk).getByRole('button', { name: /Why can't I bulk-incorporate/i }),
    ).toBeTruthy()
  })

  it('wires bulk signal-only review without incorporate:true', async () => {
    const user = userEvent.setup()
    renderQueue()
    await waitFor(() => expect(screen.getByLabelText(/Select all visible rows/i)).toBeTruthy())
    await user.click(screen.getByLabelText(/Select all visible rows/i))
    await user.click(within(screen.getByTestId('price-report-bulk-bar')).getByRole('button', { name: /Signal only/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/benchmark will NOT change/i)).toBeTruthy()
    await user.click(within(dialog).getByRole('button', { name: /Publish/i }))

    await waitFor(() => {
      expect(apiMock.bulkReviewAdminAgentPriceReports).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'verified',
          incorporate: false,
          ids: expect.arrayContaining(['aprt_1', 'aprt_low']),
        }),
      )
    })
  })

  it('opens incorporate confirm for a single high-delta row', async () => {
    const user = userEvent.setup()
    renderQueue()
    await waitFor(() => expect(screen.getAllByRole('button', { name: /^Incorporate$/i }).length).toBeGreaterThan(0))
    await user.click(screen.getAllByRole('button', { name: /^Incorporate$/i })[0]!)

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/second approver is required/i)).toBeTruthy()
    expect(within(dialog).getByLabelText(/Signal weight/i)).toBeTruthy()
  })
})
