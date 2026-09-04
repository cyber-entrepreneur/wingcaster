/**
 * CrmShell — Command Center layout wrapper for all CRM pages.
 * Renders a sticky left sidebar nav + main content area.
 */
import { type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Inbox,
  Users,
  CheckSquare,
  TrendingUp,
  BarChart3,
  Megaphone,
  Settings,
  LayoutDashboard,
  Zap,
  MessageSquareText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Numeric } from '@/components/ui/numeric'

interface NavItem {
  label: string
  path: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number | string
}

interface CrmShellProps {
  children: ReactNode
  /** Pass unread / overdue counts to surface on nav badges */
  badges?: {
    inbox?: number
    tasks?: number
  }
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Inbox', path: '/dashboard/inbox', icon: Inbox },
  { label: 'Contacts', path: '/contacts', icon: Users },
  { label: 'Tasks', path: '/tasks', icon: CheckSquare },
  { label: 'Opportunities', path: '/opportunities', icon: TrendingUp },
  { label: 'Campaigns', path: '/campaigns', icon: Megaphone },
  { label: 'Message Templates', path: '/message-templates', icon: MessageSquareText },
  { label: 'Analytics', path: '/analytics/crm', icon: BarChart3 },
  { label: 'Workflows', path: '/workflows', icon: Zap },
  { label: 'Integrations', path: '/integrations', icon: Settings },
]

export function CrmShell({ children, badges = {} }: CrmShellProps) {
  const location = useLocation()

  return (
    <div className="flex min-h-screen bg-[var(--lc-bg-page)]">
      <aside className="hidden w-56 shrink-0 border-r border-[var(--lc-border)] bg-[var(--lc-surface)] lg:flex lg:flex-col">
        <div className="flex h-14 items-center border-b border-[var(--lc-border)] px-4">
          <span className="text-[11px] font-semibold uppercase tracking-[var(--lc-tracking-overline)] text-[var(--lc-text-muted)]">
            CRM
          </span>
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active =
              item.path === '/dashboard'
                ? location.pathname === '/dashboard'
                : location.pathname.startsWith(item.path)
            const badge =
              item.path === '/dashboard/inbox' ? badges.inbox : item.path === '/tasks' ? badges.tasks : undefined
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'mx-2 mb-0.5 flex min-h-tap items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]'
                    : 'text-[var(--lc-text-muted)] hover:bg-[var(--lc-action-secondary)] hover:text-[var(--lc-text-primary)]',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
                {badge != null && badge > 0 && (
                  <Badge
                    className={cn(
                      'ml-auto h-4 min-w-[1.25rem] px-1 text-[10px]',
                      active
                        ? 'bg-[var(--lc-action-primary-text)] text-[var(--lc-action-primary)]'
                        : 'bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]',
                    )}
                  >
                    <Numeric>{badge}</Numeric>
                  </Badge>
                )}
              </Link>
            )
          })}
        </nav>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  )
}
