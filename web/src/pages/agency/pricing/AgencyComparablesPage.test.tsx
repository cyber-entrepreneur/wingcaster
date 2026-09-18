// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AgencyComparablesPage } from './AgencyComparablesPage'

const { addToast, apiMock } = vi.hoisted(() => ({
  addToast: vi.fn(),
  apiMock: {
    getAgencyPricingComparables: vi.fn(),
    reportComparable: vi.fn(),
  },
}))

vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    agent: { id: 'usr_owner', name: 'Agency Owner', affiliation: { role: 'owner' } },
    loading: false,
  }),
}))
vi.mock('@/components/ui/toast', async () => {
  const actual = await vi.importActual<typeof import('@/components/ui/toast')>('@/components/ui/toast')
  return { ...actual, useToast: () => ({ addToast, toasts: [], removeToast: vi.fn() }) }
})
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

const RESPONSE = {
  agency_id: 'agency-1',
  total: 2,
  coordinates_available: 1,
  items: [
    {
      id: 'report-1',
      source: 'agent_report' as const,
      source_label: 'Verified agency report',
      title: 'Downtown apartment',
      location: 'Downtown, Dubai',
      city: 'Dubai',
      area_name: 'Downtown',
      property_type: 'apartment',
      evidence_date: '2026-08-10',
      price: 1250000,
      currency: 'AED',
      bedrooms: 2,
      bathrooms: 2,
      area_sqm: 105,
      latitude: 25.197,
      longitude: 55.274,
      status: 'verified',
      strength_score: 95,
      strength: 'strong' as const,
    },
    {
      id: 'external-1',
      source: 'external' as const,
      source_label: 'Registry',
      title: 'Marina apartment',
      location: 'Dubai Marina',
      city: 'Dubai',
      area_name: 'Marina',
      property_type: 'apartment',
      evidence_date: '2026-07-01',
      price: 1100000,
      currency: 'AED',
      bedrooms: 1,
      bathrooms: 1,
      area_sqm: 80,
      status: 'sold',
      source_url: 'https://example.com/evidence',
      strength_score: 70,
      strength: 'moderate' as const,
    },
  ],
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/agency/pricing/comparables']}>
      <Routes>
        <Route path="/agency/pricing/comparables" element={<AgencyComparablesPage />} />
        <Route path="/agency/pricing" element={<div>pricing home</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  document.documentElement.dir = 'ltr'
  apiMock.getAgencyPricingComparables.mockResolvedValue(RESPONSE)
  apiMock.reportComparable.mockResolvedValue({ id: 'comparable-report-1' })
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:comparables') })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
})

describe('AgencyComparablesPage', () => {
  it('loads evidence and opens a complete detail view', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Comparables browser' })).toBeTruthy()
    expect(screen.getByText('Downtown apartment')).toBeTruthy()
    expect(screen.getByText('Marina apartment')).toBeTruthy()

    fireEvent.click(screen.getAllByRole('button', { name: 'View detail' })[0])
    expect(await screen.findByRole('dialog')).toBeTruthy()
    expect(screen.getByText('Comparable strength')).toBeTruthy()
    expect(screen.getByText(/95\/100/)).toBeTruthy()
  })

  it('applies all agency-wide query filters', async () => {
    renderPage()
    await screen.findByText('Downtown apartment')

    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Dubai' } })
    fireEvent.change(screen.getByLabelText('Area'), { target: { value: 'Downtown' } })
    fireEvent.change(screen.getByLabelText('Property type'), { target: { value: 'apartment' } })
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'agent_report' } })
    fireEvent.change(screen.getByLabelText('Recorded from'), { target: { value: '2026-08-01' } })
    fireEvent.change(screen.getByLabelText('Recorded to'), { target: { value: '2026-08-31' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }))

    await waitFor(() => expect(apiMock.getAgencyPricingComparables).toHaveBeenLastCalledWith(expect.objectContaining({
      city: 'Dubai',
      area: 'Downtown',
      property_type: 'apartment',
      source: 'agent_report',
      date_from: '2026-08-01',
      date_to: '2026-08-31',
      limit: 500,
    })))
  })

  it('renders an RTL-safe map view for geocoded evidence', async () => {
    document.documentElement.dir = 'rtl'
    renderPage()
    await screen.findByText('Downtown apartment')

    fireEvent.click(screen.getByRole('button', { name: 'Map' }))
    expect(screen.getByTestId('comparables-map')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Downtown apartment at/ })).toBeTruthy()
    expect(document.querySelector('[style*="inset-inline-start"]')).toBeTruthy()
  })

  it('submits a bad-comparable report with the correct source type', async () => {
    renderPage()
    await screen.findByText('Downtown apartment')

    fireEvent.click(screen.getByRole('button', { name: 'Report Downtown apartment' }))
    fireEvent.change(await screen.findByLabelText('Reason'), { target: { value: 'incorrect_price' } })
    fireEvent.change(screen.getByLabelText('Review notes'), { target: { value: 'The recorded amount conflicts with registry evidence.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit report' }))

    await waitFor(() => expect(apiMock.reportComparable).toHaveBeenCalledWith({
      comparable_id: 'report-1',
      comparable_type: 'agent_report',
      reason: 'incorrect_price',
      notes: 'The recorded amount conflicts with registry evidence.',
    }))
    expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Comparable reported' }))
  })

  it('exports the filtered evidence as CSV', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    renderPage()
    await screen.findByText('Downtown apartment')

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }))

    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(click).toHaveBeenCalled()
    expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Comparables exported' }))
    click.mockRestore()
  })

  it('shows a retryable error state', async () => {
    apiMock.getAgencyPricingComparables.mockRejectedValueOnce(new Error('Network unavailable'))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Network unavailable')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('Downtown apartment')).toBeTruthy()
    expect(apiMock.getAgencyPricingComparables).toHaveBeenCalledTimes(2)
  })
})
