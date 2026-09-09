/**
 * Cross-family onboarding state.
 *
 * Canonical import is `@/hooks/useOnboardingState` (owned by `feat/wave-4a-state-hook`).
 * That module is not on `main` yet, so we consume Shared Prep's compatible stub
 * and still read checklist flags. When the hook PR lands, switch this one import.
 *
 * Prefer `complete` / `defer` from the hook when present (see `useActivationState`).
 */
export {
  useOnboardingState,
  type OnboardingChecklistFlags,
  type OnboardingState,
  type OnboardingStatePatch,
  type UseOnboardingStateResult,
} from '@/components/onboarding'
