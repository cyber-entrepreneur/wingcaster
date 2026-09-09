// @vitest-environment jsdom
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'
import { ActivationWelcomePage } from './ActivationWelcomePage'
import { ActivationInviteTeamPage } from './ActivationInviteTeamPage'
import { ActivationPortalCredentialsPage } from './ActivationPortalCredentialsPage'
import { ActivationWhatsAppPage } from './ActivationWhatsAppPage'
import { ActivationFirstListingPage } from './ActivationFirstListingPage'
import { agencyOwnerState, makeActivationState, midFlowSolo, withState } from './testFixtures'
import type { ActivationState } from './types'

const navigateMock = vi.hoisted(() => vi.fn())
const apiMock = vi.hoisted(() => ({
  fetchActivationState: vi.fn(),
  completeActivationStep: vi.fn(),
  deferActivationStep: vi.fn(),
  recordOnboardingEvent: vi.fn(),
  fetchPortalRegistry: vi.fn(),
  fetchConnectedPortals: vi.fn(),
  savePortalCredentials: vi.fn(),
  fetchWhatsAppActivationCode: vi.fn(),
  regenerateWhatsAppActivationCode: vi.fn(),
  fetchWhatsAppBindingStatus: vi.fn(),
  fetchAgencyInvitations: vi.fn(),
  fetchShareLink: vi.fn(),
  rotateShareLink: vi.fn(),
  rotateInvitationCode: vi.fn(),
  sendBulkInvitations: vi.fn(),
  resendInvitation: vi.fn(),
  revokeInvitation: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('./api', () => apiMock)

vi.mock('@/components/nav/LanguageSelector', () => ({
  LanguageSelector: () => <div data-testid="language-selector">Language</div>,
}))

vi.mock('@/components/ui/color-mode-toggle', () => ({
  ColorModeToggle: () => <button type="button">Mode</button>,
}))

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn(async () => 'data:image/png;base64,xx') },
}))

const authMock = vi.hoisted(() => ({
  agent: { id: 'usr_test', name: 'Test', email: 't@example.com', agency_name: 'Elite', role: 'owner' } as Record<
    string,
    unknown
  > | null,
  loading: false,
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authMock,
}))

vi.mock('./onboardingHook', () => ({
  useOnboardingState: () => ({
    state: {
      user_id: 'usr_test',
      step: 'welcome',
      path: null,
      started_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
      completed_at: null,
      checklist: {
        welcome_seen: true,
        first_listing_drafted: false,
        first_listing_published: false,
        channels_connected: false,
        notifications_enabled: false,
        profile_completed: false,
        subscription_active: false,
      },
    },
    data: {},
    patch: vi.fn(async (x: unknown) => x),
    mutate: vi.fn(async () => ({})),
    isLoading: false,
    isError: false,
    error: undefined,
  }),
}))

function wrap(ui: ReactElement, path = '/activate') {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/activate" element={ui} />
          <Route path="/activate/welcome" element={ui} />
          <Route path="/activate/whatsapp" element={ui} />
          <Route path="/activate/first-listing" element={ui} />
          <Route path="/activate/portal-credentials" element={ui} />
          <Route path="/activate/invite-team" element={ui} />
          <Route path="/activate/working-hours" element={ui} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

function stubState(state: ActivationState, portals: unknown[] = []) {
  apiMock.fetchActivationState.mockResolvedValue(state)
  apiMock.fetchPortalRegistry.mockResolvedValue(portals)
  apiMock.fetchConnectedPortals.mockResolvedValue([])
  apiMock.deferActivationStep.mockImplementation(async (stepId: string) => ({
    ...state,
    steps: state.steps.map((s) => (s.id === stepId ? { ...s, state: 'deferred' as const } : s)),
  }))
  apiMock.completeActivationStep.mockImplementation(async (stepId: string, via = 'dashboard_action') => ({
    ...state,
    steps: state.steps.map((s) =>
      s.id === stepId
        ? { ...s, state: 'complete' as const, completed_via: via, completed_at: '2026-09-09T12:00:00Z' }
        : s,
    ),
    completed_count: state.completed_count + 1,
  }))
}

describe('AGT-ACT welcome hub', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    Object.values(apiMock).forEach((fn) => fn.mockReset())
    authMock.agent = { id: 'usr_test', name: 'Test', email: 't@example.com', agency_name: 'Elite', role: 'agent' }
  })

  it('renders solo Step 5 as locked', async () => {
    stubState(midFlowSolo(), [])
    wrap(<ActivationWelcomePage />)
    await waitFor(() => expect(screen.getByText(/Grow into an agency/i)).toBeInTheDocument())
    const invite = screen.getByRole('region', { name: /Grow into an agency/i })
    expect(invite).toHaveAttribute('data-step-state', 'locked')
    expect(screen.getByText(/Available if you register an agency later/i)).toBeInTheDocument()
  })

  it('renders join-path Step 5 as locked with agency-owner helper', async () => {
    stubState(
      makeActivationState({
        signup_path: 'join',
        steps: [
          withState('whatsapp', 'not_started', { sub_route: '/activate/whatsapp' }),
          withState('first_listing', 'not_started', { sub_route: '/activate/first-listing' }),
          withState('portal_credentials', 'locked', { sub_route: '/activate/portal-credentials' }),
          withState('working_hours', 'not_started', { sub_route: '/activate/working-hours' }),
          withState('invite_team', 'locked', {
            sub_route: '/activate/invite-team',
            lock_reason: 'join_signup_path',
          }),
        ],
      }),
      [],
    )
    wrap(<ActivationWelcomePage />)
    await waitFor(() => expect(screen.getByRole('region', { name: /Grow into an agency/i })).toBeInTheDocument())
    const card = screen.getByRole('region', { name: /Grow into an agency/i })
    expect(card).toHaveAttribute('data-step-state', 'locked')
    expect(card.textContent).toMatch(/Invite is managed by your agency owner/i)
  })

  it('renders agency-owner Step 5 as a first-class invite card', async () => {
    stubState(agencyOwnerState('agency'), [{ code: 'bayut', display_name: 'Bayut' }])
    wrap(<ActivationWelcomePage />)
    await waitFor(() => expect(screen.getByRole('region', { name: 'Invite your team' })).toBeInTheDocument())
    const invite = screen.getByRole('region', { name: 'Invite your team' })
    expect(invite).toHaveAttribute('data-step-state', 'not_started')
    expect(screen.getByRole('button', { name: 'Invite agents' })).toBeInTheDocument()
  })

  it('locks portal credentials when portal_registry is empty', async () => {
    const state = makeActivationState({
      signup_path: 'agency',
      steps: [
        withState('whatsapp', 'not_started', { sub_route: '/activate/whatsapp' }),
        withState('first_listing', 'not_started', { sub_route: '/activate/first-listing' }),
        withState('portal_credentials', 'not_started', { sub_route: '/activate/portal-credentials' }),
        withState('working_hours', 'not_started', { sub_route: '/activate/working-hours' }),
        withState('invite_team', 'not_started', { sub_route: '/activate/invite-team' }),
      ],
    })
    stubState(state, [])
    wrap(<ActivationWelcomePage />)
    await waitFor(() => expect(screen.getByRole('region', { name: /portal credentials/i })).toBeInTheDocument())
    const card = screen.getByRole('region', { name: /portal credentials/i })
    expect(card).toHaveAttribute('data-step-state', 'locked')
    expect(
      screen.getByText(/Available soon — we're finalizing your country's portal list/i),
    ).toBeInTheDocument()
  })

  it('shows auto-complete caption without a surveillance banner', async () => {
    stubState(midFlowSolo(), [])
    wrap(<ActivationWelcomePage />)
    await waitFor(() => expect(screen.getByText(/Completed via onboarding/i)).toBeInTheDocument())
    expect(screen.getByText(/Completed via WhatsApp intake/i)).toBeInTheDocument()
    expect(screen.queryByText(/we saw you already/i)).not.toBeInTheDocument()
  })

  it('POSTs defer when Later is clicked', async () => {
    const user = userEvent.setup()
    stubState(midFlowSolo(), [])
    wrap(<ActivationWelcomePage />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Set my hours' })).toBeInTheDocument())
    const later = screen.getAllByRole('button', { name: /I'll do this later/i })[0]
    await user.click(later)
    await waitFor(() => expect(apiMock.deferActivationStep).toHaveBeenCalled())
  })

  it('celebrates only when arriving with celebrate=1 (4→5)', async () => {
    const complete = makeActivationState({
      steps: [
        withState('whatsapp', 'complete', { sub_route: '/activate/whatsapp' }, 'direct'),
        withState('first_listing', 'complete', { sub_route: '/activate/first-listing' }, 'direct'),
        withState('portal_credentials', 'complete', { sub_route: '/activate/portal-credentials' }, 'direct'),
        withState('working_hours', 'complete', { sub_route: '/activate/working-hours' }, 'direct'),
        withState('invite_team', 'complete', { sub_route: '/activate/invite-team' }, 'direct'),
      ],
    })
    stubState(complete, [{ code: 'bayut', display_name: 'Bayut' }])
    wrap(<ActivationWelcomePage />, '/activate')
    await waitFor(() => expect(screen.getByText(/Unlock every WingCaster feature/i)).toBeInTheDocument())
    expect(screen.queryByText(/You're activated/i)).not.toBeInTheDocument()
  })

  it('shows celebration banner when celebrate=1 is in the query', async () => {
    const complete = makeActivationState({
      steps: [
        withState('whatsapp', 'complete', { sub_route: '/activate/whatsapp' }, 'direct'),
        withState('first_listing', 'complete', { sub_route: '/activate/first-listing' }, 'direct'),
        withState('portal_credentials', 'complete', { sub_route: '/activate/portal-credentials' }, 'direct'),
        withState('working_hours', 'complete', { sub_route: '/activate/working-hours' }, 'direct'),
        withState('invite_team', 'complete', { sub_route: '/activate/invite-team' }, 'direct'),
      ],
    })
    stubState(complete, [{ code: 'bayut', display_name: 'Bayut' }])
    wrap(<ActivationWelcomePage />, '/activate?celebrate=1')
    await waitFor(() => expect(screen.getByText(/You're activated/i)).toBeInTheDocument())
  })
})

describe('AGT-ACT-004 portal credentials', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    Object.values(apiMock).forEach((fn) => fn.mockReset())
  })

  it('renders locked empty-state when portal_registry is empty', async () => {
    stubState(agencyOwnerState('agency'), [])
    wrap(<ActivationPortalCredentialsPage />, '/activate/portal-credentials')
    await waitFor(() => expect(screen.getByText(/still setting up the portal list/i)).toBeInTheDocument())
    expect(screen.getByText(/No portals to connect yet/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Mark step complete/i })).toBeDisabled()
  })

  it('enables complete after connecting one portal', async () => {
    const user = userEvent.setup()
    stubState(agencyOwnerState('agency'), [
      {
        code: 'bayut',
        display_name: 'Bayut',
        publisher_config: { description: 'UAE listings', credentials_schema: { properties: { username: {}, password: {} } } },
      },
    ])
    apiMock.savePortalCredentials.mockResolvedValue({ status: 'connected', masked_identifier: 'sara@***' })
    wrap(<ActivationPortalCredentialsPage />, '/activate/portal-credentials')
    await waitFor(() => expect(screen.getByText('Bayut')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /Connect →/i }))
    await user.type(screen.getByLabelText('username'), 'sara')
    await user.type(screen.getByLabelText('password'), 'secret')
    await user.click(screen.getByRole('button', { name: /Save & test connection/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /Mark step complete/i })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: /Mark step complete/i }))
    await waitFor(() =>
      expect(apiMock.completeActivationStep).toHaveBeenCalledWith(
        'portal_credentials',
        'dashboard_action',
        expect.objectContaining({ connected_count: 1 }),
      ),
    )
  })
})

describe('AGT-ACT-005 invite team', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    Object.values(apiMock).forEach((fn) => fn.mockReset())
    authMock.agent = { id: 'usr_test', name: 'Test', email: 't@example.com', agency_name: 'Elite', role: 'owner' }
  })

  it('redirects solo agents to /activate', async () => {
    stubState(midFlowSolo(), [])
    wrap(<ActivationInviteTeamPage />, '/activate/invite-team')
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/activate', { replace: true }))
  })

  it('shows three tabs for agency owners and completes to /channels', async () => {
    const user = userEvent.setup()
    authMock.agent = { id: 'usr_test', name: 'Test', email: 't@example.com', agency_name: 'Elite RE', role: 'owner' }
    stubState(agencyOwnerState('agency'), [{ code: 'bayut', display_name: 'Bayut' }])
    apiMock.fetchShareLink.mockResolvedValue({ url: 'https://wingcaster.app/join/elite?code=INV-1', code: 'INV-1' })
    apiMock.fetchAgencyInvitations.mockResolvedValue([
      { id: 'inv_1', email: 'sara@example.com', sent_at: '2026-09-08T10:00:00Z', status: 'pending' },
    ])
    wrap(<ActivationInviteTeamPage />, '/activate/invite-team')
    await waitFor(() => expect(screen.getByText('Invite your team')).toBeInTheDocument())
    expect(screen.getByRole('tab', { name: 'Share link' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Invitation code' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Bulk email' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Mark step complete/i }))
    await waitFor(() => expect(apiMock.completeActivationStep).toHaveBeenCalledWith(
      'invite_team',
      'dashboard_action',
      expect.any(Object),
    ))
    expect(navigateMock).toHaveBeenCalledWith('/channels?source=activation')
  })
})

describe('AGT-ACT complete/defer POSTs', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    Object.values(apiMock).forEach((fn) => fn.mockReset())
  })

  it('POSTs whatsapp complete after bind', async () => {
    const user = userEvent.setup()
    const state = makeActivationState({
      steps: [
        withState('whatsapp', 'not_started', { sub_route: '/activate/whatsapp' }),
        withState('first_listing', 'not_started', { sub_route: '/activate/first-listing' }),
        withState('portal_credentials', 'locked', { sub_route: '/activate/portal-credentials' }),
        withState('working_hours', 'not_started', { sub_route: '/activate/working-hours' }),
        withState('invite_team', 'locked', { sub_route: '/activate/invite-team' }),
      ],
    })
    stubState(state, [])
    apiMock.fetchWhatsAppActivationCode.mockResolvedValue({
      display_code: 'WC-A7K3',
      shared_number_e164: '+971500000000',
      expires_at: new Date(Date.now() + 600000).toISOString(),
    })
    apiMock.fetchWhatsAppBindingStatus.mockResolvedValue({ bound: true, phone_e164: '+971501234567' })
    wrap(<ActivationWhatsAppPage />, '/activate/whatsapp')
    await waitFor(() => expect(screen.getByRole('button', { name: /Mark step complete/i })).toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole('button', { name: /Mark step complete/i })).toBeEnabled(), {
      timeout: 5000,
    })
    await user.click(screen.getByRole('button', { name: /Mark step complete/i }))
    await waitFor(() =>
      expect(apiMock.completeActivationStep).toHaveBeenCalledWith(
        'whatsapp',
        'dashboard_action',
        undefined,
      ),
    )
    expect(navigateMock).toHaveBeenCalledWith('/activate')
  })

  it('first-listing alt mark-complete POSTs completed_via direct', async () => {
    const user = userEvent.setup()
    stubState(makeActivationState(), [])
    wrap(<ActivationFirstListingPage />, '/activate/first-listing')
    await waitFor(() => expect(screen.getByText(/How do you want to create/i)).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /Mark this step complete/i }))
    await user.click(screen.getByRole('button', { name: /Yes, mark complete/i }))
    await waitFor(() =>
      expect(apiMock.completeActivationStep).toHaveBeenCalledWith('first_listing', 'direct', undefined),
    )
  })
})
