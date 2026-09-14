import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { SettingsCardRow } from './SettingsCardRow'
import type { SettingsNavGroupData } from './types'

export interface SettingsCardListProps {
  /** Capability-scoped groups (already filtered by search if applicable). */
  groups: SettingsNavGroupData[]
  /** Called when a row is activated. */
  onNavigate?: (route: string) => void
  /**
   * Empty-search / empty-list slot. Parent supplies copy
   * (`search.empty` / Clear search) when needed.
   */
  emptyState?: ReactNode
  className?: string
}

/**
 * Mobile ≤767px settings home — one raised card per group with heading-3 title
 * and 56px list rows. Sidebar is NOT rendered on mobile.
 *
 * Used by: SHR-SET-001 mobile layout; rows push into SHR-SET-002/003/004/005.
 * Groups with zero items after filter are omitted.
 */
export function SettingsCardList({
  groups,
  onNavigate,
  emptyState,
  className,
}: SettingsCardListProps) {
  const visible = groups.filter((g) => g.items.length > 0)

  if (visible.length === 0) {
    return (
      <div className={cn('px-[var(--lc-space-md)] py-[var(--lc-space-xl)]', className)}>
        {emptyState ?? null}
      </div>
    )
  }

  return (
    <div
      className={cn('flex flex-col gap-[var(--lc-space-md)] px-[var(--lc-space-md)]', className)}
      data-settings-card-list
    >
      {visible.map((group) => (
        <Card
          key={group.id}
          className="overflow-hidden shadow-[var(--lc-elevation-sm)] rounded-[var(--lc-radius-lg)]"
          data-settings-card-group={group.id}
        >
          <CardHeader className="px-[var(--lc-space-md)] py-[var(--lc-space-sm)]">
            <CardTitle
              className="text-[var(--lc-text-heading)]"
              style={{ font: 'var(--lc-type-heading-3)' }}
            >
              {group.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-[var(--lc-border)] p-0">
            {group.items.map((item) => (
              <SettingsCardRow
                key={item.id}
                item={item}
                groupLabel={group.label}
                onNavigate={onNavigate}
              />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
