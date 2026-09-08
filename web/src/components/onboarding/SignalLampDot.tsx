import { cn } from '@/lib/utils'

export interface SignalLampDotProps {
  /** When true, applies the Broadcast pulse (respect prefers-reduced-motion via CSS). */
  pulsing?: boolean
  /** Accessible label; defaults to "Live signal". */
  'aria-label'?: string
  className?: string
  size?: number
}

/**
 * Broadcast signal-lamp motif — teal `--lc-accent-bold` dot with contrast ring.
 *
 * Legal ONLY on:
 * - Active `<OnboardingStepper>` item (AGT-ONB-002)
 * - Live-listing thumbnail (AGT-ONB-004)
 *
 * Used by: AGT-ONB-002, AGT-ONB-004.
 * Stub visual only — parent decides when to mount (do not scatter).
 */
export function SignalLampDot({
  pulsing = true,
  'aria-label': ariaLabel = 'Live signal',
  className,
  size = 8,
}: SignalLampDotProps) {
  return (
    <span
      role="status"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full',
        'border border-[var(--lc-focus-ring-contrast)]',
        'bg-[var(--lc-accent-bold)]',
        pulsing && 'motion-safe:animate-pulse',
        className,
      )}
      style={{ width: size, height: size }}
      data-signal-lamp
      data-pulsing={pulsing || undefined}
    />
  )
}
