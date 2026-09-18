// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AgencyListingsPerformanceReportPage } from './AgencyListingsPerformanceReportPage'

const { addToast, apiMock, localeState } = vi.hoisted(() => ({
  addToast: vi.fn(),
  apiMock: {
    getAgencyListingsPerformance: vi.fn(),
  },
  localeState: { isArabic: false },
}))

vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast, toasts: [], removeToast: vi.fn() }),
}))
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))
vi.mock('@/hooks/useLocale', () => ({
  useLocale: () => ({
    locale: localeState.isArabic ? 'ar' : 'en',
    isArabic: localeState.isArabic,
    dir: localeState.isArabic ? 'rtl' : 'ltr',
    setLocale: vi.fn(),
  }),
}))

let hasAgency = true
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    agent: hasAgency
      ? { id: 'usr_owner', affiliation: { agency_id: 'agc_1', role: 'owner' } }
      : { id: 'usr_solo', affiliation: undefined },
    loading: false,
  }),
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <AgencyListingsPerformanceReportPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  hasAgency = true
  apiMock.getAgencyListingsPerformance.mockReset()
  addToast.mockReset()
  apiMock.getAgencyListingsPerformance.mockResolvedValue({
    generated_at: '2026-09-18T00:00:00.000Z',
    agency_id: 'agc_1',
    overview: {
      listings: 2,
      active_listings: 2,
      total_views: 240,
      total_saves: 3,
      total_inquiries: 8,
      total_viewings: 4,
      total_conversions: 2,
      conversion_rate: 25,
    },
    rows: [
      {
        id: 'prop_1',
        title: 'Sea View Villa',
        city: 'Beirut',
        neighborhood: 'Achrafieh',
        property_type: 'apartment',
        status: 'active',
        agent_id: 'agt_1',
        agent_name: 'Alex Agent',
        views: 180,
        clicks: 12,
        saves: 2,
        inquiries: 5,
        viewings: 3,
        conversions: 1,
        conversion_rate: 20,
        engagement: 200,
      },
    ],
    by_channel: [{ label: 'marketplace', value: 120 }],
    by_device: [{ label: 'Mobile', value: 90 }],
    top_listings: [{ id: 'prop_1', title: 'Sea View Villa', views: 180, inquiries: 5 }],
    filter_options: {
      agents: [{ id: 'agt_1', name: 'Alex Agent' }],
      areas: ['Beirut', 'Achrafieh'],
      property_types: ['apartment'],
    },
  })
})

describe('AgencyListingsPerformanceReportPage', () => {
  it('renders listings performance report for agency members', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Listings performance')).toBeInTheDocument()
    })
    expect(screen.getAllByText('Sea View Villa').length).toBeGreaterThan(0)
    expect(screen.getByText('Export CSV')).toBeInTheDocument()
    expect(document.querySelector('[data-screen="AGN-REP-002"]')).toBeTruthy()
  })

  it('shows forbidden state without agency affiliation', async () => {
    hasAgency = false
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Listings report unavailable')).toBeInTheDocument()
    })
    expect(apiMock.getAgencyListingsPerformance).not.toHaveBeenCalled()
  })

  it('sets dir=rtl when locale is Arabic', async () => {
    localeState.isArabic = true
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Listings performance')).toBeInTheDocument()
    })
    expect(document.querySelector('[data-screen="AGN-REP-002"]')?.getAttribute('dir')).toBe('rtl')
    localeState.isArabic = false
  })
})
