import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Bell } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import type { NavLocale } from './UserMenu'

export const NOTIFICATIONS_COPY = {
  en: {
    header: 'Notifications',
    markAll: 'Mark all as read',
    viewAll: 'View all →',
    empty: "You're all caught up.",
  },
  ar: {
    header: 'الإشعارات',
    markAll: 'تحديد الكل كمقروء',
    viewAll: 'عرض الكل ←',
    empty: 'لقد اطلعت على كل شيء.',
  },
} as const

export type NavNotification = {
  id: string
  title: string
  snippet: string
  timestamp: string
  unread: boolean
  href?: string
  icon?: ReactNode
}

export interface NotificationsPopoverProps {
  locale?: NavLocale
  notifications?: NavNotification[]
  onMarkAllRead?: () => void | Promise<void>
  onOpenChange?: (open: boolean) => void
  className?: string
}

function formatRelative(ts: string, locale: NavLocale) {
  const date = new Date(ts)
  if (Number.isNaN(date.getTime())) return ts
  try {
    return new Intl.RelativeTimeFormat(locale === 'ar' ? 'ar' : 'en', { numeric: 'auto' }).format(
      Math.round((date.getTime() - Date.now()) / 60_000),
      'minute',
    )
  } catch {
    return date.toLocaleString(locale === 'ar' ? 'ar' : 'en')
  }
}

export function NotificationsPopover({
  locale = 'en',
  notifications: controlled,
  onMarkAllRead,
  onOpenChange,
  className,
}: NotificationsPopoverProps) {
  const copy = NOTIFICATIONS_COPY[locale]
  const { addToast } = useToast()
  const [items, setItems] = useState<NavNotification[]>(controlled ?? [])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (controlled) setItems(controlled)
  }, [controlled])

  const unreadCount = useMemo(() => items.filter((n) => n.unread).length, [items])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    onOpenChange?.(next)
    if (!next) {
      const marked = items.filter((n) => n.unread).length
      if (marked > 0) {
        setItems((prev) => prev.map((n) => ({ ...n, unread: false })))
        void onMarkAllRead?.()
        addToast({
          title: locale === 'ar' ? `تم تحديد ${marked} كمقروء` : `Marked ${marked} as read`,
          variant: 'default',
          duration: 2500,
        })
      }
    }
  }

  const markAll = () => {
    const marked = items.filter((n) => n.unread).length
    setItems((prev) => prev.map((n) => ({ ...n, unread: false })))
    void onMarkAllRead?.()
    if (marked > 0) {
      addToast({
        title: locale === 'ar' ? `تم تحديد ${marked} كمقروء` : `Marked ${marked} as read`,
        variant: 'default',
        duration: 2500,
      })
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'relative inline-flex h-tap w-tap min-h-tap min-w-tap items-center justify-center rounded-md text-[var(--lc-text-muted)] transition-colors duration-fast hover:text-[var(--lc-text-primary)] focus-visible:outline-none data-[state=open]:text-[var(--lc-action-primary)]',
            className,
          )}
          aria-label={
            unreadCount > 0
              ? `${copy.header}: ${unreadCount} new`
              : copy.header
          }
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unreadCount > 0 ? (
            <span
              className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-pill bg-[var(--lc-action-primary)] px-1 text-[10px] font-semibold text-[var(--lc-action-primary-text)]"
              style={{ transform: 'translate(4px, -4px)' }}
              aria-hidden="true"
            >
              <Numeric>{unreadCount > 99 ? '99+' : unreadCount}</Numeric>
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="flex max-h-[480px] w-[360px] flex-col overflow-hidden rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-0 shadow-md"
        sideOffset={8}
        aria-label={unreadCount > 0 ? `${unreadCount} new notifications` : copy.header}
      >
        <DropdownMenuLabel className="flex items-center justify-between gap-2 px-3 py-3 font-normal">
          <span className="text-sm font-semibold text-[var(--lc-text-primary)]">{copy.header}</span>
          <button
            type="button"
            className="min-h-tap text-sm text-[var(--lc-text-brand)] hover:underline focus-visible:outline-none"
            onClick={markAll}
          >
            {copy.markAll}
          </button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="flex-1 overflow-y-auto" role="list">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
              <Bell className="h-8 w-8 text-[var(--lc-text-muted)]" aria-hidden="true" />
              <p className="text-sm text-[var(--lc-text-muted)]">{copy.empty}</p>
            </div>
          ) : (
            items.map((item) => {
              const body = (
                <div
                  className={cn(
                    'flex min-h-[72px] items-start gap-3 px-3 py-2 transition-colors duration-fast hover:bg-[var(--lc-action-secondary)]',
                  )}
                  style={
                    item.unread
                      ? { background: 'color-mix(in srgb, var(--lc-action-primary) 12%, transparent)' }
                      : undefined
                  }
                >
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--lc-surface-sunken)] text-[var(--lc-text-muted)]">
                    {item.icon ?? <Bell className="h-4 w-4" aria-hidden="true" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-medium text-[var(--lc-text-primary)]">{item.title}</p>
                      <time className="shrink-0 text-xs text-[var(--lc-text-muted)]" dateTime={item.timestamp}>
                        {formatRelative(item.timestamp, locale)}
                      </time>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-[var(--lc-text-muted)]">{item.snippet}</p>
                  </div>
                </div>
              )
              return item.href ? (
                <Link key={item.id} to={item.href} role="listitem" className="block focus-visible:outline-none">
                  {body}
                </Link>
              ) : (
                <div key={item.id} role="listitem">
                  {body}
                </div>
              )
            })
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="px-3 py-2">
          <Link
            to="/notifications"
            className="inline-flex min-h-tap items-center text-sm font-medium text-[var(--lc-text-brand)] hover:underline focus-visible:outline-none"
          >
            {copy.viewAll}
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
