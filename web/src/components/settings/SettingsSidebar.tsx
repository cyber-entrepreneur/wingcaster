import { Search, X } from 'lucide-react'
import type { ReactNode, Ref } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { SettingsNavGroup } from './SettingsNavGroup'
import type { SettingsNavGroupData } from './types'

export interface SettingsSidebarProps {
  /** Page title above the search input (desktop). Default: "Settings". */
  title?: string
  /** Controlled search query. */
  searchQuery?: string
  onSearchChange?: (query: string) => void
  /** Placeholder for the search input (parent supplies i18n). */
  searchPlaceholder?: string
  /** Visually-hidden label text for the search input. */
  searchLabel?: string
  /** Optional hotkey hint node (e.g. `<Kbd>⌘/</Kbd>`). */
  searchHotkeyHint?: ReactNode
  /** Capability-scoped (and optionally search-filtered) groups. */
  groups: SettingsNavGroupData[]
  /**
   * Empty-search state announced with `aria-live="polite"`.
   * Rendered when every group has zero items after filter.
   */
  emptyState?: ReactNode
  /** Sticky-bottom footer (version · build hash · feedback). */
  footer?: ReactNode
  /** Optional ref to the search input for `Cmd+/` / `Ctrl+/` focus. */
  searchInputRef?: Ref<HTMLInputElement>
  className?: string
}

/**
 * Desktop settings sub-nav: H1 + search + capability groups + footer.
 * Sticky 240px column with `--lc-surface-raised` fill and trailing hairline border
 * (leading border in RTL via logical properties).
 *
 * Used by: SHR-SET-001 shell for SHR-SET-002/003/004/005 child routes.
 * Invariant: groups come from the server capability index — never hard-code roles.
 */
export function SettingsSidebar({
  title = 'Settings',
  searchQuery = '',
  onSearchChange,
  searchPlaceholder = 'Search settings',
  searchLabel = 'Search settings',
  searchHotkeyHint,
  groups,
  emptyState,
  footer,
  searchInputRef,
  className,
}: SettingsSidebarProps) {
  const hasVisibleItems = groups.some((g) => g.items.length > 0)
  const showClear = searchQuery.length > 0

  return (
    <aside
      role="navigation"
      aria-label="Settings navigation"
      className={cn(
        'flex h-full w-[240px] shrink-0 flex-col border-e border-[var(--lc-border)]',
        'bg-[var(--lc-surface-raised)] p-[var(--lc-space-md)]',
        className,
      )}
      data-settings-sidebar
    >
      <h1
        className="mb-[var(--lc-space-md)] text-[var(--lc-text-heading)]"
        style={{ font: 'var(--lc-type-heading-1)' }}
      >
        {title}
      </h1>

      <div className="relative mb-[var(--lc-space-sm)]">
        <Label htmlFor="settings-sidebar-search" className="sr-only">
          {searchLabel}
        </Label>
        <Search
          className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--lc-text-muted)]"
          aria-hidden="true"
        />
        <Input
          ref={searchInputRef}
          id="settings-sidebar-search"
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange?.(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              onSearchChange?.('')
            }
          }}
          placeholder={searchPlaceholder}
          className={cn(
            'bg-[var(--lc-surface-sunken)] ps-9',
            showClear || searchHotkeyHint ? 'pe-10' : undefined,
          )}
          autoComplete="off"
        />
        {showClear ? (
          <button
            type="button"
            aria-label="Clear search"
            className="absolute end-2 top-1/2 -translate-y-1/2 rounded-[var(--lc-radius-md)] p-1 text-[var(--lc-text-muted)] hover:text-[var(--lc-text-primary)]"
            onClick={() => onSearchChange?.('')}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : searchHotkeyHint ? (
          <span className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-[var(--lc-text-muted)]">
            {searchHotkeyHint}
          </span>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!hasVisibleItems ? (
          <div aria-live="polite" className="py-[var(--lc-space-md)] text-[var(--lc-text-muted)]">
            {emptyState}
          </div>
        ) : (
          groups.map((group) => <SettingsNavGroup key={group.id} group={group} />)
        )}
      </div>

      {footer ? (
        <div
          className="sticky bottom-0 mt-[var(--lc-space-md)] border-t border-[var(--lc-border)] pt-[var(--lc-space-sm)] text-[var(--lc-text-muted)]"
          style={{ font: 'var(--lc-type-caption)' }}
        >
          {footer}
        </div>
      ) : null}
    </aside>
  )
}
