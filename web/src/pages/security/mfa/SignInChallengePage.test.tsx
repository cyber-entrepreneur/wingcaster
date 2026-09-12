// @vitest-environment jsdom
/**
 * SHR-MFA-004 / 004b — TOTP challenge and backup-code sign-in.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'
import { LoginFlow } from './LoginFlow'

const navigateMock = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

const apiMock = vi.hoisted(() => ({
  twoFactorChallenge: vi.fn(),
}))
vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>('@/api/client')
  return {
    ...actual,
    api: { ...actual.api, twoFactorChallenge: apiMock.twoFactorChallenge },
    setAuthToken: vi.fn(),
    clearElevatedToken: vi.fn(),
  }
})

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    agent: null,
    loading: false,
    refreshAgent: vi.fn(),
  }),
}))

vi.mock('@/hooks/useLocale', () => ({
  useLocale: () => ({
    locale: 'en' as const,
    setLocale: vi.fn(async () => ({ ok: true as const })),
    dir: 'ltr' as const,
    isArabic: false,
  }),
}))

vi.mock('@/components/nav/LanguageSelector', () => ({
  LanguageSelector: () => <div data-testid="language-selector">Language</div>,
}))

function renderFlow(url: string) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[url]}>
        <LoginFlow />
      </MemoryRouter>
    </ToastProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  apiMock.twoFactorChallenge.mockResolvedValue({
    token: 'jwt',
    agent: { id: '1', email: 'a@b.com' },
    factor_used: 'totp',
  })
})

describe('SHR-MFA-004 TOTP challenge', () => {
  it('redeems a TOTP code and offers the backup-code path', async () => {
    const user = userEvent.setup()
    renderFlow('/login?stage=2fa&challenge_id=ch-1')

    expect(await screen.findByRole('heading', { name: /Verify it['’]s you/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Verify$/i })).toBeDisabled()

    await user.type(screen.getByLabelText('Digit 1 of 6'), '123456')
    await user.click(screen.getByRole('button', { name: /^Verify$/i }))

    await waitFor(() => expect(apiMock.twoFactorChallenge).toHaveBeenCalledWith('ch-1', '123456'))
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/dashboard', { replace: true }))
  })

  it('routes to backup sign-in with the same challenge id', async () => {
    const user = userEvent.setup()
    renderFlow('/login?stage=2fa&challenge_id=ch-1')
    await user.click(await screen.findByRole('button', { name: /Use a backup code instead/i }))
    expect(navigateMock).toHaveBeenCalledWith(
      '/login?stage=backup&challenge_id=ch-1',
      expect.objectContaining({ state: expect.objectContaining({ challenge_id: 'ch-1' }) }),
    )
  })
})

describe('SHR-MFA-004b backup code sign-in', () => {
  it('submits a normalized backup code', async () => {
    const user = userEvent.setup()
    apiMock.twoFactorChallenge.mockResolvedValue({
      token: 'jwt',
      factor_used: 'backup_code',
    })
    renderFlow('/login?stage=backup&challenge_id=ch-1')

    expect(await screen.findByRole('heading', { name: /Enter a backup code/i })).toBeInTheDocument()
    await user.type(screen.getByLabelText(/^Backup code$/i), 'abcdefghjk')
    await user.click(screen.getByRole('button', { name: /^Verify$/i }))

    await waitFor(() => expect(apiMock.twoFactorChallenge).toHaveBeenCalledWith('ch-1', 'ABCDEFGHJK'))
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/dashboard', { replace: true }))
  })
})
