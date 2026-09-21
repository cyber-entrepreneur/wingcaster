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

const linkedinSpec = {
  model: 'enterprise',
  supported_methods: ['oauth', 'manual'],
  primary_method: 'oauth',
  oauth_configured: true,
  target_fields: [{
    key: 'li_author_urn',
    label: 'LinkedIn Author URN',
    required: true,
    secret: false,
  }],
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
    connection_fields: { linkedin: linkedinSpec },
  })
  apiMock.getSocialChannels.mockResolvedValue([])
  apiMock.upsertSocialChannel.mockResolvedValue({})
  apiMock.startSocialOAuth.mockResolvedValue({ auth_url: 'https://oauth.test/linkedin', state: 'st', dev: false })
})

afterEach(() => {
  cleanup()
})

describe('SocialChannelsPage LinkedIn OAuth', () => {
  it('shows oauth-primary LinkedIn card with manual fallback', async () => {
    renderPage()

    expect(await screen.findByRole('button', { name: /Connect with LinkedIn/i })).toBeInTheDocument()
    expect(screen.getByText('OAuth recommended')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Connect manually instead/i })).toBeInTheDocument()
  })

  it('shows author picker when multiple identities are pending', async () => {
    apiMock.getSocialChannels.mockResolvedValue([
      {
        id: 'conn-li',
        platform: 'linkedin',
        account_name: 'Alex Agent',
        status: 'connected',
        health: 'healthy',
        connect_method: 'oauth',
        handle: 'Alex Agent',
        enterprise_targets: {},
        pending_author_identities: [
          { urn: 'urn:li:person:1', label: 'Alex Agent', type: 'person' },
          { urn: 'urn:li:organization:2', label: 'WingCaster HQ', type: 'organization' },
        ],
        token_status: {
          connected: true,
          method: 'oauth',
          scope: 'w_member_social',
          expires_at: '2026-12-01T00:00:00.000Z',
          health: 'healthy',
        },
        updated_at: '2026-09-21T00:00:00.000Z',
      },
    ])

    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText(/Choose the LinkedIn identity to publish as/i)).toBeInTheDocument()
    await user.click(screen.getByLabelText(/WingCaster HQ/i))
    await user.click(screen.getByRole('button', { name: 'Use this identity' }))

    await waitFor(() => {
      expect(apiMock.upsertSocialChannel).toHaveBeenCalledWith('linkedin', {
        enterprise_targets: { li_author_urn: 'urn:li:organization:2' },
      })
    })
  })
})
