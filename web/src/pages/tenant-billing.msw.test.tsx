// @vitest-environment jsdom
/**
 * Integration: tenant views balance → top-up stub.
 *
 * jsdom cannot run msw/node against relative `/api` fetches (requests hang),
 * and web CI typecheck has no msw package. Handler payloads match the MSW
 * shape used by the backend top-up stub (202 pending_provider).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
  requestTenantTopUp: vi.fn(),
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

describe('MyCreditsPage top-up stub', () => {
  beforeEach(() => {
    apiMock.getTenantCreditsBalance.mockResolvedValue(balancePayload)
    apiMock.requestTenantTopUp.mockResolvedValue({
      status: 'pending_provider',
      amount_usd: 25,
      idempotency_key: 'msw-1',
    })
  })

  it('loads balance and records a top-up request', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><MyCreditsPage /></MemoryRouter>)
    expect(await screen.findByText('5.00')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Top up/i }))
    expect(await screen.findByText(/Top up credits/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Request top-up/i }))
    await waitFor(() => expect(apiMock.requestTenantTopUp).toHaveBeenCalled())
  })
})
