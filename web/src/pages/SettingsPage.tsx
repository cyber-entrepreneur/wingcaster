import { useCallback, useMemo, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { StepUpProvider } from '@/components/mfa'
import {
  SettingsItemRoutesProvider,
  SettingsShell,
} from '@/components/settings'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/AuthContext'
import { useHotkey } from '@/hooks/useHotkey'
import { useLocale } from '@/hooks/useLocale'
import { useSettingsIndex } from '@/hooks/useSettingsIndex'
import { usePageTitle } from '@/lib/usePageTitle'
import { fillCopy, settingsCopy } from '@/lib/settings-copy'
import { collectItemRoutes, navGroupsFromIndex } from '@/lib/settings-nav'
import { filterSettingsGroups, firstVisibleSettingsItem } from '@/lib/settings-search'
import { cn } from '@/lib/utils'

function isSettingsIndexPath(pathname: string): boolean {
  return pathname === '/settings' || pathname === '/settings/'
}

function KbdHint({ label }: { label: string }) {
  return (
    <kbd
      className="rounded-[var(--lc-radius-sm)] border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] px-1 text-[var(--lc-text-muted)]"
      style={{ font: 'var(--lc-type-caption)' }}
    >
      {label}
    </kbd>
  )
}

function SettingsLayoutInner() {
  const location = useLocation()
  const navigate = useNavigate()
  const { agent } = useAuth()
  const { locale } = useLocale()
  const copy = settingsCopy(locale)
  const { data, error, loading, reload } = useSettingsIndex()
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const isIndex = isSettingsIndexPath(location.pathname)

  usePageTitle(copy.title)
  useHotkey('mod+/', () => searchRef.current?.focus(), { enabled: true, allowInInputs: true })

  const groups = useMemo(
    () => navGroupsFromIndex(data, { fallback: Boolean(error), locale }),
    [data, error, locale],
  )
  const filtered = useMemo(() => filterSettingsGroups(groups, query), [groups, query])
  const itemRoutes = useMemo(() => collectItemRoutes(groups), [groups])

  const onSearchSubmit = useCallback(() => {
    const first = firstVisibleSettingsItem(filtered)
    if (first) navigate(first.route)
  }, [filtered, navigate])

  const emptyState = query.trim() ? (
    <div className="space-y-[var(--lc-space-sm)]">
      <p>{fillCopy(copy['search.empty'], { query: query.trim() })}</p>
      <button
        type="button"
        className="text-[var(--lc-text-brand)]"
        onClick={() => setQuery('')}
      >
        {copy['search.clear']}
      </button>
    </div>
  ) : null

  const version = (import.meta.env.VITE_APP_VERSION as string | undefined) || '0.0.0'
  const buildHash = (import.meta.env.VITE_GIT_SHA as string | undefined) || 'dev'
  const footer = (
    <div className="flex flex-col gap-[var(--lc-space-2xs)]">
      <span>
        Wingcaster {version} · {buildHash}
      </span>
      <a href="mailto:support@wingcaster.app" className="text-[var(--lc-text-brand)]">
        {copy['footer.feedback']}
      </a>
    </div>
  )

  const mobileSearch = (
    <div className="sticky top-0 z-10 bg-[var(--lc-bg-page)] px-[var(--lc-space-md)] pt-[var(--lc-space-md)]">
      <Label htmlFor="settings-mobile-search" className="mb-[var(--lc-space-2xs)] block">
        {copy['search.label']}
      </Label>
      <div className="relative">
        <Input
          ref={searchRef}
          id="settings-mobile-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setQuery('')
            if (e.key === 'Enter') {
              e.preventDefault()
              onSearchSubmit()
            }
          }}
          placeholder={copy['search.placeholder']}
          className="bg-[var(--lc-surface-sunken)]"
          autoComplete="off"
        />
      </div>
    </div>
  )

  const banner = error ? (
    <div
      role="status"
      className="mb-[var(--lc-space-md)] rounded-[var(--lc-radius-md)] bg-[var(--lc-status-underOffer-bg)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)] text-[var(--lc-status-underOffer-fg)]"
      style={{ font: 'var(--lc-type-body-sm)' }}
    >
      {copy['error.load']}{' '}
      <button type="button" className="underline" onClick={() => void reload()}>
        {copy['error.retry']}
      </button>
    </div>
  ) : null

  const skeleton = loading && !data ? (
    <div className="space-y-[var(--lc-space-md)]" aria-busy="true" aria-label="Loading settings">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-10 rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)]"
        />
      ))}
    </div>
  ) : null

  return (
    <SettingsItemRoutesProvider value={itemRoutes}>
      <SettingsShell
        title={copy.title}
        groups={filtered}
        searchQuery={query}
        onSearchChange={setQuery}
        searchPlaceholder={copy['search.placeholder']}
        searchLabel={copy['search.label']}
        searchHotkeyHint={<KbdHint label={copy['search.hotkey.win']} />}
        searchInputRef={searchRef}
        onSearchSubmit={onSearchSubmit}
        emptyState={emptyState}
        footer={footer}
        onNavigate={(route) => navigate(route)}
        mobileView={isIndex ? 'list' : 'detail'}
        mobileSearch={mobileSearch}
      >
        {banner}
        {skeleton}
        <Link
          to="/settings"
          className={cn(
            'mb-[var(--lc-space-md)] inline-flex min-h-[var(--lc-tap-target-min)] items-center gap-1',
            'text-[var(--lc-text-brand)] md:hidden',
            isIndex && 'hidden',
          )}
        >
          <ChevronLeft className="h-4 w-4 rtl:hidden" aria-hidden="true" />
          <ChevronRight className="hidden h-4 w-4 rtl:inline" aria-hidden="true" />
          {copy.title}
        </Link>
        <Outlet
          context={{
            settingsIndex: data,
            settingsError: error,
            agent,
            locale,
            reloadSettingsIndex: reload,
          }}
        />
      </SettingsShell>
    </SettingsItemRoutesProvider>
  )
}

/**
 * Settings layout mount (SHR-SET-001). Child routes render in `<Outlet />`.
 * MFA-owned `/settings/2fa` and `/settings/2fa/*` stay nested here so they
 * inherit the shell without this agent owning those page implementations.
 */
export function SettingsPage() {
  return (
    <StepUpProvider>
      <SettingsLayoutInner />
    </StepUpProvider>
  )
}

export default SettingsPage
