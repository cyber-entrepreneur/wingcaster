// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlatformStatusBanner } from './PlatformStatusBanner'
import type { PlatformStatusNotice, PlatformStatusResponse } from '@/api/client'

const apiMock = vi.hoisted(() => ({ getPlatformStatus: vi.fn() }))
const localeMock = vi.hoisted(() => ({ locale: 'en' as 'en' | 'ar', dir: 'ltr' as 'ltr' | 'rtl' }))

vi.mock('@/api/client', () => ({ api: apiMock }))

// Isolate the banner from the locale/auth/broadcast chain — we only need a
// controllable { locale, dir } for the RTL assertion.
vi.mock('@/hooks/useLocale', () => ({
  useLocale: () => localeMock,
}))

function notice(overrides: Partial<PlatformStatusNotice> = {}): PlatformStatusNotice {
  return {
    id: 'n1',
    status: 'degraded',
    title: 'Instagram publishing is slow',
    body: 'Other features are working normally.',
    learn_more_url: null,
    active: true,
    starts_at: null,
    ends_at: null,
    created_at: '2026-09-18T20:00:00Z',
    updated_at: '2026-09-18T20:00:00Z',
    ...overrides,
  }
}

function resolve(response: PlatformStatusResponse) {
  apiMock.getPlatformStatus.mockResolvedValue(response)
}

beforeEach(() => {
  apiMock.getPlatformStatus.mockReset()
  sessionStorage.clear()
  localeMock.locale = 'en'
  localeMock.dir = 'ltr'
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('PlatformStatusBanner', () => {
  it('renders nothing when the platform is healthy', async () => {
    resolve({ status: 'ok', notices: [] })
    render(<PlatformStatusBanner pollMs={0} />)
    await waitFor(() => expect(apiMock.getPlatformStatus).toHaveBeenCalled())
    expect(screen.queryByTestId('platform-status-banner')).not.toBeInTheDocument()
  })

  it('renders nothing (and does not throw) when the poll fails', async () => {
    apiMock.getPlatformStatus.mockRejectedValue(new Error('network'))
    render(<PlatformStatusBanner pollMs={0} />)
    await waitFor(() => expect(apiMock.getPlatformStatus).toHaveBeenCalled())
    expect(screen.queryByTestId('platform-status-banner')).not.toBeInTheDocument()
  })

  it('shows the live notice with title, body, and level', async () => {
    resolve({ status: 'degraded', notices: [notice()] })
    render(<PlatformStatusBanner pollMs={0} />)
    const banner = await screen.findByTestId('platform-status-banner')
    expect(banner).toHaveAttribute('data-level', 'degraded')
    expect(screen.getByText('Instagram publishing is slow')).toBeInTheDocument()
    expect(screen.getByText('Other features are working normally.')).toBeInTheDocument()
  })

  it('uses role="alert" for a maintenance outage', async () => {
    resolve({ status: 'maintenance', notices: [notice({ status: 'maintenance', title: 'Scheduled maintenance' })] })
    render(<PlatformStatusBanner pollMs={0} />)
    const banner = await screen.findByTestId('platform-status-banner')
    expect(banner).toHaveAttribute('role', 'alert')
  })

  it('renders a Learn more link only when a URL is present', async () => {
    resolve({ status: 'info', notices: [notice({ status: 'info', learn_more_url: 'https://status.example.test/i/1' })] })
    render(<PlatformStatusBanner pollMs={0} />)
    await screen.findByTestId('platform-status-banner')
    const link = screen.getByRole('link', { name: 'Learn more' })
    expect(link).toHaveAttribute('href', 'https://status.example.test/i/1')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('dismisses the active notice and persists the dismissal', async () => {
    resolve({ status: 'degraded', notices: [notice()] })
    render(<PlatformStatusBanner pollMs={0} />)
    await screen.findByTestId('platform-status-banner')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(screen.queryByTestId('platform-status-banner')).not.toBeInTheDocument()
    expect(sessionStorage.getItem('wingcaster.status.dismissed')).toContain('n1::2026-09-18T20:00:00Z')
  })

  it('resurfaces a dismissed notice once it is edited (new updated_at)', async () => {
    sessionStorage.setItem('wingcaster.status.dismissed', JSON.stringify(['n1::2026-09-18T20:00:00Z']))
    resolve({ status: 'degraded', notices: [notice({ updated_at: '2026-09-18T21:30:00Z' })] })
    render(<PlatformStatusBanner pollMs={0} />)
    expect(await screen.findByTestId('platform-status-banner')).toBeInTheDocument()
  })

  it('shows the first (highest-severity) notice the server returned', async () => {
    resolve({
      status: 'maintenance',
      notices: [
        notice({ id: 'm', status: 'maintenance', title: 'Down for maintenance' }),
        notice({ id: 'd', status: 'degraded', title: 'Slow' }),
      ],
    })
    render(<PlatformStatusBanner pollMs={0} />)
    const banner = await screen.findByTestId('platform-status-banner')
    expect(banner).toHaveAttribute('data-level', 'maintenance')
    expect(screen.getByText('Down for maintenance')).toBeInTheDocument()
  })

  it('re-polls on the configured cadence', async () => {
    vi.useFakeTimers()
    try {
      resolve({ status: 'ok', notices: [] })
      render(<PlatformStatusBanner pollMs={1000} />)
      await act(async () => {
        await Promise.resolve()
      })
      expect(apiMock.getPlatformStatus).toHaveBeenCalledTimes(1)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000)
      })
      expect(apiMock.getPlatformStatus).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('mirrors the document direction for RTL', async () => {
    localeMock.locale = 'ar'
    localeMock.dir = 'rtl'
    resolve({ status: 'degraded', notices: [notice()] })
    render(<PlatformStatusBanner pollMs={0} />)
    const banner = await screen.findByTestId('platform-status-banner')
    expect(banner).toHaveAttribute('dir', 'rtl')
  })
})
