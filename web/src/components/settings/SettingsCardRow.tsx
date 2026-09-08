import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'
import type { SettingsNavBadge, SettingsNavItemData } from './types'

export interface SettingsCardRowProps {
  /** Item from the capability-scoped settings index. */
  item: SettingsNavItemData
  /** Group label included in aria-label for screen readers. */
  groupLabel: string
  /** Called on activate — parent pushes the child route. */
  onNavigate?: (route: string) => void
  className?: string
}

function RowBadge({ badge }: { badge: SettingsNavBadge }) {
  if (badge.kind === 'count') {
    if (badge.value <= 0) return null
    return (
      <Badge variant="secondary" className="shrink-0">
        <Numeric>{badge.value}</Numeric>
      </Badge>
    )
  }

  const variant =
    badge.tone === 'warning' ? 'underOffer' : badge.tone === 'danger' ? 'unpublished' : 'secondary'

  return (
    <Badge variant={variant} className="shrink-0">
      {badge.label}
    </Badge>
  )
}

/**
 * Mobile settings card row — 56px tall button with icon + label + optional badge
 * + directional chevron (`ChevronRight` LTR / `ChevronLeft` RTL).
 *
 * Used by: SHR-SET-001 mobile grouped-cards; navigates into SHR-SET-002/003/004/005.
 */
export function SettingsCardRow({ item, groupLabel, onNavigate, className }: SettingsCardRowProps) {
  const Icon = item.icon
  const danger = Boolean(item.danger)

  return (
    <button
      type="button"
      role="link"
      aria-label={`${item.label}, ${groupLabel} group`}
      onClick={() => onNavigate?.(item.route)}
      className={cn(
        'flex h-14 w-full items-center gap-3 px-[var(--lc-space-md)] text-start',
        'text-[var(--lc-text-primary)] transition-colors duration-[var(--lc-duration-base)]',
        'hover:bg-[var(--lc-surface-sunken)]',
        'focus-visible:outline-none',
        danger && 'hover:text-[var(--lc-status-unpublished-fg)]',
        className,
      )}
    >
      <Icon
        className={cn(
          'h-6 w-6 shrink-0',
          danger ? 'text-[var(--lc-status-unpublished-fg)]' : 'text-[var(--lc-text-primary)]',
        )}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1 truncate" style={{ font: 'var(--lc-type-body)' }}>
        {item.label}
      </span>
      {item.badge ? <RowBadge badge={item.badge} /> : null}
      <ChevronRight
        className="h-5 w-5 shrink-0 text-[var(--lc-text-muted)] rtl:hidden"
        aria-hidden="true"
      />
      <ChevronLeft
        className="hidden h-5 w-5 shrink-0 text-[var(--lc-text-muted)] rtl:block"
        aria-hidden="true"
      />
    </button>
  )
}
