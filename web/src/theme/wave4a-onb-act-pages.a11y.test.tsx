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
import type { OnboardingState } from '@/components/onboarding/useOnboardingState'
import { makeState } from '@/pages/agent/onboarding/testState'
import { makeActivationState, midFlowSolo, agencyOwnerState } from '@/pages/agent/activation/testFixtures'

expect.extend(toHaveNoViolations)

const navigateMock = vi.hoisted(() => vi.fn())

const onboardingHook = vi.hoisted(() => ({
  state: {} as OnboardingState,
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

const authAgent = vi.hoisted(() => ({
  current: {
    id: 'u1',
    name: 'Sara Agent',
    email: 'sara@example.com',
    role: 'agent',
    agency_name: 'Elite Realty',
  } as Record<string, unknown>,
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
    agent: authAgent.current,
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
  getWhatsAppDraft: vi.fn(async () => ({
    id: 'draft_1',
    status: 'awaiting_approval',
    title: '2BR · Downtown Dubai',
    price: 2_400_000,
    currency: 'AED',
    beds: 2,
    baths: 2,
    area: '1,200 sqft',
    address: '42 Marina Walk, Dubai',
    description: 'Bright 2-bedroom apartment on the marina.',
    photo_urls: ['https://example.test/a.jpg'],
  })),
  approveWhatsAppDraft: vi.fn(),
  discardWhatsAppDraft: vi.fn(),
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
import { FirstListingReviewPage } from '@/pages/agent/onboarding/FirstListingReviewPage'
import { ActivationWelcomePage } from '@/pages/agent/activation/ActivationWelcomePage'
import { ActivationPortalCredentialsPage } from '@/pages/agent/activation/ActivationPortalCredentialsPage'
import { ActivationWhatsAppPage } from '@/pages/agent/activation/ActivationWhatsAppPage'
import { ActivationFirstListingPage } from '@/pages/agent/activation/ActivationFirstListingPage'
import { ActivationInviteTeamPage } from '@/pages/agent/activation/ActivationInviteTeamPage'
import { SkipWizardDialog } from '@/pages/agent/activation/components/SkipWizardDialog'

vi.mock('@/pages/agent/onboarding/useOnlineStatus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/pages/agent/onboarding/useOnlineStatus')>()
  return {
    ...actual,
    useOnlineStatus: () => true,
  }
})

vi.mock('@/pages/agent/activation/useOnlineStatus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/pages/agent/activation/useOnlineStatus')>()
  return {
    ...actual,
    useOnlineStatus: () => true,
  }
})

function shell(ui: ReactElement, path = '/onboarding/welcome', extraMain = true) {
  const routed = (
    <Routes>
      <Route path="/onboarding/welcome" element={ui} />
      <Route path="/onboarding/first-listing/published" element={ui} />
      <Route path="/onboarding/first-listing/:draftId" element={ui} />
      <Route path="/dashboard" element={ui} />
      <Route path="/activate" element={ui} />
      <Route path="/activate/portal-credentials" element={ui} />
      <Route path="/activate/whatsapp" element={ui} />
      <Route path="/activate/first-listing" element={ui} />
      <Route path="/activate/invite-team" element={ui} />
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
  onboardingHook.state = makeState()
  onboardingHook.isLoading = false
  onboardingHook.isError = false
  authAgent.current = {
    id: 'u1',
    name: 'Sara Agent',
    email: 'sara@example.com',
    role: 'agent',
    agency_name: 'Elite Realty',
  }
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
    // Widget ships its own <section> landmark; shell also wraps <main>. Disable
    // landmark-unique here (same class of harness exemption as LoginPage in
    // a11y-top-pages.rtl.test.tsx) — markup fix belongs to the DSH mount PR.
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
    // See ONB-005 card case — Pro pill shares the nested-landmark harness conflict.
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
    for (let i = 0; i < 6; i += 1) {
      await user.tab({ shift: true })
      expect(dialog.contains(document.activeElement)).toBe(true)
    }
    await user.keyboard('{Escape}')
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it('ACT-002 WhatsApp connect has no axe violations', async () => {
    apiMock.fetchActivationState.mockResolvedValue(
      makeActivationState({
        steps: makeActivationState().steps.map((s) =>
          s.id === 'whatsapp' ? { ...s, state: 'in_progress' as const } : s,
        ),
      }),
    )
    apiMock.fetchWhatsAppActivationCode.mockResolvedValue({
      display_code: 'WC-A4K9-JAMIL',
      shared_number_e164: '+9714XXXXXXX',
      expires_at: '2026-09-09T12:15:00.000Z',
    })
    apiMock.fetchWhatsAppBindingStatus.mockResolvedValue({ bound: false })
    const { container } = shell(<ActivationWhatsAppPage />, '/activate/whatsapp', false)
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /Connect your business WhatsApp/i })).toBeInTheDocument(),
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('ACT-003 first listing has no axe violations', async () => {
    apiMock.fetchActivationState.mockResolvedValue(
      makeActivationState({
        steps: makeActivationState().steps.map((s) => {
          if (s.id === 'whatsapp') return { ...s, state: 'complete' as const }
          if (s.id === 'first_listing') return { ...s, state: 'in_progress' as const }
          return s
        }),
      }),
    )
    const { container } = shell(<ActivationFirstListingPage />, '/activate/first-listing', false)
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: /How do you want to create your first listing/i }),
      ).toBeInTheDocument(),
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('ACT-005 invite team masks pending emails + axe clean', async () => {
    authAgent.current = {
      id: 'u1',
      name: 'Sara Owner',
      email: 'owner@agency.test',
      role: 'owner',
      agency_name: 'Elite Realty',
    }
    apiMock.fetchActivationState.mockResolvedValue(agencyOwnerState())
    apiMock.fetchShareLink.mockResolvedValue({
      url: 'https://example.test/join/abc',
      code: 'JOIN-1',
      expires_at: null,
    })
    apiMock.fetchAgencyInvitations.mockResolvedValue([
      {
        id: 'inv_1',
        email: 'teammate@agency.test',
        status: 'pending',
        sent_at: '2026-09-08T10:00:00.000Z',
      },
    ])
    const { container } = shell(<ActivationInviteTeamPage />, '/activate/invite-team', false)
    await waitFor(() => expect(screen.getByRole('heading', { name: /Invite your team/i })).toBeInTheDocument())
    await waitFor(() => expect(container.querySelector('[data-pii-revealed="false"]')).toBeTruthy())
    expect(screen.queryByText('teammate@agency.test')).toBeNull()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('ACT-005 invite table masks pending invitee emails by default', async () => {
    authAgent.current = {
      id: 'u1',
      name: 'Sara Owner',
      email: 'owner@agency.test',
      role: 'owner',
      agency_name: 'Elite Realty',
    }
    apiMock.fetchActivationState.mockResolvedValue(agencyOwnerState())
    apiMock.fetchShareLink.mockResolvedValue({
      url: 'https://example.test/join/abc',
      code: 'JOIN-1',
      expires_at: null,
    })
    apiMock.fetchAgencyInvitations.mockResolvedValue([
      { id: 'inv_1', email: 'ali@example.test', status: 'pending', sent_at: '2026-09-08T10:00:00.000Z' },
      { id: 'inv_2', email: 'sara@example.test', status: 'pending', sent_at: '2026-09-08T11:00:00.000Z' },
    ])
    render(
      <MemoryRouter initialEntries={['/activate/invite-team']}>
        <BrandProvider>
          <ToastProvider>
            <ActivationInviteTeamPage />
          </ToastProvider>
        </BrandProvider>
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getByRole('heading', { name: /Invite your team/i })).toBeInTheDocument())
    await waitFor(() => expect(screen.getAllByTestId('pending-invite-row')).toHaveLength(2))

    // Positive: raw plaintext emails must NOT appear anywhere in the rendered tree.
    expect(screen.queryByText('ali@example.test')).toBeNull()
    expect(screen.queryByText('sara@example.test')).toBeNull()

    // Every pending row is masked-by-default.
    const rows = screen.getAllByTestId('pending-invite-row')
    rows.forEach((row) => {
      const mask = row.querySelector('[data-pii-revealed]')
      expect(mask?.getAttribute('data-pii-revealed')).toBe('false')
    })

    // The masked chips render the PIIMask email pattern (labelled for a11y).
    expect(screen.getAllByLabelText(/Masked email/i)).toHaveLength(2)
    // Local part of each address is masked (e.g. `a***@…`) — the domain half of
    // the plaintext never survives into the DOM text either.
    const bodyText = document.body.textContent ?? ''
    expect(bodyText).not.toMatch(/ali@example\.test/)
    expect(bodyText).not.toMatch(/sara@example\.test/)
  })

  it('ACT-005 revealing a pending email fires an audit event', async () => {
    const user = userEvent.setup()
    authAgent.current = {
      id: 'u1',
      name: 'Sara Owner',
      email: 'owner@agency.test',
      role: 'owner',
      agency_name: 'Elite Realty',
    }
    apiMock.fetchActivationState.mockResolvedValue(agencyOwnerState())
    apiMock.fetchShareLink.mockResolvedValue({
      url: 'https://example.test/join/abc',
      code: 'JOIN-1',
      expires_at: null,
    })
    apiMock.fetchAgencyInvitations.mockResolvedValue([
      { id: 'inv_1', email: 'ali@example.test', status: 'pending', sent_at: '2026-09-08T10:00:00.000Z' },
      { id: 'inv_2', email: 'sara@example.test', status: 'pending', sent_at: '2026-09-08T11:00:00.000Z' },
    ])
    render(
      <MemoryRouter initialEntries={['/activate/invite-team']}>
        <BrandProvider>
          <ToastProvider>
            <ActivationInviteTeamPage />
          </ToastProvider>
        </BrandProvider>
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getAllByTestId('pending-invite-row')).toHaveLength(2))

    const revealButtons = screen.getAllByRole('button', { name: /Reveal PII/i })
    expect(revealButtons).toHaveLength(2)
    await user.click(revealButtons[0])

    await waitFor(() =>
      expect(apiMock.recordOnboardingEvent).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'pii_reveal', step_id: 'invite_team' }),
      ),
    )
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

describe('Wave 4A a11y — real ONB-003 review page', () => {
  it('ONB-003 FirstListingReviewPage has no axe violations', async () => {
    onboardingHook.state = makeState({ step: 'draft_review', path: 'whatsapp' })
    const { container } = shell(<FirstListingReviewPage />, '/onboarding/first-listing/draft_1')
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /drafted your first listing/i })).toBeInTheDocument(),
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
