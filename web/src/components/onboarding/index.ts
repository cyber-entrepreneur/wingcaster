/**
 * Wave-4 onboarding family primitives (Shared Components Prep §3.3).
 *
 * Consumers: AGT-ONB-001…005, AGT-DSH-001/002, AGT-SET-004, AGT-WLA-002.
 * Do NOT import from `onboarding/whatsapp/` here — Agent 4 owns that family.
 */

export {
  OnboardingProgressMarker,
  type OnboardingProgressMarkerProps,
  type OnboardingStepIndex,
} from './OnboardingProgressMarker'

export {
  IntakePathCard,
  IntakeNextActionIcons,
  type IntakePathCardProps,
  type IntakePathVariant,
} from './IntakePathCard'

export {
  ActivationCodeBanner,
  type ActivationCodeBannerProps,
  type ActivationCodeStatus,
} from './ActivationCodeBanner'

export {
  OnboardingStepper,
  type OnboardingStepperProps,
  type OnboardingStepperStep,
} from './OnboardingStepper'

export {
  SignalLampDot,
  type SignalLampDotProps,
} from './SignalLampDot'

export {
  DraftListingPreview,
  type DraftListingPreviewProps,
  type DraftListingPreviewData,
} from './DraftListingPreview'

export {
  CelebrationHeader,
  type CelebrationHeaderProps,
  type CelebrationHeaderTone,
} from './CelebrationHeader'

export {
  PublishingOverlay,
  type PublishingOverlayProps,
} from './PublishingOverlay'

export {
  OnboardingChecklistCard,
  type OnboardingChecklistCardProps,
  type OnboardingChecklistItem,
} from './OnboardingChecklistCard'

export {
  OnboardingPill,
  type OnboardingPillProps,
} from './OnboardingPill'

export {
  ProgressRing,
  type ProgressRingProps,
} from './ProgressRing'

export {
  SparkleBurst,
  type SparkleBurstProps,
} from './SparkleBurst'

export {
  OfflineBanner,
  type OfflineBannerProps,
} from './OfflineBanner'

export {
  useOnboardingState,
  type OnboardingStep,
  type OnboardingPath,
  type OnboardingChecklistFlags,
  type OnboardingState,
  type OnboardingStatePatch,
  type UseOnboardingStateResult,
} from './useOnboardingState'
