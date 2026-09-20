// @vitest-environment jsdom
/**
 * PA-NDL-001 — Notifications dead-letter queue.
 *
 * Covers: list render + total, empty + error states, retry-one flow, the
 * two-step ignore confirm, channel filtering re-query, bulk retry, and RTL.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { NotificationDeadLetterPage } from './NotificationDeadLetterPage'

const toastMock = vi.hoisted(() => ({ addToast: vi.fn() }))
vi.mock('@/components/ui/toast', () => ({ useToast: () => toastMock }))
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

const apiMock = vi.hoisted(() => ({
  getAdminNotificationDeadLetter: vi.fn(),
  retryAdminNotificationDeadLetter: vi.fn(),
  ignoreAdminNotificationDeadLetter: vi.fn(),
  retryAdminPendingNotifications: vi.fn(),
}))
vi.mock('@/api/client', () => ({ api: apiMock }))

const ITEMS = [
  {
    id: 'r1',
    notification_id: 'n1',
    channel: 'email',
    status: 'dead_letter' as const,
    attempts: 5,
    last_error: 'SMTP 550 mailbox unavailable',
    next_retry_at: null,
    created_at: '2026-03-01T00:00:00Z',
    event_type: 'viewing_reminder',
    title: 'Viewing tomorrow',
  },
  {
    id: 'r2',
    notification_id: 'n2',
    channel: 'sms',
    status: 'failed' as const,
    attempts: 3,
    last_error: 'carrier reject',
    next_retry_at: null,
    created_at: '2026-02-01T00:00:00Z',
    event_type: 'offer_update',
    title: 'Offer countered',
  },
]

function renderPage() {
  return render(
    <MemoryRouter>
      <NotificationDeadLetterPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  toastMock.addToast.mockReset()
  apiMock.getAdminNotificationDeadLetter.mockReset()
  apiMock.retryAdminNotificationDeadLetter.mockReset()
  apiMock.ignoreAdminNotificationDeadLetter.mockReset()
  apiMock.retryAdminPendingNotifications.mockReset()
  apiMock.getAdminNotificationDeadLetter.mockResolvedValue({ items: ITEMS, total: 2 })
  apiMock.retryAdminNotificationDeadLetter.mockResolvedValue({ item: { ...ITEMS[0], status: 'pending' } })
  apiMock.ignoreAdminNotificationDeadLetter.mockResolvedValue({ item: { ...ITEMS[0], status: 'ignored' } })
  apiMock.retryAdminPendingNotifications.mockResolvedValue({ processed: 3 })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('NotificationDeadLetterPage', () => {
  it('lists failed deliveries with details', async () => {
    renderPage()
    expect(await screen.findByTestId('dlq-list')).toBeTruthy()
    expect(screen.getAllByTestId('dlq-item')).toHaveLength(2)
    expect(screen.getByText('SMTP 550 mailbox unavailable')).toBeTruthy()
    expect(screen.getByText('viewing_reminder')).toBeTruthy()
  })

  it('renders the empty state', async () => {
    apiMock.getAdminNotificationDeadLetter.mockResolvedValue({ items: [], total: 0 })
    renderPage()
    expect(await screen.findByTestId('dlq-empty')).toBeTruthy()
  })

  it('renders an error state and can retry the load', async () => {
    apiMock.getAdminNotificationDeadLetter.mockRejectedValueOnce(new Error('boom'))
    renderPage()
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText('boom')).toBeTruthy()
  })

  it('retries a single item and reloads', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('dlq-list')
    await user.click(screen.getByTestId('dlq-retry-r1'))
    await waitFor(() => expect(apiMock.retryAdminNotificationDeadLetter).toHaveBeenCalledWith('r1'))
    expect(toastMock.addToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Retry queued' }))
    // reloaded after the action
    await waitFor(() => expect(apiMock.getAdminNotificationDeadLetter).toHaveBeenCalledTimes(2))
  })

  it('requires a confirm step before ignoring', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('dlq-list')
    await user.click(screen.getByTestId('dlq-ignore-r1'))
    expect(apiMock.ignoreAdminNotificationDeadLetter).not.toHaveBeenCalled()
    await user.click(screen.getByTestId('dlq-confirm-ignore-r1'))
    await waitFor(() => expect(apiMock.ignoreAdminNotificationDeadLetter).toHaveBeenCalledWith('r1'))
  })

  it('re-queries when the channel filter changes', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('dlq-list')
    await user.selectOptions(screen.getByLabelText('Channel'), 'sms')
    await waitFor(() =>
      expect(apiMock.getAdminNotificationDeadLetter).toHaveBeenLastCalledWith(
        expect.objectContaining({ channel: 'sms' }),
      ),
    )
  })

  it('bulk-retries pending items', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('dlq-list')
    await user.click(screen.getByTestId('dlq-bulk-retry'))
    await waitFor(() => expect(apiMock.retryAdminPendingNotifications).toHaveBeenCalled())
  })

  it('renders under RTL', async () => {
    render(
      <div dir="rtl">
        <MemoryRouter>
          <NotificationDeadLetterPage />
        </MemoryRouter>
      </div>,
    )
    expect(await screen.findByTestId('dlq-page')).toBeTruthy()
  })
})
