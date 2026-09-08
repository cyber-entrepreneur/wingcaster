import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Benefit {
  icon: LucideIcon
  /** Bold weight-600 line (parent supplies i18n). */
  label: string
  /** Muted sub-line. */
  sub: string
}

export interface BenefitListProps {
  /** Exactly three benefits — TypeScript tuple enforces length. */
  items: [Benefit, Benefit, Benefit]
  className?: string
}

/**
 * Iconified value-prop stack for WhatsApp intake commit.
 *
 * Used by: AGT-WLB-001 only. Other WLB screens do not render this.
 *
 * Stub visual + prop types only.
 */
export function BenefitList({ items, className }: BenefitListProps) {
  return (
    <ul
      className={cn(
        'rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-xl)]',
        'shadow-[var(--lc-elevation-sm)]',
        'flex flex-col gap-[var(--lc-space-lg)]',
        className,
      )}
    >
      {items.map((item) => {
        const Icon = item.icon
        return (
          <li key={item.label} className="flex items-start gap-[var(--lc-space-md)]">
            <span
              aria-hidden
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                'bg-[var(--lc-accent-bold)] text-[var(--lc-accent-bold-text)]',
                'outline outline-1 outline-[var(--lc-accent-bold-edge)]',
              )}
            >
              <Icon className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-[var(--lc-text-primary)]">{item.label}</p>
              <p className="mt-0.5 text-sm text-[var(--lc-text-muted)]">{item.sub}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
