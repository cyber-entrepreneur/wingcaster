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
  completeMetaOAuthPageSelection: vi.fn(),
  completeWhatsAppOAuthSelection: vi.fn(),
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
  supported_methods: ['oauth', 'manual'],
  primary_method: 'oauth',
  oauth_configured: true,
  target_fields: [{ key: 'fb_page_id', label: 'Facebook Page ID', required: true, secret: false }],
}

const instagramSpec = {
  model: 'enterprise',
  supported_methods: ['oauth', 'manual'],
  primary_method: 'oauth',
  oauth_configured: true,
  target_fields: [{ key: 'ig_business_account_id', label: 'Instagram Business Account ID', required: true, secret: false }],
}

const whatsappSpec = {
  model: 'enterprise',
  supported_methods: ['oauth', 'manual'],
  primary_method: 'oauth',
  oauth_configured: true,
  target_fields: [
    { key: 'wa_phone_number_id', label: 'WhatsApp Phone Number ID', required: true, secret: false },
    { key: 'wa_business_account_id', label: 'WhatsApp Business Account ID', required: true, secret: false },
  ],
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
      instagram: instagramSpec,
      whatsapp: whatsappSpec,
    },
  })
  apiMock.getSocialChannels.mockResolvedValue([])
  apiMock.upsertSocialChannel.mockResolvedValue({})
  apiMock.startSocialOAuth.mockResolvedValue({ auth_url: 'https://oauth.test/start', state: 'st', dev: false })
  apiMock.completeMetaOAuthPageSelection.mockResolvedValue({ ok: true, platform: 'facebook', connection_id: 'conn-fb' })
  apiMock.completeWhatsAppOAuthSelection.mockResolvedValue({ ok: true, platform: 'whatsapp', connection_id: 'conn-wa' })
})

afterEach(() => {
  cleanup()
})

describe('SocialChannelsPage connect UX', () => {
  it('shows oauth-primary card with manual fallback for configured oauth platforms', async () => {
    renderPage()

    expect(await screen.findByRole('button', { name: /Connect with X/i })).toBeInTheDocument()
    expect(screen.getAllByText('OAuth recommended').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole('button', { name: /Connect manually instead/i }).length).toBeGreaterThanOrEqual(1)
  })

  it('shows oauth-primary card for configured meta platforms', async () => {
    renderPage()

    expect(await screen.findByRole('button', { name: /Connect with Facebook/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Connect with Instagram/i })).toBeInTheDocument()
    expect(screen.getAllByText('OAuth recommended').length).toBeGreaterThanOrEqual(2)
  })

  it('shows page picker when oauth popup posts wingcaster:oauth:pages', async () => {
    renderPage()
    await screen.findByRole('button', { name: /Connect with Facebook/i })

    window.dispatchEvent(new MessageEvent('message', {
      data: {
        type: 'wingcaster:oauth:pages',
        platform: 'facebook',
        selection_id: 'sel-1',
        pages: [{ id: 'page-1', name: 'My Page', has_instagram: true }],
      },
    }))

    expect(await screen.findByText(/Select a Facebook Page/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'My Page' })).toBeInTheDocument()
  })

  it('reveals manual form from oauth-primary fallback and saves', async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByRole('button', { name: /Connect with X/i })
    const manualButtons = screen.getAllByRole('button', { name: /Connect manually instead/i })
    await user.click(manualButtons[manualButtons.length - 1])

    const input = screen.getByLabelText(/X handle/i)
    await user.type(input, '@agent')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(apiMock.upsertSocialChannel).toHaveBeenCalledWith('x', {
        enterprise_targets: { x_handle: '@agent' },
      })
    })
  })

  it('completes page selection via API', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('button', { name: /Connect with Facebook/i })

    window.dispatchEvent(new MessageEvent('message', {
      data: {
        type: 'wingcaster:oauth:pages',
        platform: 'facebook',
        selection_id: 'sel-1',
        pages: [{ id: 'page-1', name: 'My Page', has_instagram: false }],
      },
    }))

    await user.click(await screen.findByRole('button', { name: 'My Page' }))

    await waitFor(() => {
      expect(apiMock.completeMetaOAuthPageSelection).toHaveBeenCalledWith({
        selection_id: 'sel-1',
        page_id: 'page-1',
        platform: 'facebook',
      })
    })
  })

  it('shows oauth-primary WhatsApp card with Connect WhatsApp Business label', async () => {
    renderPage()

    expect(await screen.findByRole('button', { name: /Connect WhatsApp Business/i })).toBeInTheDocument()
    expect(screen.getAllByText('OAuth recommended').length).toBeGreaterThanOrEqual(1)
  })

  it('shows WhatsApp picker when oauth popup posts wingcaster:oauth:whatsapp', async () => {
    renderPage()
    await screen.findByRole('button', { name: /Connect WhatsApp Business/i })

    window.dispatchEvent(new MessageEvent('message', {
      data: {
        type: 'wingcaster:oauth:whatsapp',
        platform: 'whatsapp',
        selection_id: 'sel-wa-1',
        accounts: [{
          waba_id: 'waba-1',
          waba_name: 'Acme WABA',
          phone_number_id: 'phone-1',
          display_phone_number: '+1 555 0100',
          verified_name: 'Acme Realty',
        }],
      },
    }))

    expect(await screen.findByText(/Select a WhatsApp Business number/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Acme Realty/i })).toBeInTheDocument()
  })

  it('completes WhatsApp selection via API', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('button', { name: /Connect WhatsApp Business/i })

    window.dispatchEvent(new MessageEvent('message', {
      data: {
        type: 'wingcaster:oauth:whatsapp',
        platform: 'whatsapp',
        selection_id: 'sel-wa-1',
        accounts: [{
          waba_id: 'waba-1',
          waba_name: 'Acme WABA',
          phone_number_id: 'phone-1',
          display_phone_number: '+1 555 0100',
          verified_name: 'Acme Realty',
        }],
      },
    }))

    await user.click(await screen.findByRole('button', { name: /Acme Realty/i }))

    await waitFor(() => {
      expect(apiMock.completeWhatsAppOAuthSelection).toHaveBeenCalledWith({
        selection_id: 'sel-wa-1',
        phone_number_id: 'phone-1',
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
