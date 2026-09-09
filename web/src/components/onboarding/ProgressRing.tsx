import { cn } from '@/lib/utils'

export interface ProgressRingProps {
  /** Outer diameter in CSS pixels. Default 44 (AGT-ONB-005 card). */
  size?: number
  /** Completed main steps (1–4 ring math; optional paid step excluded). */
  completed: number
  /** Total main steps. Default 4. */
  total?: number
  /** Stroke width. */
  strokeWidth?: number
  /** Accessible label override. */
  'aria-label'?: string
  className?: string
}

/**
 * Circular progress ring for onboarding completion.
 *
 * Used by: AGT-ONB-005 checklist card, AGT-DSH-002 Pro-mode `<OnboardingPill>`.
 * Stub visual + prop types only.
 */
export function ProgressRing({
  size = 44,
  completed,
  total = 4,
  strokeWidth = 4,
  'aria-label': ariaLabel,
  className,
}: ProgressRingProps) {
  const safeTotal = Math.max(1, total)
  const clamped = Math.min(safeTotal, Math.max(0, completed))
  const pct = clamped / safeTotal
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - pct)
  const done = clamped >= safeTotal
  const label = ariaLabel ?? `${clamped} of ${safeTotal} steps complete`

  return (
    // AGT-ONB-005: ring is a progressbar (not a decorative img).
    <span
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={safeTotal}
      aria-valuenow={clamped}
      aria-label={label}
      className={cn('inline-flex shrink-0', className)}
      data-progress-completed={clamped}
      data-progress-total={safeTotal}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--lc-border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={
            done ? 'var(--lc-status-published-fg)' : 'var(--lc-action-primary)'
          }
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
    </span>
  )
}
