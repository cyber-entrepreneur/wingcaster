// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PromoteDistributeModal } from './PromoteDistributeModal'

const apiMocks = vi.hoisted(() => ({
  getTenantCreditsBalance: vi.fn(),
  distributeOwn: vi.fn(),
  submitToFi: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  api: apiMocks,
}))

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

describe('PromoteDistributeModal (AGT-PUB-002)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.getTenantCreditsBalance.mockResolvedValue({
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
    apiMocks.distributeOwn.mockResolvedValue([{ platform: 'instagram', status: 'pending_retry' }])
  })

  it('renders AGT-PUB-002 screen marker', async () => {
    render(
      <PromoteDistributeModal
        open
        mode="promote"
        property={property}
        platforms={platforms}
        myConnections={connections}
        fiAccounts={[]}
        whatsappRecipient=""
        onClose={vi.fn()}
        onDone={vi.fn()}
      />,
    )
    await waitFor(() => {
      expect(screen.getByTestId('publish-per-channel-modal')).toHaveAttribute('data-screen', 'AGT-PUB-002')
    })
  })

  it('shows per-channel caption tabs when multiple channels are selected', async () => {
    const user = userEvent.setup()
    render(
      <PromoteDistributeModal
        open
        mode="promote"
        property={property}
        platforms={platforms}
        myConnections={connections}
        fiAccounts={[]}
        whatsappRecipient=""
        onClose={vi.fn()}
        onDone={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: /instagram/i }))
    await user.click(screen.getByRole('button', { name: /x \(twitter\)/i }))

    expect(screen.getByRole('tab', { name: 'Instagram' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'X (Twitter)' })).toBeInTheDocument()
    expect(screen.getByText(/total:/i)).toBeInTheDocument()
  })

  it('submits per-channel captions to distributeOwn', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    render(
      <PromoteDistributeModal
        open
        mode="promote"
        property={property}
        platforms={platforms}
        myConnections={connections}
        fiAccounts={[]}
        whatsappRecipient=""
        onClose={vi.fn()}
        onDone={onDone}
      />,
    )

    await user.click(screen.getByRole('button', { name: /instagram/i }))
    const caption = screen.getByPlaceholderText(/marina apartment/i)
    await user.clear(caption)
    await user.type(caption, 'IG-specific copy')
    await user.click(screen.getByRole('button', { name: /promote now/i }))

    await waitFor(() => {
      expect(apiMocks.distributeOwn).toHaveBeenCalledWith(
        'prop_1',
        ['instagram'],
        expect.objectContaining({
          captions: { instagram: 'IG-specific copy' },
        }),
      )
    })
    expect(onDone).toHaveBeenCalled()
  })
})
