import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Drawer } from 'vaul'
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  GitBranch,
  LayoutTemplate,
  LifeBuoy,
  LogOut,
  Megaphone,
  Settings,
  UsersRound,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

export type BottomTabLocale = 'en' | 'ar'

export type BottomTabCopy = {
  'tab.dashboard': string
  'tab.listings': string
  'tab.inbox': string
  'tab.contacts': string
  'tab.more': string
  'sheet.header': string
  'sheet.group.business': string
  'sheet.group.setup': string
  'sheet.group.account': string
  'sheet.row.campaigns': string
  'sheet.row.templates': string
  'sheet.row.pricing': string
  'sheet.row.analytics': string
  'sheet.row.channels': string
  'sheet.row.routing': string
  'sheet.row.team': string
  'sheet.row.settings': string
  'sheet.row.help': string
  'sheet.row.signout': string
  'badge.unread.max': string
  'badge.attention.max': string
  'a11y.tab.active': string
  'a11y.badge.unread': string
  'a11y.badge.attention': string
  'a11y.badge.moreWarning': string
  'a11y.nav': string
}

/** Exact EN/AR copy from SHR-NAV-003 brief. */
export const BOTTOM_TAB_COPY: Record<BottomTabLocale, BottomTabCopy> = {
  en: {
    'tab.dashboard': 'Dashboard',
    'tab.listings': 'Listings',
    'tab.inbox': 'Inbox',
    'tab.contacts': 'Contacts',
    'tab.more': 'More',
    'sheet.header': 'More',
    'sheet.group.business': 'Business',
    'sheet.group.setup': 'Setup',
    'sheet.group.account': 'Account',
    'sheet.row.campaigns': 'Campaigns',
    'sheet.row.templates': 'Templates',
    'sheet.row.pricing': 'Pricing & plans',
    'sheet.row.analytics': 'Analytics',
    'sheet.row.channels': 'Channels',
    'sheet.row.routing': 'Routing rules',
    'sheet.row.team': 'Team',
    'sheet.row.settings': 'Settings',
    'sheet.row.help': 'Help & support',
    'sheet.row.signout': 'Sign out',
    'badge.unread.max': '99+',
    'badge.attention.max': '9+',
    'a11y.tab.active': 'Currently on {tabLabel}',
    'a11y.badge.unread': '{count} unread messages',
    'a11y.badge.attention': '{count} contacts need attention',
    'a11y.badge.moreWarning': 'Attention needed in More menu',
    'a11y.nav': 'Primary navigation',
  },
  ar: {
    'tab.dashboard': 'لوحة التحكم',
    'tab.listings': 'الإعلانات',
    'tab.inbox': 'الوارد',
    'tab.contacts': 'جهات الاتصال',
    'tab.more': 'المزيد',
    'sheet.header': 'المزيد',
    'sheet.group.business': 'الأعمال',
    'sheet.group.setup': 'الإعداد',
    'sheet.group.account': 'الحساب',
    'sheet.row.campaigns': 'الحملات',
    'sheet.row.templates': 'القوالب',
    'sheet.row.pricing': 'التسعير والخطط',
    'sheet.row.analytics': 'التحليلات',
    'sheet.row.channels': 'القنوات',
    'sheet.row.routing': 'قواعد التوجيه',
    'sheet.row.team': 'الفريق',
    'sheet.row.settings': 'الإعدادات',
    'sheet.row.help': 'المساعدة والدعم',
    'sheet.row.signout': 'تسجيل الخروج',
    'badge.unread.max': '٩٩+',
    'badge.attention.max': '٩+',
    'a11y.tab.active': 'أنت الآن على {tabLabel}',
    'a11y.badge.unread': '{count} رسائل غير مقروءة',
    'a11y.badge.attention': '{count} جهة اتصال تحتاج إلى انتباه',
    'a11y.badge.moreWarning': 'يلزم الانتباه في قائمة المزيد',
    'a11y.nav': 'التنقل الرئيسي',
  },
}

export function formatBottomTabCopy(
  template: string,
  vars: Record<string, string | number>,
): string {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.split(`{${key}}`).join(String(value)),
    template,
  )
}

export interface MoreSheetRow {
  id: string
  labelKey: keyof BottomTabCopy
  href?: string
  icon: LucideIcon
  destructive?: boolean
  onSelect?: () => void
}

export interface MoreSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  locale?: BottomTabLocale
  /** Show Team row when the user is agency-scoped. */
  showTeam?: boolean
  onSignOut?: () => void
  className?: string
}

type SheetGroup = {
  id: string
  labelKey: 'sheet.group.business' | 'sheet.group.setup' | 'sheet.group.account'
  rows: MoreSheetRow[]
}

function buildGroups(showTeam: boolean, onSignOut?: () => void): SheetGroup[] {
  const setupRows: MoreSheetRow[] = [
    { id: 'channels', labelKey: 'sheet.row.channels', href: '/channels', icon: Zap },
    { id: 'routing', labelKey: 'sheet.row.routing', href: '/routing', icon: GitBranch },
  ]
  if (showTeam) {
    setupRows.push({ id: 'team', labelKey: 'sheet.row.team', href: '/team', icon: UsersRound })
  }

  return [
    {
      id: 'business',
      labelKey: 'sheet.group.business',
      rows: [
        { id: 'campaigns', labelKey: 'sheet.row.campaigns', href: '/campaigns', icon: Megaphone },
        { id: 'templates', labelKey: 'sheet.row.templates', href: '/templates', icon: LayoutTemplate },
        { id: 'pricing', labelKey: 'sheet.row.pricing', href: '/plans', icon: CreditCard },
        { id: 'analytics', labelKey: 'sheet.row.analytics', href: '/analytics', icon: BarChart3 },
      ],
    },
    {
      id: 'setup',
      labelKey: 'sheet.group.setup',
      rows: setupRows,
    },
    {
      id: 'account',
      labelKey: 'sheet.group.account',
      rows: [
        { id: 'settings', labelKey: 'sheet.row.settings', href: '/settings', icon: Settings },
        { id: 'help', labelKey: 'sheet.row.help', href: '/help', icon: LifeBuoy },
        {
          id: 'signout',
          labelKey: 'sheet.row.signout',
          icon: LogOut,
          destructive: true,
          onSelect: onSignOut,
        },
      ],
    },
  ]
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(mq.matches)
    sync()
    mq.addEventListener?.('change', sync)
    return () => mq.removeEventListener?.('change', sync)
  }, [])
  return reduced
}

export function MoreSheet({
  open,
  onOpenChange,
  locale = 'en',
  showTeam = false,
  onSignOut,
  className,
}: MoreSheetProps) {
  const copy = BOTTOM_TAB_COPY[locale]
  const isRtl = locale === 'ar'
  const Chevron = isRtl ? ChevronLeft : ChevronRight
  const groups = buildGroups(showTeam, onSignOut)
  const reducedMotion = usePrefersReducedMotion()

  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      shouldScaleBackground={false}
      dismissible
    >
      <Drawer.Portal>
        <Drawer.Overlay
          className={cn(
            'fixed inset-0 z-overlay lc-overlay',
            !reducedMotion &&
              'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          )}
        />
        <Drawer.Content
          role="dialog"
          aria-modal="true"
          aria-labelledby="more-sheet-title"
          dir={isRtl ? 'rtl' : 'ltr'}
          className={cn(
            'fixed inset-x-0 bottom-0 z-modal flex max-h-[85vh] flex-col rounded-t-xl border border-[var(--lc-border)] border-b-0 bg-[var(--lc-surface-raised)] outline-none',
            'pb-[env(safe-area-inset-bottom,0px)]',
            className,
          )}
          style={
            reducedMotion
              ? { transitionDuration: 'var(--lc-duration-instant)' }
              : undefined
          }
        >
          <div
            className="mx-auto mt-1.5 h-1 w-6 shrink-0 rounded-pill bg-[var(--lc-border)]"
            aria-hidden="true"
          />

          <Drawer.Title
            id="more-sheet-title"
            className="px-[var(--lc-space-md)] pb-[var(--lc-space-xs)] pt-[var(--lc-space-sm)] text-[var(--lc-text-primary)]"
            style={{
              font: 'var(--lc-type-heading-3)',
              letterSpacing: 'var(--lc-tracking-heading-3)',
            }}
          >
            {copy['sheet.header']}
          </Drawer.Title>

          <div className="min-h-0 flex-1 overflow-y-auto px-[var(--lc-space-2xs)] pb-[var(--lc-space-md)]">
            {groups.map((group, groupIndex) => (
              <div key={group.id} className="mb-[var(--lc-space-xs)]">
                {groupIndex > 0 ? (
                  <Separator className="mx-[var(--lc-space-sm)] mb-[var(--lc-space-xs)]" />
                ) : null}
                <p
                  className="px-[var(--lc-space-md)] pb-[var(--lc-space-2xs)] uppercase text-[var(--lc-text-muted)]"
                  style={{
                    font: 'var(--lc-type-overline)',
                    letterSpacing: 'var(--lc-tracking-overline)',
                  }}
                >
                  {copy[group.labelKey]}
                </p>
                <ul className="flex flex-col">
                  {group.rows.map((row) => {
                    const Icon = row.icon
                    const label = copy[row.labelKey]
                    const rowClass = cn(
                      'flex h-14 min-h-[var(--lc-tap-target-min)] w-full items-center gap-[var(--lc-space-sm)] px-[var(--lc-space-md)] text-start',
                      'text-[var(--lc-text-primary)] transition-colors duration-fast ease-out',
                      'hover:bg-[var(--lc-action-secondary)]',
                      'focus-visible:outline-none',
                      row.destructive && 'text-[var(--lc-status-unpublished-fg)]',
                    )
                    const inner = (
                      <>
                        <Icon aria-hidden="true" className="h-5 w-5 shrink-0" strokeWidth={1.5} />
                        <span
                          className="flex-1"
                          style={{
                            font: 'var(--lc-type-body)',
                            letterSpacing: 'var(--lc-tracking-body)',
                          }}
                        >
                          {label}
                        </span>
                        {!row.destructive ? (
                          <Chevron
                            aria-hidden="true"
                            className="h-4 w-4 shrink-0 text-[var(--lc-text-muted)]"
                          />
                        ) : null}
                      </>
                    )

                    return (
                      <li key={row.id}>
                        {row.href ? (
                          <Link
                            to={row.href}
                            className={rowClass}
                            onClick={() => onOpenChange(false)}
                          >
                            {inner}
                          </Link>
                        ) : (
                          <button
                            type="button"
                            className={rowClass}
                            onClick={() => {
                              onOpenChange(false)
                              row.onSelect?.()
                            }}
                          >
                            {inner}
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
