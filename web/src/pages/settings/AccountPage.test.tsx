// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'
import { AccountPage } from './AccountPage'

const updateProfile = vi.fn()
const refreshAgent = vi.fn()

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    agent: {
      id: 'u1',
      name: 'Sara Al Mansoori',
      email: 'sara.almansoori@example.com',
      phone: '+971512345678',
      slug: 'sara.almansoori',
      verified: 1,
      preferred_locale: 'en',
      preferred_timezone: 'Asia/Dubai',
    },
    loading: false,
    updateProfile,
    refreshAgent,
  }),
}))

vi.mock('@/hooks/useLocale', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useLocale')>('@/hooks/useLocale')
  return {
    ...actual,
    persistPreferredLocale: vi.fn().mockResolvedValue(undefined),
    useLocale: () => ({ locale: 'en', setLocale: vi.fn() }),
  }
})

describe('AccountPage save', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateProfile.mockResolvedValue({ slug: 'sara.new' })
    refreshAgent.mockResolvedValue(undefined)
  })

  it('enables username save and calls updateProfile', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <ToastProvider>
          <AccountPage />
        </ToastProvider>
      </MemoryRouter>,
    )
    expect(await screen.findByLabelText('Username')).toBeInTheDocument()
    const username = screen.getByLabelText('Username')
    await user.clear(username)
    await user.type(username, 'saranew')
    expect(screen.getByRole('button', { name: 'Save username' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Save username' }))
    expect(updateProfile).toHaveBeenCalledWith({ slug: 'saranew' })
  })
})
