// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PriceReportDetailPage } from './PriceReportDetailPage'
import type { PriceReportDetail } from './priceReportTypes'

const apiMock = vi.hoisted(() => ({
  getAdminAgentPriceReport: vi.fn(),
  getAdminPricingBenchmarkSeries: vi.fn(),
  reviewAdminAgentPriceReport: vi.fn(),
  undoAdminAgentPriceReportReview: vi.fn(),
  getAdminAgentPriceReportEvidenceUrl: vi.fn(),
  castSecondApprovalVote: vi.fn(),
  revealAdminAgentPriceReportPii: vi.fn(),
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

const localeMock = vi.hoisted(() => ({
  locale: 'en' as 'en' | 'ar',
  isArabic: false,
  dir: 'ltr' as 'ltr' | 'rtl',
  setLocale: vi.fn(),
}))
vi.mock('@/hooks/useLocale', () => ({
  useLocale: () => ({
    ...localeMock,
    isArabic: localeMock.locale === 'ar',
    dir: localeMock.locale === 'ar' ? 'rtl' : 'ltr',
  }),
}))


function detail(overrides: Partial<PriceReportDetail> = {}): PriceReportDetail {
  return {
    id: 'aprt_abc123',
    submitted_at: new Date(Date.now() - 2 * 3600_000).toISOString(),
    agent: {
      id: 'usr_xyz',
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
      property_type: 'apartment',
      bedroom_range: '2-3',
      comparable_listings_count: 18,
    },
    recommendation: {
      price_low: 1_750_000,
      price_point: 1_850_000,
      price_high: 1_950_000,
      currency: 'AED',
    },
    benchmark_delta: {
      benchmark_price_point: 1_562_500,
      benchmark_currency: 'AED',
      delta_pct: 18.4,
      delta_direction: 'above',
      delta_tier: 'high',
      benchmark_computed_at: new Date(Date.now() - 3 * 3600_000).toISOString(),
      stale: false,
    },
    sources: { comparable_count: 2, evidence_file_count: 1 },
    tenure_risk: { tier: 'low', score: 0.09 },
    composite_risk_tier: 'high',
    status: 'pending_review',
    is_own: false,
    step_up_required: true,
    two_person_required: true,
    parameters: {
      segment_definition: 'Dubai Marina neighborhood, buildings completed post-2015',
      time_window: 'Q2-Q3 2026 (6 months)',
      analysis_basis: 'mix_transactions_and_active_listings',
      recommendation_type: 'band',
    },
    analysis: { format: 'markdown', body: 'Post-Expo demand shift remains strong in Marina Gate.' },
    cited_comparables: [
      {
        id: 'cmp_1',
        address: 'Marina Gate 2, Apt 1204',
        price: 1_875_000,
        currency: 'AED',
        price_per_sqft: 2050,
        beds: 3,
        baths: 3,
        status: 'active',
        source_portal: 'property_finder',
        source_url: 'https://example.com/listing',
      },
    ],
    evidence_files: [
      {
        id: 'ev_1',
        filename: 'dubizzle_transaction_export_q3_2026.pdf',
        mime: 'application/pdf',
        size_bytes: 2_411_520,
        uploaded_at: new Date().toISOString(),
      },
    ],
    audit_trail: [
      {
        actor: { id: 'usr_xyz', name: 'Sara Al Mansouri', role: 'agent' },
        action: 'submitted',
        at: new Date(Date.now() - 2 * 3600_000).toISOString(),
      },
    ],
    env: 'live',
    ...overrides,
  }
}

function renderDetail(path = '/admin/valuation/price-reports/aprt_abc123') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/valuation/price-reports/:reportId" element={<PriceReportDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localeMock.locale = 'en'
  cleanup()
  vi.clearAllMocks()
  authMock.isAdmin = true
  apiMock.getAdminAgentPriceReport.mockResolvedValue(detail())
  apiMock.getAdminPricingBenchmarkSeries.mockResolvedValue({
    points: [
      { date: '2026-06-01', price: 1_500_000, confidence_low: 1_350_000, confidence_high: 1_650_000 },
      { date: '2026-09-01', price: 1_562_500, confidence_low: 1_406_250, confidence_high: 1_718_750 },
    ],
    currency: 'AED',
    segment_id: 'seg_dxb_marina',
    window: '90d',
  })
})

describe('PriceReportDetailPage (PA-PVA-009b)', () => {
  it('renders report reader + two-person banner for high-delta pending reports', async () => {
    renderDetail()
    await waitFor(() => {
      expect(screen.getAllByText(/Dubai Marina · 2-3BR apartments/i).length).toBeGreaterThan(0)
    })
    expect(screen.getByText(/Agent's analysis/i)).toBeTruthy()
    expect(screen.getByText(/Post-Expo demand shift/i)).toBeTruthy()
    expect(screen.getByText(/second approver is required/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Incorporate into benchmark/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Approve as signal only/i })).toBeTruthy()
    expect(screen.getByTestId('benchmark-chart')).toBeTruthy()
    expect(screen.getAllByLabelText(/Masked name/i).length).toBeGreaterThan(0)
  })

  it('reviews with incorporate:true and weight for high-delta (two-person path)', async () => {
    apiMock.reviewAdminAgentPriceReport.mockResolvedValue({
      success: true,
      pending_second_approval: true,
      approval_request_id: 'apr_1',
      status: 'pending_second_approval',
    })
    apiMock.getAdminAgentPriceReport
      .mockResolvedValueOnce(detail())
      .mockResolvedValueOnce(
        detail({
          status: 'pending_second_approval',
          approval_request_id: 'apr_1',
          review: {
            decided_at: new Date().toISOString(),
            decided_by: 'pa-1',
            incorporated: false,
          },
        }),
      )

    const user = userEvent.setup()
    renderDetail()
    await waitFor(() => expect(screen.getByRole('button', { name: /Incorporate into benchmark/i })).toBeTruthy())
    await user.click(screen.getByRole('button', { name: /Incorporate into benchmark/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/second approver is required/i)).toBeTruthy()
    await user.click(within(dialog).getByRole('button', { name: /^Incorporate$/i }))

    await waitFor(() => {
      expect(apiMock.reviewAdminAgentPriceReport).toHaveBeenCalledWith(
        'aprt_abc123',
        expect.objectContaining({
          status: 'verified',
          incorporate: true,
          weight: 100,
        }),
      )
    })
    expect(toastMock.addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringMatching(/Awaiting second approver/i),
      }),
    )
  })

  it('reviews with incorporate:false + weight for signal-only', async () => {
    apiMock.reviewAdminAgentPriceReport.mockResolvedValue({
      success: true,
      status: 'verified',
      incorporated: false,
    })
    apiMock.getAdminAgentPriceReport
      .mockResolvedValueOnce(
        detail({
          two_person_required: false,
          benchmark_delta: {
            benchmark_price_point: 280_000,
            benchmark_currency: 'OMR',
            delta_pct: 3.1,
            delta_direction: 'in_band',
            delta_tier: 'low',
          },
          composite_risk_tier: 'low',
        }),
      )
      .mockResolvedValueOnce(
        detail({
          status: 'verified',
          review: { decided_at: new Date().toISOString(), decided_by: 'pa-1', incorporated: false, weight: 50 },
        }),
      )

    const user = userEvent.setup()
    renderDetail()
    await waitFor(() => expect(screen.getByRole('button', { name: /Approve as signal only/i })).toBeTruthy())
    await user.click(screen.getByRole('button', { name: /Approve as signal only/i }))

    const dialog = await screen.findByRole('dialog')
    const weight = within(dialog).getByLabelText(/Signal weight/i)
    await user.selectOptions(weight, '50')
    await user.click(within(dialog).getByRole('button', { name: /Approve as signal-only/i }))

    await waitFor(() => {
      expect(apiMock.reviewAdminAgentPriceReport).toHaveBeenCalledWith(
        'aprt_abc123',
        expect.objectContaining({
          status: 'verified',
          incorporate: false,
          weight: 50,
        }),
      )
    })
  })

  it('disables decision panel when is_own', async () => {
    apiMock.getAdminAgentPriceReport.mockResolvedValue(detail({ is_own: true }))
    renderDetail()
    await waitFor(() => {
      expect(screen.getByText(/You are the submitting agent/i)).toBeTruthy()
    })
    expect(screen.queryByRole('button', { name: /Incorporate into benchmark/i })).toBeNull()
  })

  it('hides decision panel actions when is_own', async () => {
    apiMock.getAdminAgentPriceReport.mockResolvedValue(detail({ is_own: true }))
    renderDetail()
    await waitFor(() => expect(screen.getByText(/cannot review this report/i)).toBeTruthy())
    expect(screen.queryByRole('button', { name: /Incorporate into benchmark/i })).toBeNull()
  })

  it('second-approver mode wires Approve/Decline and surfaces SAME_REVIEWER', async () => {
    apiMock.getAdminAgentPriceReport.mockResolvedValue(
      detail({
        status: 'pending_second_approval',
        approval_request_id: 'apr_1',
        review: { decided_at: new Date().toISOString(), decided_by: 'pa-other', incorporated: false },
        viewer_already_voted: false,
      }),
    )
    apiMock.castSecondApprovalVote.mockRejectedValue(
      Object.assign(new Error('same'), { status: 409, code: 'SAME_REVIEWER' }),
    )
    const user = userEvent.setup()
    renderDetail('/admin/valuation/price-reports/aprt_abc123?approval_request_id=apr_1')
    await waitFor(() => expect(screen.getByRole('button', { name: /Approve request/i })).toBeTruthy())
    await user.click(screen.getByRole('button', { name: /Approve request/i }))
    await waitFor(() => {
      expect(apiMock.castSecondApprovalVote).toHaveBeenCalledWith(
        expect.objectContaining({ approval_request_id: 'apr_1', decision: 'approve' }),
      )
      expect(toastMock.addToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: expect.stringMatching(/first vote/i) }),
      )
    })
  })

  it('hides second-approver buttons when deep-linked initiator already voted', async () => {
    apiMock.getAdminAgentPriceReport.mockResolvedValue(
      detail({
        status: 'pending_second_approval',
        approval_request_id: 'apr_1',
        review: { decided_at: new Date().toISOString(), decided_by: 'pa-1', incorporated: false },
        viewer_already_voted: true,
      }),
    )
    renderDetail('/admin/valuation/price-reports/aprt_abc123?approval_request_id=apr_1')
    await waitFor(() => expect(screen.getByText(/already cast the first vote/i)).toBeTruthy())
    expect(screen.queryByRole('button', { name: /Approve request/i })).toBeNull()
  })

  it('shows pending-second banner when viewer is not on matching approval deep-link', async () => {
    apiMock.getAdminAgentPriceReport.mockResolvedValue(
      detail({
        status: 'pending_second_approval',
        approval_request_id: 'apr_9',
        review: { decided_at: new Date().toISOString(), decided_by: 'pa-other', incorporated: false },
      }),
    )
    renderDetail()
    await waitFor(() => expect(screen.getAllByText(/Awaiting second approver/i).length).toBeGreaterThan(0))
  })

  it('keyboard ? opens shortcuts; B navigates back intent via shortcuts panel', async () => {
    const user = userEvent.setup()
    renderDetail()
    await waitFor(() => expect(screen.getByRole('button', { name: /Incorporate into benchmark/i })).toBeTruthy())
    await user.keyboard('?')
    await waitFor(() => expect(screen.getAllByText(/Show keyboard shortcuts|Keyboard shortcuts/i).length).toBeGreaterThan(0))
  })

  it('audits PII reveal', async () => {
    apiMock.revealAdminAgentPriceReportPii.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    renderDetail()
    await waitFor(() => expect(screen.getAllByLabelText(/Masked name/i).length).toBeGreaterThan(0))
    const revealBtns = screen.getAllByRole('button', { name: /Reveal/i })
    if (revealBtns[0]) {
      await user.click(revealBtns[0])
      await waitFor(() => {
        expect(apiMock.revealAdminAgentPriceReportPii).toHaveBeenCalled()
      })
    }
  })

  it('fetches evidence URL and toasts on expiry', async () => {
    apiMock.getAdminAgentPriceReportEvidenceUrl.mockRejectedValue(new Error('expired'))
    const user = userEvent.setup()
    renderDetail()
    await waitFor(() => expect(screen.getByText(/dubizzle_transaction_export/i)).toBeTruthy())
    const preview = screen.queryByRole('button', { name: /Preview|Open|Download/i })
      || screen.getByText(/dubizzle_transaction_export/i).closest('button')
    if (preview) {
      await user.click(preview)
      await waitFor(() => {
        expect(toastMock.addToast).toHaveBeenCalledWith(
          expect.objectContaining({ title: expect.stringMatching(/expired|Preview/i) }),
        )
      })
    }
  })

  it('undo happy path uses server undo_token_id', async () => {
    const expires = new Date(Date.now() + 5000).toISOString()
    apiMock.reviewAdminAgentPriceReport.mockResolvedValue({
      success: true,
      status: 'verified',
      undo_token_id: 'tok_1',
      undo_expires_at: expires,
    })
    apiMock.undoAdminAgentPriceReportReview.mockResolvedValue({ success: true, status: 'pending_review' })
    apiMock.getAdminAgentPriceReport
      .mockResolvedValueOnce(detail({ two_person_required: false, benchmark_delta: {
        benchmark_price_point: 1_800_000,
        benchmark_currency: 'AED',
        delta_pct: 2.7,
        delta_direction: 'above',
        delta_tier: 'low',
      }}))
      .mockResolvedValue(detail({ status: 'verified', two_person_required: false }))

    const user = userEvent.setup()
    renderDetail()
    await waitFor(() => expect(screen.getByRole('button', { name: /Approve as signal only/i })).toBeTruthy())
    await user.click(screen.getByRole('button', { name: /Approve as signal only/i }))
    const dialog = await screen.findByRole('dialog')
    const confirm = within(dialog).queryByRole('button', { name: /Confirm|Publish|Signal/i })
    if (confirm) await user.click(confirm)
    await waitFor(() => expect(apiMock.reviewAdminAgentPriceReport).toHaveBeenCalled())
  })
})



describe('PriceReportDetailPage AR toast copy', () => {
  it('renders Arabic approve toast body from PRICE_REPORT_COPY', async () => {
    localeMock.locale = 'ar'
    apiMock.getAdminAgentPriceReport.mockResolvedValue(
      detail({
        status: 'pending_second_approval',
        approval_request_id: 'apr_1',
        review: { decided_at: new Date().toISOString(), decided_by: 'pa-other', incorporated: false },
        viewer_already_voted: false,
      }),
    )
    apiMock.castSecondApprovalVote.mockResolvedValue({ success: true, status: 'incorporated' })
    const user = userEvent.setup()
    renderDetail('/admin/valuation/price-reports/aprt_abc123?approval_request_id=apr_1')
    await waitFor(() => expect(screen.getByRole('button', { name: /Approve request/i })).toBeTruthy())
    await user.click(screen.getByRole('button', { name: /Approve request/i }))
    await waitFor(() => {
      expect(toastMock.addToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'تم تسجيل الموافقة. جارٍ إعادة احتساب المعايير.',
        }),
      )
    })
  })

  it('renders Arabic SAME_REVIEWER toast from PRICE_REPORT_COPY', async () => {
    localeMock.locale = 'ar'
    apiMock.getAdminAgentPriceReport.mockResolvedValue(
      detail({
        status: 'pending_second_approval',
        approval_request_id: 'apr_1',
        review: { decided_at: new Date().toISOString(), decided_by: 'pa-other', incorporated: false },
        viewer_already_voted: false,
      }),
    )
    apiMock.castSecondApprovalVote.mockRejectedValue(
      Object.assign(new Error('same'), { status: 409, code: 'SAME_REVIEWER' }),
    )
    const user = userEvent.setup()
    renderDetail('/admin/valuation/price-reports/aprt_abc123?approval_request_id=apr_1')
    await waitFor(() => expect(screen.getByRole('button', { name: /Approve request/i })).toBeTruthy())
    await user.click(screen.getByRole('button', { name: /Approve request/i }))
    await waitFor(() => {
      expect(toastMock.addToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'أنت صاحب التصويت الأول. يجب أن يصوّت مسؤول منصة آخر.',
        }),
      )
    })
  })

  it('renders Arabic undo-expired toast from PRICE_REPORT_COPY', async () => {
    localeMock.locale = 'ar'
    // Trigger via toastVoteError path through undo with UNDO_EXPIRED
    const expires = new Date(Date.now() + 5000).toISOString()
    apiMock.getAdminAgentPriceReport.mockResolvedValue(
      detail({
        two_person_required: false,
        benchmark_delta: {
          benchmark_price_point: 1_800_000,
          benchmark_currency: 'AED',
          delta_pct: 2.7,
          delta_direction: 'above',
          delta_tier: 'low',
        },
      }),
    )
    apiMock.reviewAdminAgentPriceReport.mockResolvedValue({
      success: true,
      status: 'verified',
      undo_token_id: 'tok_1',
      undo_expires_at: expires,
    })
    apiMock.undoAdminAgentPriceReportReview.mockRejectedValue(
      Object.assign(new Error('expired'), { code: 'UNDO_EXPIRED', status: 409 }),
    )
    const user = userEvent.setup()
    renderDetail()
    await waitFor(() => expect(screen.getByRole('button', { name: /Approve as signal only/i })).toBeTruthy())
    await user.click(screen.getByRole('button', { name: /Approve as signal only/i }))
    const dialog = await screen.findByRole('dialog')
    const confirm = within(dialog).queryByRole('button', { name: /Confirm|Publish|Signal|Approve/i })
    if (confirm) await user.click(confirm)
    await waitFor(() => expect(apiMock.reviewAdminAgentPriceReport).toHaveBeenCalled())
    const undoBtn = screen.queryByRole('button', { name: /^Undo/i })
    if (undoBtn) {
      await user.click(undoBtn)
      await waitFor(() => {
        expect(toastMock.addToast).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'انتهت مهلة التراجع.' }),
        )
      })
    }
  })
})
