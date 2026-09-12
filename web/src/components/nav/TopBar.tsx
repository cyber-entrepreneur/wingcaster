import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { PanelLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GlobalSearch, type NavPersona } from './GlobalSearch'
import { NotificationsPopover, type NavNotification } from './NotificationsPopover'
import { UserMenu, type NavLocale, type UserMenuUser } from './UserMenu'
import { EnvBadge } from './EnvBadge'
import {
  DRAWER_PREF_KEY,
  type DrawerMode,
  readDrawerCollapsedPref,
  writeDrawerCollapsedPref,
} from './SideDrawer'

export type TopBarEnvironment = 'live' | 'test'

export interface TopBarProps {
  persona?: NavPersona
  locale?: NavLocale
  user: UserMenuUser
  environment?: TopBarEnvironment
  /** Slot for SHR-NAV-008 TenantSwitcher (other agent). */
  tenantSwitcher?: ReactNode
  /** Slot for SHR-NAV-006 LanguageSelector (other agent). */
  languageSelector?: ReactNode
  /** Slot / override for PA-NAV-001 env switcher trigger. When omitted, PA gets a static badge. */
  envBadge?: ReactNode
  onEnvBadgeClick?: () => void
  notifications?: NavNotification[]
  onMarkAllNotificationsRead?: () => void | Promise<void>
  onSignOut?: () => void
  /** Slot for AGT-SET-002 ModeChip (left of avatar). */
  modeChip?: ReactNode
  /** Controlled drawer mode for shell integration. */
  drawerMode?: DrawerMode
  onDrawerModeChange?: (mode: DrawerMode) => void
  /** Viewport hint from shell; defaults to matchMedia. */
  viewport?: 'mobile' | 'tablet' | 'desktop'
  className?: string
  routeAnnounce?: string
}

function WingCasterWordmark({ compact }: { compact?: boolean }) {
  return (
    <Link
      to="/"
      className="inline-flex min-h-tap items-center gap-2 rounded-md focus-visible:outline-none"
      aria-label="WingCaster"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
        <path
          d="M4 18 L12 4 L20 18 L16.5 18 L12 10 L7.5 18 Z"
          fill="var(--lc-text-brand)"
        />
      </svg>
      {!compact ? (
        <span
          className="font-[family-name:var(--lc-font-display)] text-[var(--lc-text-primary)]"
          style={{ font: 'var(--lc-type-heading-3)', letterSpacing: 'var(--lc-tracking-heading-3)' }}
        >
          WingCaster
        </span>
      ) : null}
    </Link>
  )
}

function useViewportBucket(forced?: TopBarProps['viewport']) {
  const [bucket, setBucket] = useState<'mobile' | 'tablet' | 'desktop'>(forced ?? 'desktop')

  useEffect(() => {
    if (forced) {
      setBucket(forced)
      return
    }
    const mqDesktop = window.matchMedia('(min-width: 1024px)')
    const mqTablet = window.matchMedia('(min-width: 768px)')
    const update = () => {
      if (mqDesktop.matches) setBucket('desktop')
      else if (mqTablet.matches) setBucket('tablet')
      else setBucket('mobile')
    }
    update()
    mqDesktop.addEventListener('change', update)
    mqTablet.addEventListener('change', update)
    return () => {
      mqDesktop.removeEventListener('change', update)
      mqTablet.removeEventListener('change', update)
    }
  }, [forced])

  return bucket
}

/**
 * SHR-NAV-001 top bar. TenantSwitcher / LanguageSelector / EnvSwitcher are
 * composition slots owned by sibling Wave-0 agents.
 */
export function TopBar({
  persona = 'agent',
  locale = 'en',
  user,
  environment = 'live',
  tenantSwitcher,
  languageSelector,
  envBadge,
  onEnvBadgeClick,
  notifications,
  onMarkAllNotificationsRead,
  onSignOut,
  modeChip,
  drawerMode,
  onDrawerModeChange,
  viewport,
  className,
  routeAnnounce,
}: TopBarProps) {
  const location = useLocation()
  const bucket = useViewportBucket(viewport)
  const [internalDrawer, setInternalDrawer] = useState<DrawerMode>(() => {
    if (typeof window === 'undefined') return 'expanded'
    if (window.matchMedia('(max-width: 767px)').matches) return 'closed'
    if (window.matchMedia('(max-width: 1023px)').matches) return 'rail'
    return readDrawerCollapsedPref() ? 'rail' : 'expanded'
  })

  const mode = drawerMode ?? internalDrawer
  const setMode = onDrawerModeChange ?? setInternalDrawer

  const announce = routeAnnounce ?? location.pathname
  const compactBrand = bucket === 'mobile'
  const searchTrigger = bucket === 'desktop' ? 'input' : 'icon'
  const showLanguageInBar = !(bucket === 'mobile' && typeof window !== 'undefined' && window.innerWidth < 360)

  const toggleDrawer = () => {
    if (bucket === 'mobile') {
      setMode(mode === 'overlay' ? 'closed' : 'overlay')
      return
    }
    if (mode === 'expanded') {
      writeDrawerCollapsedPref(true)
      setMode('rail')
    } else if (mode === 'rail' || mode === 'closed') {
      writeDrawerCollapsedPref(false)
      setMode('expanded')
    } else if (mode === 'overlay') {
      setMode('closed')
    }
  }

  // Persist preference when shell drives mode externally.
  useEffect(() => {
    if (drawerMode === 'rail') writeDrawerCollapsedPref(true)
    if (drawerMode === 'expanded') writeDrawerCollapsedPref(false)
  }, [drawerMode])

  return (
    <header
      role="banner"
      className={cn(
        'sticky top-0 z-sticky flex h-14 w-full items-center gap-2 border-b border-[var(--lc-border)] bg-[var(--lc-surface-raised)] px-2 shadow-sm sm:px-3',
        className,
      )}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-tooltip focus:rounded-md focus:bg-[var(--lc-surface-raised)] focus:px-3 focus:py-2 focus:text-sm focus:text-[var(--lc-text-primary)] focus:shadow-md"
      >
        Skip to content
      </a>

      <button
        type="button"
        className="inline-flex h-tap w-tap min-h-tap min-w-tap items-center justify-center rounded-md text-[var(--lc-text-muted)] hover:text-[var(--lc-text-primary)] focus-visible:outline-none"
        aria-label="Toggle navigation"
        aria-expanded={mode === 'expanded' || mode === 'overlay'}
        onClick={toggleDrawer}
      >
        <PanelLeft className="h-5 w-5" aria-hidden="true" />
      </button>

      <div className="flex min-w-0 items-center gap-2">
        <WingCasterWordmark compact={compactBrand} />
        {persona === 'pa'
          ? (envBadge ?? (
              <EnvBadge env={environment} locale={locale} onClick={onEnvBadgeClick} />
            ))
          : null}
        {tenantSwitcher ? <div className="min-w-0">{tenantSwitcher}</div> : null}
      </div>

      <div className="ms-1 flex min-w-0 flex-1 items-center">
        <GlobalSearch persona={persona} locale={locale} triggerVariant={searchTrigger} />
      </div>

      <div className="ms-auto flex items-center gap-1">
        {showLanguageInBar && languageSelector ? languageSelector : null}
        <NotificationsPopover
          locale={locale}
          notifications={notifications}
          onMarkAllRead={onMarkAllNotificationsRead}
        />
        {modeChip ? <div className="flex items-center">{modeChip}</div> : null}
        <UserMenu user={user} locale={locale} onSignOut={onSignOut} />
      </div>

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announce}
      </div>

      {/* Expose pref key for shells/tests without exporting dead code. */}
      <span hidden data-drawer-pref-key={DRAWER_PREF_KEY} />
    </header>
  )
}

export { readDrawerCollapsedPref, writeDrawerCollapsedPref, DRAWER_PREF_KEY }
