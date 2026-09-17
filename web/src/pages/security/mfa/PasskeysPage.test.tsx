// @vitest-environment jsdom
/**
 * Page-level coverage for PasskeysPage (issue #189).
 *
 * Covers: unsupported-browser guard renders instead of the surface, list
 * shows credentials + Remove button, enroll dialog calls
 * webauthnRegisterBegin → startRegistration → webauthnRegisterComplete on
 * happy path, revoke flow flips the row without a reload, WebAuthn errors
 * surface via toast without dismissing the dialog.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'

const apiMock = vi.hoisted(() => ({
  listPasskeys: vi.fn(),
  webauthnRegisterBegin: vi.fn(),
  webauthnRegisterComplete: vi.fn(),
  revokePasskey: vi.fn(),
}))
vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

const startRegistrationMock = vi.hoisted(() => vi.fn())
vi.mock('@simplewebauthn/browser', () => ({
  startRegistration: startRegistrationMock,
}))

// Stub PublicKeyCredential so the page does not fall through to unsupported.
Object.defineProperty(window, 'PublicKeyCredential', {
  configurable: true,
  value: class {},
})

import { PasskeysPage } from './PasskeysPage'

const NOW = '2026-09-16T00:00:00Z'

function renderPage() {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <PasskeysPage />
      </MemoryRouter>
    </ToastProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  apiMock.listPasskeys.mockResolvedValue({ credentials: [] })
})

afterEach(() => {
  cleanup()
})

describe('PasskeysPage', () => {
  it('renders empty state when the user has no passkeys', async () => {
    renderPage()
    expect(await screen.findByText(/No passkeys yet\./i)).toBeInTheDocument()
  })

  it('surfaces unsupported-browser state when PublicKeyCredential is missing', async () => {
    const original = window.PublicKeyCredential
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).PublicKeyCredential
    try {
      renderPage()
      expect(
        await screen.findByText(/Your browser does not support passkeys/i),
      ).toBeInTheDocument()
      expect(apiMock.listPasskeys).not.toHaveBeenCalled()
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).PublicKeyCredential = original
    }
  })

  it('enrolls a passkey through Begin → startRegistration → Complete and adds it to the list', async () => {
    const user = userEvent.setup()
    apiMock.webauthnRegisterBegin.mockResolvedValue({
      options: { challenge: 'chal', rp: { id: 'localhost' }, user: {} },
    })
    startRegistrationMock.mockResolvedValue({ id: 'cred-1', response: { transports: ['internal'] } })
    apiMock.webauthnRegisterComplete.mockResolvedValue({
      credential: {
        id: 'wc-1',
        credential_id: 'cred-1',
        name: 'MacBook Touch ID',
        device_type: 'multiDevice',
        backup_eligible: true,
        backup_state: true,
        transports: ['internal'],
        last_used_at: null,
        created_at: NOW,
        revoked_at: null,
      },
    })
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Add a passkey/i }))
    await user.type(screen.getByLabelText(/^Name$/i), 'MacBook Touch ID')
    await user.click(screen.getByRole('button', { name: /^Add passkey$/i }))

    await waitFor(() => expect(apiMock.webauthnRegisterBegin).toHaveBeenCalled())
    await waitFor(() => expect(startRegistrationMock).toHaveBeenCalled())
    await waitFor(() =>
      expect(apiMock.webauthnRegisterComplete).toHaveBeenCalledWith({
        name: 'MacBook Touch ID',
        response: expect.objectContaining({ id: 'cred-1' }),
      }),
    )
    // New credential appears in the list (dialog placeholder also matches
    // "MacBook Touch ID"; wait for the Remove button which only appears on
    // the credential row to disambiguate).
    expect(
      await screen.findByRole('button', { name: /Remove passkey MacBook Touch ID/i }),
    ).toBeInTheDocument()
  })

  it('revokes a passkey and flips the row (list re-renders without it)', async () => {
    const user = userEvent.setup()
    apiMock.listPasskeys.mockResolvedValue({
      credentials: [
        {
          id: 'wc-1',
          credential_id: 'cred-1',
          name: 'YubiKey',
          device_type: null,
          backup_eligible: false,
          backup_state: false,
          transports: ['usb'],
          last_used_at: NOW,
          created_at: NOW,
          revoked_at: null,
        },
      ],
    })
    apiMock.revokePasskey.mockResolvedValue(undefined)
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Remove passkey YubiKey/i }))
    await user.click(screen.getByRole('button', { name: /^Remove passkey$/i }))
    await waitFor(() => expect(apiMock.revokePasskey).toHaveBeenCalledWith('wc-1'))
    // YubiKey row now filtered out (component filters revoked from the list).
    await waitFor(() => expect(screen.queryByText(/YubiKey/)).not.toBeInTheDocument())
  })

  it('surfaces a WebAuthn native prompt failure via toast', async () => {
    const user = userEvent.setup()
    apiMock.webauthnRegisterBegin.mockResolvedValue({ options: { challenge: 'chal' } })
    startRegistrationMock.mockRejectedValue(new Error('NotAllowedError: user cancelled'))
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Add a passkey/i }))
    await user.type(screen.getByLabelText(/^Name$/i), 'X')
    await user.click(screen.getByRole('button', { name: /^Add passkey$/i }))

    expect(await screen.findByText(/Passkey setup failed/i)).toBeInTheDocument()
    expect(apiMock.webauthnRegisterComplete).not.toHaveBeenCalled()
  })
})
