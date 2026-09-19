// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'

const apiMock = vi.hoisted(() => ({
  getAgencyFeatureQuotas: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  api: apiMock,
}))

const authMock = vi.hoisted(() => ({
  agent: {
    id: 'user-owner-1',
    affiliation: { agency_id: 'agency-1', role: 'owner' as string | undefined },
  } as { id: string; affiliation: { agency_id: string; role: string | undefined } },
}))

vi.mock('@/context/AuthContext', () => ({ useAuth: () => authMock }))
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

import { AgencyCreditsLayout } from './AgencyCreditsLayout'
import { AgencyFeatureQuotasPage } from './AgencyFeatureQuotasPage'

const QUOTAS = {
  agency_id: 'agency-1',
  billing_cycle_start: '2026-09-01T00:00:00.000Z',
  billing_cycle_end: '2026-10-01T00:00:00.000Z',
  groups: [
    {
      key: 'social',
      label: 'Social',
      quotas: [
        {
          enabled: true,
          registered: true,
          feature_code: 'publishing.social.instagram',
          display_name: 'Instagram publish',
          category_group: 'social',
          quota_used_this_cycle: 5000,
          quota_display: 10000,
          typical_monthly: 10000,
          usage_ratio: 0.5,
          soft_warning: false,
          at_cap: false,
          near_cap: false,
          used_credits: 50,
          typical_credits: 100,
          agent_breakdown: [
            {
              agent_user_id: 'agent-1',
              agent_name: 'Agent One',
              used_credits: 50,
              source: 'agent' as const,
            },
          ],
        },
      ],
    },
  ],
  quotas: [],
}

function renderPage() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/agency/credits/quotas']}>
        <Routes>
          <Route path="/agency/credits" element={<AgencyCreditsLayout />}>
            <Route path="quotas" element={<AgencyFeatureQuotasPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.agent.affiliation.role = 'owner'
  apiMock.getAgencyFeatureQuotas.mockResolvedValue(QUOTAS)
})

afterEach(() => {
  cleanup()
})

describe('AgencyFeatureQuotasPage', () => {
  it('loads grouped quotas on mount', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Social')).toBeInTheDocument()
    })
    expect(screen.getByText('Instagram publish')).toBeInTheDocument()
    expect(apiMock.getAgencyFeatureQuotas).toHaveBeenCalledTimes(1)
  })

  it('expands per-agent breakdown', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /agents/i })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /agents/i }))
    expect(screen.getByText('Agent One')).toBeInTheDocument()
  })

  it('shows forbidden state for unauthorized members', async () => {
    authMock.agent.affiliation.role = 'member'
    apiMock.getAgencyFeatureQuotas.mockRejectedValue({ status: 403 })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/finance, marketer, or read-only access/i)).toBeInTheDocument()
    })
  })
})
