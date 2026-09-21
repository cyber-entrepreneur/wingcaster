// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'

const uiMode = vi.hoisted(() => ({ shouldRenderPro: true }))
const apiMock = vi.hoisted(() => ({
  getSocialChannelsConfig: vi.fn(),
  getSocialChannels: vi.fn(),
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ agent: { id: 'agent-1' }, loading: false }),
}))
vi.mock('@/hooks/useUiMode', () => ({ useUiMode: () => uiMode }))
vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))
vi.mock('@/components/social-channels/PersonalConnectionsPanel', () => ({
  PersonalConnectionsPanel: () => <div>Personal accounts panel</div>,
}))

import { SocialChannelsPage } from './SocialChannelsPage'

function renderPage(entry = '/settings/channels') {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[entry]}>
        <SocialChannelsPage />
      </MemoryRouter>
    </ToastProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  uiMode.shouldRenderPro = true
  apiMock.getSocialChannelsConfig.mockResolvedValue({
    connection_fields: {
      instagram: {
        model: 'oauth',
        supported_methods: ['oauth', 'manual'],
        primary_method: 'oauth',
        oauth_configured: true,
        target_fields: [],
      },
    },
  })
  apiMock.getSocialChannels.mockResolvedValue([])
})

afterEach(() => {
  cleanup()
})

describe('SocialChannelsPage personal accounts tab', () => {
  it('deep-links to the Pro personal accounts tab and switches back to setup', async () => {
    const user = userEvent.setup()
    renderPage('/settings/channels?tab=accounts')

    expect(await screen.findByText('Personal accounts panel')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'My accounts' })).toHaveAttribute('data-state', 'active')

    await user.click(screen.getByRole('tab', { name: 'Channel setup' }))
    await waitFor(() => expect(screen.queryByText('Personal accounts panel')).not.toBeInTheDocument())
  })

  it('keeps explicit primary switching out of Guided mode', async () => {
    uiMode.shouldRenderPro = false
    renderPage('/settings/channels?tab=accounts')

    await screen.findByText('Social channels')
    expect(screen.queryByRole('tab', { name: 'My accounts' })).not.toBeInTheDocument()
    expect(screen.queryByText('Personal accounts panel')).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Channel setup' })).toHaveAttribute('data-state', 'active')
  })
})
