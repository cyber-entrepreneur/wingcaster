import { cn } from '@/lib/utils'
import { SettingsNavItem } from './SettingsNavItem'
import type { SettingsNavGroupData } from './types'

export interface SettingsNavGroupProps {
  /** Group from the capability-scoped settings index. */
  group: SettingsNavGroupData
  className?: string
}

/**
 * Settings sidebar group: overline heading + nav items.
 * Suppresses render entirely when `items.length === 0` (after search filter or
 * capability gating) — never render a locked/disabled ghost group.
 *
 * Used by: SHR-SET-001 → SHR-SET-002/003/004/005.
 */
export function SettingsNavGroup({ group, className }: SettingsNavGroupProps) {
  if (group.items.length === 0) return null

  return (
    <div className={cn('mt-[var(--lc-space-md)]', className)} data-settings-nav-group={group.id}>
      <h2
        className="mb-[var(--lc-space-2xs)] text-[var(--lc-text-muted)] ltr:uppercase"
        style={{
          font: 'var(--lc-type-overline)',
          letterSpacing: '0.08em',
        }}
      >
        {group.label}
      </h2>
      <ul className="flex list-none flex-col gap-0.5 p-0" role="list">
        {group.items.map((item) => (
          <li key={item.id}>
            <SettingsNavItem item={item} />
          </li>
        ))}
      </ul>
    </div>
  )
}
