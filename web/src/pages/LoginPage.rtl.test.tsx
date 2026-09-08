// @vitest-environment jsdom
/**
 * RTL coverage for SHR-AUT-001 sign-in + Phase 7f/2 second-factor branch.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'

expect.extend(toHaveNoViolations)

const navigateMock = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

const authMock = vi.hoisted(() => ({
  completeTwoFactor: vi.fn(),
  refreshAgent: vi.fn(),
  agent: null as unknown,
  loading: false,
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => authMock }))

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

vi.mock('@/context/BrandContext', async () => {
  const actual = await vi.importActual<typeof import('@/context/BrandContext')>('@/context/BrandContext')
  return {
    ...actual,
    useMode: () => ['light', vi.fn()] as const,
    useBrand: () => ({
      brand: { name: 'Wingcaster' },
      setBrand: vi.fn(),
      loading: false,
      mode: 'light',
      setMode: vi.fn(),
    }),
  }
})

const loginApiMock = vi.hoisted(() => ({
  postAuthLogin: vi.fn(),
  adoptLoginToken: vi.fn(),
  startOAuth: vi.fn(),
}))
vi.mock('@/components/auth/loginApi', async () => {
  const actual = await vi.importActual<typeof import('@/components/auth/loginApi')>(
    '@/components/auth/loginApi',
  )
  return {
    ...actual,
    postAuthLogin: loginApiMock.postAuthLogin,
    adoptLoginToken: loginApiMock.adoptLoginToken,
    startOAuth: loginApiMock.startOAuth,
  }
})

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>('@/api/client')
  return {
    ...actual,
    clearElevatedToken: vi.fn(),
    setAuthToken: vi.fn(),
  }
})

import { LoginPage } from './LoginPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  )
}

async function signIn(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^Email$/i), 'agent@example.com')
  await user.type(screen.getByLabelText(/^Password$/i), 'hunter2')
  await user.click(screen.getByRole('button', { name: /^Sign in$/i }))
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.agent = null
  authMock.loading = false
  authMock.completeTwoFactor.mockResolvedValue(undefined)
  authMock.refreshAgent.mockResolvedValue(undefined)
  loginApiMock.postAuthLogin.mockResolvedValue({ status: 'signed_in', token: 'tok' })
  loginApiMock.adoptLoginToken.mockResolvedValue(undefined)
  loginApiMock.startOAuth.mockResolvedValue(undefined)
})

describe('LoginPage — six-path chrome', () => {
  it('renders federated providers and identifier tabs', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /Sign in with Google/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sign in with Apple/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sign in with Facebook/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^Email$/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^Username$/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^Phone$/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Welcome back\./i })).toBeInTheDocument()
    expect(screen.getByLabelText(/Keep me signed in on this device/i)).not.toBeChecked()
  })

  it('posts identifier_type email on sign-in', async () => {
    const user = userEvent.setup()
    renderPage()
    await signIn(user)

    await waitFor(() =>
      expect(loginApiMock.postAuthLogin).toHaveBeenCalledWith({
        identifier: 'agent@example.com',
        identifier_type: 'email',
        password: 'hunter2',
        remember_me: false,
      }),
    )
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/dashboard', { replace: true }))
  })

  it('clears identifier when switching tabs but keeps password', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByLabelText(/^Email$/i), 'agent@example.com')
    await user.type(screen.getByLabelText(/^Password$/i), 'hunter2')
    await user.click(screen.getByRole('tab', { name: /^Username$/i }))
    expect(screen.getByLabelText(/^Username$/i)).toHaveValue('')
    expect(screen.getByLabelText(/^Password$/i)).toHaveValue('hunter2')
  })
})

describe('LoginPage — no second factor', () => {
  it('navigates straight to the dashboard', async () => {
    const user = userEvent.setup()
    renderPage()
    await signIn(user)

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/dashboard', { replace: true }))
    expect(screen.queryByText(/Two-factor authentication/i)).not.toBeInTheDocument()
  })
})

describe('LoginPage — second factor required', () => {
  beforeEach(() => {
    loginApiMock.postAuthLogin.mockResolvedValue({
      status: '2fa_required',
      challenge_id: 'ch-1',
      method: 'totp',
    })
  })

  it('swaps to the code prompt instead of signing in', async () => {
    const user = userEvent.setup()
    renderPage()
    await signIn(user)

    expect(await screen.findByText(/Two-factor authentication/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Authentication or backup code/i)).toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('mentions backup codes so a lost phone is not a dead end', async () => {
    const user = userEvent.setup()
    renderPage()
    await signIn(user)
    expect(await screen.findByText(/backup codes/i)).toBeInTheDocument()
  })

  it('redeems the challenge and then navigates', async () => {
    const user = userEvent.setup()
    renderPage()
    await signIn(user)

    await user.type(await screen.findByLabelText(/Authentication or backup code/i), '123456')
    await user.click(screen.getByRole('button', { name: /^Verify$/i }))

    await waitFor(() => expect(authMock.completeTwoFactor).toHaveBeenCalledWith('ch-1', '123456'))
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/dashboard', { replace: true }))
  })

  it('surfaces a rejected code, clears the field and stays put', async () => {
    const user = userEvent.setup()
    authMock.completeTwoFactor.mockRejectedValueOnce(new Error('Invalid code'))
    renderPage()
    await signIn(user)

    const input = await screen.findByLabelText(/Authentication or backup code/i)
    await user.type(input, '000000')
    await user.click(screen.getByRole('button', { name: /^Verify$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/Invalid code/i)
    expect(input).toHaveValue('')
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('lets the user back out to the password form', async () => {
    const user = userEvent.setup()
    renderPage()
    await signIn(user)

    await user.click(await screen.findByRole('button', { name: /Back to sign in/i }))
    expect(screen.getByLabelText(/^Email$/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Authentication or backup code/i)).not.toBeInTheDocument()
  })

  it('labels the emailed-code variant for users without an authenticator', async () => {
    const user = userEvent.setup()
    loginApiMock.postAuthLogin.mockResolvedValue({
      status: '2fa_required',
      challenge_id: 'ch-2',
      method: 'email',
    })
    renderPage()
    await signIn(user)

    expect(await screen.findByLabelText(/Emailed code/i)).toBeInTheDocument()
  })

  it('has no axe violations on the challenge step', async () => {
    const user = userEvent.setup()
    const { container } = renderPage()
    await signIn(user)
    await screen.findByLabelText(/Authentication or backup code/i)
    expect(await axe(container)).toHaveNoViolations()
  })
})
