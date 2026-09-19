import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bell,
  CheckCheck,
  CreditCard,
  GitBranch,
  Inbox,
  Loader2,
  Megaphone,
  Settings,
  UserRound,
} from 'lucide-react'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/hooks/useLocale'
import { usePageTitle } from '@/lib/usePageTitle'
import { useOnlineStatus } from '@/lib/useOnlineStatus'
import {
  DAY_GROUP_LABELS,
  filterInboxNotifications,
  formatInboxTimestamp,
  groupNotificationsByDay,
  INBOX_CATEGORIES,
  INBOX_CATEGORY_LABELS,
  readInboxCache,
  writeInboxCache,
} from '@/lib/notifications/inboxHelpers'
import type { InboxNotificationCategory, InboxNotificationRow } from '@/types/inboxNotifications'
import { cn } from '@/lib/utils'

type FilterMode = 'all' | 'unread'

function categoryIcon(category: InboxNotificationCategory | undefined) {
  switch (category) {
    case 'leads':
      return UserRound
    case 'publications':
      return Megaphone
    case 'approvals':
      return GitBranch
    case 'billing':
      return CreditCard
    default:
      return Bell
  }
}

/**
 * AGT-NPF-001 — Notifications inbox
 * Route: `/notifications`
 */
export function NotificationsInboxPage() {
  usePageTitle('Notifications')
  const { agent } = useAuth()
  const navigate = useNavigate()
  const online = useOnlineStatus()
  const { locale: rawLocale } = useLocale()
  const locale = rawLocale === 'ar' ? 'ar' : 'en'

  const [rows, setRows] = useState<InboxNotificationRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [category, setCategory] = useState<InboxNotificationCategory | 'all'>('all')
  const [markingAll, setMarkingAll] = useState(false)
  const [usingCache, setUsingCache] = useState(false)

  const loadNotifications = useCallback(async () => {
    if (!agent) {
      setLoading(false)
      return
    }

    setError(null)
    setUsingCache(false)

    if (!online) {
      const cached = readInboxCache()
      setRows(cached)
      setUsingCache(cached.length > 0)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const res = await api.getMyInboxNotifications()
      const next = res.notifications ?? []
      setRows(next)
      writeInboxCache(next)
    } catch (err: unknown) {
      const cached = readInboxCache()
      if (cached.length > 0) {
        setRows(cached)
        setUsingCache(true)
      } else {
        setRows([])
        setError(err instanceof Error ? err.message : 'Failed to load notifications')
      }
    } finally {
      setLoading(false)
    }
  }, [agent?.id, online])

  useEffect(() => {
    void loadNotifications()
  }, [loadNotifications])

  const filtered = useMemo(
    () =>
      filterInboxNotifications(rows, {
        unreadOnly: filterMode === 'unread',
        category,
      }),
    [rows, filterMode, category],
  )

  const grouped = useMemo(() => groupNotificationsByDay(filtered), [filtered])
  const unreadCount = useMemo(() => rows.filter((r) => r.unread).length, [rows])

  const markAllRead = async () => {
    if (!unreadCount) return
    setMarkingAll(true)
    setRows((prev) => prev.map((r) => ({ ...r, unread: false })))
    try {
      await api.markMyInboxNotificationsAllRead()
      writeInboxCache(rows.map((r) => ({ ...r, unread: false })))
    } catch {
      void loadNotifications()
    } finally {
      setMarkingAll(false)
    }
  }

  const openNotification = async (row: InboxNotificationRow) => {
    if (row.unread) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, unread: false } : r)))
      try {
        await api.markMyInboxNotificationRead(row.id)
      } catch {
        /* optimistic UI */
      }
    }
    if (row.href) {
      navigate(row.href)
    }
  }

  if (!agent) {
    return (
      <div
        data-screen="AGT-NPF-001"
        className="mx-auto max-w-2xl px-[var(--lc-space-md)] py-[var(--lc-space-xl)]"
      >
        <p className="text-sm text-[var(--lc-text-muted)]">
          <Link to="/login" className="text-[var(--lc-text-brand)] hover:underline">Sign in</Link>
          {' '}to view your notifications.
        </p>
      </div>
    )
  }

  return (
    <div
      data-screen="AGT-NPF-001"
      data-testid="notifications-inbox-page"
      className="min-h-full bg-[var(--lc-bg-page)] text-[var(--lc-text-primary)]"
    >
      <header className="border-b border-[var(--lc-border)] bg-[var(--lc-surface-raised)] px-[var(--lc-space-md)] py-3">
        <div className="mx-auto flex max-w-3xl items-start justify-between gap-3">
          <div>
            <h1 style={{ font: 'var(--lc-type-heading-1)' }}>Notifications</h1>
            <p className="mt-1 text-sm text-[var(--lc-text-muted)]">
              Workflow updates, leads, publications, and account alerts.
            </p>
          </div>
          <Link
            to="/notification-preferences"
            className="inline-flex min-h-tap min-w-tap items-center justify-center rounded-md text-[var(--lc-text-muted)] transition-colors hover:text-[var(--lc-text-brand)] focus-visible:outline-none"
            aria-label="Notification preferences"
          >
            <Settings className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
      </header>

      {!online ? (
        <div
          role="status"
          className="border-b border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] px-[var(--lc-space-md)] py-2 text-sm text-[var(--lc-text-muted)]"
        >
          You&apos;re offline
          {usingCache ? ' — showing cached notifications.' : ' — connect to refresh.'}
        </div>
      ) : null}

      <div className="mx-auto max-w-3xl px-[var(--lc-space-md)] py-[var(--lc-space-md)]">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-[var(--lc-border)] p-0.5">
            {(['all', 'unread'] as FilterMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={cn(
                  'min-h-tap rounded px-3 text-sm capitalize transition-colors',
                  filterMode === mode
                    ? 'bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]'
                    : 'text-[var(--lc-text-muted)] hover:text-[var(--lc-text-primary)]',
                )}
                onClick={() => setFilterMode(mode)}
                aria-pressed={filterMode === mode}
              >
                {mode === 'all' ? 'All' : 'Unread'}
              </button>
            ))}
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-tap"
            disabled={!unreadCount || markingAll}
            onClick={() => void markAllRead()}
          >
            <CheckCheck className="me-1.5 h-4 w-4" aria-hidden="true" />
            {markingAll ? 'Marking…' : 'Mark all read'}
          </Button>
        </div>

        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            className={cn(
              'shrink-0 rounded-pill border px-3 py-1.5 text-xs font-medium transition-colors',
              category === 'all'
                ? 'border-[var(--lc-action-primary)] bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]'
                : 'border-[var(--lc-border)] text-[var(--lc-text-muted)] hover:border-[var(--lc-border-strong)]',
            )}
            onClick={() => setCategory('all')}
            aria-pressed={category === 'all'}
          >
            All categories
          </button>
          {INBOX_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={cn(
                'shrink-0 rounded-pill border px-3 py-1.5 text-xs font-medium transition-colors',
                category === cat
                  ? 'border-[var(--lc-action-primary)] bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]'
                  : 'border-[var(--lc-border)] text-[var(--lc-text-muted)] hover:border-[var(--lc-border-strong)]',
              )}
              onClick={() => setCategory(cat)}
              aria-pressed={category === cat}
            >
              {INBOX_CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--lc-text-muted)]" role="status">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Loading notifications…
          </div>
        ) : null}

        {error ? (
          <div className="rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-4">
            <p className="text-sm text-[var(--lc-status-error-text)]">{error}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3 min-h-tap"
              onClick={() => void loadNotifications()}
            >
              Retry
            </Button>
          </div>
        ) : null}

        {!loading && !error && filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-[var(--lc-border)] px-4 py-16 text-center">
            <Inbox className="h-10 w-10 text-[var(--lc-text-muted)]" aria-hidden="true" />
            <p className="text-sm text-[var(--lc-text-muted)]">
              {filterMode === 'unread' || category !== 'all'
                ? 'No notifications match your filters.'
                : "You're all caught up."}
            </p>
          </div>
        ) : null}

        {!loading && !error && filtered.length > 0 ? (
          <div className="space-y-6">
            {grouped.map((group) => (
              <section key={group.key} aria-label={DAY_GROUP_LABELS[group.key] ?? group.label}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--lc-text-muted)]">
                  {group.label}
                </h2>
                <ul className="divide-y divide-[var(--lc-border)] overflow-hidden rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface-raised)]">
                  {group.items.map((row) => {
                    const Icon = categoryIcon(row.category)
                    return (
                      <li key={row.id}>
                        <button
                          type="button"
                          className={cn(
                            'flex w-full min-h-[72px] items-start gap-3 px-3 py-3 text-start transition-colors hover:bg-[var(--lc-action-secondary)] focus-visible:outline-none',
                            row.unread && 'bg-[color-mix(in_srgb,var(--lc-action-primary)_10%,transparent)]',
                          )}
                          onClick={() => void openNotification(row)}
                        >
                          <span className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--lc-surface-sunken)] text-[var(--lc-text-muted)]">
                            <Icon className="h-4 w-4" aria-hidden="true" />
                            {row.unread ? (
                              <span
                                className="absolute -end-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[var(--lc-action-primary)]"
                                aria-hidden="true"
                              />
                            ) : null}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline justify-between gap-2">
                              <span className="truncate text-sm font-medium text-[var(--lc-text-primary)]">
                                {row.title}
                              </span>
                              <time
                                className="shrink-0 text-xs text-[var(--lc-text-muted)]"
                                dateTime={row.timestamp || undefined}
                              >
                                {formatInboxTimestamp(row.timestamp, locale)}
                              </time>
                            </span>
                            {row.snippet ? (
                              <span className="mt-0.5 line-clamp-2 block text-xs text-[var(--lc-text-muted)]">
                                {row.snippet}
                              </span>
                            ) : null}
                            {row.category ? (
                              <span className="mt-1 inline-block text-[10px] font-medium uppercase tracking-wide text-[var(--lc-text-brand)]">
                                {INBOX_CATEGORY_LABELS[row.category]}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
