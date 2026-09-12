import type { ReactNode } from 'react'
import { LanguageSelector } from '@/components/nav/LanguageSelector'
import { ModeChip } from '@/components/nav/ModeChip'
import { SideDrawer } from '@/components/nav/SideDrawer'
import { TenantSwitcher } from '@/components/nav/TenantSwitcher'
import { TopBar } from '@/components/nav/TopBar'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/hooks/useLocale'
import { useShellDrawer } from '@/app/useShellDrawer'
import { useShellNotifications } from '@/app/useShellNotifications'
import { cn } from '@/lib/utils'

export interface AgencyAppShellProps {
  children: ReactNode
  className?: string
  viewport?: 'mobile' | 'tablet' | 'desktop'
}

/**
 * Wave 0 chrome for AGN-* routes: TopBar + SideDrawer only (desktop-only persona).
 * No bottom tab bar.
 */
export function AgencyAppShell({ children, className, viewport: viewportProp }: AgencyAppShellProps) {
  const { agent, logout } = useAuth()
  const { locale } = useLocale()
  // Agency is desktop-primary; still respond to tablet rail defaults.
  const { viewport, drawerMode, setDrawerMode } = useShellDrawer()
  const effectiveViewport = viewportProp ?? (viewport === 'mobile' ? 'desktop' : viewport)
  const { notifications, markAllRead } = useShellNotifications(Boolean(agent))

  if (!agent) return <>{children}</>

  const user = {
    id: agent.id,
    name: agent.name || agent.email || 'Agency admin',
    email: agent.email || '',
    photoUrl: agent.photo ?? null,
  }

  const persistentDrawer = drawerMode === 'expanded' || drawerMode === 'rail'
  const overlayDrawer = drawerMode === 'overlay'

  return (
    <div
      className={cn('flex min-h-screen flex-col bg-[var(--lc-bg-page)]', className)}
      data-persona="agency"
      data-testid="agency-app-shell"
    >
      <TopBar
        persona="agency"
        locale={locale}
        user={user}
        viewport={effectiveViewport}
        drawerMode={drawerMode}
        onDrawerModeChange={setDrawerMode}
        tenantSwitcher={<TenantSwitcher locale={locale} />}
        languageSelector={<LanguageSelector />}
        notifications={notifications}
        onMarkAllNotificationsRead={markAllRead}
        onSignOut={logout}
        modeChip={<ModeChip />}
      />

      <div className="flex min-h-0 flex-1">
        {persistentDrawer ? (
          <aside className="sticky top-14 h-[calc(100vh-3.5rem)] shrink-0 self-start">
            <SideDrawer
              persona="agency"
              locale={locale}
              mode={drawerMode}
              onModeChange={setDrawerMode}
              languageSlot={<LanguageSelector />}
            />
          </aside>
        ) : null}

        {overlayDrawer ? (
          <SideDrawer
            persona="agency"
            locale={locale}
            mode="overlay"
            onModeChange={setDrawerMode}
            languageSlot={<LanguageSelector />}
          />
        ) : null}

        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 outline-none">
          {children}
        </main>
      </div>
    </div>
  )
}
