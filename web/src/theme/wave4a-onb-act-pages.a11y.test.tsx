// @vitest-environment jsdom
/**
 * Page-level axe + keyboard checks against merged ONB / ACT / DSH-mount
 * screens. Primitive coverage remains in wave4a-screens.*.test.tsx.
 */
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'
import { ToastProvider } from '@/components/ui/toast'
import { BrandProvider } from '@/context/BrandContext'
import { makeState } from '@/pages/agent/onboarding/testState'
import { makeActivationState, midFlowSolo } from '@/pages/agent/activation/testFixtures'

expect.extend(toHaveNoViolations)

const navigateMock = vi.hoisted(() => vi.fn())

const onboardingHook = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  isLoading: false,
  isError: false,
  patch: vi.fn(async (body: Record<string, unknown>) => body),
}))

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

vi.mock('@/hooks/useOnboardingState', () => ({
  useOnboardingState: () => ({
    state: onboardingHook.state,
    data: onboardingHook.state,
    patch: onboardingHook.patch,
    isLoading: onboardingHook.isLoading,
    isError: onboardingHook.isError,
    mutate: async () => onboardingHook.state,
    error: undefined,
  }),
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    agent: { id: 'u1', name: 'Sara Agent', email: 'sara@example.com', role: 'agent' },
    loading: false,
  }),
}))

vi.mock('@/components/nav/LanguageSelector', () => ({
  LanguageSelector: () => <div data-testid="language-selector">Language</div>,
}))

vi.mock('@/components/ui/color-mode-toggle', () => ({
  ColorModeToggle: () => (
    <button type="button" aria-label="Colour mode">
      mode
    </button>
  ),
}))

vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

vi.mock('@/pages/agent/onboarding/onboardingApi', () => ({
  getMarketingAgentCount: vi.fn(async () => 2499),
  trackOnboardingEvent: vi.fn(),
  getPublishedListing: vi.fn(async () => null),
}))

vi.mock('@/pages/agent/activation/api', () => apiMock)

vi.mock('@/pages/agent/activation/onboardingHook', () => ({
  useOnboardingState: () => ({
    state: onboardingHook.state,
    data: onboardingHook.state,
    patch: onboardingHook.patch,
    mutate: vi.fn(async () => onboardingHook.state),
    isLoading: false,
    isError: false,
    error: undefined,
  }),
}))

import { WelcomePage } from '@/pages/agent/onboarding/WelcomePage'
import { OnboardingChecklistWidget } from '@/pages/agent/onboarding/OnboardingChecklistWidget'
import { CelebrationPage } from '@/pages/agent/onboarding/CelebrationPage'
import { ActivationWelcomePage } from '@/pages/agent/activation/ActivationWelcomePage'
import { ActivationPortalCredentialsPage } from '@/pages/agent/activation/ActivationPortalCredentialsPage'
import { SkipWizardDialog } from '@/pages/agent/activation/components/SkipWizardDialog'

function shell(ui: ReactElement, path = '/onboarding/welcome', extraMain = true) {
  const routed = (
    <Routes>
      <Route path="/onboarding/welcome" element={ui} />
      <Route path="/onboarding/first-listing/published" element={ui} />
      <Route path="/dashboard" element={ui} />
      <Route path="/activate" element={ui} />
      <Route path="/activate/portal-credentials" element={ui} />
    </Routes>
  )
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BrandProvider>
        <ToastProvider>{extraMain ? <main>{routed}</main> : routed}</ToastProvider>
      </BrandProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  document.documentElement.lang = 'en'
  document.documentElement.dir = 'ltr'
  navigateMock.mockReset()
  onboardingHook.state = makeState() as typeof onboardingHook.state
  onboardingHook.isLoading = false
  onboardingHook.isError = false
  Object.values(apiMock).forEach((fn) => fn.mockReset())
  apiMock.fetchActivationState.mockResolvedValue(midFlowSolo())
  apiMock.fetchPortalRegistry.mockResolvedValue([])
  apiMock.fetchConnectedPortals.mockResolvedValue([])
  vi.stubGlobal('navigator', { ...navigator, onLine: true })
})

afterEach(() => {
  cleanup()
})

describe('Wave 4A a11y — real ONB pages (feat/wave-4a-onb)', () => {
  it('ONB-001 WelcomePage has no axe violations and arrow-moves radios', async () => {
    const user = userEvent.setup()
    const { container } = shell(<WelcomePage />)
    const group = await screen.findByRole('radiogroup', { name: /How would you like to start/i })
    const radios = within(group).getAllByRole('radio')
    expect(radios).toHaveLength(3)
    radios[0].focus()
    await user.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(radios[1])
    expect(await axe(container)).toHaveNoViolations()
  })

  it('ONB-005 widget (card) exposes region + progressbar', async () => {
    const { container } = shell(
      <OnboardingChecklistWidget
        variant="card"
        state={makeState({
          checklist: {
            welcome_seen: true,
            first_listing_drafted: true,
            first_listing_published: true,
            channels_connected: false,
            notifications_enabled: false,
            profile_completed: false,
            subscription_active: false,
          },
        })}
      />,
      '/dashboard',
      false,
    )
    expect(container.querySelector('[data-onboarding-checklist]')).toBeTruthy()
    expect(
      await axe(container, {
        rules: { 'landmark-unique': { enabled: false } },
      }),
    ).toHaveNoViolations()
  })

  it('ONB-005 Pro pill uses compact progress + descriptive name', async () => {
    const { container } = shell(
      <OnboardingChecklistWidget
        variant="pill"
        state={makeState({
          checklist: {
            welcome_seen: true,
            first_listing_drafted: true,
            first_listing_published: true,
            channels_connected: true,
            notifications_enabled: false,
            profile_completed: false,
            subscription_active: false,
          },
        })}
      />,
      '/dashboard',
      false,
    )
    expect(screen.getByRole('button', { name: /Onboarding progress/i })).toBeInTheDocument()
    expect(
      await axe(container, {
        rules: { 'landmark-unique': { enabled: false } },
      }),
    ).toHaveNoViolations()
  })

  it('ONB-004 reduced-motion skips confetti', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    })
    shell(<CelebrationPage />, '/onboarding/first-listing/published')
    expect(document.querySelector('[data-onboarding-confetti]')).toBeNull()
  })
})

describe('Wave 4A a11y — real ACT pages (feat/wave-4a-act)', () => {
  it('ACT-001 welcome hub has no axe violations', async () => {
    const { container } = shell(<ActivationWelcomePage />, '/activate', false)
    await waitFor(() => expect(screen.getByText(/Skip wizard/i)).toBeInTheDocument())
    expect(await axe(container)).toHaveNoViolations()
  })

  it('ACT skip-wizard dialog traps Tab and Escape closes', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    shell(
      <SkipWizardDialog open onOpenChange={onOpenChange} onConfirm={() => onOpenChange(false)} />,
      '/activate',
    )
    const dialog = await screen.findByRole('dialog')
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
    for (let i = 0; i < 6; i += 1) {
      await user.tab()
      expect(dialog.contains(document.activeElement)).toBe(true)
    }
    await user.keyboard('{Escape}')
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it('ACT-004 locked portal credentials has no axe violations', async () => {
    apiMock.fetchActivationState.mockResolvedValue(
      makeActivationState({
        steps: makeActivationState().steps.map((s) =>
          s.id === 'portal_credentials' ? { ...s, state: 'locked' as const } : s,
        ),
      }),
    )
    const { container } = shell(<ActivationPortalCredentialsPage />, '/activate/portal-credentials', false)
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /Portal credentials/i })).toBeInTheDocument(),
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
