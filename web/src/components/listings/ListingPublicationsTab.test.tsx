// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'
import { ListingPublicationsTab } from './ListingPublicationsTab'

const apiMock = vi.hoisted(() => ({
  getDistributions: vi.fn(),
  listScheduledPublications: vi.fn(),
  getPublishingTracker: vi.fn(),
  refreshDistributionInsights: vi.fn(),
  retryDistribution: vi.fn(),
  cancelScheduledPublication: vi.fn(),
}))

vi.mock('@/api/client', () => ({ api: apiMock }))

function renderTab() {
  render(
    <MemoryRouter>
      <ToastProvider>
        <ListingPublicationsTab listingId="lst-1" />
      </ToastProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  apiMock.getDistributions.mockReset().mockResolvedValue([
    {
      id: 'dist-1',
      property_id: 'lst-1',
      platform: 'instagram',
      status: 'published',
      external_id: 'ext',
      published_at: '2024-01-02T10:00:00.000Z',
      impressions: 1200,
    },
  ])
  apiMock.listScheduledPublications.mockReset().mockResolvedValue({
    scheduled: [{
      id: 'sched-1',
      property_id: 'lst-1',
      agent_id: 'agent-1',
      portals: ['property_finder'],
      message: null,
      scheduled_at: '2024-02-01T12:00:00.000Z',
      timezone: 'UTC',
      recurrence: 'none',
      status: 'pending',
      job_id: null,
      last_error: null,
      last_fired_at: null,
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
    }],
  })
  apiMock.getPublishingTracker.mockReset().mockResolvedValue({
    rows: [{
      distribution_attempt_id: 'att-1',
      job_id: 'job-1',
      listing: { id: 'lst-1', address_line: 'Marina', thumbnail_url: null },
      portal: { code: 'bayut', display_name: 'Bayut', channel_token_key: null },
      submitted_at: '2024-01-03T08:00:00.000Z',
      updated_at: '2024-01-03T08:00:00.000Z',
      status: 'live',
      error_class: null,
      error_message: null,
      credits_charged: 2,
      portal_live_url: null,
    }],
  })
  apiMock.refreshDistributionInsights.mockReset()
  apiMock.retryDistribution.mockReset()
  apiMock.cancelScheduledPublication.mockReset()
})

afterEach(() => cleanup())

describe('ListingPublicationsTab (AGT-LST-011)', () => {
  it('renders unified publications timeline', async () => {
    renderTab()
    expect(await screen.findByText('Publications')).toBeInTheDocument()
    expect(screen.getByText('Instagram')).toBeInTheDocument()
    expect(screen.getByText('Bayut')).toBeInTheDocument()
    expect(screen.getByText('property_finder')).toBeInTheDocument()
    expect(document.querySelector('[data-screen="AGT-LST-011"]')).toBeTruthy()
  })

  it('cancels a pending scheduled publication', async () => {
    const user = userEvent.setup()
    apiMock.cancelScheduledPublication.mockResolvedValue({ success: true })
    renderTab()
    await screen.findByText('property_finder')
    await user.click(screen.getByRole('button', { name: /Cancel/i }))
    await waitFor(() => expect(apiMock.cancelScheduledPublication).toHaveBeenCalledWith('sched-1'))
  })
})
