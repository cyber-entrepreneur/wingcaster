import { Check } from 'lucide-react'
import { SignalLampDot } from '@/components/onboarding/SignalLampDot'
import { cn } from '@/lib/utils'

export interface OnboardingStepperStep {
  /** Stable key. */
  id: string
  /** Short label. Parent supplies i18n. */
  label: string
}

export interface OnboardingStepperProps {
  /** Ordered tour sub-steps (typically 4 on AGT-ONB-002). */
  steps: OnboardingStepperStep[]
  /** Zero-based index of the active step. */
  activeIndex: number
  className?: string
}

/**
 * Horizontal/compact onboarding tour stepper with signal-lamp on the active item.
 *
 * Used by: AGT-ONB-002 (primary), AGT-ONB-003 (reuse).
 * Invariant: `<SignalLampDot>` appears only on the active step.
 * Stub visual + prop types only.
 */
export function OnboardingStepper({ steps, activeIndex, className }: OnboardingStepperProps) {
  return (
    <ol
      className={cn(
        'flex w-full flex-wrap items-start justify-between gap-[var(--lc-space-sm)]',
        className,
      )}
      aria-label="Onboarding tour progress"
    >
      {steps.map((step, index) => {
        const complete = index < activeIndex
        const active = index === activeIndex
        const pending = index > activeIndex

        return (
          <li
            key={step.id}
            className="flex min-w-[4.5rem] flex-1 flex-col items-center gap-2 text-center"
            aria-current={active ? 'step' : undefined}
            data-step-state={complete ? 'complete' : active ? 'active' : 'pending'}
          >
            <span
              className={cn(
                'relative flex h-8 w-8 items-center justify-center rounded-full border-2',
                complete &&
                  'border-[var(--lc-status-published-fg)] bg-[var(--lc-status-published-bg)]',
                active && 'border-[var(--lc-action-primary)] bg-[var(--lc-surface-raised)]',
                pending && 'border-[var(--lc-border)] bg-[var(--lc-surface)]',
              )}
            >
              {complete ? (
                <Check
                  className="h-4 w-4 text-[var(--lc-status-published-fg)]"
                  aria-hidden="true"
                />
              ) : active ? (
                <SignalLampDot size={8} pulsing aria-label={`${step.label} in progress`} />
              ) : (
                <span className="h-2 w-2 rounded-full bg-[var(--lc-border-strong)]" aria-hidden="true" />
              )}
            </span>
            <span
              className={cn(
                active ? 'text-[var(--lc-text-heading)]' : 'text-[var(--lc-text-muted)]',
              )}
              style={{ font: 'var(--lc-type-caption)' }}
            >
              {step.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
