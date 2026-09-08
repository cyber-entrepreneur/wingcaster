import { NavLink } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'
import type { SettingsNavBadge, SettingsNavItemData } from './types'

export interface SettingsNavItemProps {
  /** Item data from the capability-scoped settings index. */
  item: SettingsNavItemData
  className?: string
}

function NavBadge({ badge }: { badge: SettingsNavBadge }) {
  if (badge.kind === 'count') {
    if (badge.value <= 0) return null
    return (
      <Badge variant="secondary" className="ml-auto shrink-0">
        <Numeric>{badge.value}</Numeric>
      </Badge>
    )
  }

  const variant =
    badge.tone === 'warning' ? 'underOffer' : badge.tone === 'danger' ? 'unpublished' : 'secondary'

  return (
    <Badge variant={variant} className="ml-auto shrink-0">
      {badge.label}
    </Badge>
  )
}

/**
 * One settings sidebar link. Active state comes from React Router `NavLink`
 * `isActive` (longest-prefix match is the caller's responsibility when wiring
 * multiple overlapping routes). Leading 3px brand bar + sunken fill + brand ink.
 *
 * Used by: SHR-SET-001 shell chrome for SHR-SET-002 (account), SHR-SET-003
 * (billing/notifications), SHR-SET-004 (sessions), SHR-SET-005 (danger zone).
 *
 * Invariant: do NOT use `aria-current` alone for the active visual — `isActive` drives it.
 */
export function SettingsNavItem({ item, className }: SettingsNavItemProps) {
  const Icon = item.icon
  const danger = Boolean(item.danger)

  return (
    <NavLink
      to={item.route}
      className={({ isActive }) =>
        cn(
          'relative flex h-10 w-full items-center gap-2 rounded-[var(--lc-radius-md)] px-[var(--lc-space-sm)]',
          'text-[var(--lc-text-primary)] transition-colors duration-[var(--lc-duration-base)]',
          'hover:bg-[var(--lc-surface-sunken)]',
          isActive && 'bg-[var(--lc-surface-sunken)] font-semibold text-[var(--lc-text-brand)]',
          danger && 'hover:text-[var(--lc-status-unpublished-fg)]',
          danger && isActive && 'text-[var(--lc-status-unpublished-fg)]',
          className,
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* Leading accent bar — flips to end edge under RTL via logical border. */}
          {isActive ? (
            <span
              aria-hidden="true"
              className="absolute inset-y-0 start-0 w-[3px] rounded-s-[var(--lc-radius-md)] bg-[var(--lc-action-primary)]"
            />
          ) : null}
          <Icon
            className={cn(
              'h-[18px] w-[18px] shrink-0',
              danger
                ? 'text-[var(--lc-status-unpublished-fg)]'
                : isActive
                  ? 'text-[var(--lc-text-brand)]'
                  : 'text-[var(--lc-text-primary)]',
            )}
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 truncate" style={{ font: 'var(--lc-type-body)' }}>
            {item.label}
          </span>
          {item.badge ? <NavBadge badge={item.badge} /> : null}
        </>
      )}
    </NavLink>
  )
}
