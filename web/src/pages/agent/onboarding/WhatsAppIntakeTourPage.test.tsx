// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { makeState } from './testState'
import type { OnboardingState } from '@/components/onboarding/useOnboardingState'

const navigateMock = vi.hoisted(() => vi.fn())
const hook = vi.hoisted(() => ({
  state: {
    user_id: 'usr_test',
    step: 'whatsapp_intake_pending' as const,
    path: 'whatsapp' as const,
    started_at: '2026-09-09T10:00:00.000Z',
    updated_at: '2026-09-09T10:00:00.000Z',
    completed_at: null as string | null,
    dismissed_forever: false,
    checklist: {
      welcome_seen: true,
      first_listing_drafted: false,
      first_listing_published: false,
      channels_connected: false,
      notifications_enabled: false,
      profile_completed: false,
      subscription_active: false,
    },
  } as OnboardingState,
  isLoading: false,
  isError: false,
  patch: vi.fn(async (body: Record<string, unknown>) => body),
}))

const apiMocks = vi.hoisted(() => ({
  postActivationCode: vi.fn(),
  getBindingStatus: vi.fn(),
  listWhatsAppDrafts: vi.fn(),
  trackOnboardingEvent: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('@/hooks/useOnboardingState', () => ({
  useOnboardingState: () => ({
    state: hook.state,
    data: hook.state,
    patch: hook.patch,
    isLoading: hook.isLoading,
    isError: hook.isError,
    mutate: async () => hook.state,
    error: undefined,
  }),
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ agent: { id: 'u1', name: 'Sara' }, loading: false }),
}))

vi.mock('@/components/nav/LanguageSelector', () => ({
  LanguageSelector: () => <div data-testid="language-selector">Language</div>,
}))

vi.mock('@/components/ui/color-mode-toggle', () => ({
  ColorModeToggle: () => <button type="button" aria-label="Colour mode">mode</button>,
}))

vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn(async () => 'data:image/png;base64,stub') },
}))

vi.mock('./onboardingApi', () => apiMocks)

import { WhatsAppIntakeTourPage } from './WhatsAppIntakeTourPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <WhatsAppIntakeTourPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  hook.state = makeState({ step: 'whatsapp_intake_pending', path: 'whatsapp' }) as OnboardingState
  hook.isLoading = false
  hook.patch.mockResolvedValue({})
  apiMocks.postActivationCode.mockResolvedValue({
    display_code: 'WC-A7K3',
    shared_number_e164: '+97145550199',
    expires_at: new Date(Date.now() + 12 * 60_000 + 34_000).toISOString(),
  })
  apiMocks.getBindingStatus.mockResolvedValue({ bound: false })
  apiMocks.listWhatsAppDrafts.mockResolvedValue([])
  vi.stubGlobal('navigator', {
    ...navigator,
    onLine: true,
    clipboard: { writeText: vi.fn(async () => undefined) },
  })
})

describe('WhatsAppIntakeTourPage (AGT-ONB-002)', () => {
  it('renders the activation code and stepper at step 2', async () => {
    renderPage()
    expect(await screen.findAllByText('WC-A7K3')).toHaveLength(2)
    expect(screen.getByRole('heading', { name: /Bind your WhatsApp to WingCaster/i })).toBeInTheDocument()
    expect(screen.getByText('Get code')).toBeInTheDocument()
    expect(screen.getByText('Listening for your message…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Open WhatsApp with the code/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Prefer to type it yourself/i })).toBeInTheDocument()
    const lamps = document.querySelectorAll('[data-signal-lamp]')
    expect(lamps).toHaveLength(1)
  })

  it('advances to the bound waiting-for-listing state', async () => {
    apiMocks.getBindingStatus.mockResolvedValue({
      bound: true,
      phone_e164: '+971501234321',
    })
    renderPage()
    await waitFor(() => expect(screen.getByText(/Connected/i)).toBeInTheDocument())
    expect(screen.getByText(/Waiting for your first listing message/i)).toBeInTheDocument()
    expect(document.querySelectorAll('[data-signal-lamp]')).toHaveLength(1)
  })

  it('redirects when a draft is awaiting approval', async () => {
    apiMocks.getBindingStatus.mockResolvedValue({ bound: true, phone_e164: '+971501234321' })
    apiMocks.listWhatsAppDrafts.mockResolvedValue([
      { id: 'draft_1', status: 'awaiting_approval' },
    ])
    renderPage()
    await waitFor(() =>
      expect(hook.patch).toHaveBeenCalledWith(
        expect.objectContaining({ step: 'draft_review', path: 'whatsapp' }),
      ),
    )
    expect(navigateMock).toHaveBeenCalledWith('/onboarding/first-listing/draft_1')
  })

  it('shows expired recovery without auto-redirect', async () => {
    apiMocks.postActivationCode.mockResolvedValue({
      display_code: 'WC-A7K3',
      shared_number_e164: '+97145550199',
      expires_at: new Date(Date.now() - 1000).toISOString(),
    })
    renderPage()
    // Visible status + sr-only countdown both mention expiry.
    expect((await screen.findAllByText(/Code expired/i)).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Get a new code/i })).toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('escape hatch PATCHes manual_wizard', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findAllByText('WC-A7K3')
    await user.click(screen.getByRole('button', { name: /Prefer to type it yourself/i }))
    await waitFor(() =>
      expect(hook.patch).toHaveBeenCalledWith(
        expect.objectContaining({ step: 'manual_wizard', path: 'manual' }),
      ),
    )
    expect(navigateMock).toHaveBeenCalledWith('/listings/new')
  })

  it('redirects away when the onboarding step is not whatsapp_intake_pending', async () => {
    hook.state = makeState({ step: 'welcome' })
    renderPage()
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith('/onboarding/welcome', { replace: true }),
    )
  })
})
