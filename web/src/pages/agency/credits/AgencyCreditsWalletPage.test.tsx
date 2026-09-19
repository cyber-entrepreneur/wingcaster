// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'

const apiMock = vi.hoisted(() => ({
  getAgencyWalletOverview: vi.fn(),
  updateAgencyWalletSettings: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  api: apiMock,
}))

const authMock = vi.hoisted(() => ({
  agent: {
    id: 'user-owner-1',
    name: 'Owner',
    affiliation: { agency_id: 'agency-1', role: 'owner' as string | undefined },
  } as { id: string; name: string; affiliation: { agency_id: string; role: string | undefined } },
}))

vi.mock('@/context/AuthContext', () => ({ useAuth: () => authMock }))
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

import { AgencyCreditsWalletPage } from './AgencyCreditsWalletPage'

const OVERVIEW = {
  agency_id: 'agency-1',
  balance: {
    credits_remaining: 120,
    credits_reserved: 5,
    currency: 'USD',
    hard_block: false,
  },
  kpis: {
    wallet_balance: 120,
    mtd_spend: 40,
    burn_rate_daily: 2,
    days_until_exhausted: 60,
    allocated_to_agents: 80,
    total_available: 195,
  },
  allocation: {
    slices: [
      { key: 'agent-1', label: 'Agent One', credits: 80, kind: 'agent' as const },
      { key: 'unallocated', label: 'Unallocated pool', credits: 120, kind: 'pool' as const },
    ],
    allocated_total: 80,
    unallocated_pool: 120,
  },
  transactions: [
    {
      id: 'tx-1',
      type: 'consumption',
      amount: 5,
      description: 'WhatsApp draft',
      created_at: '2026-09-01T12:00:00.000Z',
    },
  ],
  settings: {
    agency_id: 'agency-1',
    low_balance_alert_threshold: 100,
    updated_by: null,
    updated_at: null,
    is_default: true,
  },
  alerts: {
    is_low_balance: false,
    threshold: 100,
  },
  permissions: {
    can_manage_settings: true,
    can_top_up: false,
    can_allocate: true,
  },
}

function renderPage() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/agency/credits']}>
        <AgencyCreditsWalletPage />
      </MemoryRouter>
    </ToastProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.agent.affiliation.role = 'owner'
  apiMock.getAgencyWalletOverview.mockResolvedValue(OVERVIEW)
  apiMock.updateAgencyWalletSettings.mockResolvedValue({
    settings: { ...OVERVIEW.settings, low_balance_alert_threshold: 75, is_default: false },
  })
})

afterEach(() => {
  cleanup()
})

describe('AgencyCreditsWalletPage', () => {
  it('loads wallet overview and shows KPI strip', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Agency wallet')).toBeInTheDocument()
    })
    expect(screen.getByText('Wallet balance')).toBeInTheDocument()
    expect(screen.getByText('MTD spend')).toBeInTheDocument()
    expect(apiMock.getAgencyWalletOverview).toHaveBeenCalledTimes(1)
  })

  it('shows low-balance banner when pool is below threshold', async () => {
    apiMock.getAgencyWalletOverview.mockResolvedValue({
      ...OVERVIEW,
      alerts: { is_low_balance: true, threshold: 100 },
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Low balance')).toBeInTheDocument()
    })
  })

  it('shows forbidden state for members without finance/read-only access', async () => {
    authMock.agent.affiliation.role = 'member'
    apiMock.getAgencyWalletOverview.mockRejectedValue({ status: 403 })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/need owner, admin, finance, or read-only access/i)).toBeInTheDocument()
    })
  })

  it('saves alert threshold from the settings dialog', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /set alert threshold/i })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /set alert threshold/i }))
    const input = screen.getByRole('textbox', { name: /threshold \(credits\)/i })
    await user.clear(input)
    await user.type(input, '75')
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => {
      expect(apiMock.updateAgencyWalletSettings).toHaveBeenCalledWith(75)
    })
  })
})
