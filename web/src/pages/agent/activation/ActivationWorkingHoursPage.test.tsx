// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'
import { ActivationWorkingHoursPage } from './ActivationWorkingHoursPage'
import { agencyOwnerState, makeActivationState, withState } from './testFixtures'
import type { ActivationState } from './types'

const navigateMock = vi.hoisted(() => vi.fn())
const apiMock = vi.hoisted(() => ({
  fetchActivationState: vi.fn(),
  completeActivationStep: vi.fn(),
  deferActivationStep: vi.fn(),
  fetchPortalRegistry: vi.fn(),
  fetchConnectedPortals: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('./api', () => apiMock)

vi.mock('@/hooks/useLocale', () => ({
  useLocale: () => ({ locale: 'en', setLocale: vi.fn(), dir: 'ltr' }),
}))

vi.mock('@/components/nav/LanguageSelector', () => ({
  LanguageSelector: () => <div data-testid="language-selector">Language</div>,
}))

vi.mock('@/components/ui/color-mode-toggle', () => ({
  ColorModeToggle: () => <button type="button">Mode</button>,
}))

vi.mock('@/hooks/useOnboardingState', () => ({
  useOnboardingState: () => ({
    state: null,
    data: {},
    patch: vi.fn(async (x: unknown) => x),
    mutate: vi.fn(async () => ({})),
    isLoading: false,
    isError: false,
    error: undefined,
    activation: null,
    completeActivation: (stepId: string, completedVia?: string) =>
      apiMock.completeActivationStep(stepId, completedVia ?? 'direct'),
    deferActivation: (stepId: string) => apiMock.deferActivationStep(stepId),
    isStepComplete: () => false,
    completedVia: () => null,
  }),
}))

function wrap(ui: React.ReactElement) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/activate/working-hours']}>
        <Routes>
          <Route path="/activate/working-hours" element={ui} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

function stubState(state: ActivationState) {
  apiMock.fetchActivationState.mockResolvedValue(state)
  apiMock.fetchPortalRegistry.mockResolvedValue([])
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

describe('ActivationWorkingHoursPage', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    Object.values(apiMock).forEach((fn) => fn.mockReset())
  })

  it('renders hours form and POSTs complete with schedule metadata', async () => {
    const user = userEvent.setup()
    stubState(agencyOwnerState('agency'))
    wrap(<ActivationWorkingHoursPage />)
    await waitFor(() => expect(screen.getByText(/Set your working hours/i)).toBeInTheDocument())
    expect(screen.getByLabelText(/Weekdays from/i)).toHaveValue('09:00')
    expect(screen.getByLabelText(/Typical first-reply time/i)).toHaveValue(15)

    await user.clear(screen.getByLabelText(/Typical first-reply time/i))
    await user.type(screen.getByLabelText(/Typical first-reply time/i), '20')
    await user.click(screen.getByRole('button', { name: /Mark step complete/i }))

    await waitFor(() =>
      expect(apiMock.completeActivationStep).toHaveBeenCalledWith(
        'working_hours',
        'dashboard_action',
        expect.objectContaining({
          weekday_start: '09:00',
          weekday_end: '18:00',
          weekend_start: '10:00',
          weekend_end: '14:00',
          response_minutes: 20,
        }),
      ),
    )
    expect(navigateMock).toHaveBeenCalledWith('/activate')
  })

  it('defers working hours back to /activate', async () => {
    const user = userEvent.setup()
    stubState(agencyOwnerState('agency'))
    wrap(<ActivationWorkingHoursPage />)
    await waitFor(() => expect(screen.getByRole('button', { name: /I'll do this later/i })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /I'll do this later/i }))
    await waitFor(() => expect(apiMock.deferActivationStep).toHaveBeenCalledWith('working_hours'))
    expect(navigateMock).toHaveBeenCalledWith('/activate')
  })

  it('appends celebrate=1 when completing the final remaining step', async () => {
    const user = userEvent.setup()
    const almostDone = makeActivationState({
      signup_path: 'agency',
      steps: [
        withState('whatsapp', 'complete', { sub_route: '/activate/whatsapp' }, 'direct'),
        withState('first_listing', 'complete', { sub_route: '/activate/first-listing' }, 'direct'),
        withState('portal_credentials', 'complete', { sub_route: '/activate/portal-credentials' }, 'direct'),
        withState('working_hours', 'not_started', { sub_route: '/activate/working-hours' }),
        withState('invite_team', 'complete', { sub_route: '/activate/invite-team' }, 'direct'),
      ],
    })
    stubState(almostDone)
    wrap(<ActivationWorkingHoursPage />)
    await waitFor(() => expect(screen.getByRole('button', { name: /Mark step complete/i })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /Mark step complete/i }))
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/activate?celebrate=1'))
  })
})
