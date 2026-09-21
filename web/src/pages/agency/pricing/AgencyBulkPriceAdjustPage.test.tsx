// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AgencyBulkPriceAdjustPage } from './AgencyBulkPriceAdjustPage'

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getAgencyBulkPriceAdjustActive: vi.fn(),
    previewAgencyBulkPriceAdjust: vi.fn(),
    applyAgencyBulkPriceAdjust: vi.fn(),
    revertAgencyBulkPriceAdjust: vi.fn(),
  },
}))

vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast: vi.fn(), toasts: [], removeToast: vi.fn() }),
}))
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

let authRole = 'owner'
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    agent: { id: 'usr_owner', affiliation: { role: authRole } },
    loading: false,
  }),
}))

function renderPage(ids = 'prop-1,prop-2') {
  return render(
    <MemoryRouter initialEntries={[`/agency/pricing/bulk-adjust?ids=${ids}`]}>
      <Routes>
        <Route path="/agency/pricing/bulk-adjust" element={<AgencyBulkPriceAdjustPage />} />
        <Route path="/agency/pricing" element={<div>pricing home</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  authRole = 'owner'
  apiMock.getAgencyBulkPriceAdjustActive.mockReset()
  apiMock.previewAgencyBulkPriceAdjust.mockReset()
  apiMock.applyAgencyBulkPriceAdjust.mockReset()
  apiMock.revertAgencyBulkPriceAdjust.mockReset()
  apiMock.getAgencyBulkPriceAdjustActive.mockResolvedValue({ active: null })
})

describe('AgencyBulkPriceAdjustPage', () => {
  it('renders selection summary with data-screen marker', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Bulk price adjustment')).toBeInTheDocument()
    })
    expect(document.querySelector('[data-screen="AGN-PRC-002"]')).toBeTruthy()
    expect(screen.getByText(/listings selected for adjustment/i)).toBeInTheDocument()
  })

  it('shows forbidden state for non-admin members', async () => {
    authRole = 'agent'
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Only agency owners and admins/i)).toBeInTheDocument()
    })
  })

  it('generates preview after strategy selection', async () => {
    apiMock.previewAgencyBulkPriceAdjust.mockResolvedValue({
      preview: {
        rows: [{
          property_id: 'prop-1',
          agent_id: 'agent-1',
          agent_name: 'Agent One',
          title: 'Listing 1',
          address: 'Downtown',
          currency: 'USD',
          price_before: 100,
          price_after: 120,
          delta_percent: 20,
        }],
        skipped: [],
        totals: {
          listing_count: 1,
          total_value_before: 100,
          total_value_after: 120,
          aggregate_change_percent: 20,
        },
      },
      missing: [],
      safety: { ok: true },
    })

    renderPage('prop-1')
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /Generate preview/i }))

    await waitFor(() => {
      expect(apiMock.previewAgencyBulkPriceAdjust).toHaveBeenCalled()
      expect(screen.getByText('Listing 1')).toBeInTheDocument()
    })
  })
})
