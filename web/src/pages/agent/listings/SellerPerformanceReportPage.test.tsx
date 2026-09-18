// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
const toastMock = vi.hoisted(() => ({ addToast: vi.fn() }))
vi.mock('@/components/ui/toast', () => ({
  useToast: () => toastMock,
}))

vi.mock('@/lib/usePageTitle', () => ({
  usePageTitle: () => undefined,
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    agent: { id: 'agent-1', name: 'Agent One' },
    loading: false,
  }),
}))

vi.mock('@/components/performance/PerformanceTab', () => ({
  PerformanceTab: () => <div data-testid="performance-tab">Performance</div>,
}))

const apiMock = vi.hoisted(() => ({
  getSellerReport: vi.fn(),
  updateSellerReport: vi.fn(),
  createSellerReportShareToken: vi.fn(),
}))
vi.mock('@/api/client', () => ({
  api: apiMock,
}))

const sampleResponse = {
  report: {
    id: 'report-1',
    property_id: 'prop-1',
    agent_id: 'agent-1',
    agency_id: null,
    state_of_play: 'Strong early interest.',
    agent_summary: 'Buyers are comparing financing.',
    show_offer_amounts: false,
    show_full_address: false,
    layout_template: 'standard',
    status: 'live',
    frozen_snapshot: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  payload: {
    generated_at: '2026-02-01T00:00:00Z',
    report: {
      id: 'report-1',
      status: 'live',
      layout_template: 'standard',
      state_of_play: 'Strong early interest.',
      agent_summary: 'Buyers are comparing financing.',
      show_offer_amounts: false,
      show_full_address: false,
    },
    property: {
      id: 'prop-1',
      reference: 'PROP1',
      title: 'Seaside Villa',
      price: 500000,
      price_unit: 'USD',
      location_label: 'Achrafieh, Beirut',
      days_on_market: 12,
    },
    agent: { id: 'agent-1', name: 'Agent One', photo_url: null, agency_name: null },
    scores: { quality: 8, cleanliness: 7, location: 9, overall: 8 },
    summary: {
      list_price: 500000,
      days_on_market: 12,
      posts_count: 3,
      inquiries_received: 4,
      qualified_inquiries: 2,
      shielded_inquiries: 2,
      untriaged_inquiries: 1,
      viewings_count: 1,
      offers_count: 1,
      momentum: 120,
    },
    marketing: { websites: [], social_posts: [], channels: [] },
    performance: {
      all_channels: {
        impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0,
        clicks: 0, engagements: 0, messages: 0, inquiries: 0, viewings_scheduled: 0,
        closes: 0, contacts: 0, avg_views_per_post: 0, published_posts: 0,
      },
      per_channel: [],
      funnel: [],
      time_series: { days: 30, channels: {} },
    },
    inquiries: { total: 4, qualified: 2, shielded: 2, untriaged: 1 },
    feedback: [],
    offers: [],
    is_empty: false,
  },
  share_tokens: [],
}

let SellerPerformanceReportPage: typeof import('./SellerPerformanceReportPage').SellerPerformanceReportPage

beforeEach(async () => {
  toastMock.addToast.mockReset()
  apiMock.getSellerReport.mockReset()
  apiMock.updateSellerReport.mockReset()
  apiMock.createSellerReportShareToken.mockReset()
  apiMock.getSellerReport.mockResolvedValue(sampleResponse)
  ;({ SellerPerformanceReportPage } = await import('./SellerPerformanceReportPage'))
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/listings/prop-1/report']}>
      <Routes>
        <Route path="/listings/:id/report" element={<SellerPerformanceReportPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SellerPerformanceReportPage', () => {
  it('renders the seller report overview', async () => {
    renderPage()
    await waitFor(() => {
      expect(apiMock.getSellerReport).toHaveBeenCalledWith('prop-1')
      expect(screen.getByText('Seaside Villa')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Strong early interest.')).toBeInTheDocument()
    })
  })

  it('shows untriaged lead nudge when needed', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Seaside Villa')).toBeInTheDocument()
      expect(document.body.textContent).toMatch(/leads still untriaged/i)
    })
  })
})
