import type { ReactNode } from 'react'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'

export type BottomTabBadgeVariant = 'count' | 'dot'

export interface BottomTabBadgeProps {
  /** Numeric count; ignored when variant is `dot`. */
  count?: number
  /** Cap before showing maxLabel (e.g. 99 for inbox, 9 for contacts). */
  max?: number
  /** Displayed when count exceeds max (EN/AR from brief). */
  maxLabel?: string
  /** `count` = numeric pill; `dot` = attention-only (More / MFA). */
  variant?: BottomTabBadgeVariant
  className?: string
  /** Extra class for the warning attention dot. */
  dotClassName?: string
}

/**
 * Badge overlay for bottom-tab icons. Visually aria-hidden — callers must
 * provide an sr-only announcement for the count / attention reason.
 */
export function BottomTabBadge({
  count = 0,
  max = 99,
  maxLabel = '99+',
  variant = 'count',
  className,
  dotClassName,
}: BottomTabBadgeProps) {
  if (variant === 'dot') {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute -end-1.5 -top-1.5 h-2 w-2 rounded-pill bg-[var(--lc-status-underOffer-dot)]',
          className,
          dotClassName,
        )}
      />
    )
  }

  if (count <= 0) return null

  const capped = count > max
  const label = capped ? maxLabel : String(count)

  return (
    <span
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute -end-1.5 -top-1.5 inline-flex min-h-[16px] min-w-[16px] items-center justify-center rounded-pill bg-[var(--lc-action-primary)] px-1 text-[10px] font-semibold leading-none text-[var(--lc-action-primary-text)]',
        className,
      )}
    >
      <Numeric>{label}</Numeric>
    </span>
  )
}

export function BottomTabBadgeAnnouncement({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>
}
