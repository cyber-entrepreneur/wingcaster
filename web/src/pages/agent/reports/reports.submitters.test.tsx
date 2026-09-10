// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const apiMock = vi.hoisted(() => ({
  reportComparable: vi.fn(),
  getTenantSubscription: vi.fn(),
  submitAgentPriceReport: vi.fn(),
}))
vi.mock('@/api/client', () => ({ api: apiMock }))

vi.mock('@/lib/usePageTitle', () => ({
  usePageTitle: () => {},
}))

const toastMock = vi.hoisted(() => ({ addToast: vi.fn() }))
vi.mock('@/components/ui/toast', () => ({
  useToast: () => toastMock,
}))

import { BadComparableReportPage } from './BadComparableReportPage'
import { PriceReportPage } from './PriceReportPage'
import { PRICE_REPORTS_SUBMIT_FEATURE } from './constants'
import { flagsFromSubscription, hasPriceReportsSubmitFeature } from './types'

function renderBadComparable(initial = '/reports/comparables/new?comparable_id=cmp_1&title=Apt%202405') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/reports/comparables/new" element={<BadComparableReportPage />} />
        <Route path="/comparables/:comparableId/report" element={<BadComparableReportPage />} />
        <Route path="/agent/pricing" element={<div>Pricing hub</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function renderPriceReport(
  flags: Record<string, boolean> | null,
  initial = '/reports/prices/new',
) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route
          path="/reports/prices/new"
          element={<PriceReportPage featureFlagsOverride={flags} />}
        />
        <Route path="/plans" element={<div>Plans</div>} />
        <Route path="/agent/pricing" element={<div>Pricing hub</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  apiMock.reportComparable.mockResolvedValue({ id: 'rpt_1', status: 'pending' })
  apiMock.submitAgentPriceReport.mockResolvedValue({ id: 'aprt_1', status: 'pending_review' })
  apiMock.getTenantSubscription.mockResolvedValue({
    subscription: { tier: 'pro', package_code: 'pro-agent', properties_committed: 1 },
    tenant_id: 't1',
  })
})

describe('flagsFromSubscription', () => {
  it('prefers explicit package_feature_flags', () => {
    const flags = flagsFromSubscription({
      tier: 'free',
      package_feature_flags: { [PRICE_REPORTS_SUBMIT_FEATURE]: true },
    })
    expect(hasPriceReportsSubmitFeature(flags)).toBe(true)
  })

  it('treats Pro tier as carrying the submit feature', () => {
    expect(
      hasPriceReportsSubmitFeature(flagsFromSubscription({ tier: 'pro', package_code: 'pro-agent' })),
    ).toBe(true)
    expect(
      hasPriceReportsSubmitFeature(flagsFromSubscription({ tier: 'free', package_code: 'free-agent' })),
    ).toBe(false)
  })
})

describe('BadComparableReportPage', () => {
  it('submits a happy-path report via POST /pricing/report-comparable', async () => {
    const user = userEvent.setup()
    renderBadComparable()

    expect(await screen.findByRole('heading', { name: /Report a bad comparable/i })).toBeInTheDocument()
    expect(screen.getByText(/Apt 2405/i)).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /Wrong price/i }))
    await user.type(
      screen.getByLabelText(/Tell PA what happened/i),
      'This unit closed lower per the registry. Attached screenshot for PA.',
    )
    await user.click(screen.getByRole('button', { name: /^Submit report$/i }))

    await waitFor(() => expect(apiMock.reportComparable).toHaveBeenCalled())
    expect(apiMock.reportComparable).toHaveBeenCalledWith(
      expect.objectContaining({
        comparable_id: 'cmp_1',
        comparable_type: 'external',
        reason: 'incorrect_price',
      }),
    )
    expect(await screen.findByText(/Report received — under PA review/i)).toBeInTheDocument()
  })

  it('blocks submit and surfaces validation when notes are too short', async () => {
    const user = userEvent.setup()
    renderBadComparable()

    await user.click(await screen.findByRole('radio', { name: /Wrong price/i }))
    await user.type(screen.getByLabelText(/Tell PA what happened/i), 'Too short')

    const submit = screen.getByRole('button', { name: /^Submit report$/i })
    expect(submit).toBeDisabled()
    expect(document.getElementById('bcr-notes-hint')).toHaveTextContent(/Add a bit more detail/i)
    expect(apiMock.reportComparable).not.toHaveBeenCalled()
  })
})

describe('PriceReportPage', () => {
  it('renders Pro upsell when valuation.price_reports.submit is missing', async () => {
    renderPriceReport({ [PRICE_REPORTS_SUBMIT_FEATURE]: false })

    expect(
      await screen.findByRole('heading', { name: /Price reports are a Pro feature/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /See Pro plans/i })).toHaveAttribute(
      'href',
      '/plans?highlight=wf06',
    )
    expect(screen.queryByRole('button', { name: /Submit for PA review/i })).not.toBeInTheDocument()
  })

  it('submits a happy-path price report when the feature flag is enabled', async () => {
    const user = userEvent.setup()
    renderPriceReport({ [PRICE_REPORTS_SUBMIT_FEATURE]: true })

    expect(await screen.findByRole('heading', { name: /Submit a price report/i })).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /External \/ off-platform sale/i }))
    await user.type(screen.getByLabelText(/Property title/i), 'Marina Heights T2')
    await user.type(screen.getByLabelText(/Location/i), 'Dubai Marina')
    await user.type(screen.getByLabelText(/Sold price/i), '2400000')
    await user.type(
      screen.getByLabelText(/Evidence notes/i),
      'Closed at this figure per DLD registry. Four nearby comps bracket the mid-tier band.',
    )
    await user.click(screen.getByRole('button', { name: /Submit for PA review/i }))

    await waitFor(() => expect(apiMock.submitAgentPriceReport).toHaveBeenCalled())
    expect(apiMock.submitAgentPriceReport).toHaveBeenCalledWith(
      expect.objectContaining({
        external_property_title: 'Marina Heights T2',
        sold_price: 2400000,
        currency: 'AED',
      }),
    )
    expect(
      await screen.findByText(/Report received — under PA editorial review/i),
    ).toBeInTheDocument()
  })

  it('shows validation errors when sold price is missing', async () => {
    const user = userEvent.setup()
    renderPriceReport({ [PRICE_REPORTS_SUBMIT_FEATURE]: true })

    await screen.findByRole('heading', { name: /Submit a price report/i })
    await user.click(screen.getByRole('radio', { name: /External \/ off-platform sale/i }))
    await user.type(screen.getByLabelText(/Property title/i), 'Villa 8')
    await user.type(
      screen.getByLabelText(/Evidence notes/i),
      'Enough notes for the soft floor so we can assert the sold-price validation path.',
    )

    const submit = screen.getByRole('button', { name: /Submit for PA review/i })
    expect(submit).toBeDisabled()
    expect(apiMock.submitAgentPriceReport).not.toHaveBeenCalled()
  })
})
