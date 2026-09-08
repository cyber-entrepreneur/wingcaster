import { ProgressRing } from '@/components/onboarding/ProgressRing'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'

export interface OnboardingPillProps {
  /** Completed main checklist steps. */
  completed: number
  /** Total main steps (default 4). */
  total?: number
  /** Opens Pro-mode sheet with full checklist. */
  onClick?: () => void
  /** Tooltip / aria: `Finish setting up — {n} of {total} steps done`. */
  'aria-label'?: string
  className?: string
}

/**
 * Compact Pro-mode top-bar pill (ring + `n/4` label).
 *
 * Used by: AGT-DSH-002 (Pro dashboard); opens sheet with `<OnboardingChecklistCard>` content.
 * Stub visual + prop types only.
 */
export function OnboardingPill({
  completed,
  total = 4,
  onClick,
  'aria-label': ariaLabel,
  className,
}: OnboardingPillProps) {
  const label =
    ariaLabel ?? `Finish setting up — ${completed} of ${total} steps done`

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-[var(--lc-radius-lg)]',
        'border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] px-2',
        'text-[var(--lc-text-primary)] shadow-[var(--lc-elevation-sm)]',
        'focus-visible:outline-none',
        className,
      )}
      data-onboarding-pill
    >
      <ProgressRing size={24} completed={completed} total={total} strokeWidth={3} />
      <Numeric
        className="text-[var(--lc-text-heading)]"
        style={{ font: 'var(--lc-type-data)', fontFamily: 'var(--lc-font-mono)' }}
      >
        {completed}/{total}
      </Numeric>
    </button>
  )
}
