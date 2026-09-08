import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SparkleBurstProps {
  /** When false, renders nothing. */
  active?: boolean
  /** Prefer static glyph when `prefers-reduced-motion` (parent may force). */
  reducedMotion?: boolean
  className?: string
}

/**
 * Small single-flash celebration accent (NOT full confetti).
 *
 * Broadcast-legal ONLY on: AGT-ONB-005 (100% auto-dismiss) + AGT-ONB-004 (supporting).
 * Used by: AGT-ONB-005, AGT-ONB-004.
 * Stub visual only — size-capped vs canvas-confetti on -004.
 */
export function SparkleBurst({
  active = true,
  reducedMotion = false,
  className,
}: SparkleBurstProps) {
  if (!active) return null

  return (
    <div
      className={cn(
        'pointer-events-none relative inline-flex items-center justify-center',
        !reducedMotion && 'motion-safe:animate-pulse',
        className,
      )}
      aria-hidden="true"
      data-sparkle-burst
      data-reduced-motion={reducedMotion || undefined}
    >
      <Sparkles
        className="h-6 w-6 text-[var(--lc-text-brand)]"
        strokeWidth={1.75}
      />
      <Sparkles
        className="absolute h-3 w-3 translate-x-3 -translate-y-2 text-[var(--lc-action-primary)]"
        strokeWidth={2}
      />
      <Sparkles
        className="absolute h-3 w-3 -translate-x-3 translate-y-2 text-[var(--lc-accent-bold)]"
        strokeWidth={2}
      />
    </div>
  )
}
