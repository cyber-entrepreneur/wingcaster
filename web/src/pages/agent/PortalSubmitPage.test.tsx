// @vitest-environment jsdom
/**
 * AGT-PUB-005 — registry-driven portal list + post-submit navigation to receipt.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { portalReceiptPath, PortalSubmitPage } from './PortalSubmitPage'

const navigateMock = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

const toastMock = vi.hoisted(() => ({ addToast: vi.fn() }))
vi.mock('@/components/ui/toast', () => ({
  useToast: () => toastMock,
}))

vi.mock('@/lib/usePageTitle', () => ({
  usePageTitle: () => undefined,
}))

const apiMock = vi.hoisted(() => ({
  getPortalRegistry: vi.fn(),
  getProperty: vi.fn(),
  createPublishingJob: vi.fn(),
}))
vi.mock('@/api/client', () => ({
  api: apiMock,
}))

const REGISTRY = {
  portals: [
    {
      code: 'wasalt',
      display_name: 'Wasalt',
      description: 'KSA portal from registry',
      logo_url: null,
      country_codes: ['SA'],
      primary_language: 'ar',
      is_active: true,
      deprecated_at: null,
      sla_hours: 6,
    },
    {
      code: 'aqarmap',
      display_name: 'Aqarmap',
      description: 'EG portal from registry',
      logo_url: null,
      country_codes: ['EG'],
      primary_language: 'ar',
      is_active: false,
      deprecated_at: null,
      sla_hours: null,
    },
  ],
}

function renderPage(listingId = 'lst_test_1') {
  return render(
    <MemoryRouter initialEntries={[`/listings/${listingId}/portals/submit`]}>
      <Routes>
        <Route path="/listings/:id/portals/submit" element={<PortalSubmitPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('portalReceiptPath', () => {
  it('builds AGT-PUB-003 receipt URL with jobId', () => {
    expect(portalReceiptPath('job_abc')).toBe('/publish/receipts/job_abc')
  })
})

describe('PortalSubmitPage', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    toastMock.addToast.mockReset()
    apiMock.getPortalRegistry.mockReset()
    apiMock.getProperty.mockReset()
    apiMock.createPublishingJob.mockReset()
    apiMock.getPortalRegistry.mockResolvedValue(REGISTRY)
    apiMock.getProperty.mockResolvedValue({ id: 'lst_test_1', title: 'Marina Gate 2' })
  })

  it('renders portals from dynamic registry (no hardcoded Bayut/PF/OLX list)', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('portal-submit-list')).toBeTruthy()
    })

    expect(screen.getByTestId('portal-option-wasalt')).toBeTruthy()
    expect(screen.getByTestId('portal-option-aqarmap')).toBeTruthy()
    expect(screen.getByText('Wasalt')).toBeTruthy()
    expect(screen.getByText('Aqarmap')).toBeTruthy()

    // Must not embed a static legacy portal array as the only options.
    expect(screen.queryByText('Bayut')).toBeNull()
    expect(screen.queryByText('Property Finder')).toBeNull()
    expect(screen.queryByText('OLX')).toBeNull()
    expect(apiMock.getPortalRegistry).toHaveBeenCalledTimes(1)
  })

  it('submits selected portals and navigates to /publish/receipts/:jobId', async () => {
    const user = userEvent.setup()
    apiMock.createPublishingJob.mockResolvedValue({
      jobId: 'job_01HRECEIPT',
      job: { id: 'job_01HRECEIPT', aggregate: 'in_review_only' },
      destinations: [],
    })

    renderPage()
    await waitFor(() => screen.getByTestId('portal-option-wasalt'))

    await user.click(screen.getByTestId('portal-option-wasalt'))
    await user.click(screen.getByTestId('portal-submit-cta'))

    await waitFor(() => {
      expect(apiMock.createPublishingJob).toHaveBeenCalledWith(
        'lst_test_1',
        [{ code: 'wasalt', country_code: 'SA' }],
        undefined,
      )
    })

    expect(navigateMock).toHaveBeenCalledWith('/publish/receipts/job_01HRECEIPT')
  })
})
