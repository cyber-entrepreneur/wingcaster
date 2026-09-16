// @vitest-environment jsdom
/**
 * Page-level coverage for ApiTokensPage (issue #192a).
 *
 * The four contracts that matter:
 *   - Empty state renders when list returns no tokens
 *   - Create-flow opens dialog, PUTs, and surfaces the raw token exactly once
 *   - Revoke flow calls DELETE and flips the row to Revoked without a reload
 *   - Server-side errors on create surface via toast without dismissing the
 *     dialog (user gets to retry with the same inputs)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'

const apiMock = vi.hoisted(() => ({
  listApiTokens: vi.fn(),
  createApiToken: vi.fn(),
  revokeApiToken: vi.fn(),
}))
vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

// clipboard mock — jsdom does not implement writeText. Copy button click
// paths in the component fall back to a toast on rejection, so a stub that
// resolves is enough to keep the happy path free of console noise.
Object.defineProperty(navigator, 'clipboard', {
  configurable: true,
  value: { writeText: () => Promise.resolve() },
})

import { ApiTokensPage } from './ApiTokensPage'

const NOW = '2026-09-16T00:00:00Z'

function renderPage() {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <ApiTokensPage />
      </MemoryRouter>
    </ToastProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  apiMock.listApiTokens.mockResolvedValue({ tokens: [] })
})

afterEach(() => {
  cleanup()
})

describe('ApiTokensPage', () => {
  it('renders empty state when the user has no tokens', async () => {
    renderPage()
    expect(await screen.findByText(/No tokens yet\./i)).toBeInTheDocument()
    expect(apiMock.listApiTokens).toHaveBeenCalled()
  })

  it('creates a token and shows the raw value exactly once', async () => {
    const user = userEvent.setup()
    apiMock.createApiToken.mockResolvedValue({
      token: 'wc_pat_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdef',
      record: {
        id: 't-new',
        name: 'CRM sync',
        scopes: ['listings:read'],
        last_used_at: null,
        expires_at: null,
        revoked_at: null,
        created_at: NOW,
        agency_id: null,
      },
    })
    renderPage()

    await user.click(await screen.findByRole('button', { name: /New token/i }))
    await user.type(screen.getByLabelText(/^Name$/i), 'CRM sync')
    await user.click(screen.getByRole('checkbox', { name: /Read listings/i }))
    await user.click(screen.getByRole('button', { name: /^Create token$/i }))

    await waitFor(() =>
      expect(apiMock.createApiToken).toHaveBeenCalledWith({
        name: 'CRM sync',
        scopes: ['listings:read'],
        expires_at: null,
      }),
    )
    // Raw-value dialog appears once and shows the value.
    expect(await screen.findByText(/Copy your token now/i)).toBeInTheDocument()
    expect(
      screen.getByText(/wc_pat_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdef/),
    ).toBeInTheDocument()
    // "I've saved it" dismissal button exists — user's one chance to move on.
    expect(screen.getByRole('button', { name: /I've saved it/i })).toBeInTheDocument()
  })

  it('revokes a token and flips its row to Revoked without a reload', async () => {
    apiMock.listApiTokens.mockResolvedValue({
      tokens: [
        {
          id: 't-1',
          name: 'Zapier',
          scopes: [],
          last_used_at: NOW,
          expires_at: null,
          revoked_at: null,
          created_at: NOW,
          agency_id: null,
        },
      ],
    })
    apiMock.revokeApiToken.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Revoke token Zapier/i }))
    await user.click(screen.getByRole('button', { name: /^Revoke token$/i }))
    await waitFor(() => expect(apiMock.revokeApiToken).toHaveBeenCalledWith('t-1'))
    // Row now shows "Revoked" badge (no full page reload).
    expect(await screen.findByText(/^Revoked$/i)).toBeInTheDocument()
  })

  it('surfaces backend error on create via toast without dismissing the dialog', async () => {
    const user = userEvent.setup()
    apiMock.createApiToken.mockRejectedValue(
      Object.assign(new Error('token_limit_reached'), { status: 409 }),
    )
    renderPage()

    await user.click(await screen.findByRole('button', { name: /New token/i }))
    await user.type(screen.getByLabelText(/^Name$/i), 'Overflow')
    await user.click(screen.getByRole('button', { name: /^Create token$/i }))

    expect(await screen.findByText(/Could not create token/i)).toBeInTheDocument()
    // Dialog stays open so user can retry / adjust.
    expect(screen.getByLabelText(/^Name$/i)).toBeInTheDocument()
  })

  it('disables Create button when name is empty', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: /New token/i }))
    expect(screen.getByRole('button', { name: /^Create token$/i })).toBeDisabled()
  })
})
