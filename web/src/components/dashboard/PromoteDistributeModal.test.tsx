// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PromoteDistributeModal } from './PromoteDistributeModal'

const apiMock = vi.hoisted(() => ({
  getTenantCreditsBalance: vi.fn(),
  publishListingToSocial: vi.fn(),
  submitToFi: vi.fn(),
  createScheduledPublication: vi.fn(),
}))

vi.mock('@/api/client', () => ({ api: apiMock }))

const property = {
  id: 'prop_1',
  title: 'Marina apartment',
  city: 'Dubai',
  price: 850000,
  description: 'Sea view',
}

const platforms = [
  { id: 'instagram', name: 'Instagram' },
  { id: 'x', name: 'X (Twitter)' },
]

const connections = [
  { platform: 'instagram', status: 'connected', account_name: '@agency' },
  { platform: 'x', status: 'connected', account_name: '@agency_x' },
]

function renderModal(mode: 'promote' | 'distribute' = 'promote') {
  const onClose = vi.fn()
  const onDone = vi.fn()
  render(
    <PromoteDistributeModal
      open
      mode={mode}
      property={property}
      platforms={platforms}
      myConnections={connections}
      fiAccounts={[]}
      whatsappRecipient=""
      onClose={onClose}
      onDone={onDone}
    />,
  )
  return { onClose, onDone }
}

beforeEach(() => {
  vi.clearAllMocks()
  apiMock.getTenantCreditsBalance.mockResolvedValue({
    tenant_id: 't1',
    public_tenant_id: 't1',
    scope: 'personal',
    credits_remaining: 100,
    credits_reserved: 0,
    credits_remaining_units: 100,
    credits_reserved_units: 0,
    currency: 'USD',
    hard_block: false,
    quotas: [
      {
        feature_code: 'publishing.social.instagram',
        typical_credits: 2,
        enabled: true,
        registered: true,
        quota_used_this_cycle: 0,
        quota_display: 0,
        typical_monthly: 0,
        usage_ratio: 0,
        soft_warning: false,
      },
    ],
  })
  apiMock.publishListingToSocial.mockResolvedValue({
    results: [{ platform: 'instagram', status: 'published', external_id: 'ig-1', external_url: null, provider: 'instagram', simulated: false, error: null }],
  })
  apiMock.createScheduledPublication.mockResolvedValue({ id: 'sched-1', status: 'pending' })
})

afterEach(() => cleanup())

describe('PromoteDistributeModal (AGT-PUB-002)', () => {
  it('renders AGT-PUB-002 screen marker', async () => {
    renderModal()
    await waitFor(() => {
      expect(screen.getByTestId('publish-per-channel-modal')).toHaveAttribute('data-screen', 'AGT-PUB-002')
    })
  })

  it('shows per-channel caption tabs when multiple channels are selected', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.click(screen.getByRole('button', { name: /instagram/i }))
    await user.click(screen.getByRole('button', { name: /x \(twitter\)/i }))

    expect(screen.getByRole('tab', { name: 'Instagram' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'X (Twitter)' })).toBeInTheDocument()
    expect(screen.getByText(/total:/i)).toBeInTheDocument()
  })

  it('submits per-channel captions to publishListingToSocial', async () => {
    const user = userEvent.setup()
    const { onDone } = renderModal()

    await user.click(screen.getByRole('button', { name: /instagram/i }))
    const caption = screen.getByPlaceholderText(/marina apartment/i)
    await user.clear(caption)
    await user.type(caption, 'IG-specific copy')
    await user.click(screen.getByRole('button', { name: /promote now/i }))

    await waitFor(() => {
      expect(apiMock.publishListingToSocial).toHaveBeenCalledWith(
        'prop_1',
        expect.objectContaining({
          channels: [{ platform: 'instagram', caption: 'IG-specific copy' }],
          caption: 'IG-specific copy',
        }),
      )
    })
    expect(onDone).toHaveBeenCalled()
  })
})

describe('PromoteDistributeModal (AGT-PUB-007 schedule for later)', () => {
  it('shows Schedule for later when own social channels are selected', async () => {
    const user = userEvent.setup()
    renderModal()
    expect(screen.queryByTestId('promote-schedule-cta')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Instagram/i }))
    expect(screen.getByTestId('promote-schedule-cta')).toBeInTheDocument()
  })

  it('opens AGT-PUB-007 schedule dialog and schedules selected channels', async () => {
    const user = userEvent.setup()
    const { onClose, onDone } = renderModal()
    await user.click(screen.getByRole('button', { name: /Instagram/i }))
    await user.click(screen.getByTestId('promote-schedule-cta'))

    expect(screen.getByRole('dialog', { name: /Schedule publish/i })).toHaveAttribute('data-screen', 'AGT-PUB-007')
    await user.click(screen.getByRole('button', { name: /^Schedule$/ }))

    await waitFor(() => {
      expect(apiMock.createScheduledPublication).toHaveBeenCalledWith(
        'prop_1',
        expect.objectContaining({ portals: ['instagram'] }),
      )
    })
    await waitFor(() => {
      expect(onDone).toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
    })
  })
})
