// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { NotificationsInboxPage } from './NotificationsInboxPage'

const apiMocks = vi.hoisted(() => ({
  getMyInboxNotifications: vi.fn(),
  markMyInboxNotificationRead: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  api: {
    getMyInboxNotifications: apiMocks.getMyInboxNotifications,
    markMyInboxNotificationRead: apiMocks.markMyInboxNotificationRead,
    markMyInboxNotificationsAllRead: vi.fn(),
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

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/notifications']}>
      <Routes>
        <Route path="/notifications" element={<NotificationsInboxPage />} />
        <Route path="/inbox" element={<div data-testid="inbox-page">inbox</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('NotificationsInboxPage states', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('shows empty state when inbox has no rows', async () => {
    apiMocks.getMyInboxNotifications.mockImplementation(() =>
      Promise.resolve({ notifications: [], unreadCount: 0 }),
    )
    renderPage()
    expect(await screen.findByText("You're all caught up.")).toBeInTheDocument()
  })

  it('marks unread notification read and deep-links on tap', async () => {
    apiMocks.getMyInboxNotifications.mockImplementation(() =>
      Promise.resolve({
        notifications: [
          {
            id: 'n1',
            title: 'Inquiry SLA overdue',
            snippet: 'Reply to Marina lead',
            timestamp: '2026-09-18T10:00:00.000Z',
            unread: true,
            category: 'leads',
            href: '/inbox',
          },
        ],
        unreadCount: 1,
      }),
    )
    apiMocks.markMyInboxNotificationRead.mockImplementation(() => Promise.resolve({ success: true }))
    renderPage()
    await userEvent.setup().click(await screen.findByRole('button', { name: /Inquiry SLA overdue/i }))
    expect(apiMocks.markMyInboxNotificationRead).toHaveBeenCalledWith('n1')
    expect(screen.getByTestId('inbox-page')).toBeInTheDocument()
  })

  it('shows error and retries load', async () => {
    apiMocks.getMyInboxNotifications
      .mockImplementationOnce(() => Promise.reject(new Error('Network down')))
      .mockImplementationOnce(() =>
        Promise.resolve({
          notifications: [
            {
              id: 'n1',
              title: 'Recovered',
              snippet: 'Back online',
              timestamp: '2026-09-18T10:00:00.000Z',
              unread: true,
              category: 'system',
            },
          ],
          unreadCount: 1,
        }),
      )

    renderPage()
    expect(await screen.findByText('Network down')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Recovered')).toBeInTheDocument()
  })
})
