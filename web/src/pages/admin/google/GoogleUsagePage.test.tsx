// @vitest-environment jsdom
/**
 * PA-GOO-001 — Google Maps usage dashboard.
 *
 * Covers: KPI + breakdown render, over-budget banner, error state, budget-edit
 * validation gating, a successful budget save round-trip, and RTL.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GoogleUsagePage } from './GoogleUsagePage'

const toastMock = vi.hoisted(() => ({ addToast: vi.fn() }))
vi.mock('@/components/ui/toast', () => ({ useToast: () => toastMock }))
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

const apiMock = vi.hoisted(() => ({
  getGoogleUsageSummary: vi.fn(),
  getGoogleBudget: vi.fn(),
  updateGoogleBudget: vi.fn(),
}))
vi.mock('@/api/client', () => ({ api: apiMock }))

const SUMMARY = {
  mtd_spend_usd: 120,
  mtd_requests: 42,
  budget_usd_monthly: 500,
  alert_threshold_pct: 80,
  projected_month_end_usd: 372,
  headroom_usd: 380,
  pct_consumed: 24,
  over_budget: false,
  near_threshold: false,
  by_operation: [{ operation: 'places', requests: 30, cost: 90 }],
  top_consumers: [{ area_id: 'downtown', requests: 30, cost: 90 }],
  daily: [
    { date: '2026-03-01', cost: 10, requests: 4 },
    { date: '2026-03-02', cost: 20, requests: 8 },
  ],
  updated_at: null,
}
const BUDGET = {
  config: { budget_usd_monthly: 500, alert_threshold_pct: 80, updated_by: null, updated_at: null },
  constraints: { max_budget_usd_monthly: 10000000, min_alert_threshold_pct: 1, max_alert_threshold_pct: 100 },
}

beforeEach(() => {
  toastMock.addToast.mockReset()
  apiMock.getGoogleUsageSummary.mockReset()
  apiMock.getGoogleBudget.mockReset()
  apiMock.updateGoogleBudget.mockReset()
  apiMock.getGoogleUsageSummary.mockResolvedValue({ summary: SUMMARY })
  apiMock.getGoogleBudget.mockResolvedValue(BUDGET)
  apiMock.updateGoogleBudget.mockResolvedValue({ config: { ...BUDGET.config, budget_usd_monthly: 800 } })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GoogleUsagePage', () => {
  it('renders KPIs and breakdowns', async () => {
    render(<GoogleUsagePage />)
    expect(await screen.findByTestId('google-usage-page')).toBeTruthy()
    expect(screen.getByTestId('google-usage-ops')).toBeTruthy()
    expect(screen.getByTestId('google-usage-consumers')).toBeTruthy()
    expect(screen.getByText('places')).toBeTruthy()
    expect(screen.getByText('downtown')).toBeTruthy()
    expect(screen.getByTestId('google-usage-daily').children).toHaveLength(2)
  })

  it('shows the over-budget banner', async () => {
    apiMock.getGoogleUsageSummary.mockResolvedValue({
      summary: { ...SUMMARY, over_budget: true, pct_consumed: 130 },
    })
    render(<GoogleUsagePage />)
    expect(await screen.findByTestId('google-usage-over-budget')).toBeTruthy()
  })

  it('shows the near-threshold banner', async () => {
    apiMock.getGoogleUsageSummary.mockResolvedValue({
      summary: { ...SUMMARY, near_threshold: true, pct_consumed: 85 },
    })
    render(<GoogleUsagePage />)
    expect(await screen.findByTestId('google-usage-near-threshold')).toBeTruthy()
  })

  it('renders an error state', async () => {
    apiMock.getGoogleUsageSummary.mockRejectedValueOnce(new Error('boom'))
    render(<GoogleUsagePage />)
    expect(await screen.findByTestId('google-usage-error')).toBeTruthy()
  })

  it('blocks save on an invalid alert threshold', async () => {
    const user = userEvent.setup()
    render(<GoogleUsagePage />)
    await screen.findByTestId('google-usage-page')
    const threshold = screen.getByLabelText('Alert threshold (%)')
    await user.clear(threshold)
    await user.type(threshold, '0')
    expect(screen.getByTestId('google-budget-save')).toBeDisabled()
    expect(apiMock.updateGoogleBudget).not.toHaveBeenCalled()
  })

  it('saves an updated budget', async () => {
    const user = userEvent.setup()
    render(<GoogleUsagePage />)
    await screen.findByTestId('google-usage-page')
    const budgetInput = screen.getByLabelText('Monthly budget (USD)')
    await user.clear(budgetInput)
    await user.type(budgetInput, '800')
    await user.click(screen.getByTestId('google-budget-save'))
    await waitFor(() => expect(apiMock.updateGoogleBudget).toHaveBeenCalledTimes(1))
    expect(apiMock.updateGoogleBudget).toHaveBeenCalledWith({ budget_usd_monthly: 800, alert_threshold_pct: 80 })
    expect(toastMock.addToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Budget updated' }))
  })

  it('renders under RTL', async () => {
    render(
      <div dir="rtl">
        <GoogleUsagePage />
      </div>,
    )
    expect(await screen.findByTestId('google-usage-page')).toBeTruthy()
  })
})
