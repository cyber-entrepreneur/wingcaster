// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'
import { StepUpProvider } from '@/components/mfa'
import { DeleteAccountPage } from './DeleteAccountPage'

const apiMock = vi.hoisted(() => ({
  initiateDeleteAccount: vi.fn(),
  regenerateDeleteAccountWord: vi.fn(),
  resendDeleteAccountEmail: vi.fn(),
  confirmDeleteAccount: vi.fn(),
  cancelDeleteAccount: vi.fn(),
}))

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>('@/api/client')
  return { ...actual, api: apiMock }
})

vi.mock('@/components/mfa', async () => {
  const actual = await vi.importActual<typeof import('@/components/mfa')>('@/components/mfa')
  return {
    ...actual,
    useStepUp: () => ({ requireStepUp: async () => ({ elevatedToken: 'test-elevated' }) }),
  }
})

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    agent: { id: 'u1', name: 'Sara', email: 'sara.almansoori@propertyfinder.ae' },
    loading: false,
  }),
}))

function wrap() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <StepUpProvider>
          <DeleteAccountPage />
        </StepUpProvider>
      </ToastProvider>
    </MemoryRouter>,
  )
}

describe('DeleteAccountPage step order', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.initiateDeleteAccount.mockRejectedValue(Object.assign(new Error('missing'), { status: 404 }))
    apiMock.confirmDeleteAccount.mockRejectedValue(Object.assign(new Error('missing'), { status: 404 }))
  })

  it('walks confirm intent → email → TOTP → scheduled', async () => {
    const user = userEvent.setup()
    wrap()

    expect(screen.getByRole('heading', { name: 'Delete Account' })).toBeInTheDocument()
    expect(screen.getByText(/30-day cool-down/i)).toBeInTheDocument()
    const continueBtn = screen.getByRole('button', { name: 'Continue to email verification' })
    expect(continueBtn).toBeDisabled()

    const word = screen.getByTestId('liveness-word').textContent || ''
    await user.type(screen.getByLabelText('Type the word above'), word)
    await user.selectOptions(screen.getByLabelText('Why are you leaving?'), 'prefer_not')
    expect(continueBtn).toBeEnabled()
    await user.click(continueBtn)

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue to verification' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Continue to verification' }))

    expect(await screen.findByRole('heading', { name: 'One more step' })).toBeInTheDocument()
    expect(screen.getByLabelText('Verification code')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Digit 1 of 6'), '123456')
    await user.click(screen.getByRole('button', { name: 'Verify and delete' }))

    expect(await screen.findByRole('heading', { name: /Your account will be deleted on/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel Deletion' })).toBeInTheDocument()
  })
})
