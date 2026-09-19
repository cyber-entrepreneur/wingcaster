// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AgencyReportsHomePage } from './AgencyReportsHomePage'

const { addToast, apiMock, localeState } = vi.hoisted(() => ({
  addToast: vi.fn(),
  apiMock: {
    getAgencyReportsHome: vi.fn(),
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
      <AgencyReportsHomePage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  hasAgency = true
  apiMock.getAgencyReportsHome.mockReset()
  addToast.mockReset()
  apiMock.getAgencyReportsHome.mockResolvedValue({
    generated_at: '2026-09-18T00:00:00.000Z',
    agency_id: 'agc_1',
    window_days: 30,
    totals: { listings: 4, inquiries: 8, opportunities: 2, agents: 3, campaigns: 1 },
    cards: [
      {
        id: 'listings',
        report_id: 'AGN-REP-002',
        title: 'Listings performance',
        href: '/agency/reports/listings',
        kpi_label: 'Active listings',
        kpi_value: 4,
        secondary_label: 'Total views (30d)',
        secondary_value: 1200,
        trend: [1, 2, 0, 3, 1, 2, 4],
      },
      {
        id: 'leads',
        report_id: 'AGN-REP-003',
        title: 'Lead conversion funnel',
        href: '/agency/reports/leads',
        kpi_label: 'Inquiries (30d)',
        kpi_value: 8,
        secondary_label: 'Closed won',
        secondary_value: 2,
        trend: [0, 1, 2, 1, 0, 1, 3],
      },
    ],
  })
})

describe('AgencyReportsHomePage', () => {
  it('renders report preview cards for agency members', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Reports home')).toBeInTheDocument()
    })
    expect(screen.getByTestId('report-card-listings')).toHaveAttribute('href', '/agency/reports/listings')
    expect(screen.getByText('Listings performance')).toBeInTheDocument()
    expect(screen.getByText('Custom report')).toBeInTheDocument()
    expect(document.querySelector('[data-screen="AGN-REP-001"]')).toBeTruthy()
  })

  it('shows forbidden state without agency affiliation', async () => {
    hasAgency = false
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Agency reports unavailable')).toBeInTheDocument()
    })
    expect(apiMock.getAgencyReportsHome).not.toHaveBeenCalled()
  })

  it('sets dir=rtl when locale is Arabic', async () => {
    localeState.isArabic = true
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Reports home')).toBeInTheDocument()
    })
    expect(document.querySelector('[data-screen="AGN-REP-001"]')?.getAttribute('dir')).toBe('rtl')
    localeState.isArabic = false
  })
})
