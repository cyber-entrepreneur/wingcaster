import { useEffect, useId, useMemo, useRef } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Activity,
  AlertCircle,
  BarChart3,
  Bell,
  Calculator,
  CheckCircle2,
  Coins,
  CreditCard,
  DollarSign,
  FileText,
  GitBranch,
  Globe,
  History,
  Home,
  KeyRound,
  LayoutDashboard,
  LayoutTemplate,
  LifeBuoy,
  ListChecks,
  Megaphone,
  MessageSquare,
  Package,
  RefreshCcw,
  Settings,
  Shield,
  ShieldCheck,
  Target,
  Truck,
  Users,
  Zap,
} from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'
import type { NavPersona } from './GlobalSearch'
import type { NavLocale } from './UserMenu'
import { SideDrawerRail, type RailNavItem } from './SideDrawerRail'

export const NAV_GROUP_COPY = {
  en: {
    work: 'Work',
    grow: 'Grow',
    setup: 'Setup',
    account: 'Account',
    agency: 'Agency',
    operations: 'Operations',
    governance: 'Governance',
    billing: 'Billing',
    approvals: 'Approvals',
    moderation: 'Moderation',
    financial: 'Financial',
    configuration: 'Configuration',
    audit: 'Audit',
    manageTenants: 'Manage tenants',
    expand: 'Expand navigation',
    collapse: 'Collapse navigation',
    close: 'Close navigation',
  },
  ar: {
    work: 'العمل',
    grow: 'النمو',
    setup: 'الإعداد',
    account: 'الحساب',
    agency: 'الوكالة',
    operations: 'العمليات',
    governance: 'الحوكمة',
    billing: 'الفوترة',
    approvals: 'الموافقات',
    moderation: 'الإشراف',
    financial: 'المالية',
    configuration: 'الإعدادات',
    audit: 'التدقيق',
    manageTenants: 'إدارة الحسابات',
    expand: 'توسيع التنقل',
    collapse: 'طي التنقل',
    close: 'إغلاق التنقل',
  },
} as const

type GroupKey =
  | 'work'
  | 'grow'
  | 'setup'
  | 'account'
  | 'agency'
  | 'operations'
  | 'governance'
  | 'billing'
  | 'approvals'
  | 'moderation'
  | 'financial'
  | 'configuration'
  | 'audit'

export type DrawerNavItem = {
  id: string
  label: string
  href: string
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>
  badge?: number
}

export type DrawerNavGroup = {
  id: GroupKey
  items: DrawerNavItem[]
}

const AGENT_NAV: DrawerNavGroup[] = [
  {
    id: 'work',
    items: [
      { id: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { id: 'listings', label: 'Listings', href: '/listings', icon: Home },
      { id: 'inbox', label: 'Inbox', href: '/inbox', icon: MessageSquare },
      { id: 'contacts', label: 'Contacts', href: '/contacts', icon: Users },
      { id: 'opportunities', label: 'Opportunities', href: '/opportunities', icon: Target },
      { id: 'tasks', label: 'Tasks', href: '/tasks', icon: ListChecks },
    ],
  },
  {
    id: 'grow',
    items: [
      { id: 'campaigns', label: 'Campaigns', href: '/campaigns', icon: Megaphone },
      { id: 'templates', label: 'Templates', href: '/templates', icon: LayoutTemplate },
      { id: 'analytics', label: 'Analytics', href: '/analytics', icon: BarChart3 },
    ],
  },
  {
    id: 'setup',
    items: [
      { id: 'channels', label: 'Channels', href: '/channels', icon: Zap },
      { id: 'routing', label: 'Routing', href: '/routing', icon: GitBranch },
    ],
  },
  {
    id: 'account',
    items: [
      { id: 'plans', label: 'Plans', href: '/plans', icon: CreditCard },
      { id: 'settings', label: 'Settings', href: '/settings', icon: Settings },
      { id: 'help', label: 'Help', href: '/help', icon: LifeBuoy },
    ],
  },
]

const AGENCY_NAV: DrawerNavGroup[] = [
  {
    id: 'agency',
    items: [
      { id: 'agency-dashboard', label: 'Dashboard', href: '/agency', icon: LayoutDashboard },
      { id: 'members', label: 'Members', href: '/agency/members', icon: Users },
      { id: 'roles', label: 'Roles & permissions', href: '/agency/roles', icon: ShieldCheck },
      { id: 'activity', label: 'Team activity', href: '/agency/activity', icon: Activity },
    ],
  },
  {
    id: 'operations',
    items: [
      { id: 'agency-listings', label: 'Listings', href: '/agency/listings', icon: Home },
      { id: 'reports', label: 'Reports', href: '/agency/reports', icon: BarChart3 },
      { id: 'agency-routing', label: 'Routing', href: '/agency/routing', icon: GitBranch },
    ],
  },
  {
    id: 'setup',
    items: [
      { id: 'white-label', label: 'White-label', href: '/agency/white-label', icon: LayoutTemplate },
      { id: 'agency-channels', label: 'Channels', href: '/agency/channels', icon: Zap },
    ],
  },
  {
    id: 'governance',
    items: [
      { id: 'agency-audit', label: 'Audit log', href: '/agency/audit', icon: FileText },
      { id: 'agency-settings', label: 'Settings', href: '/agency/settings', icon: Settings },
    ],
  },
  {
    id: 'billing',
    items: [
      { id: 'subscription', label: 'Subscription', href: '/agency/subscription', icon: CreditCard },
      { id: 'credits', label: 'Credits', href: '/agency/credits', icon: Coins },
      { id: 'invoices', label: 'Invoices', href: '/agency/invoices', icon: FileText },
    ],
  },
]

const PA_NAV: DrawerNavGroup[] = [
  {
    id: 'approvals',
    items: [
      { id: 'approvals-queue', label: 'Approvals queue', href: '/admin/approvals', icon: CheckCircle2 },
      { id: 'packages', label: 'Package publishing', href: '/admin/packages', icon: Package },
      { id: 'credit-grants', label: 'Credit grants', href: '/admin/credits', icon: Coins },
    ],
  },
  {
    id: 'moderation',
    items: [
      { id: 'portal-submissions', label: 'Portal submissions', href: '/admin/moderation', icon: Shield },
      { id: 'pva', label: 'Property valuation', href: '/admin/pva', icon: Calculator },
      { id: 'acr', label: 'Account recovery', href: '/admin/acr', icon: KeyRound },
    ],
  },
  {
    id: 'financial',
    items: [
      { id: 'fin-dashboard', label: 'Dashboard', href: '/admin/fin', icon: LayoutDashboard },
      { id: 'vendors', label: 'Vendors', href: '/admin/fin/vendors', icon: Truck },
      { id: 'rates', label: 'Vendor rates', href: '/admin/fin/rates', icon: DollarSign },
      { id: 'statements', label: 'Statements', href: '/admin/fin/statements', icon: FileText },
      { id: 'reconciliation', label: 'Reconciliation', href: '/admin/fin/reconciliation', icon: RefreshCcw },
      { id: 'dunning', label: 'Dunning', href: '/admin/fin/dunning', icon: AlertCircle },
    ],
  },
  {
    id: 'configuration',
    items: [
      { id: 'system-config', label: 'System config', href: '/admin/cfg', icon: Settings },
      { id: 'portals', label: 'Portal registry', href: '/admin/portals', icon: Globe },
      { id: 'admin-templates', label: 'Templates', href: '/admin/tpl', icon: LayoutTemplate },
      { id: 'admin-notifications', label: 'Notifications', href: '/admin/notifications', icon: Bell },
    ],
  },
  {
    id: 'audit',
    items: [{ id: 'admin-audit', label: 'Audit log', href: '/admin/audit', icon: History }],
  },
]

export function getPersonaNav(persona: NavPersona): DrawerNavGroup[] {
  if (persona === 'agency') return AGENCY_NAV
  if (persona === 'pa') return PA_NAV
  return AGENT_NAV
}

export type DrawerMode = 'expanded' | 'rail' | 'overlay' | 'closed'

export const DRAWER_PREF_KEY = 'wingcaster.drawer.collapsed'

export function readDrawerCollapsedPref(): boolean {
  try {
    return localStorage.getItem(DRAWER_PREF_KEY) === '1'
  } catch {
    return false
  }
}

export function writeDrawerCollapsedPref(collapsed: boolean) {
  try {
    localStorage.setItem(DRAWER_PREF_KEY, collapsed ? '1' : '0')
  } catch {
    /* ignore */
  }
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export interface SideDrawerProps {
  persona?: NavPersona
  locale?: NavLocale
  mode: DrawerMode
  onModeChange?: (mode: DrawerMode) => void
  badges?: Record<string, number>
  tenantPreview?: ReactNode
  languageSlot?: ReactNode
  className?: string
}

export function SideDrawer({
  persona = 'agent',
  locale = 'en',
  mode,
  onModeChange,
  badges,
  tenantPreview,
  languageSlot,
  className,
}: SideDrawerProps) {
  const copy = NAV_GROUP_COPY[locale]
  const location = useLocation()
  const titleId = useId()
  const panelRef = useRef<HTMLElement>(null)
  const prevPathRef = useRef(location.pathname)

  const groups = useMemo(() => {
    return getPersonaNav(persona).map((group) => ({
      ...group,
      items: group.items.map((item) => ({
        ...item,
        badge: badges?.[item.id] && badges[item.id] > 0 ? badges[item.id] : undefined,
      })),
    }))
  }, [persona, badges])

  const flatItems: RailNavItem[] = useMemo(
    () => groups.flatMap((g) => g.items),
    [groups],
  )

  // Overlay: Escape closes + basic focus trap.
  useEffect(() => {
    if (mode !== 'overlay') return
    const panel = panelRef.current
    const previouslyFocused = document.activeElement as HTMLElement | null
    const focusables = () =>
      panel
        ? Array.from(
            panel.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
            ),
          )
        : []

    focusables()[0]?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onModeChange?.('closed')
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const nodes = focusables()
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [mode, onModeChange])

  // Auto-close overlay on navigation (mobile).
  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      prevPathRef.current = location.pathname
      if (mode === 'overlay') onModeChange?.('closed')
    }
  }, [location.pathname, mode, onModeChange])

  if (mode === 'closed') return null

  if (mode === 'rail') {
    return (
      <SideDrawerRail
        className={className}
        items={flatItems}
        onExpand={() => {
          writeDrawerCollapsedPref(false)
          onModeChange?.('expanded')
        }}
        expandLabel={copy.expand}
        footer={null}
      />
    )
  }

  const panel = (
    <nav
      ref={panelRef}
      role="navigation"
      aria-label="Primary"
      aria-labelledby={mode === 'overlay' ? titleId : undefined}
      className={cn(
        'flex h-full w-[240px] max-w-[80vw] flex-col border-e border-[var(--lc-border)] bg-[var(--lc-bg-page)]',
        mode === 'overlay' && 'max-w-[320px] shadow-lg',
        className,
      )}
    >
      {mode === 'overlay' ? (
        <div className="flex items-center justify-between border-b border-[var(--lc-border)] px-3 py-2">
          <span id={titleId} className="text-sm font-semibold text-[var(--lc-text-primary)]">
            WingCaster
          </span>
          <button
            type="button"
            className="inline-flex h-tap min-w-tap items-center justify-center rounded-md px-2 text-sm text-[var(--lc-text-muted)] hover:bg-[var(--lc-action-secondary)] focus-visible:outline-none"
            onClick={() => onModeChange?.('closed')}
          >
            {copy.close}
          </button>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto px-2 py-3">
        {groups.map((group, index) => (
          <div key={group.id} className={cn(index > 0 && 'mt-3')}>
            {index > 0 ? <Separator className="mb-3" /> : null}
            <p
              className="mb-1 px-2 uppercase text-[var(--lc-text-muted)]"
              style={{ font: 'var(--lc-type-caption)', letterSpacing: 'var(--lc-tracking-overline)' }}
            >
              {copy[group.id]}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon
                const active = isActivePath(location.pathname, item.href)
                return (
                  <li key={item.id}>
                    <Link
                      to={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'relative flex min-h-tap items-center gap-2 rounded-md px-2 text-sm text-[var(--lc-text-primary)] transition-colors duration-fast focus-visible:outline-none',
                        !active && 'hover:bg-[var(--lc-action-secondary)]',
                        active && 'font-semibold text-[var(--lc-action-primary)]',
                      )}
                      style={
                        active
                          ? {
                              background: 'color-mix(in srgb, var(--lc-action-primary) 12%, transparent)',
                              borderInlineStart: '3px solid var(--lc-action-primary)',
                            }
                          : undefined
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.badge && item.badge > 0 ? (
                        <span className="inline-flex min-w-5 items-center justify-center rounded-pill bg-[var(--lc-action-primary)] px-1.5 text-[11px] font-semibold text-[var(--lc-action-primary-text)]">
                          <Numeric>{item.badge > 99 ? '99+' : item.badge}</Numeric>
                        </span>
                      ) : null}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
        {languageSlot ? <div className="mt-4 px-2 lg:hidden">{languageSlot}</div> : null}
      </div>

      <div className="border-t border-[var(--lc-border)] p-3">
        {tenantPreview}
        <Link
          to="/settings/tenants"
          className="mt-1 inline-flex min-h-tap items-center text-xs text-[var(--lc-text-brand)] hover:underline focus-visible:outline-none"
        >
          {copy.manageTenants}
        </Link>
        {mode === 'expanded' ? (
          <button
            type="button"
            className="mt-2 inline-flex min-h-tap w-full items-center justify-center rounded-md text-sm text-[var(--lc-text-muted)] hover:bg-[var(--lc-action-secondary)] focus-visible:outline-none"
            onClick={() => {
              writeDrawerCollapsedPref(true)
              onModeChange?.('rail')
            }}
          >
            {copy.collapse}
          </button>
        ) : null}
      </div>
    </nav>
  )

  if (mode === 'overlay') {
    return (
      <div className="fixed inset-0 z-overlay flex" role="presentation">
        <button
          type="button"
          className="absolute inset-0 lc-overlay"
          aria-label={copy.close}
          onClick={() => onModeChange?.('closed')}
        />
        <div className="relative z-raised h-full motion-safe:animate-in motion-safe:slide-in-from-left motion-reduce:animate-none rtl:motion-safe:slide-in-from-right">
          {panel}
        </div>
      </div>
    )
  }

  return panel
}
