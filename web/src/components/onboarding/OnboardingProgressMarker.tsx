import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Onboarding family step index (AGT-ONB-001…004). */
export type OnboardingStepIndex = 1 | 2 | 3 | 4

export interface OnboardingProgressMarkerProps {
  /** Current step (1–4). Used by AGT-ONB-001/002/003/004. */
  step: OnboardingStepIndex
  /** Total steps in the family tour. Defaults to 4. */
  of?: OnboardingStepIndex
  /** Short label after the middot, e.g. `"Welcome"`. Parent supplies i18n. */
  label: string
  /**
   * When true (AGT-ONB-004), renders a completed check beside the step text.
   * Contract: `<OnboardingProgressMarker step={4} complete>`.
   */
  complete?: boolean
  className?: string
}

/**
 * Top-bar `Step X of 4 · {label}` progress marker (Broadcast A9).
 *
 * Used by: AGT-ONB-001, AGT-ONB-002, AGT-ONB-003, AGT-ONB-004.
 * Stub visual + prop types only — no routing.
 */
export function OnboardingProgressMarker({
  step,
  of = 4,
  label,
  complete = false,
  className,
}: OnboardingProgressMarkerProps) {
  return (
    <p
      className={cn(
        'inline-flex items-center gap-1.5 text-[var(--lc-text-muted)]',
        className,
      )}
      style={{ font: 'var(--lc-type-overline)' }}
      aria-current={complete ? undefined : 'step'}
      data-onboarding-step={step}
      data-onboarding-complete={complete || undefined}
    >
      <span>
        Step {step} of {of}
        <span aria-hidden="true"> · </span>
        {label}
      </span>
      {complete ? (
        <Check
          className="h-3.5 w-3.5 text-[var(--lc-status-published-fg)]"
          aria-hidden="true"
        />
      ) : null}
    </p>
  )
}
