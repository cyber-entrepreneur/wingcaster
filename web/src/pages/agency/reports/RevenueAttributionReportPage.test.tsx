// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { RevenueAttributionReportPage } from './RevenueAttributionReportPage'
import type { AgencyRevenueAttributionResponse } from '@/api/client'

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getAgencyRevenueAttribution: vi.fn(),
  },
}))

vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast: vi.fn(), toasts: [], removeToast: vi.fn() }),
}))
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))
vi.mock('@/hooks/useLocale', () => ({
  useLocale: () => ({ locale: 'en', isArabic: false, dir: 'ltr', setLocale: vi.fn() }),
}))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    agent: { id: 'usr_1', affiliation: { agency_id: 'agc_1', role: 'owner' } },
    loading: false,
  }),
}))

const sampleResponse: AgencyRevenueAttributionResponse = {
  generated_at: '2026-09-18T12:00:00.000Z',
  scope: {
    agency_id: 'agc_1',
    start_date: '2026-03-18',
    end_date: '2026-09-18',
    filters: { channel: null, agent_id: null, campaign_id: null },
  },
  summary: {
    total_revenue: 800000,
    transaction_count: 2,
    average_deal_value: 400000,
    currency: 'USD',
  },
  by_channel: [{ channel: 'portal_lead', label: 'portal lead', revenue: 500000, count: 1 }],
  by_agent: [{ agent_id: 'agt_1', agent_name: 'Sara', revenue: 800000, count: 2 }],
  by_campaign: [{ campaign_id: 'cmp_1', campaign_name: 'Autumn push', revenue: 500000, count: 1 }],
  waterfall: [{ label: '2026-09', value: 800000 }],
  sankey: { nodes: [], links: [] },
  transactions: [
    {
      id: 'txn_1',
      closed_at: '2026-09-10T12:00:00Z',
      agent_id: 'agt_1',
      agent_name: 'Sara',
      attribution_source: 'portal_lead',
      channel_label: 'portal lead',
      final_sold_price: 500000,
      currency: 'USD',
      transaction_type: 'sale',
      listing_id: 'lst_1',
      campaign_id: 'cmp_1',
      campaign_name: 'Autumn push',
    },
  ],
  filter_options: {
    channels: ['portal_lead', 'referral'],
    agents: [{ id: 'agt_1', name: 'Sara' }],
    campaigns: [{ id: 'cmp_1', name: 'Autumn push' }],
  },
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/agency/reports/revenue']}>
      <Routes>
        <Route path="/agency/reports/revenue" element={<RevenueAttributionReportPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  apiMock.getAgencyRevenueAttribution.mockReset()
  apiMock.getAgencyRevenueAttribution.mockResolvedValue(sampleResponse)
})

describe('RevenueAttributionReportPage', () => {
  it('renders revenue KPIs and screen tag', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Revenue attribution')).toBeInTheDocument()
    })
    expect(document.querySelector('[data-screen="AGN-REP-007"]')).toBeTruthy()
    expect(screen.getByText('Total revenue')).toBeInTheDocument()
    expect(screen.getAllByText('Sara').length).toBeGreaterThan(0)
  })

  it('applies filters via API call', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Channel' })).toBeInTheDocument())
    fireEvent.change(screen.getByRole('combobox', { name: 'Channel' }), { target: { value: 'portal_lead' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }))
    await waitFor(() => {
      expect(apiMock.getAgencyRevenueAttribution).toHaveBeenLastCalledWith(
        expect.objectContaining({ channel: 'portal_lead' }),
      )
    })
  })

  it('shows empty state when no transactions', async () => {
    apiMock.getAgencyRevenueAttribution.mockResolvedValue({
      ...sampleResponse,
      summary: { total_revenue: 0, transaction_count: 0, average_deal_value: 0, currency: 'USD' },
      transactions: [],
      by_channel: [],
      by_agent: [],
      by_campaign: [],
      waterfall: [],
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('No closed transactions match the selected filters.')).toBeInTheDocument()
    })
  })
})
