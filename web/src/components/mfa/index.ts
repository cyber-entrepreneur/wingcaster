/**
 * MFA shared primitives (extract-stage stubs).
 *
 * Source briefs: SHR-MFA-001..007 (+ 004b). Downstream waves import from here
 * and flesh out business logic per consumer screen.
 *
 * Step-up coexistence: this package exports `StepUpModal` / `StepUpProvider` /
 * `useStepUp` for the SHR-MFA-007 contract. Legacy implementations remain at
 * `web/src/components/auth/StepUpModal.tsx` and `web/src/context/StepUpContext.tsx`
 * — do not modify those from this extract.
 */

export { OtpInput, type OtpInputProps } from './OtpInput'
export {
  BackupCodeInput,
  formatBackupCode,
  type BackupCodeInputProps,
} from './BackupCodeInput'
export { RateLimitBanner, type RateLimitBannerProps } from './RateLimitBanner'
export { TrustFooter, type TrustFooterProps } from './TrustFooter'
export {
  StepUpModal,
  type StepUpModalProps,
  type StepUpMethod,
} from './StepUpModal'
export {
  StepUpProvider,
  StepUpContext,
  type StepUpProviderProps,
  type StepUpContextValue,
  type StepUpRequestOptions,
  type StepUpResult,
} from './StepUpProvider'
export {
  useStepUp,
  type UseStepUpOptions,
  type UseStepUpReturn,
} from './useStepUp'
export {
  TwoFactorStatusHero,
  type TwoFactorStatusHeroProps,
  type TwoFactorStatus,
} from './TwoFactorStatusHero'
export { MethodRow, type MethodRowProps } from './MethodRow'
export { BackupCodesRow, type BackupCodesRowProps } from './BackupCodesRow'
export {
  EnrollmentStepper,
  type EnrollmentStepperProps,
  type EnrollmentStep,
  type EnrollmentStepId,
} from './EnrollmentStepper'
export { PasswordGateCard, type PasswordGateCardProps } from './PasswordGateCard'
export { RevealableSecret, type RevealableSecretProps } from './RevealableSecret'
export { BackupCodeGrid, type BackupCodeGridProps } from './BackupCodeGrid'
