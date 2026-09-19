// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SellerReportSharePage } from './SellerReportSharePage'

vi.mock('@/lib/usePageTitle', () => ({
  usePageTitle: () => undefined,
}))

const apiMock = vi.hoisted(() => ({
  getPublicSellerReport: vi.fn(),
}))
vi.mock('@/api/client', () => ({
  api: apiMock,
}))

const payload = {
  generated_at: '2026-02-01T00:00:00Z',
  report: {
    id: 'report-1',
    status: 'live',
    layout_template: 'standard',
    state_of_play: 'Healthy visibility.',
    agent_summary: 'We refreshed social posts this week.',
    show_offer_amounts: false,
    show_full_address: false,
  },
  property: {
    id: 'prop-1',
    reference: 'PROP1',
    title: 'Garden Apartment',
    price: 320000,
    price_unit: 'USD',
    location_label: 'Hamra, Beirut',
    days_on_market: 8,
  },
  agent: { id: 'agent-1', name: 'Sara Agent', photo_url: null, agency_name: 'Coast Realty' },
  scores: { quality: null, cleanliness: null, location: null, overall: null },
  summary: {
    list_price: 320000,
    days_on_market: 8,
    posts_count: 2,
    inquiries_received: 3,
    qualified_inquiries: 2,
    shielded_inquiries: 1,
    untriaged_inquiries: 0,
    viewings_count: 1,
    offers_count: 0,
    momentum: 40,
  },
  marketing: {
    websites: [],
    social_posts: [{ id: 'd1', platform: 'instagram' }],
    channels: [{ id: 'd1', platform: 'instagram', status: 'published', published_at: null, post_url: null, views: 40, clicks: 2, leads: 1 }],
  },
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
  inquiries: { total: 3, qualified: 2, shielded: 1, untriaged: 0 },
  feedback: [],
  offers: [],
  is_empty: false,
}

function renderPage(token = 'wc_rpt_testtoken') {
  return render(
    <MemoryRouter initialEntries={[`/r/${token}`]}>
      <Routes>
        <Route path="/r/:shareToken" element={<SellerReportSharePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  apiMock.getPublicSellerReport.mockReset()
})

describe('SellerReportSharePage', () => {
  it('renders the shared seller report', async () => {
    apiMock.getPublicSellerReport.mockResolvedValue({ status: 'live', payload })
    renderPage()
    expect(await screen.findByText('Garden Apartment')).toBeInTheDocument()
    expect(screen.getByText('Healthy visibility.')).toBeInTheDocument()
    expect(screen.getByText(/Prepared by Sara Agent/)).toBeInTheDocument()
  })

  it('shows a polite unavailable state for revoked links', async () => {
    apiMock.getPublicSellerReport.mockRejectedValue(new Error('gone'))
    renderPage('wc_rpt_revoked')
    await waitFor(() => {
      expect(screen.getByText('Report unavailable')).toBeInTheDocument()
    })
  })
})
