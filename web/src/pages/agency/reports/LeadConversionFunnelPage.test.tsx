// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LeadConversionFunnelPage } from './LeadConversionFunnelPage'
import type { AgencyLeadFunnelResponse } from '@/api/client'

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getAgencyLeadFunnel: vi.fn(),
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

const sampleResponse: AgencyLeadFunnelResponse = {
  generated_at: '2026-09-18T12:00:00.000Z',
  scope: {
    agency_id: 'agc_1',
    start_date: '2026-08-19',
    end_date: '2026-09-18',
    filters: { source: null, agent_id: null, area: null },
  },
  funnel: {
    inquiries: 12,
    viewings: 6,
    opportunities: 4,
    closed_won: 2,
    closed_lost: 1,
  },
  conversion_rates: {
    inquiry_to_viewing: 50,
    viewing_to_opportunity: 67,
    opportunity_to_won: 50,
    inquiry_to_won: 17,
  },
  by_stage: [
    { stage: 'inquiry', count: 12 },
    { stage: 'viewing', count: 6 },
    { stage: 'opportunity', count: 4 },
    { stage: 'closed_won', count: 2 },
    { stage: 'closed_lost', count: 1 },
  ],
  by_source: [{ source: 'bazaar', inquiries: 8, viewings: 4, opportunities: 3, won: 2, won_value: 900000 }],
  by_agent: [{ agent_id: 'agt_1', agent_name: 'Sara', inquiries: 12, viewings: 6, opportunities: 4, won: 2 }],
  sankey: {
    nodes: [
      { id: 'source:bazaar', label: 'bazaar', group: 'source' },
      { id: 'agent:agt_1', label: 'Sara', group: 'agent' },
      { id: 'outcome:won', label: 'won', group: 'outcome' },
    ],
    links: [
      { source: 'source:bazaar', target: 'agent:agt_1', value: 8 },
      { source: 'agent:agt_1', target: 'outcome:won', value: 2 },
    ],
  },
  filter_options: {
    sources: ['bazaar', 'direct'],
    agents: [{ id: 'agt_1', name: 'Sara' }],
    areas: ['Marina'],
  },
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/agency/reports/leads']}>
      <Routes>
        <Route path="/agency/reports/leads" element={<LeadConversionFunnelPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  apiMock.getAgencyLeadFunnel.mockReset()
  apiMock.getAgencyLeadFunnel.mockResolvedValue(sampleResponse)
})

describe('LeadConversionFunnelPage', () => {
  it('renders funnel KPIs and screen tag', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Lead conversion funnel')).toBeInTheDocument()
    })
    expect(document.querySelector('[data-screen="AGN-REP-003"]')).toBeTruthy()
    expect(screen.getByText('Inquiries')).toBeInTheDocument()
    expect(screen.getAllByText('12').length).toBeGreaterThan(0)
    expect(screen.getByText('Source → agent → outcome')).toBeInTheDocument()
  })

  it('applies filters via API call', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Source' })).toBeInTheDocument())
    fireEvent.change(screen.getByRole('combobox', { name: 'Source' }), { target: { value: 'bazaar' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }))
    await waitFor(() => {
      expect(apiMock.getAgencyLeadFunnel).toHaveBeenLastCalledWith(
        expect.objectContaining({ source: 'bazaar' }),
      )
    })
  })

  it('shows empty state when no inquiries', async () => {
    apiMock.getAgencyLeadFunnel.mockResolvedValue({
      ...sampleResponse,
      funnel: { inquiries: 0, viewings: 0, opportunities: 0, closed_won: 0, closed_lost: 0 },
      by_stage: [],
      by_source: [],
      by_agent: [],
      sankey: { nodes: [], links: [] },
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('No inquiries match the selected filters.')).toBeInTheDocument()
    })
  })
})
