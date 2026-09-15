// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { PortalStatus } from '@/components/ui/portal-status-pill'
import { PortalTrackerPage } from './PortalTrackerPage'

const STATUSES: PortalStatus[] = [
  'submitted',
  'in_review',
  'live',
  'rejected',
  'expired',
  'failed',
]

function makeRow(status: PortalStatus, idx: number) {
  return {
    distribution_attempt_id: `att_${status}_${idx}`,
    listing: {
      id: `lst_${idx}`,
      address_line: `Marina Gate T${idx} · Apt ${100 + idx}`,
      thumbnail_url: null,
    },
    portal: {
      code: 'bayut',
      display_name: 'Bayut',
      channel_token_key: 'publishing.realestate.bayut',
    },
    submitted_at: '2026-09-08T10:00:00.000Z',
    updated_at: '2026-09-08T14:22:00.000Z',
    status,
    error_class: status === 'failed' ? 'portal_down' : null,
    error_message: null,
    credits_charged: 2,
    portal_live_url: null,
  }
}

const getPublishingTracker = vi.fn()
const getPublishingTrackerSummary = vi.fn()

vi.mock('@/api/client', () => ({
  api: {
    getPublishingTracker: (...args: unknown[]) => getPublishingTracker(...args),
    getPublishingTrackerSummary: (...args: unknown[]) => getPublishingTrackerSummary(...args),
  },
  API_BASE: '',
  getAuthToken: () => 'test-token',
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast: vi.fn(), toasts: [], removeToast: vi.fn() }),
}))

vi.mock('@/lib/usePageTitle', () => ({
  usePageTitle: () => undefined,
}))

vi.mock('@/lib/publishing/socket', () => ({
  connectPublishingSocket: () => ({ close: vi.fn() }),
}))

vi.mock('@/lib/useOnlineStatus', () => ({
  useOnlineStatus: () => true,
}))

function renderPage(initial = '/publishing/tracker') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/publishing/tracker" element={<PortalTrackerPage />} />
        <Route path="/publishing/receipts/:id" element={<div data-testid="receipt-page">receipt</div>} />
        <Route path="/listings" element={<div data-testid="listings-page">listings</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PortalTrackerPage', () => {
  beforeEach(() => {
    getPublishingTracker.mockReset()
    getPublishingTrackerSummary.mockReset()
    getPublishingTrackerSummary.mockResolvedValue({
      total_submissions: 6,
      success_rate: 0.5,
      credits_spent: 12,
      top_failure_class: { class: 'portal_down', display_label: 'Portal down', count: 1 },
      scope: { from: null, to: null, filters_applied: { status: [], portal: [], listing_id: null, from: null, to: null } },
    })
    getPublishingTracker.mockResolvedValue({
      rows: STATUSES.map((s, i) => makeRow(s, i)),
      next_cursor: null,
      has_more: false,
      total: 6,
    })
  })

  it('renders every tracker status variant', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByTestId('portal-tracker-page')).toBeInTheDocument())
    for (const status of STATUSES) {
      expect(screen.getByTestId(`tracker-row-att_${status}_${STATUSES.indexOf(status)}`)).toHaveAttribute(
        'data-status',
        status,
      )
    }
    expect(screen.getByText('Submitted')).toBeInTheDocument()
    expect(screen.getByText('In review')).toBeInTheDocument()
    expect(screen.getByText('Live')).toBeInTheDocument()
    expect(screen.getByText('Not accepted')).toBeInTheDocument()
    expect(screen.getByText('Timed out')).toBeInTheDocument()
    expect(screen.getByText('Delivery failed')).toBeInTheDocument()
  })

  it('deep-links a row to /publishing/receipts/:id', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByTestId('tracker-row-att_live_2')).toBeInTheDocument())
    await user.click(screen.getByTestId('tracker-row-att_live_2'))
    expect(await screen.findByTestId('receipt-page')).toBeInTheDocument()
  })

  it('shows never-published empty state with CTA to /listings', async () => {
    getPublishingTracker.mockResolvedValue({ rows: [], next_cursor: null, has_more: false, total: 0 })
    getPublishingTrackerSummary.mockResolvedValue({
      total_submissions: 0,
      success_rate: 0,
      credits_spent: 0,
      top_failure_class: null,
      scope: { from: null, to: null, filters_applied: { status: [], portal: [], listing_id: null, from: null, to: null } },
    })
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByTestId('tracker-empty-never')).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: /Publish your first listing/i }))
    expect(await screen.findByTestId('listings-page')).toBeInTheDocument()
  })

  it('shows filter-narrowed empty state and clears filters', async () => {
    getPublishingTracker.mockImplementation(async (params?: Record<string, string>) => {
      if (params?.status) {
        return { rows: [], next_cursor: null, has_more: false, total: 0 }
      }
      return {
        rows: STATUSES.map((s, i) => makeRow(s, i)),
        next_cursor: null,
        has_more: false,
        total: 6,
      }
    })
    const user = userEvent.setup()
    renderPage('/publishing/tracker?status=rejected')
    expect(await screen.findByTestId('tracker-empty-filters')).toBeInTheDocument()
    await user.click(
      within(screen.getByTestId('tracker-empty-filters')).getByRole('button', {
        name: /Clear filters/i,
      }),
    )
    await waitFor(() => expect(screen.queryByTestId('tracker-empty-filters')).not.toBeInTheDocument())
  })

  it('masks listing addresses by default (MASKED)', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByTestId('tracker-row-att_live_2')).toBeInTheDocument())
    const row = screen.getByTestId('tracker-row-att_live_2')
    expect(within(row).queryByText(/Marina Gate T2 · Apt 102/)).not.toBeInTheDocument()
    expect(within(row).getByText(/Marina/)).toBeInTheDocument()
    expect(within(row).getByText(/••••/)).toBeInTheDocument()
  })

  it('does not render a per-row retry control (retry lives on receipt)', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByTestId('tracker-row-att_failed_5')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument()
  })
})
