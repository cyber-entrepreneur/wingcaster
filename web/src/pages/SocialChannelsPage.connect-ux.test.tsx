// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'

const apiMock = vi.hoisted(() => ({
  getSocialChannelsConfig: vi.fn(),
  getSocialChannels: vi.fn(),
  upsertSocialChannel: vi.fn(),
  startSocialOAuth: vi.fn(),
  disconnectSocialChannel: vi.fn(),
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ agent: { id: 'agent-1' }, loading: false }),
}))
vi.mock('@/hooks/useUiMode', () => ({ useUiMode: () => ({ shouldRenderPro: false }) }))
vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))
vi.mock('@/components/social-channels/PersonalConnectionsPanel', () => ({
  PersonalConnectionsPanel: () => <div>Personal accounts panel</div>,
}))
vi.mock('@/components/paid-ads/PaidChannelsPanel', () => ({
  PaidChannelsPanel: () => <div>Paid ads panel</div>,
}))

import { SocialChannelsPage } from './SocialChannelsPage'

const xSpec = {
  model: 'oauth',
  supported_methods: ['oauth', 'manual'],
  primary_method: 'oauth',
  oauth_configured: true,
  target_fields: [{ key: 'x_handle', label: 'X handle', required: false, secret: false }],
}

const facebookSpec = {
  model: 'enterprise',
  supported_methods: ['manual', 'oauth'],
  primary_method: 'manual',
  oauth_configured: false,
  target_fields: [{ key: 'fb_page_id', label: 'Facebook Page ID', required: true, secret: false }],
}

function renderPage() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/settings/channels']}>
        <SocialChannelsPage />
      </MemoryRouter>
    </ToastProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  apiMock.getSocialChannelsConfig.mockResolvedValue({
    connection_fields: {
      x: xSpec,
      facebook: facebookSpec,
    },
  })
  apiMock.getSocialChannels.mockResolvedValue([])
  apiMock.upsertSocialChannel.mockResolvedValue({})
  apiMock.startSocialOAuth.mockResolvedValue({ auth_url: 'https://oauth.test/start', state: 'st', dev: false })
})

afterEach(() => {
  cleanup()
})

describe('SocialChannelsPage connect UX', () => {
  it('shows oauth-primary card with manual fallback for configured oauth platforms', async () => {
    renderPage()

    expect(await screen.findByRole('button', { name: /Connect with X/i })).toBeInTheDocument()
    expect(screen.getByText('OAuth recommended')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Connect manually instead/i })).toBeInTheDocument()
  })

  it('shows manual-primary card when oauth is unconfigured', async () => {
    renderPage()

    expect(await screen.findByText('Facebook Page')).toBeInTheDocument()
    expect(screen.getByText('manual connection')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Connect with Facebook/i })).not.toBeInTheDocument()
  })

  it('reveals manual form from oauth-primary fallback and saves', async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByRole('button', { name: /Connect with X/i })
    await user.click(screen.getByRole('button', { name: /Connect manually instead/i }))

    const input = screen.getByLabelText(/X handle/i)
    await user.type(input, '@agent')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(apiMock.upsertSocialChannel).toHaveBeenCalledWith('x', {
        enterprise_targets: { x_handle: '@agent' },
      })
    })
  })

  it('shows re-authorise affordance when health is reauth_required', async () => {
    apiMock.getSocialChannels.mockResolvedValue([
      {
        id: 'conn-x',
        platform: 'x',
        account_name: '@agent',
        status: 'connected',
        health: 'reauth_required',
        connect_method: 'oauth',
        handle: '@agent',
        enterprise_targets: {},
        token_status: {
          connected: true,
          method: 'oauth',
          scope: 'tweet.write',
          expires_at: '2026-01-01T00:00:00.000Z',
          health: 'reauth_required',
        },
        updated_at: '2026-09-21T00:00:00.000Z',
      },
    ])

    renderPage()

    expect(await screen.findByRole('button', { name: 'Re-authorise' })).toBeInTheDocument()
    expect(screen.getByText(/Re-authorisation required/i)).toBeInTheDocument()
    expect(screen.getByText(/Connected as/)).toHaveTextContent('@agent')
    expect(screen.getByText(/Scope:/)).toBeInTheDocument()
  })
})
