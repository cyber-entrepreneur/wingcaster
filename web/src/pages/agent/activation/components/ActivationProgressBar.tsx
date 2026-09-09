import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'
import { ActivationCelebrationBanner } from './ActivationCelebrationBanner'

export interface ActivationProgressBarProps {
  completed: number
  total: number
  size?: 'lg' | 'sm'
  /** Fire the 5/5 banner. Parent must set this only on the 4→5 transition. */
  celebrate?: boolean
  className?: string
}

export function ActivationProgressBar({
  completed,
  total,
  size = 'lg',
  celebrate = false,
  className,
}: ActivationProgressBarProps) {
  const safeTotal = total > 0 ? total : 0
  const safeCompleted = Math.min(Math.max(completed, 0), safeTotal)
  const pct = safeTotal === 0 ? 0 : (safeCompleted / safeTotal) * 100

  return (
    <div className={cn('w-full', className)}>
      {celebrate ? <ActivationCelebrationBanner /> : null}
      <p
        className="mb-[var(--lc-space-xs)] text-[var(--lc-text-muted)]"
        style={{ font: 'var(--lc-type-caption)' }}
      >
        <Numeric>{safeCompleted}</Numeric>
        {' of '}
        <Numeric>{safeTotal}</Numeric>
        {' complete'}
      </p>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={safeTotal}
        aria-valuenow={safeCompleted}
        aria-label="Activation progress"
        className={cn(
          'flex w-full overflow-hidden rounded-[var(--lc-radius-pill)] bg-[var(--lc-surface-sunken)]',
          size === 'sm' ? 'h-[4px]' : 'h-[6px]',
        )}
        style={size === 'sm' ? { height: 4 } : { height: 6 }}
      >
        <div
          className="h-full rounded-[var(--lc-radius-pill)] bg-[var(--lc-action-primary)] motion-reduce:transition-none"
          style={{
            width: `${pct}%`,
            transition: 'width var(--lc-duration-base) var(--lc-easing-out)',
          }}
        />
      </div>
    </div>
  )
}
