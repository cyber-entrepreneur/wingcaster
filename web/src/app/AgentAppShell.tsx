import type { ReactNode } from 'react'
import { BottomTabBar } from '@/components/nav/BottomTabBar'
import { LanguageSelector } from '@/components/nav/LanguageSelector'
import { SideDrawer } from '@/components/nav/SideDrawer'
import { TenantSwitcher } from '@/components/nav/TenantSwitcher'
import { TopBar } from '@/components/nav/TopBar'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/hooks/useLocale'
import { useUnreadConversationCount } from '@/hooks/useUnreadConversationCount'
import { useContactAttentionCount } from '@/hooks/useContactAttentionCount'
import { isAgencyScopedAgent } from '@/app/resolvePersona'
import { useShellDrawer } from '@/app/useShellDrawer'
import { useShellNotifications } from '@/app/useShellNotifications'
import { cn } from '@/lib/utils'

export interface AgentAppShellProps {
  children: ReactNode
  className?: string
  /** Test override for drawer viewport. */
  viewport?: 'mobile' | 'tablet' | 'desktop'
}

/**
 * Wave 0 chrome for AGT-* routes: TopBar + SideDrawer (desktop) + BottomTabBar (mobile).
 */
export function AgentAppShell({ children, className, viewport: viewportProp }: AgentAppShellProps) {
  const { agent, logout } = useAuth()
  const { locale } = useLocale()
  const { viewport, drawerMode, setDrawerMode } = useShellDrawer()
  const effectiveViewport = viewportProp ?? viewport
  const { notifications, markAllRead } = useShellNotifications(Boolean(agent))
  const inbox = useUnreadConversationCount({ enabled: Boolean(agent) })
  const contacts = useContactAttentionCount({ enabled: Boolean(agent) })
  const agencyScoped = isAgencyScopedAgent(agent)

  if (!agent) return <>{children}</>

  const user = {
    id: agent.id,
    name: agent.name || agent.email || 'Agent',
    email: agent.email || '',
    photoUrl: agent.photo ?? null,
  }

  const badges: Record<string, number> = {}
  if (inbox.count > 0) badges.inbox = inbox.count
  if (contacts.count > 0) badges.contacts = contacts.count

  const persistentDrawer =
    effectiveViewport !== 'mobile' && (drawerMode === 'expanded' || drawerMode === 'rail')
  const overlayDrawer = drawerMode === 'overlay'

  return (
    <div
      className={cn('flex min-h-screen flex-col bg-[var(--lc-bg-page)]', className)}
      data-persona="agent"
      data-testid="agent-app-shell"
    >
      <TopBar
        persona="agent"
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
      />

      <div className="flex min-h-0 flex-1">
        {persistentDrawer ? (
          <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] shrink-0 self-start md:block">
            <SideDrawer
              persona="agent"
              locale={locale}
              mode={drawerMode}
              onModeChange={setDrawerMode}
              badges={badges}
              languageSlot={<LanguageSelector />}
            />
          </aside>
        ) : null}

        {overlayDrawer ? (
          <SideDrawer
            persona="agent"
            locale={locale}
            mode="overlay"
            onModeChange={setDrawerMode}
            badges={badges}
            languageSlot={<LanguageSelector />}
          />
        ) : null}

        <main
          id="main-content"
          tabIndex={-1}
          className={cn(
            'min-w-0 flex-1 outline-none',
            // Room for fixed bottom tab bar on mobile.
            'pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:pb-0',
          )}
        >
          {children}
        </main>
      </div>

      <BottomTabBar
        locale={locale}
        inboxUnreadCount={inbox.count}
        contactsAttentionCount={contacts.count}
        isAgencyScoped={agencyScoped}
        onSignOut={logout}
        forceMobile={effectiveViewport === 'mobile' ? true : undefined}
      />
    </div>
  )
}
