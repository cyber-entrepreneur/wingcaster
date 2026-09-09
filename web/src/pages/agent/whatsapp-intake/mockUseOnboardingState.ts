import { vi } from 'vitest'

const emptyChecklist = {
  welcome_seen: false,
  first_listing_drafted: false,
  first_listing_published: false,
  channels_connected: false,
  notifications_enabled: false,
  profile_completed: false,
  subscription_active: false,
}

const emptyActivation = {
  user_id: '',
  tenant_id: '',
  signup_path: 'solo' as const,
  country_code: null,
  steps: [],
  completed_count: 0,
  total_count: 0,
}

/** Test-only stub so page tests do not hit the real hook's network + revalidate loop. */
export function mockUseOnboardingState() {
  const state = {
    user_id: '',
    step: 'welcome' as const,
    path: null,
    started_at: '',
    updated_at: '',
    completed_at: null,
    dismissed_forever: false,
    checklist: emptyChecklist,
  }
  return {
    state,
    data: state,
    patch: vi.fn(async () => state),
    isLoading: false,
    isError: false,
    error: undefined,
    mutate: vi.fn(async () => state),
    activation: null,
    completeActivation: vi.fn(async () => emptyActivation),
    deferActivation: vi.fn(async () => emptyActivation),
    isStepComplete: () => false,
    completedVia: () => null,
  }
}
