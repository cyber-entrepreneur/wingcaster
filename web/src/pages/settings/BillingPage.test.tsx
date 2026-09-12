// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'
import { BillingPage } from './BillingPage'

const apiMock = vi.hoisted(() => ({
  getTenantSubscription: vi.fn(),
  getTenantInvoices: vi.fn(),
  getMyNotificationPreferences: vi.fn(),
  updateMyNotificationPreferences: vi.fn(),
  createBillingPortalSession: vi.fn(),
  testBillingNotification: vi.fn(),
}))

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>('@/api/client')
  return { ...actual, api: apiMock }
})

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ agent: { id: 'u1', name: 'Ada' }, loading: false }),
}))

vi.mock('@/hooks/useTenant', () => ({
  useTenant: () => ({
    activeTenant: { id: 't1', name: 'Elite Real Estate' },
    tenants: [],
    loading: false,
  }),
}))

describe('BillingPage matrix autosave', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.getTenantSubscription.mockResolvedValue({
      subscription: {
        id: 's1',
        status: 'ACTIVE',
        display_name: 'Wingcaster Semsar',
        monthly_price_minor: 4900,
        billing_cycle_end: '2026-10-15T00:00:00.000Z',
      },
      tenant_id: 't1',
    })
    apiMock.getTenantInvoices.mockResolvedValue({ invoices: [] })
    apiMock.getMyNotificationPreferences.mockResolvedValue({
      event_kinds: ['invoice_sent', 'payment_failed'],
      preferences: [
        { event_kind: 'invoice_sent', channel: 'email', enabled: true },
        { event_kind: 'payment_failed', channel: 'email', enabled: false },
      ],
    })
    apiMock.updateMyNotificationPreferences.mockResolvedValue({ preferences: [] })
  })

  it('autosaves a notification toggle', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <ToastProvider>
          <BillingPage />
        </ToastProvider>
      </MemoryRouter>,
    )
    const checkbox = await screen.findByLabelText('Invoice sent — Email')
    expect(checkbox).toBeChecked()
    await user.click(checkbox)
    await waitFor(() => {
      expect(apiMock.updateMyNotificationPreferences).toHaveBeenCalledWith([
        { event_kind: 'invoice_sent', channel: 'email', enabled: false },
      ])
    })
  })
})
