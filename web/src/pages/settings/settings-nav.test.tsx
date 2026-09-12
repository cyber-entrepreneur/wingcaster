// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'
import { SettingsPage } from '@/pages/SettingsPage'
import { settingsRoutes } from '@/pages/settings/routes'

const apiMock = vi.hoisted(() => ({
  getSettingsIndex: vi.fn(),
  twoFactorStatus: vi.fn(),
  getAuthSessions: vi.fn(),
  getTenantSubscription: vi.fn(),
  me: vi.fn(),
}))

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>('@/api/client')
  return { ...actual, api: apiMock }
})

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    agent: { id: 'u1', name: 'Sara Agent', email: 'sara@example.com' },
    loading: false,
    updateProfile: vi.fn(),
    refreshAgent: vi.fn(),
  }),
}))

const SOLO_INDEX = {
  capabilities: { billing: true, password: true, team: false },
  groups: [
    {
      id: 'account',
      label: 'Account',
      items: [{ id: 'profile', label: 'Account & profile', route: '/settings/account', icon: 'user' }],
    },
    {
      id: 'security',
      label: 'Security',
      items: [
        { id: 'two_factor', label: 'Two-factor authentication', route: '/settings/2fa', icon: 'shield' },
        { id: 'sessions', label: 'Sessions & devices', route: '/settings/sessions', icon: 'monitor' },
      ],
    },
    {
      id: 'danger',
      label: 'Danger zone',
      items: [{ id: 'delete_account', label: 'Delete account', route: '/settings/delete-account', icon: 'trash-2' }],
    },
  ],
}

function renderSettings(path = '/settings') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <Routes>
          <Route path="/settings" element={<SettingsPage />}>
            {settingsRoutes}
            <Route path="2fa" element={<div>MFA placeholder</div>} />
          </Route>
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}

describe('settings index-driven nav', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.getSettingsIndex.mockResolvedValue(SOLO_INDEX)
    apiMock.twoFactorStatus.mockResolvedValue({ totp_enabled: false })
    apiMock.getAuthSessions.mockRejectedValue(Object.assign(new Error('missing'), { status: 404 }))
    apiMock.getTenantSubscription.mockResolvedValue({ subscription: null, tenant_id: 't1' })
  })

  it('renders groups from the server and keeps hidden items hidden', async () => {
    renderSettings()
    expect(await screen.findAllByText('Account & profile')).not.toHaveLength(0)
    expect(screen.getAllByText('Sessions & devices').length).toBeGreaterThan(0)
    expect(screen.queryByText('Team members')).not.toBeInTheDocument()
    expect(screen.queryByText('Roles & permissions')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Password' })).not.toBeInTheDocument()
  })

  it('surfaces a team item only when the index includes it', async () => {
    apiMock.getSettingsIndex.mockResolvedValue({
      ...SOLO_INDEX,
      groups: [
        ...SOLO_INDEX.groups,
        {
          id: 'team',
          label: 'Team & tenants',
          items: [{ id: 'members', label: 'Team members', route: '/agency/members', icon: 'users' }],
        },
      ],
    })
    renderSettings()
    expect(await screen.findAllByText('Team members')).not.toHaveLength(0)
  })

  it('filters the capability list in search without revealing hidden items', async () => {
    const user = userEvent.setup()
    renderSettings()
    const search = (await screen.findAllByPlaceholderText('Search settings'))[0]
    await user.type(search, 'members')
    expect(screen.queryByText('Team members')).not.toBeInTheDocument()
    await user.clear(search)
    await user.type(search, '2FA')
    expect(screen.getAllByText('Two-factor authentication').length).toBeGreaterThan(0)
  })
})
