// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AgencyAgentLeaderboardPage } from './AgencyAgentLeaderboardPage'

const { addToast, apiMock, localeState } = vi.hoisted(() => ({
  addToast: vi.fn(),
  apiMock: {
    getAgencyAgentLeaderboard: vi.fn(),
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
      <AgencyAgentLeaderboardPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  hasAgency = true
  apiMock.getAgencyAgentLeaderboard.mockReset()
  addToast.mockReset()
  apiMock.getAgencyAgentLeaderboard.mockResolvedValue({
    generated_at: '2026-09-18T00:00:00.000Z',
    agency_id: 'agc_1',
    metric: 'revenue',
    available_metrics: ['revenue', 'closings', 'response_time', 'conversion_rate'],
    summary: { agents_ranked: 2, total_revenue: 400000, total_closings: 2 },
    leaderboard: [
      {
        rank: 1,
        medal: 'gold',
        agent_id: 'agt_1',
        agent_name: 'Alex Agent',
        revenue: 300000,
        closings: 1,
        conversion_rate: 50,
        median_response_minutes: 10,
        inquiries: 2,
        active_listings: 3,
        trend: 'up',
        metric_value: 300000,
        member_href: '/agency',
      },
    ],
  })
})

describe('AgencyAgentLeaderboardPage', () => {
  it('renders agent leaderboard for agency members', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Agent leaderboard')).toBeInTheDocument()
    })
    expect(screen.getByText('Alex Agent')).toBeInTheDocument()
    expect(screen.getByText('Export CSV')).toBeInTheDocument()
    expect(document.querySelector('[data-screen="AGN-REP-004"]')).toBeTruthy()
  })

  it('shows forbidden state without agency affiliation', async () => {
    hasAgency = false
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Agent leaderboard unavailable')).toBeInTheDocument()
    })
    expect(apiMock.getAgencyAgentLeaderboard).not.toHaveBeenCalled()
  })

  it('sets dir=rtl when locale is Arabic', async () => {
    localeState.isArabic = true
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Agent leaderboard')).toBeInTheDocument()
    })
    expect(document.querySelector('[data-screen="AGN-REP-004"]')?.getAttribute('dir')).toBe('rtl')
    localeState.isArabic = false
  })
})
