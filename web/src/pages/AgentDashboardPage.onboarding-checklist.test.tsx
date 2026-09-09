// @vitest-environment jsdom
/**
 * AGT-DSH-001 Zone 3 mount for AGT-ONB-005.
 * Conditional render only — widget internals live in the ONB family tests.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { OnboardingState } from '@/hooks/useOnboardingState'

const MAIN_COMPLETE = {
  welcome_seen: true,
  first_listing_drafted: true,
  first_listing_published: true,
  channels_connected: true,
  notifications_enabled: true,
  profile_completed: true,
  subscription_active: false,
} as const

const INCOMPLETE = {
  welcome_seen: true,
  first_listing_drafted: false,
  first_listing_published: false,
  channels_connected: false,
  notifications_enabled: false,
  profile_completed: false,
  subscription_active: false,
} as const

function makeState(overrides: Partial<OnboardingState> = {}): OnboardingState {
  return {
    user_id: 'usr_test',
    step: 'welcome',
    path: null,
    started_at: '2026-09-09T10:00:00.000Z',
    updated_at: '2026-09-09T10:00:00.000Z',
    completed_at: null,
    dismissed_forever: false,
    checklist: { ...INCOMPLETE },
    ...overrides,
    checklist: {
      ...INCOMPLETE,
      ...overrides.checklist,
    },
  }
}

const onboardingHook = vi.hoisted(() => ({
  state: null as unknown as OnboardingState,
  isLoading: false,
  isError: false,
  patch: vi.fn(async (body: Record<string, unknown>) => body),
}))

const authMock = vi.hoisted(() => ({
  agent: {
    id: 'agt_1',
    name: 'Sara Agent',
    email: 'sara@example.com',
    phone: '+971500000000',
    photo: '',
    agency_name: 'Acme Realty',
    license_number: 'LIC-1',
    verified: 1,
    rating: 4.8,
    review_count: 12,
    ui_mode: 'guided' as string,
    onboarding_status: 'active',
    onboarding_stage: 'active',
    onboarding_steps: {},
  } as Record<string, unknown>,
  isAdmin: false,
  updateProfile: vi.fn(),
  loading: false,
}))

const apiMock = vi.hoisted(() => ({
  getProperties: vi.fn(async () => []),
  getInquiries: vi.fn(async () => ({ items: [] })),
  getViewings: vi.fn(async () => []),
  getDashboardStats: vi.fn(async () => ({ listings: 0, totalViews: 0, inquiries: 0 })),
  getDashboardOperations: vi.fn(async () => null),
  getNotificationPrefs: vi.fn(async () => null),
  getPlatforms: vi.fn(async () => []),
  getMyConnections: vi.fn(async () => []),
  getFiAccounts: vi.fn(async () => []),
  getDistributionPerformance: vi.fn(async () => null),
  getMySubmissions: vi.fn(async () => []),
  getAdminSubmissions: vi.fn(async () => []),
  getWhatsAppStatus: vi.fn(async () => null),
  getAgentEngagement: vi.fn(async () => null),
  getDashboardAnalytics: vi.fn(async () => null),
  getConversations: vi.fn(async () => []),
  getDistributions: vi.fn(async () => []),
  trackEvent: vi.fn(async () => ({})),
}))

vi.mock('@/hooks/useOnboardingState', () => ({
  useOnboardingState: () => ({
    state: onboardingHook.state,
    data: onboardingHook.state,
    patch: onboardingHook.patch,
    isLoading: onboardingHook.isLoading,
    isError: onboardingHook.isError,
    mutate: async () => onboardingHook.state,
    error: onboardingHook.isError ? new Error('failed') : undefined,
    activation: null,
    completeActivation: vi.fn(),
    deferActivation: vi.fn(),
    isStepComplete: () => false,
    completedVia: () => null,
  }),
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authMock,
}))

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>('@/api/client')
  return { ...actual, api: apiMock }
})

vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

vi.mock('@/components/dashboard/KpiAnalyticsPanel', () => ({
  KpiAnalyticsPanel: () => <div data-testid="kpi-stub" />,
}))

vi.mock('@/components/ListingFormModal', () => ({
  ListingFormModal: () => null,
}))

vi.mock('@/components/dashboard/ListingRow', () => ({
  ListingRow: () => null,
}))

vi.mock('@/components/dashboard/PromoteDistributeModal', () => ({
  PromoteDistributeModal: () => null,
  PLATFORM_META: {},
  SOCIAL_PROMOTE_PLATFORMS: ['instagram', 'telegram', 'tiktok', 'x'],
}))

import { AgentDashboardPage } from './AgentDashboardPage'

function renderDashboard() {
  return render(
    <MemoryRouter>
      <AgentDashboardPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  onboardingHook.state = makeState()
  onboardingHook.isLoading = false
  onboardingHook.isError = false
  onboardingHook.patch.mockResolvedValue({})
  authMock.agent = {
    ...authMock.agent,
    ui_mode: 'guided',
    onboarding_status: 'active',
  }
  authMock.loading = false
  apiMock.getInquiries.mockResolvedValue({ items: [] })
  apiMock.getDashboardOperations.mockResolvedValue(null)
  apiMock.getProperties.mockResolvedValue([])
})

describe('AgentDashboardPage AGT-ONB-005 Zone 3 mount', () => {
  it('shows the checklist when required items are incomplete', async () => {
    renderDashboard()
    expect(await screen.findByRole('region', { name: /Onboarding progress/i })).toBeInTheDocument()
    expect(screen.getByText('Finish setting up')).toBeInTheDocument()
    expect(document.querySelector('[data-dashboard-zone="3"]')).toBeTruthy()
    expect(document.querySelector('[data-onboarding-pill]')).toBeNull()
  })

  it('shows the checklist when step is welcome_skipped', async () => {
    onboardingHook.state = makeState({ step: 'welcome_skipped' })
    renderDashboard()
    expect(await screen.findByRole('region', { name: /Onboarding progress/i })).toBeInTheDocument()
  })

  it('hides the checklist when dismissed_forever is true', () => {
    onboardingHook.state = makeState({ dismissed_forever: true })
    renderDashboard()
    expect(screen.queryByRole('region', { name: /Onboarding progress/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Finish setting up')).not.toBeInTheDocument()
    expect(document.querySelector('[data-dashboard-zone="3"]')).toBeNull()
  })

  it('hides the checklist when step is complete and all required flags are true', () => {
    onboardingHook.state = makeState({
      step: 'complete',
      completed_at: '2026-09-09T12:00:00.000Z',
      checklist: { ...MAIN_COMPLETE },
    })
    renderDashboard()
    expect(screen.queryByRole('region', { name: /Onboarding progress/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Finish setting up')).not.toBeInTheDocument()
  })

  it('renders a collapsed pill instead of the Zone 3 card when ui_mode is pro', async () => {
    authMock.agent = { ...authMock.agent, ui_mode: 'pro' }
    renderDashboard()
    await waitFor(() => {
      expect(document.querySelector('[data-onboarding-pill]')).toBeTruthy()
    })
    expect(screen.queryByRole('region', { name: /Onboarding progress/i })).not.toBeInTheDocument()
    expect(document.querySelector('[data-dashboard-zone="3"]')).toBeNull()
  })

  it('places the checklist immediately below the Zone 3 urgent card, never above it', async () => {
    apiMock.getInquiries.mockResolvedValue({
      items: [
        {
          id: 'inq_1',
          name: 'Sara',
          property_title: '2BR Downtown',
          status: 'new',
          created_at: '2026-09-09T12:00:00.000Z',
          sla_overdue: false,
          message: 'Is this still available?',
        },
      ],
    })
    renderDashboard()
    await waitFor(() => {
      expect(document.querySelector('[data-dashboard-urgent-card]')).toBeTruthy()
    })
    const zone = document.querySelector('[data-dashboard-zone="3"]')
    expect(zone).toBeTruthy()
    const urgent = zone!.querySelector('[data-dashboard-urgent-card]')
    const checklist = zone!.querySelector('[aria-label="Onboarding progress"]')
    expect(urgent).toBeTruthy()
    expect(checklist).toBeTruthy()
    expect(urgent!.compareDocumentPosition(checklist!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText('NEW LEAD')).toBeInTheDocument()
    expect(screen.getByText('Finish setting up')).toBeInTheDocument()
  })
})
