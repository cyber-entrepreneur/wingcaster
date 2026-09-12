import type { ReactNode, Ref } from 'react'
import { cn } from '@/lib/utils'
import { SettingsCardList } from './SettingsCardList'
import { SettingsSidebar } from './SettingsSidebar'
import type { SettingsNavGroupData } from './types'

export interface SettingsShellProps {
  /**
   * Right-pane content (desktop) / full-screen child (mobile detail).
   * Pass `<Outlet />` from the layout route, or any stub children.
   */
  children?: ReactNode
  /** Capability-scoped nav groups driving sidebar + mobile cards. */
  groups?: SettingsNavGroupData[]
  /** Controlled search query shared by desktop sidebar + mobile search. */
  searchQuery?: string
  onSearchChange?: (query: string) => void
  searchPlaceholder?: string
  searchLabel?: string
  searchHotkeyHint?: ReactNode
  title?: string
  /** Sidebar sticky footer slot. */
  footer?: ReactNode
  /** Empty-search / empty-list slot. */
  emptyState?: ReactNode
  /** Mobile card-row navigation (desktop uses NavLink inside the sidebar). */
  onNavigate?: (route: string) => void
  /**
   * Optional fully-custom sidebar. When provided, replaces the default
   * `<SettingsSidebar>` built from `groups`.
   */
  sidebar?: ReactNode
  /**
   * Optional fully-custom mobile nav. When provided, replaces the default
   * `<SettingsCardList>` built from `groups`.
   */
  mobileNav?: ReactNode
  /** Sticky mobile search slot rendered above the card list. */
  mobileSearch?: ReactNode
  searchInputRef?: Ref<HTMLInputElement>
  onSearchSubmit?: () => void
  /**
   * Mobile layout mode. `list` = grouped cards (settings home);
   * `detail` = full-screen child pane (SHR-SET-002/003/004/005).
   * Desktop always shows sidebar + pane.
   */
  mobileView?: 'list' | 'detail'
  /**
   * Skip-link target id for "Skip to settings content".
   * Default: `settings-content`.
   */
  contentId?: string
  className?: string
}

/**
 * Settings sub-nav shell — desktop 2-column (240px sticky sidebar + right pane),
 * mobile ≤767px grouped-cards (no sidebar). Right pane hosts either the SHR-SET-001
 * anchor dashboard (`/settings` exact) or a child route (SHR-SET-002/003/004/005).
 *
 * Stub: renders `children` in the outlet slot; no route registration required.
 * Viewport switch is CSS (`md:`) — Wave-4 can swap to `useMediaQuery` when available.
 *
 * Used by: SHR-SET-001 (anchor) + SHR-SET-002/003/004/005 (right-pane content only).
 *
 * Do NOT touch Wave 0 `AppShell*` / `components/nav/*` — this is second-level chrome.
 */
export function SettingsShell({
  children,
  groups = [],
  searchQuery,
  onSearchChange,
  searchPlaceholder,
  searchLabel,
  searchHotkeyHint,
  title,
  footer,
  emptyState,
  onNavigate,
  sidebar,
  mobileNav,
  mobileSearch,
  searchInputRef,
  onSearchSubmit,
  mobileView = 'list',
  contentId = 'settings-content',
  className,
}: SettingsShellProps) {
  const defaultSidebar = (
    <SettingsSidebar
      title={title}
      searchQuery={searchQuery}
      onSearchChange={onSearchChange}
      searchPlaceholder={searchPlaceholder}
      searchLabel={searchLabel}
      searchHotkeyHint={searchHotkeyHint}
      groups={groups}
      emptyState={emptyState}
      footer={footer}
      searchInputRef={searchInputRef}
      onSearchSubmit={onSearchSubmit}
    />
  )

  const defaultMobileNav = (
    <SettingsCardList groups={groups} onNavigate={onNavigate} emptyState={emptyState} />
  )

  return (
    <div
      className={cn(
        'w-full bg-[var(--lc-bg-page)] text-[var(--lc-text-primary)]',
        className,
      )}
      data-settings-shell
    >
      <a
        href={`#${contentId}`}
        className={cn(
          'sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-[var(--lc-space-sm)]',
          'focus:rounded-[var(--lc-radius-md)] focus:bg-[var(--lc-surface-raised)]',
          'focus:px-[var(--lc-space-sm)] focus:py-[var(--lc-space-2xs)]',
          'focus:text-[var(--lc-text-brand)]',
        )}
      >
        Skip to settings content
      </a>

      {/* Desktop / tablet ≥768px */}
      <div
        className={cn(
          'mx-auto hidden max-w-[1200px] md:grid',
          'grid-cols-[240px_minmax(640px,960px)] gap-[var(--lc-space-2xl)]',
          'px-[var(--lc-space-2xl)] pt-[var(--lc-space-4xl)]',
        )}
      >
        <div className="sticky top-0 self-start" style={{ maxHeight: '100vh' }}>
          {sidebar ?? defaultSidebar}
        </div>
        <main
          id={contentId}
          className="min-w-0 transition-opacity duration-[var(--lc-duration-base)]"
          data-settings-pane
        >
          {children}
        </main>
      </div>

      {/* Mobile ≤767px — list = grouped cards; detail = full-screen child pane. */}
      <div className="flex flex-col md:hidden">
        {mobileView === 'list' ? (
          <>
            {mobileSearch}
            <div className="pt-[var(--lc-space-xl)]">{mobileNav ?? defaultMobileNav}</div>
          </>
        ) : (
          <main
            id={`${contentId}-mobile`}
            className="min-w-0 px-[var(--lc-space-md)] pb-[var(--lc-space-xl)] pt-[var(--lc-space-xl)]"
            data-settings-pane-mobile
          >
            {children}
          </main>
        )}
      </div>
    </div>
  )
}
