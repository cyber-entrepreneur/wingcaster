// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AgencyCampaignPerformanceReportPage } from './AgencyCampaignPerformanceReportPage'

const { addToast, apiMock, localeState } = vi.hoisted(() => ({
  addToast: vi.fn(),
  apiMock: { getAgencyCampaignPerformance: vi.fn() },
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
      <AgencyCampaignPerformanceReportPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  hasAgency = true
  apiMock.getAgencyCampaignPerformance.mockReset()
  addToast.mockReset()
  apiMock.getAgencyCampaignPerformance.mockResolvedValue({
    generated_at: '2026-09-18T00:00:00.000Z',
    agency_id: 'agc_1',
    overview: {
      campaigns: 2,
      active_campaigns: 1,
      total_enrollments: 12,
      completed_enrollments: 5,
      messages_sent: 40,
      messages_delivered: 32,
      completion_rate: 42,
    },
    rows: [
      {
        id: 'cmp_1',
        name: 'Spring nurture',
        status: 'active',
        trigger: 'new_lead',
        channel: 'email',
        channels: ['email'],
        agent_id: 'agt_1',
        agent_name: 'Alex Agent',
        enrollments_total: 8,
        enrollments_active: 3,
        enrollments_completed: 5,
        completion_rate: 63,
        messages_sent: 24,
        messages_delivered: 20,
        messages_failed: 1,
        delivery_rate: 83,
        steps_count: 3,
        href: '/campaigns/cmp_1',
        created_at: '2026-09-10T10:00:00.000Z',
      },
    ],
    by_channel: [{ channel: 'email', messages_sent: 24, messages_delivered: 20, campaigns: 1, delivery_rate: 83 }],
    filter_options: { channels: ['email', 'whatsapp'], agents: [{ id: 'agt_1', name: 'Alex Agent' }] },
  })
})

describe('AgencyCampaignPerformanceReportPage', () => {
  it('renders campaign performance report for agency members', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Campaign performance')).toBeInTheDocument()
    })
    expect(screen.getByText('Spring nurture')).toBeInTheDocument()
    expect(screen.getByText('Export CSV')).toBeInTheDocument()
    expect(document.querySelector('[data-screen="AGN-REP-006"]')).toBeTruthy()
  })

  it('shows forbidden state without agency affiliation', async () => {
    hasAgency = false
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Campaign report unavailable')).toBeInTheDocument()
    })
    expect(apiMock.getAgencyCampaignPerformance).not.toHaveBeenCalled()
  })

  it('sets dir=rtl when locale is Arabic', async () => {
    localeState.isArabic = true
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Campaign performance')).toBeInTheDocument()
    })
    expect(document.querySelector('[data-screen="AGN-REP-006"]')?.getAttribute('dir')).toBe('rtl')
    localeState.isArabic = false
  })
})
