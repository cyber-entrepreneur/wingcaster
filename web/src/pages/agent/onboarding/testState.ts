import type { OnboardingState } from '@/components/onboarding/useOnboardingState'

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  user_id: 'usr_test',
  step: 'welcome',
  path: null,
  started_at: '2026-09-09T10:00:00.000Z',
  updated_at: '2026-09-09T10:00:00.000Z',
  completed_at: null,
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
}

export function makeState(overrides: Partial<OnboardingState> = {}): OnboardingState {
  return {
    ...DEFAULT_ONBOARDING_STATE,
    ...overrides,
    checklist: {
      ...DEFAULT_ONBOARDING_STATE.checklist,
      ...overrides.checklist,
    },
  }
}
