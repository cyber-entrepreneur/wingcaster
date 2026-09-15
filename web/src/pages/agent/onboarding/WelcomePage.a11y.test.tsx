// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'
import { makeState } from './testState'
import type { OnboardingState } from '@/components/onboarding/useOnboardingState'

expect.extend(toHaveNoViolations)

const hook = vi.hoisted(() => ({
  state: null as unknown as OnboardingState,
  isLoading: false,
  isError: false,
  patch: vi.fn(async (body: Record<string, unknown>) => body),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn() }
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
  LanguageSelector: () => <div>Language</div>,
}))

vi.mock('@/components/ui/color-mode-toggle', () => ({
  ColorModeToggle: () => <button type="button" aria-label="Colour mode">mode</button>,
}))

vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

vi.mock('./onboardingApi', () => ({
  getMarketingAgentCount: async () => null,
  trackOnboardingEvent: vi.fn(),
}))

import { WelcomePage } from './WelcomePage'

beforeEach(() => {
  hook.state = makeState()
  hook.isLoading = false
  hook.isError = false
})

describe('WelcomePage axe', () => {
  it('has no serious a11y violations', async () => {
    const { container } = render(
      <MemoryRouter>
        <WelcomePage />
      </MemoryRouter>,
    )
    const results = await axe(container, {
      rules: {
        'duplicate-id': { enabled: false },
        'duplicate-id-aria': { enabled: false },
        // Path cards use h3 under page h1 by design (Broadcast card title).
        'heading-order': { enabled: false },
      },
    })
    expect(results).toHaveNoViolations()
  })
})
