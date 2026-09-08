import type { ReactNode } from 'react'
import { LanguageSelector } from '@/components/nav/LanguageSelector'
import { PaEnvSwitcher } from '@/components/nav/EnvSwitcherPopover'
import { PaEnvWarningStrip } from '@/components/nav/EnvWarningStrip'
import { SideDrawer } from '@/components/nav/SideDrawer'
import { TenantSwitcher } from '@/components/nav/TenantSwitcher'
import { TopBar } from '@/components/nav/TopBar'
import { useAuth } from '@/context/AuthContext'
import { useEnv } from '@/hooks/useEnv'
import { useLocale } from '@/hooks/useLocale'
import { useShellDrawer } from '@/app/useShellDrawer'
import { useShellNotifications } from '@/app/useShellNotifications'
import { cn } from '@/lib/utils'

export interface PaAppShellProps {
  children: ReactNode
  className?: string
  viewport?: 'mobile' | 'tablet' | 'desktop'
}

/**
 * Wave 0 chrome for PA-* routes: TopBar (with PaEnvSwitcher) + SideDrawer +
 * PaEnvWarningStrip when env === test.
 */
export function PaAppShell({ children, className, viewport: viewportProp }: PaAppShellProps) {
  const { agent, logout } = useAuth()
  const { locale } = useLocale()
  const { env, isTest } = useEnv()
  // PA is desktop-only per PA-NAV-001.
  const { drawerMode, setDrawerMode } = useShellDrawer({ forceDesktop: true })
  const effectiveViewport = viewportProp ?? 'desktop'
  const { notifications, markAllRead } = useShellNotifications(Boolean(agent))

  if (!agent) return <>{children}</>

  const user = {
    id: agent.id,
    name: agent.name || agent.email || 'Platform admin',
    email: agent.email || '',
    photoUrl: agent.photo ?? null,
  }

  const persistentDrawer = drawerMode === 'expanded' || drawerMode === 'rail'
  const overlayDrawer = drawerMode === 'overlay'

  return (
    <div
      className={cn('flex min-h-screen flex-col bg-[var(--lc-bg-page)]', className)}
      data-persona="pa"
      data-env={env}
      data-testid="pa-app-shell"
    >
      <TopBar
        persona="pa"
        locale={locale}
        user={user}
        environment={env}
        viewport={effectiveViewport}
        drawerMode={drawerMode}
        onDrawerModeChange={setDrawerMode}
        envBadge={<PaEnvSwitcher />}
        tenantSwitcher={<TenantSwitcher locale={locale} />}
        languageSelector={<LanguageSelector />}
        notifications={notifications}
        onMarkAllNotificationsRead={markAllRead}
        onSignOut={logout}
      />

      {isTest ? <PaEnvWarningStrip /> : null}

      <div className="flex min-h-0 flex-1">
        {persistentDrawer ? (
          <aside className="sticky top-14 h-[calc(100vh-3.5rem)] shrink-0 self-start">
            <SideDrawer
              persona="pa"
              locale={locale}
              mode={drawerMode}
              onModeChange={setDrawerMode}
              languageSlot={<LanguageSelector />}
            />
          </aside>
        ) : null}

        {overlayDrawer ? (
          <SideDrawer
            persona="pa"
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
