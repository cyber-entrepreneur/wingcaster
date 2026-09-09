import { cn } from '@/lib/utils'

export function LivePollIndicator({
  label,
  reducedMotion = false,
  className,
}: {
  label: string
  reducedMotion?: boolean
  className?: string
}) {
  return (
    <p
      className={cn(
        'flex items-center gap-2 text-[var(--lc-text-muted)]',
        className,
      )}
      style={{ font: 'var(--lc-type-body-sm)' }}
      aria-live="polite"
      data-live-poll
    >
      <span>{label}</span>
      <span className="inline-flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(
              'h-1.5 w-1.5 rounded-full bg-[var(--lc-text-muted)]',
              !reducedMotion && 'motion-safe:animate-pulse',
            )}
            style={
              reducedMotion
                ? undefined
                : { animationDuration: 'var(--lc-duration-slow)', animationDelay: `${i * 100}ms` }
            }
          />
        ))}
      </span>
    </p>
  )
}
