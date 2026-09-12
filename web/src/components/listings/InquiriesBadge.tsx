import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'

export interface InquiriesBadgeProps {
  count: number
  className?: string
  onClick?: (e: React.MouseEvent) => void
}

/** Teal accent badge for new inquiries — hidden when count is 0. */
export function InquiriesBadge({ count, className, onClick }: InquiriesBadgeProps) {
  if (!count || count <= 0) return null

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${count} new inquiries — tap to view`}
      className={cn(
        'inline-flex min-h-[var(--lc-tap-target-min)] items-center rounded-[var(--lc-radius-pill)]',
        'border border-[var(--lc-accent-bold-edge)] bg-[var(--lc-accent)] px-2.5 py-0.5',
        'text-[length:var(--lc-type-caption)] font-semibold text-[var(--lc-accent-bold-text)]',
        className,
      )}
    >
      <Numeric>{count}</Numeric>
      <span className="ms-1">new</span>
    </button>
  )
}
