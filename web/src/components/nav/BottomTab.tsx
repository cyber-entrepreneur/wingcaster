import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BottomTabBadge, BottomTabBadgeAnnouncement, type BottomTabBadgeVariant } from './BottomTabBadge'

export interface BottomTabBadgeConfig {
  variant: BottomTabBadgeVariant
  count?: number
  max?: number
  maxLabel?: string
  /** Accessible announcement (count / attention reason). Required when badge shown. */
  announcement?: string
}

export interface BottomTabProps {
  id: string
  label: string
  icon: LucideIcon
  active?: boolean
  onSelect: () => void
  badge?: BottomTabBadgeConfig | null
  /** Active-tab a11y string, e.g. "Currently on Dashboard". */
  activeAnnouncement?: string
  className?: string
}

export function BottomTab({
  id,
  label,
  icon: Icon,
  active = false,
  onSelect,
  badge,
  activeAnnouncement,
  className,
}: BottomTabProps) {
  const showBadge =
    !!badge &&
    (badge.variant === 'dot' || (typeof badge.count === 'number' && badge.count > 0))

  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={active}
      aria-current={active ? 'page' : undefined}
      onClick={onSelect}
      className={cn(
        'relative flex min-h-[var(--lc-tap-target-min)] min-w-[var(--lc-tap-target-min)] flex-1 flex-col items-center justify-center gap-[var(--lc-space-3xs)] px-1 pt-1',
        'text-[var(--lc-text-muted)] transition-[color] duration-[100ms] ease-out',
        'hover:text-[var(--lc-action-primary-hover)]',
        'active:text-[var(--lc-action-primary-hover)]',
        active && 'text-[var(--lc-action-primary)] font-semibold active:text-[var(--lc-action-primary-hover)]',
        className,
      )}
    >
      {active ? (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 mx-auto h-0.5 w-5 rounded-pill bg-[var(--lc-action-primary)]"
        />
      ) : null}

      <span className="relative inline-flex h-6 w-6 items-center justify-center">
        <Icon
          aria-hidden="true"
          className="h-6 w-6"
          strokeWidth={active ? 2 : 1.5}
        />
        {showBadge && badge ? (
          <BottomTabBadge
            variant={badge.variant}
            count={badge.count}
            max={badge.max}
            maxLabel={badge.maxLabel}
          />
        ) : null}
      </span>

      <span
        className={cn(
          'max-w-full truncate',
          active ? 'font-semibold text-[var(--lc-action-primary)]' : 'font-medium text-[var(--lc-text-muted)]',
        )}
        style={{
          font: 'var(--lc-type-caption)',
          fontSize: '11px',
          lineHeight: '14px',
          fontWeight: active ? 600 : 500,
        }}
      >
        {label}
      </span>

      {active && activeAnnouncement ? (
        <span className="sr-only">{activeAnnouncement}</span>
      ) : null}
      {showBadge && badge?.announcement ? (
        <BottomTabBadgeAnnouncement>{badge.announcement}</BottomTabBadgeAnnouncement>
      ) : null}
    </button>
  )
}
