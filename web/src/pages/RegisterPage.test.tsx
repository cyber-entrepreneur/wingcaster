// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'
import { BrandProvider } from '@/context/BrandContext'

const navigateMock = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

const authMock = vi.hoisted(() => ({
  agent: null as unknown,
  loading: false,
  refreshAgent: vi.fn(),
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
  const actual = await vi.importActual<typeof import('@/context/BrandContext')>(
    '@/context/BrandContext',
  )
  return {
    ...actual,
    useMode: () => ['light', vi.fn()] as const,
  }
})

const registerApiMock = vi.hoisted(() => ({
  postAuthRegister: vi.fn(),
  adoptRegisterToken: vi.fn(),
}))
vi.mock('@/components/auth/registerApi', async () => {
  const actual = await vi.importActual<typeof import('@/components/auth/registerApi')>(
    '@/components/auth/registerApi',
  )
  return {
    ...actual,
    postAuthRegister: registerApiMock.postAuthRegister,
    adoptRegisterToken: registerApiMock.adoptRegisterToken,
  }
})

vi.mock('@/components/auth/loginApi', async () => {
  const actual = await vi.importActual<typeof import('@/components/auth/loginApi')>(
    '@/components/auth/loginApi',
  )
  return {
    ...actual,
    startOAuth: vi.fn(),
  }
})

import { RegisterPage } from './RegisterPage'
import { RegisterApiError } from '@/components/auth/registerApi'

function renderAt(path = '/register') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BrandProvider>
        <ToastProvider>
          <Routes>
            <Route path="/register" element={<RegisterPage />} />
          </Routes>
        </ToastProvider>
      </BrandProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.agent = null
  authMock.loading = false
  registerApiMock.postAuthRegister.mockResolvedValue({
    user: {
      id: 'u1',
      display_name: 'Sara',
      identifier_type: 'email',
      identifier_masked: 's***@example.com',
    },
    tenant: { id: 't1', name: 'personal', role: 'personal' },
    session: { token: 'tok', expires_at: '2099-01-01' },
    redirect_to: '/onboarding/welcome',
  })
})

describe('RegisterPage', () => {
  it('starts with path selector only; identity hidden', () => {
    renderAt()
    expect(screen.getByTestId('register-page')).toBeInTheDocument()
    expect(screen.getByText(/Create your WingCaster account/i)).toBeInTheDocument()
    expect(screen.queryByTestId('identity-form')).not.toBeInTheDocument()
    expect(screen.queryByTestId('oauth-trio')).not.toBeInTheDocument()
  })

  it('pre-selects path from query and reveals identity', () => {
    renderAt('/register?path=solo')
    expect(screen.getByTestId('path-card-solo')).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('identity-form')).toBeInTheDocument()
    expect(screen.getByTestId('oauth-trio')).toBeInTheDocument()
  })

  it('path=join reveals PathBFields and prefills agency slug', () => {
    renderAt('/register?path=join&agency=elite-real-estate')
    expect(screen.getByTestId('path-b-fields')).toBeInTheDocument()
    expect(screen.getByLabelText(/Agency slug/i)).toHaveValue('elite-real-estate')
  })

  it('path=agency reveals PathCFields', () => {
    renderAt('/register?path=agency')
    expect(screen.getByTestId('path-c-fields')).toBeInTheDocument()
  })

  it('posts register body for solo email path and redirects', async () => {
    const user = userEvent.setup()
    renderAt('/register?path=solo&plan=semsar')

    await user.type(screen.getByPlaceholderText('you@example.com'), 'sara@example.com')
    await user.type(screen.getByPlaceholderText('Choose a strong password'), 'Abcdefgh1!')
    await user.click(screen.getByRole('checkbox', { name: /Terms of Service/i }))
    await user.click(screen.getByRole('button', { name: 'Continue →' }))

    await waitFor(() => expect(registerApiMock.postAuthRegister).toHaveBeenCalled())
    const body = registerApiMock.postAuthRegister.mock.calls[0][0]
    expect(body.path).toBe('solo')
    expect(body.identity.type).toBe('email')
    expect(body.identity.identifier).toBe('sara@example.com')
    expect(body.consents.terms).toBe(true)
    expect(body.plan).toBe('semsar')
    expect(body.path_data).toEqual({})
    expect(registerApiMock.adoptRegisterToken).toHaveBeenCalledWith('tok')
    expect(navigateMock).toHaveBeenCalledWith('/onboarding/welcome', { replace: true })
  })

  it('opens dup-identity modal without leaking dimension', async () => {
    const user = userEvent.setup()
    registerApiMock.postAuthRegister.mockRejectedValue(
      new RegisterApiError('FREE_TRIAL_ALREADY_CLAIMED', {
        code: 'FREE_TRIAL_ALREADY_CLAIMED',
      }),
    )
    renderAt('/register?path=solo')

    await user.type(screen.getByPlaceholderText('you@example.com'), 'sara@example.com')
    await user.type(screen.getByPlaceholderText('Choose a strong password'), 'Abcdefgh1!')
    await user.click(screen.getByRole('checkbox', { name: /Terms of Service/i }))
    await user.click(screen.getByRole('button', { name: 'Continue →' }))

    await waitFor(() => expect(screen.getByTestId('dup-identity-modal')).toBeInTheDocument())
    expect(screen.getByTestId('dup-identity-modal').textContent).not.toMatch(
      /email was matched|phone was matched/i,
    )
  })
})
