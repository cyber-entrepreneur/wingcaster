import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Home, LayoutDashboard, Menu, MessageSquare, Users } from 'lucide-react'
import { useContactAttentionCount } from '@/hooks/useContactAttentionCount'
import { useUnreadConversationCount } from '@/hooks/useUnreadConversationCount'
import { useVisualViewportKeyboardVisible } from '@/hooks/useVisualViewportKeyboardVisible'
import { cn } from '@/lib/utils'
import { BottomTab } from './BottomTab'
import {
  BOTTOM_TAB_COPY,
  formatBottomTabCopy,
  MoreSheet,
  type BottomTabLocale,
} from './MoreSheet'

export type { BottomTabLocale }
export { BOTTOM_TAB_COPY, formatBottomTabCopy }

const MOBILE_MQ = '(max-width: 767px)'

function useIsMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia(MOBILE_MQ).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia(MOBILE_MQ)
    const sync = () => setIsMobile(mq.matches)
    sync()
    mq.addEventListener?.('change', sync)
    return () => mq.removeEventListener?.('change', sync)
  }, [])

  return isMobile
}

function resolveActiveTab(pathname: string): 'dashboard' | 'listings' | 'inbox' | 'contacts' | null {
  // Prefer explicit inbox routes (incl. legacy /dashboard/inbox).
  if (
    pathname === '/inbox' ||
    pathname.startsWith('/inbox/') ||
    pathname === '/dashboard/inbox' ||
    pathname.startsWith('/dashboard/inbox/')
  ) {
    return 'inbox'
  }
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) return 'dashboard'
  if (pathname === '/listings' || pathname.startsWith('/listings/')) return 'listings'
  if (pathname === '/contacts' || pathname.startsWith('/contacts/')) return 'contacts'
  return null
}

export interface BottomTabBarProps {
  locale?: BottomTabLocale
  /** Inbox unread conversation count. When omitted, polls via useUnreadConversationCount. */
  inboxUnreadCount?: number
  /** Contacts opportunity-attention count. When omitted, polls via useContactAttentionCount. */
  contactsAttentionCount?: number
  /**
   * More attention flag (MFA not enrolled / trial ending / failed payment).
   * Pass a string for the accessible warning label; `true` uses the default copy.
   */
  moreAttention?: boolean | string
  /** Agency-scoped agents see Team in the More sheet. */
  isAgencyScoped?: boolean
  onSignOut?: () => void
  className?: string
  /** Test override — force mobile visibility regardless of matchMedia. */
  forceMobile?: boolean
}

/**
 * SHR-NAV-003 — Agent mobile bottom tab bar.
 * Hidden on ≥768px and while the soft keyboard is visible.
 */
export function BottomTabBar({
  locale = 'en',
  inboxUnreadCount: inboxUnreadCountProp,
  contactsAttentionCount: contactsAttentionCountProp,
  moreAttention = false,
  isAgencyScoped = false,
  onSignOut,
  className,
  forceMobile,
}: BottomTabBarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const isMobile = useIsMobileViewport()
  const keyboardVisible = useVisualViewportKeyboardVisible()
  const [moreOpen, setMoreOpen] = useState(false)
  const liveUnread = useUnreadConversationCount({
    enabled: inboxUnreadCountProp === undefined,
    initialCount: inboxUnreadCountProp,
  })
  const liveAttention = useContactAttentionCount({
    enabled: contactsAttentionCountProp === undefined,
    initialCount: contactsAttentionCountProp,
  })
  const inboxUnreadCount = inboxUnreadCountProp ?? liveUnread.count
  const contactsAttentionCount = contactsAttentionCountProp ?? liveAttention.count

  const copy = BOTTOM_TAB_COPY[locale]
  const isRtl = locale === 'ar'
  const activeTab = resolveActiveTab(location.pathname)
  const showBar = (forceMobile ?? isMobile) && !keyboardVisible

  const go = (path: string, tabId: typeof activeTab | 'more') => {
    if (tabId !== 'more' && activeTab === tabId) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    navigate(path)
  }

  if (!showBar) return null

  const moreWarningLabel =
    typeof moreAttention === 'string'
      ? moreAttention
      : moreAttention
        ? copy['a11y.badge.moreWarning']
        : undefined

  return (
    <>
      <nav
        role="tablist"
        aria-label={copy['a11y.nav']}
        dir={isRtl ? 'rtl' : 'ltr'}
        data-testid="agent-bottom-tab-bar"
        className={cn(
          'fixed inset-x-0 bottom-0 z-sticky flex w-full border-t border-[var(--lc-border)] bg-[var(--lc-surface-raised)] md:hidden',
          'pb-[env(safe-area-inset-bottom,0px)]',
          className,
        )}
        style={{
          // Soft upward lift using Broadcast elevation (no invented --lc-shadow-up).
          boxShadow: '0 -2px 0 0 color-mix(in srgb, var(--lc-surface-inverse) 10%, transparent)',
        }}
      >
        <div className="flex h-14 w-full items-stretch">
          <BottomTab
            id="bottom-tab-dashboard"
            label={copy['tab.dashboard']}
            icon={LayoutDashboard}
            active={activeTab === 'dashboard'}
            onSelect={() => go('/dashboard', 'dashboard')}
            activeAnnouncement={formatBottomTabCopy(copy['a11y.tab.active'], {
              tabLabel: copy['tab.dashboard'],
            })}
          />
          <BottomTab
            id="bottom-tab-listings"
            label={copy['tab.listings']}
            icon={Home}
            active={activeTab === 'listings'}
            onSelect={() => go('/listings', 'listings')}
            activeAnnouncement={formatBottomTabCopy(copy['a11y.tab.active'], {
              tabLabel: copy['tab.listings'],
            })}
          />
          <BottomTab
            id="bottom-tab-inbox"
            label={copy['tab.inbox']}
            icon={MessageSquare}
            active={activeTab === 'inbox'}
            onSelect={() => go('/inbox', 'inbox')}
            activeAnnouncement={formatBottomTabCopy(copy['a11y.tab.active'], {
              tabLabel: copy['tab.inbox'],
            })}
            badge={
              inboxUnreadCount > 0
                ? {
                    variant: 'count',
                    count: inboxUnreadCount,
                    max: 99,
                    maxLabel: copy['badge.unread.max'],
                    announcement: formatBottomTabCopy(copy['a11y.badge.unread'], {
                      count: inboxUnreadCount > 99 ? copy['badge.unread.max'] : inboxUnreadCount,
                    }),
                  }
                : null
            }
          />
          <BottomTab
            id="bottom-tab-contacts"
            label={copy['tab.contacts']}
            icon={Users}
            active={activeTab === 'contacts'}
            onSelect={() => go('/contacts', 'contacts')}
            activeAnnouncement={formatBottomTabCopy(copy['a11y.tab.active'], {
              tabLabel: copy['tab.contacts'],
            })}
            badge={
              contactsAttentionCount > 0
                ? {
                    variant: 'count',
                    count: contactsAttentionCount,
                    max: 9,
                    maxLabel: copy['badge.attention.max'],
                    announcement: formatBottomTabCopy(copy['a11y.badge.attention'], {
                      count:
                        contactsAttentionCount > 9
                          ? copy['badge.attention.max']
                          : contactsAttentionCount,
                    }),
                  }
                : null
            }
          />
          <BottomTab
            id="bottom-tab-more"
            label={copy['tab.more']}
            icon={Menu}
            active={moreOpen}
            onSelect={() => setMoreOpen(true)}
            badge={
              moreAttention
                ? {
                    variant: 'dot',
                    announcement: moreWarningLabel,
                  }
                : null
            }
          />
        </div>
      </nav>

      <MoreSheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        locale={locale}
        showTeam={isAgencyScoped}
        onSignOut={onSignOut}
      />
    </>
  )
}
