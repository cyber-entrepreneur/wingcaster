// @vitest-environment jsdom
/**
 * Integration: tenant views balance → opens the top-up payment flow.
 *
 * Top-up now goes through Paddle checkout (server-issued checkout-config +
 * inline Paddle.js), not the old outbox stub. With no VITE_PADDLE_CLIENT_TOKEN
 * in the test env the checkout is unavailable, so we assert the balance loads
 * and the dialog surfaces the "Continue to payment" CTA.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { MyCreditsPage } from './MyCreditsPage'

const balancePayload = {
  tenant_id: 't1',
  public_tenant_id: 'personal:u1',
  scope: 'personal',
  credits_remaining: 5,
  credits_reserved: 0,
  credits_remaining_units: 500,
  credits_reserved_units: 0,
  currency: 'USD',
  hard_block: false,
  quotas: [] as unknown[],
}

const apiMock = vi.hoisted(() => ({
  getTenantCreditsBalance: vi.fn(),
}))

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>('@/api/client')
  return { ...actual, api: apiMock }
})

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ agent: { id: 'u1', name: 'Ada' }, loading: false }),
}))
vi.mock('@/context/StepUpContext', () => ({
  useStepUp: () => ({
    runElevated: async (action: () => Promise<unknown>) => action(),
    requireElevation: async () => true,
  }),
}))
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}))

describe('MyCreditsPage top-up', () => {
  beforeEach(() => {
    apiMock.getTenantCreditsBalance.mockResolvedValue(balancePayload)
  })

  it('loads balance and opens the top-up payment flow', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><MyCreditsPage /></MemoryRouter>)
    expect(await screen.findByText('5.00')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Top up/i }))
    expect(await screen.findByText(/Top up credits/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Continue to payment/i })).toBeInTheDocument()
  })
})
