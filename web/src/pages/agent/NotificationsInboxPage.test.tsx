// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { NotificationsInboxPage } from './NotificationsInboxPage'

const apiMocks = vi.hoisted(() => ({
  getMyInboxNotifications: vi.fn(),
  markMyInboxNotificationRead: vi.fn(),
  markMyInboxNotificationsAllRead: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  api: {
    getMyInboxNotifications: apiMocks.getMyInboxNotifications,
    markMyInboxNotificationRead: apiMocks.markMyInboxNotificationRead,
    markMyInboxNotificationsAllRead: apiMocks.markMyInboxNotificationsAllRead,
  },
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    agent: { id: 'agent-1', name: 'Agent' },
    user: { id: 'user-1' },
  }),
}))

vi.mock('@/hooks/useLocale', () => ({
  useLocale: () => ({ locale: 'en' }),
}))

vi.mock('@/lib/usePageTitle', () => ({
  usePageTitle: () => undefined,
}))

vi.mock('@/lib/useOnlineStatus', () => ({
  useOnlineStatus: () => true,
}))

const sampleNotifications = [
  {
    id: 'n1',
    title: 'Inquiry SLA overdue',
    snippet: 'Reply to Marina lead',
    timestamp: '2026-09-18T10:00:00.000Z',
    unread: true,
    category: 'leads' as const,
    href: '/inbox',
  },
  {
    id: 'n2',
    title: 'Portal submission live',
    snippet: 'Bayut listing is live',
    timestamp: '2026-09-17T10:00:00.000Z',
    unread: false,
    category: 'publications' as const,
    href: '/publishing/tracker',
  },
]

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/notifications']}>
      <Routes>
        <Route path="/notifications" element={<NotificationsInboxPage />} />
        <Route path="/notification-preferences" element={<div data-testid="prefs-page">prefs</div>} />
        <Route path="/inbox" element={<div data-testid="inbox-page">inbox</div>} />
        <Route path="/publishing/tracker" element={<div data-testid="tracker-page">tracker</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('NotificationsInboxPage', () => {
  beforeEach(() => {
    sessionStorage.clear()
    apiMocks.getMyInboxNotifications.mockImplementation(() =>
      Promise.resolve({ notifications: sampleNotifications, unreadCount: 1 }),
    )
    apiMocks.markMyInboxNotificationRead.mockImplementation(() => Promise.resolve({ success: true }))
    apiMocks.markMyInboxNotificationsAllRead.mockImplementation(() =>
      Promise.resolve({ success: true, marked: 1 }),
    )
  })

  it('renders AGT-NPF-001 inbox with filters, grouping, and preferences link', async () => {
    renderPage()
    const page = await screen.findByTestId('notifications-inbox-page')
    expect(page).toHaveAttribute('data-screen', 'AGT-NPF-001')
    expect(await screen.findByText('Inquiry SLA overdue')).toBeInTheDocument()
    expect(screen.getByText('Portal submission live')).toBeInTheDocument()
    expect(screen.getByLabelText('Notification preferences')).toHaveAttribute('href', '/notification-preferences')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Unread' }))
    expect(screen.queryByText('Portal submission live')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'All' }))
    await user.click(screen.getByRole('button', { name: 'Mark all read' }))
    expect(apiMocks.markMyInboxNotificationsAllRead).toHaveBeenCalled()
  })
})
