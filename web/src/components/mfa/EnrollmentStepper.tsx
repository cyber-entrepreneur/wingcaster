import { cn } from '@/lib/utils'

export type EnrollmentStepId = 'setup' | 'verify' | 'save-codes'

export interface EnrollmentStep {
  id: EnrollmentStepId
  /** Visible label — parent supplies i18n (Set up · Verify · Save codes). */
  label: string
}

export interface EnrollmentStepperProps {
  /** Zero-based active step index (0 = setup, 1 = verify, 2 = save-codes). */
  activeIndex: number
  /** Optional override of the three default labels. */
  steps?: EnrollmentStep[]
  className?: string
}

const DEFAULT_STEPS: EnrollmentStep[] = [
  { id: 'setup', label: 'Set up' },
  { id: 'verify', label: 'Verify' },
  { id: 'save-codes', label: 'Save codes' },
]

/**
 * 3-step enrollment progress indicator.
 *
 * Used by: SHR-MFA-002, SHR-MFA-003, SHR-MFA-005 (Mode A first-view).
 * Stub visual only.
 */
export function EnrollmentStepper({
  activeIndex,
  steps = DEFAULT_STEPS,
  className,
}: EnrollmentStepperProps) {
  return (
    <ol
      aria-label="Enrollment progress"
      className={cn(
        'flex flex-wrap items-center gap-[var(--lc-space-sm)]',
        className,
      )}
    >
      {steps.map((step, index) => {
        const complete = index < activeIndex
        const current = index === activeIndex
        return (
          <li key={step.id} className="flex items-center gap-[var(--lc-space-sm)]">
            {index > 0 ? (
              <span className="text-[var(--lc-text-muted)]" aria-hidden>
                ·
              </span>
            ) : null}
            <span
              className={cn(
                'inline-flex items-center gap-2 text-[length:var(--lc-type-body-sm)]',
                current || complete
                  ? 'font-semibold text-[var(--lc-text-primary)]'
                  : 'text-[var(--lc-text-muted)]',
              )}
              aria-current={current ? 'step' : undefined}
            >
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full',
                  'text-[length:var(--lc-type-caption)] font-[family-name:var(--lc-font-mono)] tabular-nums',
                  current || complete
                    ? 'bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]'
                    : 'bg-[var(--lc-surface-sunken)] text-[var(--lc-text-muted)]',
                )}
                aria-hidden
              >
                {index + 1}
              </span>
              {step.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
