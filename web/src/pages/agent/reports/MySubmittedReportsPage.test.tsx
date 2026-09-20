// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const apiMocks = vi.hoisted(() => ({
  getMyAgentPriceReports: vi.fn(),
  getMyComparableReports: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  api: apiMocks,
  setAuthToken: vi.fn(),
  getAuthToken: vi.fn(() => 'test-token'),
  API_BASE: '/api',
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ agent: { id: 'agent-1', name: 'Test Agent' }, loading: false }),
}))

vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

import { MySubmittedReportsPage } from '@/pages/agent/reports/MySubmittedReportsPage'

const priceReports = [
  { id: 'pr1', external_property_title: 'Marina 2BR', sold_price: 1850000, currency: 'AED', sold_date: '2026-02-10', status: 'verified', created_at: '2026-02-11T00:00:00Z' },
  { id: 'pr2', external_property_location: 'Downtown', sold_price: 990000, currency: 'AED', status: 'pending', created_at: '2026-02-01T00:00:00Z' },
]

const comparableReports = [
  { id: 'cr1', reason: 'Stale listing price', comparable_type: 'listing', status: 'rejected', decision_reason_code: 'insufficient_evidence', reviewed_at: '2026-02-05T00:00:00Z', created_at: '2026-02-03T00:00:00Z' },
]

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/agent/pricing/reports']}>
      <Routes>
        <Route path="/agent/pricing/reports" element={<MySubmittedReportsPage />} />
        <Route path="/agent/pricing/reports/:id/outcome" element={<div>Price outcome page</div>} />
        <Route path="/agent/comparable-reports/:id" element={<div>Comparable outcome page</div>} />
        <Route path="/agent/pricing/reports/new" element={<div>New report page</div>} />
        <Route path="/agent/pricing" element={<div>Price Health page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  apiMocks.getMyAgentPriceReports.mockReset().mockResolvedValue(priceReports)
  apiMocks.getMyComparableReports.mockReset().mockResolvedValue(comparableReports)
})

afterEach(() => vi.restoreAllMocks())

describe('MySubmittedReportsPage', () => {
  it('renders both tabs with counts and the sold-price rows', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Marina 2BR')).toBeInTheDocument())
    expect(screen.getByRole('tab', { name: /Sold-price/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Comparables/ })).toBeInTheDocument()
    expect(screen.getByText('Verified')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  it('navigates to the price-report outcome when a row is clicked', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Marina 2BR')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Marina 2BR'))
    await waitFor(() => expect(screen.getByText('Price outcome page')).toBeInTheDocument())
  })

  it('shows the comparable rows after switching tabs and links to the comparable outcome', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText('Marina 2BR')).toBeInTheDocument())
    await user.click(screen.getByRole('tab', { name: /Comparables/ }))
    await waitFor(() => expect(screen.getByText('Stale listing price')).toBeInTheDocument())
    await user.click(screen.getByText('Stale listing price'))
    await waitFor(() => expect(screen.getByText('Comparable outcome page')).toBeInTheDocument())
  })

  it('defaults to the comparable tab when there are no sold-price reports', async () => {
    apiMocks.getMyAgentPriceReports.mockResolvedValue([])
    renderPage()
    await waitFor(() => expect(screen.getByText('Stale listing price')).toBeInTheDocument())
  })

  it('shows an empty state when there are no comparable reports', async () => {
    const user = userEvent.setup()
    apiMocks.getMyComparableReports.mockResolvedValue([])
    renderPage()
    await waitFor(() => expect(screen.getByText('Marina 2BR')).toBeInTheDocument())
    await user.click(screen.getByRole('tab', { name: /Comparables/ }))
    await waitFor(() => expect(screen.getByText('No comparable reports yet')).toBeInTheDocument())
  })

  it('shows an error state with retry when loading fails', async () => {
    apiMocks.getMyAgentPriceReports.mockRejectedValueOnce(new Error('nope'))
    renderPage()
    await waitFor(() => expect(screen.getByText("Couldn't load your reports")).toBeInTheDocument())
    expect(screen.getByText('nope')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})
