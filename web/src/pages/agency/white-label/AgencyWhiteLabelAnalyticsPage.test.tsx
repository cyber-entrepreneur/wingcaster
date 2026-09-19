// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AgencyWhiteLabelAnalyticsPage } from './AgencyWhiteLabelAnalyticsPage'

const apiMock = vi.hoisted(() => ({
  getAgencyWhiteLabelAnalytics: vi.fn(),
}))

vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast: vi.fn(), toasts: [], removeToast: vi.fn() }),
}))
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))
vi.mock('@/hooks/useLocale', () => ({
  useLocale: () => ({ locale: 'en', isArabic: false, dir: 'ltr', setLocale: vi.fn() }),
}))

let hasAgency = true
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    agent: hasAgency ? { id: 'usr_1', affiliation: { agency_id: 'agc_1', role: 'owner' } } : null,
    loading: false,
  }),
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/agency/white-label/analytics']}>
      <Routes>
        <Route path="/agency/white-label/analytics" element={<AgencyWhiteLabelAnalyticsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AgencyWhiteLabelAnalyticsPage', () => {
  beforeEach(() => {
    hasAgency = true
    apiMock.getAgencyWhiteLabelAnalytics.mockReset()
    apiMock.getAgencyWhiteLabelAnalytics.mockResolvedValue({
      agency_id: 'agc_1',
      start_date: '2026-08-19',
      end_date: '2026-09-18',
      kpis: {
        visitors: 120,
        inquiries: 8,
        conversions: 2,
        conversion_rate: 6.7,
        bazaar_referral_share: 22.5,
        pageviews: 240,
      },
      top_pages: [{ key: '/', value: 100 }],
      traffic_sources: [{ key: 'bazaar', value: 54 }],
      devices: [{ key: 'mobile', value: 140 }],
      top_listings: [{ property_id: 'prop_1', title: 'Sea View Villa', views: 42 }],
      trend: [],
      total_events: 240,
    })
  })

  it('renders KPI cards when analytics load', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('White-label analytics')).toBeTruthy()
      expect(screen.getByText('Visitors')).toBeTruthy()
      expect(screen.getByText('Sea View Villa')).toBeTruthy()
      expect(screen.getByText('bazaar')).toBeTruthy()
    })
    expect(document.querySelector('[data-screen="AGN-WLB-005"]')).toBeTruthy()
  })

  it('shows forbidden state without agency affiliation', async () => {
    hasAgency = false
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Sign in with an agency account/i)).toBeTruthy()
    })
  })

  it('shows empty state when no events are recorded', async () => {
    apiMock.getAgencyWhiteLabelAnalytics.mockResolvedValue({
      agency_id: 'agc_1',
      start_date: '2026-08-19',
      end_date: '2026-09-18',
      kpis: {
        visitors: 0,
        inquiries: 0,
        conversions: 0,
        conversion_rate: 0,
        bazaar_referral_share: 0,
        pageviews: 0,
      },
      top_pages: [],
      traffic_sources: [],
      devices: [],
      top_listings: [],
      trend: [],
      total_events: 0,
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('No analytics yet')).toBeTruthy()
    })
  })
})
