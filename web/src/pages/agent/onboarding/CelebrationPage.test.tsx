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
    step: 'first_published' as const,
    path: 'whatsapp' as const,
    started_at: new Date(Date.now() - 2 * 60_000).toISOString(),
    updated_at: '2026-09-09T10:00:00.000Z',
    completed_at: null as string | null,
    dismissed_forever: false,
    checklist: {
      welcome_seen: true,
      first_listing_drafted: true,
      first_listing_published: true,
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
  useAuth: () => ({ agent: { id: 'u1', name: 'Sara Agent' }, loading: false }),
}))

vi.mock('@/components/nav/LanguageSelector', () => ({
  LanguageSelector: () => <div data-testid="language-selector">Language</div>,
}))

vi.mock('@/components/ui/color-mode-toggle', () => ({
  ColorModeToggle: () => <button type="button" aria-label="Colour mode">mode</button>,
}))

vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

vi.mock('./onboardingApi', () => ({
  getPublishedListing: vi.fn(async () => ({
    id: 'prop_1',
    priceLabel: 'AED 2.4M',
    address: 'Burj Vista Tower 1',
  })),
  trackOnboardingEvent: vi.fn(),
}))

import { CelebrationPage } from './CelebrationPage'
import { ONB_CELEBRATION_LISTING_KEY, ONB_CONFETTI_KEY } from './helpers'

function renderPage() {
  return render(
    <MemoryRouter>
      <CelebrationPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  hook.state = makeState({
    step: 'first_published',
    path: 'whatsapp',
    started_at: new Date(Date.now() - 2 * 60_000).toISOString(),
  }) as OnboardingState
  hook.patch.mockResolvedValue({})
  sessionStorage.setItem(
    ONB_CELEBRATION_LISTING_KEY,
    JSON.stringify({
      id: 'prop_1',
      priceLabel: 'AED 2.4M',
      address: 'Burj Vista Tower 1',
    }),
  )
})

describe('CelebrationPage (AGT-ONB-004)', () => {
  it('renders the live headline, next actions, and a single signal-lamp', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: /Your first listing is live/i })).toBeInTheDocument()
    expect(screen.getByText(/Sara — you turned a voice memo/i)).toBeInTheDocument()
    expect(screen.getByText('Share on your Instagram')).toBeInTheDocument()
    expect(screen.getByText('Connect your other channels')).toBeInTheDocument()
    expect(screen.getByText('Explore your dashboard')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Skip for now/i })).toBeInTheDocument()
    expect(await screen.findByText('Burj Vista Tower 1')).toBeInTheDocument()
    expect(document.querySelectorAll('[data-signal-lamp]')).toHaveLength(1)
    await waitFor(() =>
      expect(hook.patch).toHaveBeenCalledWith(
        expect.objectContaining({ step: 'complete' }),
      ),
    )
  })

  it('plays confetti once per session', () => {
    renderPage()
    expect(sessionStorage.getItem(ONB_CONFETTI_KEY)).toBe('true')
    const firstBurst = document.querySelectorAll('[data-onboarding-confetti]').length
    renderPage()
    expect(document.querySelectorAll('[data-onboarding-confetti]').length).toBe(firstBurst)
  })

  it('uses a static burst when reduced motion is set', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }))
    renderPage()
    expect(document.querySelector('[data-sparkle-burst]')).toBeTruthy()
    expect(document.querySelector('[data-onboarding-confetti]')).toBeNull()
  })

  it('later link goes to the dashboard', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /Skip for now/i }))
    expect(navigateMock).toHaveBeenCalledWith('/dashboard')
  })
})
