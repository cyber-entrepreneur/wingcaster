// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { PlansPage } from './PlansPage'
import { MySubscriptionPage } from './MySubscriptionPage'
import { MyCreditsPage } from './MyCreditsPage'
import { MyCreditNotesPage } from './MyCreditNotesPage'
import { MyInvoicesPage } from './MyInvoicesPage'

const apiMock = vi.hoisted(() => ({
  getTenantPlans: vi.fn(),
  getTenantSubscription: vi.fn(),
  getTenantCreditsBalance: vi.fn(),
  getTenantCreditNotes: vi.fn(),
  getTenantInvoices: vi.fn(),
  requestTenantTopUp: vi.fn(),
  previewTenantPlanChange: vi.fn(),
  changeTenantPlan: vi.fn(),
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

const toastMock = vi.hoisted(() => ({ addToast: vi.fn() }))
vi.mock('@/components/ui/toast', () => ({
  useToast: () => toastMock,
}))

const quota = {
  enabled: true,
  registered: true,
  feature_code: 'publishing.social.instagram',
  display_name: 'Instagram publish',
  quota_used_this_cycle: 100,
  quota_display: 100,
  typical_monthly: 100,
  usage_ratio: 1,
  soft_warning: true,
  used_credits: 1,
  typical_credits: 1,
}

beforeEach(() => {
  vi.clearAllMocks()
  apiMock.getTenantPlans.mockResolvedValue({
    plans: [{
      package_id: 'p1', code: 'free-agent', display_name: 'Free Agent', tier: 'free',
      target_audience: 'agent', billing_cadence: 'monthly', currency: 'USD',
      version_id: 'v1', version_number: 1, properties_covered: 0, monthly_price_minor: 0, state: 'PUBLISHED',
    }],
  })
  apiMock.getTenantSubscription.mockResolvedValue({
    subscription: {
      id: 's1', status: 'ACTIVE', package_code: 'free-agent', display_name: 'Free Agent',
      properties_committed: 0, billing_cycle_start: '2026-09-01T00:00:00.000Z',
      billing_cycle_end: '2026-10-01T00:00:00.000Z', auto_renew: true,
    },
    tenant_id: 't1',
  })
  apiMock.getTenantCreditsBalance.mockResolvedValue({
    tenant_id: 't1', public_tenant_id: 'personal:u1', scope: 'personal',
    credits_remaining: 12.5, credits_reserved: 0, credits_remaining_units: 1250,
    credits_reserved_units: 0, currency: 'USD', hard_block: false, quotas: [quota],
  })
  apiMock.getTenantCreditNotes.mockResolvedValue({ credit_notes: [] })
  apiMock.getTenantInvoices.mockResolvedValue({ invoices: [] })
  apiMock.requestTenantTopUp.mockResolvedValue({
    status: 'pending_provider', amount_usd: 25, idempotency_key: 'k1',
  })
})

describe('tenant billing pages', () => {
  it('PlansPage renders published plans', async () => {
    render(<MemoryRouter><PlansPage /></MemoryRouter>)
    expect(await screen.findByText('Free Agent')).toBeInTheDocument()
    expect(screen.getByText(/Choose a published package/i)).toBeInTheDocument()
  })

  it('MySubscriptionPage shows current status', async () => {
    render(<MemoryRouter><MySubscriptionPage /></MemoryRouter>)
    expect(await screen.findByText('ACTIVE')).toBeInTheDocument()
  })

  it('MyCreditsPage shows balance, soft warning, and top-up', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><MyCreditsPage /></MemoryRouter>)
    expect(await screen.findByText('12.50')).toBeInTheDocument()
    expect(screen.getByText(/soft warning/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Top up/i }))
    expect(await screen.findByText(/Top up credits/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Request top-up/i }))
    await waitFor(() => expect(apiMock.requestTenantTopUp).toHaveBeenCalled())
  })

  it('MyCreditNotesPage empty state', async () => {
    render(<MemoryRouter><MyCreditNotesPage /></MemoryRouter>)
    expect(await screen.findByText(/No credit notes yet/i)).toBeInTheDocument()
  })

  it('MyInvoicesPage empty state', async () => {
    render(<MemoryRouter><MyInvoicesPage /></MemoryRouter>)
    expect(await screen.findByText(/No invoices yet/i)).toBeInTheDocument()
  })
})
