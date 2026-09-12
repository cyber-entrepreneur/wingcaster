// @vitest-environment jsdom
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'
import { PortalStatusPill, type PortalStatus } from '@/components/ui/portal-status-pill'
import { TrackerEmptyState } from '@/components/publishing/TrackerEmptyState'
import { TrackerFilterBar } from '@/components/publishing/TrackerFilterBar'
import { PortalTrackerRow } from '@/components/publishing/PortalTrackerRow'
import { PortalTrackerScreen } from '@/components/publishing/PortalTrackerScreen'
import {
  EMPTY_TRACKER_FILTERS,
  receiptPathForRow,
  type TrackerFilters,
  type TrackerRow,
} from '@/components/publishing/PortalTrackerScreen/types'
import { PortalTrackerPage } from '@/pages/agent/PortalTrackerPage'

const listMock = vi.hoisted(() => vi.fn())
const summaryMock = vi.hoisted(() => vi.fn())
const notificationsMock = vi.hoisted(() => vi.fn())
const navigateMock = vi.hoisted(() => vi.fn())

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>('@/api/client')
  return {
    ...actual,
    api: {
      ...actual.api,
      getPublishingTracker: listMock,
      getPublishingTrackerSummary: summaryMock,
      getNotifications: notificationsMock,
      getProperties: vi.fn().mockResolvedValue([]),
    },
  }
})

const STATUSES: PortalStatus[] = [
  'submitted',
  'in_review',
  'live',
  'rejected',
  'expired',
  'failed',
]

function sampleRow(overrides: Partial<TrackerRow> = {}): TrackerRow {
  return {
    distribution_attempt_id: 'att_1',
    job_id: 'job_1',
    listing: {
      id: 'lst_1',
      address_line: 'Marina Gate 2 · Apt 1205',
      thumbnail_url: null,
    },
    portal: {
      code: 'property_finder',
      display_name: 'Property Finder',
      channel_token_key: 'publishing.realestate.property_finder',
    },
    submitted_at: '2026-09-07T12:14:22Z',
    updated_at: '2026-09-07T14:22:15Z',
    status: 'live',
    error_class: null,
    error_message: null,
    credits_charged: 3,
    portal_live_url: null,
    ...overrides,
  }
}

function emptySummary() {
  return {
    scope: {
      from: '2026-09-01T00:00:00.000Z',
      to: '2026-09-30T23:59:59.999Z',
      filters_applied: { status: [], portal: [], listing_id: null },
    },
    total_submissions: 0,
    success_rate: 0,
    credits_spent: 0,
    top_failure_class: null,
  }
}

function wrap(ui: ReactElement, path = '/publish/tracker') {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/publish/tracker" element={ui} />
          <Route path="*" element={ui} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  navigateMock.mockReset()
  listMock.mockResolvedValue({ rows: [], next_cursor: null, has_more: false, total: 0 })
  summaryMock.mockResolvedValue(emptySummary())
  notificationsMock.mockResolvedValue({ notifications: [] })
})

describe('PortalStatusPill — glyph + label (AGT-PUB-006)', () => {
  it.each(STATUSES)('renders glyph and label for %s (never colour-alone)', (status) => {
    const { container } = render(<PortalStatusPill status={status} />)
    const pill = container.querySelector('span[aria-label]')
    expect(pill).toBeTruthy()
    expect(pill?.querySelector('svg')).toBeTruthy()
    expect(pill?.textContent?.trim().length).toBeGreaterThan(0)
  })

  it('keeps REJECTED and FAILED visually distinct via token classes', () => {
    const { rerender, container } = render(<PortalStatusPill status="rejected" />)
    const rejected = container.querySelector('span[aria-label]')?.className || ''
    expect(rejected).toMatch(/status-closed/)
    expect(rejected).not.toMatch(/status-danger/)

    rerender(<PortalStatusPill status="failed" />)
    const failed = container.querySelector('span[aria-label]')?.className || ''
    expect(failed).toMatch(/status-danger/)
    expect(failed).not.toMatch(/status-closed/)
  })
})

describe('TrackerEmptyState', () => {
  it('renders never-published empty with primary CTA', async () => {
    const onPublish = vi.fn()
    const user = userEvent.setup()
    render(
      <TrackerEmptyState variant="never_published" onPublishFirst={onPublish} />,
    )
    expect(screen.getByRole('heading', { name: /No portal submissions yet/i })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Publish your first listing/i }))
    expect(onPublish).toHaveBeenCalled()
  })

  it('renders filters-empty without illustration CTA clear', async () => {
    const onClear = vi.fn()
    const user = userEvent.setup()
    render(<TrackerEmptyState variant="filters" onClearFilters={onClear} />)
    expect(screen.getByRole('heading', { name: /No submissions match these filters/i })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Clear filters/i }))
    expect(onClear).toHaveBeenCalled()
  })
})

describe('TrackerFilterBar', () => {
  it('shows Clear filters when a status filter is active and clears on click', async () => {
    const user = userEvent.setup()
    let filters: TrackerFilters = { ...EMPTY_TRACKER_FILTERS, status: ['rejected'] }
    const onChange = vi.fn((next: TrackerFilters) => {
      filters = next
    })
    const onClear = vi.fn()
    const { rerender } = render(
      <TrackerFilterBar filters={filters} onChange={onChange} onClear={onClear} />,
    )
    expect(screen.getByRole('button', { name: /Clear filters/i })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Clear filters/i }))
    expect(onClear).toHaveBeenCalled()

    rerender(
      <TrackerFilterBar
        filters={EMPTY_TRACKER_FILTERS}
        onChange={onChange}
        onClear={onClear}
      />,
    )
    expect(screen.queryByRole('button', { name: /Clear filters/i })).toBeNull()
  })
})

describe('PortalTrackerRow', () => {
  it('uses PortalStatusPill and navigates to /publish/receipts/:jobId', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    const row = sampleRow({ status: 'rejected', job_id: 'job_abc' })
    expect(receiptPathForRow(row)).toBe('/publish/receipts/job_abc')

    render(
      <ul>
        <PortalTrackerRow row={row} layout="mobile" onNavigate={onNavigate} />
      </ul>,
    )
    expect(screen.getByLabelText(/Not accepted/i)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Marina Gate/i }))
    expect(onNavigate).toHaveBeenCalledWith('/publish/receipts/job_abc')
  })
})

describe('PortalTrackerScreen empty + filter states', () => {
  it('shows never-published empty when API returns zero rows', async () => {
    wrap(
      <PortalTrackerScreen
        filters={EMPTY_TRACKER_FILTERS}
        onFiltersChange={vi.fn()}
        onNavigate={navigateMock}
      />,
    )
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /No portal submissions yet/i })).toBeTruthy()
    })
    expect(listMock).toHaveBeenCalled()
    expect(summaryMock).toHaveBeenCalled()
  })

  it('shows filters-empty when filters active and zero rows', async () => {
    const filters: TrackerFilters = { ...EMPTY_TRACKER_FILTERS, status: ['failed'] }
    wrap(
      <PortalTrackerScreen
        filters={filters}
        onFiltersChange={vi.fn()}
        onNavigate={navigateMock}
      />,
    )
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /No submissions match these filters/i })).toBeTruthy()
    })
  })

  it('renders mixed-status rows with PortalStatusPill labels', async () => {
    listMock.mockResolvedValue({
      rows: [
        sampleRow({ distribution_attempt_id: 'a1', status: 'live', job_id: 'j1' }),
        sampleRow({
          distribution_attempt_id: 'a2',
          status: 'failed',
          job_id: 'j2',
          listing: { id: 'l2', address_line: 'Business Bay · Office 22F', thumbnail_url: null },
        }),
      ],
      next_cursor: null,
      has_more: false,
      total: 2,
    })
    summaryMock.mockResolvedValue({
      ...emptySummary(),
      total_submissions: 2,
      success_rate: 0.5,
      credits_spent: 6,
    })

    wrap(
      <PortalTrackerScreen
        filters={EMPTY_TRACKER_FILTERS}
        onFiltersChange={vi.fn()}
        onNavigate={navigateMock}
      />,
    )

    await waitFor(() => {
      expect(screen.getAllByLabelText(/^Live$/i).length).toBeGreaterThan(0)
      expect(screen.getAllByLabelText(/Delivery failed/i).length).toBeGreaterThan(0)
    })
    expect(screen.getByText(/Submissions this month/i)).toBeTruthy()
  })
})

describe('PortalTrackerPage URL hydration', () => {
  it('hydrates status filter from query string', async () => {
    listMock.mockResolvedValue({ rows: [], next_cursor: null, has_more: false, total: 0 })
    wrap(<PortalTrackerPage />, '/publish/tracker?status=rejected')
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /No submissions match these filters/i })).toBeTruthy()
    })
    const toolbar = screen.getByRole('toolbar', { name: /Filter portal submissions/i })
    expect(within(toolbar).getByRole('button', { name: /Clear filters/i })).toBeTruthy()
  })
})
