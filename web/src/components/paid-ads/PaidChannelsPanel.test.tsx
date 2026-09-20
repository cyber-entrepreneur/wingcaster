// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { PaidChannelsPanel } from '@/components/paid-ads/PaidChannelsPanel'

const apiMocks = vi.hoisted(() => ({
  getPaidAdsChannels: vi.fn(),
  connectPaidAdsChannel: vi.fn(),
  addToast: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  api: apiMocks,
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast: apiMocks.addToast }),
}))

beforeEach(() => {
  apiMocks.addToast.mockReset()
  apiMocks.getPaidAdsChannels.mockReset().mockResolvedValue({
    channels: [
      {
        platform: 'meta_ads',
        kind: 'paid',
        honest_state: 'connect_pending_approval',
        approval: { approved: false, state: 'pending_approval', message: 'pending review' },
        connection: null,
        health: 'disconnected',
        message: 'pending review',
      },
      {
        platform: 'google_ads',
        kind: 'paid',
        honest_state: 'connect_pending_approval',
        approval: { approved: false, state: 'pending_approval', message: 'pending review' },
        connection: null,
        health: 'disconnected',
        message: 'pending review',
      },
    ],
  })
  apiMocks.connectPaidAdsChannel.mockReset().mockResolvedValue({
    connection: { id: 'chn_1' },
    honest_state: 'connect_pending_approval',
  })
})

afterEach(() => cleanup())

describe('PaidChannelsPanel', () => {
  it('shows honest connect + pending approval for Meta and Google', async () => {
    render(<PaidChannelsPanel />)
    await waitFor(() => {
      expect(screen.getByText('Meta Ads')).toBeTruthy()
      expect(screen.getByText('Google Ads')).toBeTruthy()
    })
    const badges = screen.getAllByText('Connect + pending approval')
    expect(badges.length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText(/Demand Gen/i)).toBeTruthy()
  })
})
