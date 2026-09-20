// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PaidCampaignBuilderPage } from './PaidCampaignBuilderPage'

const apiMocks = vi.hoisted(() => ({
  getPaidAdsChannels: vi.fn(),
  getAudiences: vi.fn(),
  createPaidAdExecution: vi.fn(),
  addToast: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  api: apiMocks,
  setAuthToken: vi.fn(),
  API_BASE: '/api',
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast: apiMocks.addToast }),
}))

vi.mock('@/lib/usePageTitle', () => ({
  usePageTitle: () => undefined,
}))

function renderBuilder() {
  return render(
    <MemoryRouter initialEntries={['/campaigns/paid/new']}>
      <Routes>
        <Route path="/campaigns/paid/new" element={<PaidCampaignBuilderPage />} />
        <Route path="/journeys" element={<div>journeys</div>} />
        <Route path="/settings/channels" element={<div>channels</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  apiMocks.addToast.mockReset()
  apiMocks.getPaidAdsChannels.mockReset().mockResolvedValue({
    channels: [
      {
        platform: 'meta_ads',
        kind: 'paid',
        honest_state: 'connect_pending_approval',
        approval: {
          approved: false,
          state: 'pending_approval',
          message: 'Connect your ad account; live delivery waits on Meta/Google app review',
        },
        connection: { id: 'chn_meta_1' },
        message: 'Connect your ad account; live delivery waits on Meta/Google app review',
      },
      {
        platform: 'google_ads',
        kind: 'paid',
        honest_state: 'connect_pending_approval',
        approval: { approved: false, state: 'pending_approval', message: 'pending' },
        connection: null,
        message: 'pending',
      },
    ],
  })
  apiMocks.getAudiences.mockReset().mockResolvedValue([
    { id: 'aud_1', name: 'Dubai buyers', type: 'dynamic', rules: {}, member_source: 'crm' },
  ])
  apiMocks.createPaidAdExecution.mockReset().mockResolvedValue({
    id: 'exec_paid_1',
    kind: 'paid_ad',
    status: 'draft',
    objective: 'traffic',
    budget_micros: 50_000_000,
    currency: 'USD',
  })
})

afterEach(() => cleanup())

describe('PaidCampaignBuilderPage', () => {
  it('renders honest pending-approval state and creates a paid execution', async () => {
    const user = userEvent.setup()
    renderBuilder()

    await waitFor(() => {
      expect(screen.getByText(/Connect \+ pending approval/i)).toBeTruthy()
    })
    expect(screen.getByText('PROVIDER_NOT_APPROVED')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Next/i }))
    await user.clear(screen.getByLabelText(/Daily budget/i))
    await user.type(screen.getByLabelText(/Daily budget/i), '75')
    await user.click(screen.getByRole('button', { name: /Next/i }))
    await user.selectOptions(screen.getByLabelText(/Audience/i), 'aud_1')
    await user.click(screen.getByRole('button', { name: /Next/i }))
    await user.type(screen.getByLabelText(/Creative id/i), 'cre_1')
    await user.click(screen.getByRole('button', { name: /Next/i }))

    expect(screen.getByRole('heading', { name: /Review/i })).toBeTruthy()
    expect(screen.getByText('connect_pending_approval')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Create paid execution/i }))
    await waitFor(() => {
      expect(apiMocks.createPaidAdExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          channel_connection_id: 'chn_meta_1',
          objective: 'traffic',
          budget_micros: 75_000_000,
          audience_id: 'aud_1',
          creative_id: 'cre_1',
        }),
      )
    })
    await waitFor(() => {
      expect(screen.getByText(/exec_paid_1/)).toBeTruthy()
    })
  })
})
