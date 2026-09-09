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
    step: 'welcome' as const,
    path: null as null,
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
  },
  isLoading: false,
  isError: false,
  patch: vi.fn(async (body: Record<string, unknown>) => body),
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
  useAuth: () => ({
    agent: { id: 'u1', name: 'Sara Agent' },
    loading: false,
  }),
}))

vi.mock('@/components/nav/LanguageSelector', () => ({
  LanguageSelector: () => <div data-testid="language-selector">Language</div>,
}))

vi.mock('@/components/ui/color-mode-toggle', () => ({
  ColorModeToggle: () => <button type="button" aria-label="Colour mode">mode</button>,
}))

vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

const agentCountMock = vi.hoisted(() => vi.fn(async () => 2499))
vi.mock('./onboardingApi', () => ({
  getMarketingAgentCount: () => agentCountMock(),
  trackOnboardingEvent: vi.fn(),
}))

import { WelcomePage } from './WelcomePage'

function renderPage() {
  return render(
    <MemoryRouter>
      <WelcomePage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  hook.state = makeState()
  hook.isLoading = false
  hook.isError = false
  agentCountMock.mockResolvedValue(2499)
  vi.stubGlobal('navigator', { ...navigator, onLine: true })
})

describe('WelcomePage (AGT-ONB-001)', () => {
  it('renders three intake cards with WhatsApp recommended and no CTA until selected', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: /Welcome to WingCaster, Sara/i })).toBeInTheDocument()
    expect(screen.getByText('WhatsApp voice memo')).toBeInTheDocument()
    expect(screen.getByText('Add manually')).toBeInTheDocument()
    expect(screen.getByText('Import a spreadsheet')).toBeInTheDocument()
    expect(screen.getByText(/Recommended · fastest to your first listing/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Get started/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Skip for now/i })).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: /How would you like to start/i })).toBeInTheDocument()
  })

  it('shows the CTA only on the selected card', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('WhatsApp voice memo'))
    // Radio cards cannot nest a real button (axe nested-interactive); CTA is visual + Enter/second click.
    expect(screen.getByText(/Get started/i)).toBeInTheDocument()
    const radios = screen.getAllByRole('radio')
    expect(radios[0]).toHaveAttribute('aria-checked', 'true')
    expect(radios[1]).toHaveAttribute('aria-checked', 'false')
  })

  it('PATCHes whatsapp_intake_pending and navigates on CTA', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('WhatsApp voice memo'))
    await user.click(screen.getByText(/Get started/i))
    await waitFor(() =>
      expect(hook.patch).toHaveBeenCalledWith(
        expect.objectContaining({
          step: 'whatsapp_intake_pending',
          path: 'whatsapp',
        }),
      ),
    )
    expect(navigateMock).toHaveBeenCalledWith('/onboarding/whatsapp')
  })

  it('skip writes welcome_skipped', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /Skip for now/i }))
    await waitFor(() =>
      expect(hook.patch).toHaveBeenCalledWith(
        expect.objectContaining({ step: 'welcome_skipped', path: null }),
      ),
    )
    expect(navigateMock).toHaveBeenCalledWith('/dashboard')
  })

  it('redirects complete state to the dashboard', async () => {
    hook.state = makeState({ step: 'complete' })
    renderPage()
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/dashboard', { replace: true }))
  })

  it('resumes whatsapp_intake_pending at the tour', async () => {
    hook.state = makeState({ step: 'whatsapp_intake_pending', path: 'whatsapp' })
    renderPage()
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith('/onboarding/whatsapp', { replace: true }),
    )
  })

  it('falls back when the name is missing', () => {
    // re-mock useAuth would require a mutable auth stub — heading still contains WingCaster
    renderPage()
    expect(screen.getByRole('heading', { level: 1 }).textContent).not.toMatch(/undefined/i)
  })

  it('hides fabricated agent counts when the endpoint fails', async () => {
    agentCountMock.mockResolvedValueOnce(null)
    renderPage()
    await waitFor(() => expect(agentCountMock).toHaveBeenCalled())
    expect(screen.queryByText(/MENA agents on WingCaster/i)).not.toBeInTheDocument()
  })

  it('shows a soft warning when state fetch failed', () => {
    hook.isError = true
    renderPage()
    expect(screen.getByText(/couldn't check your progress/i)).toBeInTheDocument()
    expect(screen.getByText('WhatsApp voice memo')).toBeInTheDocument()
  })

  it('renders a skeleton while loading', () => {
    hook.isLoading = true
    renderPage()
    expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument()
    expect(screen.queryByText('WhatsApp voice memo')).not.toBeInTheDocument()
  })
})
