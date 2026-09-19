// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { PerformanceTab } from './PerformanceTab'

const mockGetListingPerformance = vi.fn()
const mockAddToast = vi.fn()

vi.mock('@/api/client', () => ({
  api: {
    getListingPerformance: (...args: unknown[]) => mockGetListingPerformance(...args),
  },
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast: mockAddToast }),
}))

vi.mock('@/hooks/useUiMode', () => ({
  useUiMode: () => ({
    shouldRenderPro: true,
    effectiveMode: 'pro',
    mode: 'pro',
  }),
}))

const samplePerformance = {
  listing_id: 'lst-1',
  generated_at: '2026-03-01T12:00:00Z',
  all_channels: {
    impressions: 1200,
    reach: 900,
    likes: 40,
    comments: 8,
    shares: 3,
    saves: 15,
    clicks: 55,
    engagements: 66,
    messages: 4,
    inquiries: 6,
    viewings_scheduled: 2,
    closes: 0,
    contacts: 5,
    avg_views_per_post: 400,
    published_posts: 3,
  },
  per_channel: [
    {
      platform: 'instagram',
      impressions: 800,
      reach: 600,
      likes: 30,
      comments: 5,
      shares: 2,
      saves: 10,
      clicks: 30,
      engagements: 47,
      messages: 2,
      inquiries: 4,
      viewings_scheduled: 1,
      closes: 0,
      contacts: 3,
      avg_views_per_post: 400,
      published_posts: 2,
    },
  ],
  funnel: [
    {
      platform: 'instagram',
      views: 800,
      engagements: 47,
      clicks: 30,
      inquiries: 4,
      viewings_scheduled: 1,
      closes: 0,
    },
  ],
  time_series: { days: 30, channels: {} },
  counts: {
    published_posts: 3,
    channels: 2,
    snapshot_days: 30,
    snapshot_points: 0,
    contacts_reached: 5,
  },
}

describe('PerformanceTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetListingPerformance.mockResolvedValue(samplePerformance)
  })

  it('renders AGT-LST-006 screen marker and KPI strip', async () => {
    render(
      <PerformanceTab
        listingId="lst-1"
        listingTitle="Palm Jumeirah Villa"
        askingPrice={2500000}
        currency="AED"
        pricingAnalysis={{
          id: 'pa-1',
          property_id: 'lst-1',
          match_config_id: 'mc-1',
          comparable_count: 5,
          lowest_price: 2000000,
          highest_price: 3000000,
          median_price: 2400000,
          mean_price: 2450000,
          percentile_25: null,
          percentile_75: null,
          target_price: 2500000,
          target_percentile: 55,
          target_vs_median: 'above',
          target_vs_median_percent: 4.2,
          confidence: 'medium',
          currency_normalized: 'AED',
          rate_is_stale: false,
          calculated_at: '2026-03-01T00:00:00Z',
          comparables_summary: [],
        }}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Palm Jumeirah Villa')).toBeInTheDocument()
    })

    expect(document.querySelector('[data-screen="AGT-LST-006"]')).toBeTruthy()
    expect(screen.getByText('Pricing context')).toBeInTheDocument()
    expect(screen.getAllByText('Viewings').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Export PDF/i })).toBeInTheDocument()
  })

  it('shows empty publish hint when no posts', async () => {
    mockGetListingPerformance.mockResolvedValue({
      ...samplePerformance,
      counts: { ...samplePerformance.counts, published_posts: 0 },
    })
    render(<PerformanceTab listingId="lst-1" />)

    await waitFor(() => {
      expect(screen.getByText(/Publish this listing to a channel/)).toBeInTheDocument()
    })
  })
})
