// @vitest-environment jsdom
/**
 * AGT-DSH-001 Zone 3 mount for AGT-ONB-005.
 *
 * Mirrors GuidedAgentDashboard Zone 3 wiring (pill vs card, urgent-first)
 * without importing the 2k-line AgentDashboardPage module graph — that import
 * OOMs ubuntu-latest (~4GB) before any assertions run.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { OnboardingState } from '@/hooks/useOnboardingState'
import {
  OnboardingChecklistWidget,
  shouldRenderOnboardingChecklist,
} from '@/pages/agent/onboarding'

const MAIN_COMPLETE = {
  welcome_seen: true,
  first_listing_drafted: true,
  first_listing_published: true,
  channels_connected: true,
  comms_connected: true,
  first_post_designed: true,
  markets_set: true,
  notifications_enabled: true,
  profile_completed: true,
  subscription_active: false,
} as const

const INCOMPLETE = {
  welcome_seen: true,
  first_listing_drafted: false,
  first_listing_published: false,
  channels_connected: false,
  comms_connected: false,
  first_post_designed: false,
  markets_set: false,
  notifications_enabled: false,
  profile_completed: false,
  subscription_active: false,
} as const

function makeState(overrides: Partial<OnboardingState> = {}): OnboardingState {
  const { checklist, ...rest } = overrides
  return {
    user_id: 'usr_test',
    step: 'welcome',
    path: null,
    started_at: '2026-09-09T10:00:00.000Z',
    updated_at: '2026-09-09T10:00:00.000Z',
    completed_at: null,
    dismissed_forever: false,
    ...rest,
    checklist: {
      ...INCOMPLETE,
      ...checklist,
    },
  }
}

vi.mock('@/hooks/useLocale', () => ({
  useLocale: () => ({ locale: 'en', isArabic: false, dir: 'ltr' }),
}))

vi.mock('@/hooks/useOnboardingState', () => ({
  useOnboardingState: () => ({
    patch: vi.fn(),
    isLoading: false,
    isError: false,
  }),
}))

type HarnessProps = {
  isProUi: boolean
  state: OnboardingState
  isLoading?: boolean
  isError?: boolean
  urgent?: boolean
}

/**
 * Zone 3 mount harness — keep in sync with GuidedAgentDashboard Zone 3 in
 * AgentDashboardPage.tsx (pill when pro, card under urgent when guided).
 */
function OnboardingZone3Harness({
  isProUi,
  state,
  isLoading = false,
  isError = false,
  urgent = false,
}: HarnessProps) {
  const showOnboardingChecklist =
    !isError && (isLoading || shouldRenderOnboardingChecklist(state))
  const showZone3 = urgent || (!isProUi && showOnboardingChecklist)
  const patch = vi.fn()

  return (
    <MemoryRouter>
      <div>
        {isProUi && showOnboardingChecklist ? (
          <OnboardingChecklistWidget
            variant="pill"
            state={state}
            patch={patch}
            isLoading={isLoading}
            isError={isError}
          />
        ) : null}
        {showZone3 ? (
          <div data-dashboard-zone="3" className="mb-6 space-y-4">
            {urgent ? (
              <div data-dashboard-urgent-card>
                <p>NEW LEAD</p>
              </div>
            ) : null}
            {!isProUi && showOnboardingChecklist ? (
              <OnboardingChecklistWidget
                variant="card"
                state={state}
                patch={patch}
                isLoading={isLoading}
                isError={isError}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </MemoryRouter>
  )
}

describe('AgentDashboardPage AGT-ONB-005 Zone 3 mount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the checklist when required items are incomplete', () => {
    render(<OnboardingZone3Harness isProUi={false} state={makeState()} />)
    expect(screen.getByRole('region', { name: /Onboarding progress/i })).toBeInTheDocument()
    expect(screen.getByText('Finish setting up')).toBeInTheDocument()
    expect(document.querySelector('[data-dashboard-zone="3"]')).toBeTruthy()
    expect(document.querySelector('[data-onboarding-pill]')).toBeNull()
  })

  it('shows the checklist when step is welcome_skipped', () => {
    render(
      <OnboardingZone3Harness
        isProUi={false}
        state={makeState({ step: 'welcome_skipped' })}
      />,
    )
    expect(screen.getByRole('region', { name: /Onboarding progress/i })).toBeInTheDocument()
  })

  it('hides the checklist when dismissed_forever is true', () => {
    render(
      <OnboardingZone3Harness
        isProUi={false}
        state={makeState({ dismissed_forever: true })}
      />,
    )
    expect(screen.queryByRole('region', { name: /Onboarding progress/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Finish setting up')).not.toBeInTheDocument()
    expect(document.querySelector('[data-dashboard-zone="3"]')).toBeNull()
  })

  it('hides the checklist when step is complete and all required flags are true', () => {
    render(
      <OnboardingZone3Harness
        isProUi={false}
        state={makeState({
          step: 'complete',
          completed_at: '2026-09-09T12:00:00.000Z',
          checklist: { ...MAIN_COMPLETE },
        })}
      />,
    )
    expect(screen.queryByRole('region', { name: /Onboarding progress/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Finish setting up')).not.toBeInTheDocument()
  })

  it('renders a collapsed pill instead of the Zone 3 card when ui_mode is pro', () => {
    render(<OnboardingZone3Harness isProUi state={makeState()} />)
    expect(document.querySelector('[data-onboarding-pill]')).toBeTruthy()
    expect(screen.queryByRole('region', { name: /Onboarding progress/i })).not.toBeInTheDocument()
    expect(document.querySelector('[data-dashboard-zone="3"]')).toBeNull()
  })

  it('places the checklist immediately below the Zone 3 urgent card, never above it', () => {
    render(<OnboardingZone3Harness isProUi={false} state={makeState()} urgent />)
    expect(document.querySelector('[data-dashboard-urgent-card]')).toBeTruthy()
    const zone = document.querySelector('[data-dashboard-zone="3"]')
    expect(zone).toBeTruthy()
    const urgentEl = zone!.querySelector('[data-dashboard-urgent-card]')
    const checklist = zone!.querySelector('[aria-label="Onboarding progress"]')
    expect(urgentEl).toBeTruthy()
    expect(checklist).toBeTruthy()
    expect(
      urgentEl!.compareDocumentPosition(checklist!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(screen.getByText('NEW LEAD')).toBeInTheDocument()
    expect(screen.getByText('Finish setting up')).toBeInTheDocument()
  })
})
