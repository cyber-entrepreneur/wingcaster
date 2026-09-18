// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ListingShareSheet } from './ListingShareSheet'

const mockGetSharePayload = vi.fn()
const mockTrackPropertyEvent = vi.fn()
const mockAddToast = vi.fn()

vi.mock('@/api/client', () => ({
  api: {
    getSharePayload: (...args: unknown[]) => mockGetSharePayload(...args),
    trackPropertyEvent: (...args: unknown[]) => mockTrackPropertyEvent(...args),
  },
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast: mockAddToast }),
}))

vi.mock('@/lib/mobile/platform', () => ({
  isNativePlatform: () => false,
}))

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,qr'),
  },
}))

describe('ListingShareSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSharePayload.mockResolvedValue({
      title: 'Marina apartment',
      description: '2 bed with sea view',
      url: 'https://app.example/property/lst-1',
    })
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
      share: undefined,
    })
  })

  it('renders AGT-LST-007 marker and share actions', async () => {
    render(<ListingShareSheet propertyId="lst-1" open onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Share listing')).toBeInTheDocument()
    })

    expect(document.querySelector('[data-screen="AGT-LST-007"]')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Copy link/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /WhatsApp/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Instagram story/i })).toBeInTheDocument()
  })

  it('tracks copy_link telemetry', async () => {
    render(<ListingShareSheet propertyId="lst-1" open onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Copy link/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Copy link/i }))

    await waitFor(() => {
      expect(mockTrackPropertyEvent).toHaveBeenCalledWith('lst-1', {
        type: 'click',
        channel: 'share',
        referrer: 'copy_link',
      })
    })
  })
})
