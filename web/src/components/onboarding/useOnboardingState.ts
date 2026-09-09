/**
 * Shared Prep public path for `useOnboardingState`.
 *
 * Wave 4A replaces the local stub with the real fetch-backed hook so
 * `OnboardingChecklistCard` and other extract-stage consumers keep compiling
 * against the same type names.
 */
export {
  useOnboardingState,
  type OnboardingStep,
  type OnboardingPath,
  type OnboardingChecklistFlags,
  type OnboardingState,
  type OnboardingStatePatch,
  type UseOnboardingStateResult,
} from '@/hooks/useOnboardingState'
