// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AiAdaptiveComposer } from './AiAdaptiveComposer'
import { api } from '@/api/client'

vi.mock('@/api/client', () => ({
  api: {
    getSocialCardPlatforms: vi.fn(),
    generateListingCreative: vi.fn(),
    updateCreativeVariant: vi.fn(),
    approveCreative: vi.fn(),
    publishCreative: vi.fn(),
  },
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}))

const property = {
  id: 'lst_1',
  title: 'Hamra 2-bed',
  description: 'Bright apartment in Hamra',
  agent_id: 'agt_1',
} as const

const mockBundle = {
  creative: {
    id: 'cre_1',
    approval_state: 'pending',
    source: 'ai',
    status: 'ready',
    channel_keys: ['instagram_feed'],
  },
  variants: [{
    id: 'crv_1',
    label: 'Warm lifestyle',
    copy: { instagram_feed: 'Hello Hamra' },
    renditions: [{
      id: 'rnd_1',
      channel_key: 'instagram_feed',
      width: 1080,
      height: 1080,
      asset_url: '/uploads/test.png',
      provider: 'local',
      status: 'ready',
    }],
  }],
  approval_request: { id: 'apr_1', state: 'pending' },
}

describe('AiAdaptiveComposer', () => {
  beforeEach(() => {
    vi.mocked(api.getSocialCardPlatforms).mockResolvedValue({
      platforms: [{ key: 'instagram_feed', label: 'Instagram feed', width: 1080, height: 1080, aspect: '1:1' }],
    })
    vi.mocked(api.generateListingCreative).mockResolvedValue(mockBundle as never)
    vi.mocked(api.updateCreativeVariant).mockResolvedValue({ variant: mockBundle.variants[0] } as never)
    vi.mocked(api.approveCreative).mockResolvedValue({
      ...mockBundle,
      creative: { ...mockBundle.creative, approval_state: 'approved' },
    } as never)
    vi.mocked(api.publishCreative).mockResolvedValue({
      creative_id: 'cre_1',
      results: [{ variant_id: 'crv_1', channel_key: 'instagram_feed', platform: 'instagram', status: 'published' }],
    } as never)
  })

  it('renders gallery after generate and calls publish on selection', async () => {
    const user = userEvent.setup()
    render(<AiAdaptiveComposer property={property as never} />)

    await user.click(screen.getByRole('button', { name: /generate variants/i }))
    await waitFor(() => expect(api.generateListingCreative).toHaveBeenCalled())

    expect(screen.getByRole('list', { name: /variant gallery/i })).toBeInTheDocument()
    expect(screen.getByText(/pending approval/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /approve/i }))
    await waitFor(() => expect(api.approveCreative).toHaveBeenCalledWith('cre_1', { decision: 'approved' }))

    await user.click(screen.getByRole('button', { name: /select variant/i }))
    await user.click(screen.getByRole('button', { name: /publish selected/i }))
    await waitFor(() => expect(api.publishCreative).toHaveBeenCalled())
  })
})
