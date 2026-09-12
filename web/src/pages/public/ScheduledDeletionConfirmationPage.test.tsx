// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'
import {
  ScheduledDeletionConfirmationPage,
  type ScheduledDeletionPayload,
} from './ScheduledDeletionConfirmationPage'

const TOKEN = 'v1.test-token.sig'

function pendingPayload(overrides: Partial<ScheduledDeletionPayload> = {}): ScheduledDeletionPayload {
  return {
    deletion_request_id: 'DEL-01H8XZ4NQR2E9K',
    status: 'scheduled',
    scheduled_for: '2026-10-07T14:22:15Z',
    deletion_date: 'Tuesday, 7 October 2026',
    days_remaining: 28,
    cancelled: false,
    cancel_available: true,
    email_masked: 's•••@p•••.ae',
    purpose: 'scheduled_deletion_view',
    ...overrides,
  }
}

function renderPage(path = `/account/scheduled-deletion/${TOKEN}`) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/account/scheduled-deletion/:token"
            element={<ScheduledDeletionConfirmationPage />}
          />
          <Route path="/login" element={<div>Login page</div>} />
          <Route path="/register" element={<div>Register page</div>} />
          <Route path="/account-recovery" element={<div>Recovery page</div>} />
          <Route path="/support/new" element={<div>Support page</div>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

describe('ScheduledDeletionConfirmationPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('loads VALID_PENDING from path token (never query auth)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => pendingPayload(),
      headers: new Headers(),
    })
    vi.stubGlobal('fetch', fetchMock)

    renderPage(`/account/scheduled-deletion/${TOKEN}?src=reminder-t-minus-7&token=EVIL`)

    await screen.findByText('Your account is scheduled for deletion')
    expect(screen.getByText('Reminder: 7 days left')).toBeInTheDocument()
    expect(screen.getByText(/Deletion was requested for s•••@p•••\.ae/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cancel deletion of account/i })).toBeInTheDocument()

    const url = String(fetchMock.mock.calls[0]?.[0] ?? '')
    expect(url).toContain(`/auth/scheduled-deletion/${encodeURIComponent(TOKEN)}`)
    expect(url).not.toContain('EVIL')
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(init.credentials).toBe('omit')
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('renders ALREADY_CANCELLED', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () =>
          pendingPayload({
            status: 'cancelled',
            cancelled: true,
            cancel_available: false,
            days_remaining: 0,
          }),
        headers: new Headers(),
      }),
    )

    renderPage()
    await screen.findByText('This deletion has already been cancelled')
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Sign in to your account/i })).toBeInTheDocument()
  })

  it('renders ALREADY_DELETED', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () =>
          pendingPayload({
            status: 'completed',
            cancelled: false,
            cancel_available: false,
          }),
        headers: new Headers(),
      }),
    )

    renderPage()
    await screen.findByText('This account has been deleted')
    expect(screen.getByRole('link', { name: /Start a new account/i })).toHaveAttribute(
      'href',
      '/register',
    )
  })

  it('renders INVALID_TOKEN on 401/404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'bad', code: 'invalid_token' }),
        headers: new Headers(),
      }),
    )

    renderPage()
    await screen.findByText("This link isn't valid")
    expect(screen.getByRole('link', { name: /Account recovery/i })).toHaveAttribute(
      'href',
      '/account-recovery',
    )
  })

  it('renders EXPIRED_TOKEN on 410', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 410,
        json: async () => ({ error: 'expired', code: 'expired' }),
        headers: new Headers(),
      }),
    )

    renderPage()
    await screen.findByText('This link has expired')
    expect(screen.getByText(/Sign in to view your deletion status/i)).toBeInTheDocument()
  })

  it('shows offline banner and disables cancel', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => pendingPayload(),
        headers: new Headers(),
      }),
    )
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => false,
    })

    renderPage()
    await screen.findByText('Your account is scheduled for deletion')
    expect(screen.getByText(/You're offline/i)).toBeInTheDocument()
    const cancel = screen.getByRole('button', { name: /Cancel deletion of account/i })
    expect(cancel).toBeDisabled()
  })

  it('POSTs cancel using path token and flips to ALREADY_CANCELLED', async () => {
    const user = userEvent.setup()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => pendingPayload(),
        headers: new Headers(),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () =>
          pendingPayload({
            status: 'cancelled',
            cancelled: true,
            cancel_available: false,
          }),
        headers: new Headers(),
      })
    vi.stubGlobal('fetch', fetchMock)
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => true,
    })

    renderPage()
    await screen.findByText('Your account is scheduled for deletion')

    await user.click(screen.getByRole('button', { name: /Cancel deletion of account/i }))

    await waitFor(() => {
      expect(screen.getByText('This deletion has already been cancelled')).toBeInTheDocument()
    })

    const cancelCall = fetchMock.mock.calls.find(
      (c) => (c[1] as RequestInit | undefined)?.method === 'POST',
    )
    expect(cancelCall).toBeTruthy()
    expect(String(cancelCall?.[0])).toContain(
      `/auth/scheduled-deletion/${encodeURIComponent(TOKEN)}/cancel`,
    )
    expect((cancelCall?.[1] as RequestInit).credentials).toBe('omit')
  })

  it('toggles impact list', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => pendingPayload(),
        headers: new Headers(),
      }),
    )

    renderPage()
    await screen.findByText('Your account is scheduled for deletion')
    const toggle = screen.getByRole('button', {
      name: /What happens when the account is deleted/i,
    })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const panel = document.getElementById('deletion-impact-panel')
    expect(panel).toBeTruthy()
    expect(within(panel as HTMLElement).getByText(/Your profile and login/i)).toBeInTheDocument()
  })
})
