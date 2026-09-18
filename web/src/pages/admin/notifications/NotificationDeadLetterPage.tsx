/**
 * PA-NDL-001 — Notifications dead-letter queue.
 *
 * Consumer notification deliveries that exhaust their retries land here. A
 * Platform Admin triages them: filter by channel or error text, retry one back
 * through the dispatcher, bulk-retry everything pending, or mark an item
 * ignored (a soft dismissal that keeps the audit row). Persistent items usually
 * mean a misconfiguration — hence the link out to Configuration.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Inbox, Loader2, RefreshCw, RotateCw, Settings2, X } from 'lucide-react'
import { api } from '@/api/client'
import type { NotificationDeadLetterItem } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { usePageTitle } from '@/lib/usePageTitle'

const CHANNELS = ['email', 'sms', 'whatsapp', 'in_app', 'push'] as const

function statusVariant(status: string): 'destructive' | 'secondary' | 'outline' {
  if (status === 'dead_letter') return 'destructive'
  if (status === 'failed') return 'secondary'
  return 'outline'
}

export function NotificationDeadLetterPage() {
  const { addToast } = useToast()
  usePageTitle('Notifications dead-letter queue')

  const [items, setItems] = useState<NotificationDeadLetterItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [channel, setChannel] = useState('')
  const [search, setSearch] = useState('')
  const [includeIgnored, setIncludeIgnored] = useState(false)

  const [busyId, setBusyId] = useState('')
  const [confirmIgnoreId, setConfirmIgnoreId] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.getAdminNotificationDeadLetter({
        channel: channel || undefined,
        q: search.trim() || undefined,
        include_ignored: includeIgnored || undefined,
      })
      setItems(data.items || [])
      setTotal(data.total || 0)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load the dead-letter queue')
    } finally {
      setLoading(false)
    }
  }, [channel, search, includeIgnored])

  useEffect(() => {
    void load()
  }, [load])

  async function retryOne(id: string) {
    setBusyId(id)
    try {
      await api.retryAdminNotificationDeadLetter(id)
      addToast({ title: 'Retry queued', variant: 'success' })
      await load()
    } catch (err: unknown) {
      addToast({
        title: 'Retry failed',
        description: err instanceof Error ? err.message : undefined,
        variant: 'error',
      })
    } finally {
      setBusyId('')
    }
  }

  async function ignoreOne(id: string) {
    setBusyId(id)
    try {
      await api.ignoreAdminNotificationDeadLetter(id)
      addToast({ title: 'Item ignored', variant: 'success' })
      setConfirmIgnoreId('')
      await load()
    } catch (err: unknown) {
      addToast({
        title: 'Could not ignore item',
        description: err instanceof Error ? err.message : undefined,
        variant: 'error',
      })
    } finally {
      setBusyId('')
    }
  }

  async function retryAllPending() {
    setBulkBusy(true)
    try {
      const result = await api.retryAdminPendingNotifications(50)
      const processed = typeof result.processed === 'number' ? result.processed : undefined
      addToast({
        title: 'Bulk retry started',
        description: processed != null ? `${processed} pending item(s) processed` : undefined,
        variant: 'success',
      })
      await load()
    } catch (err: unknown) {
      addToast({
        title: 'Bulk retry failed',
        description: err instanceof Error ? err.message : undefined,
        variant: 'error',
      })
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6" data-testid="dlq-page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-[var(--lc-text-primary)]">
            <AlertTriangle className="h-5 w-5 text-[var(--lc-status-danger-fg)]" />
            Dead-letter queue
          </h1>
          <p className="mt-0.5 text-sm text-[var(--lc-text-muted)]">
            Notifications that failed to send after all retries. Retry, bulk-retry, or ignore.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void retryAllPending()}
          disabled={bulkBusy}
          className="gap-1.5"
          data-testid="dlq-bulk-retry"
        >
          {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
          Retry all pending
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Inbox className="h-5 w-5 text-[var(--lc-action-primary)]" />
            Failed deliveries
            <Badge variant="outline" className="ms-1">
              <Numeric>{total}</Numeric>
            </Badge>
          </CardTitle>
          <CardDescription>
            Persistent items usually indicate a misconfiguration —{' '}
            <Link
              to="/admin/fin/configuration"
              className="text-[var(--lc-action-primary)] underline underline-offset-2"
            >
              review Configuration
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[9rem] flex-1">
              <Label htmlFor="dlq-channel" className="text-xs">
                Channel
              </Label>
              <select
                id="dlq-channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="mt-1 block w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-2 py-2 text-sm text-[var(--lc-text-primary)]"
              >
                <option value="">All channels</option>
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[12rem] flex-[2]">
              <Label htmlFor="dlq-search" className="text-xs">
                Search error
              </Label>
              <Input
                id="dlq-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="e.g. SMTP 550"
                className="mt-1"
              />
            </div>
            <label className="flex items-center gap-2 py-2 text-sm text-[var(--lc-text-muted)]">
              <input
                type="checkbox"
                checked={includeIgnored}
                onChange={(e) => setIncludeIgnored(e.target.checked)}
                data-testid="dlq-include-ignored"
              />
              Show ignored
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void load()}
              className="gap-1.5"
              aria-label="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12" data-testid="dlq-loading">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--lc-text-muted)]" />
            </div>
          ) : error ? (
            <div
              role="alert"
              className="rounded-md border border-[var(--lc-status-danger-fg)] bg-[var(--lc-status-danger-bg)] px-3 py-2 text-sm text-[var(--lc-status-danger-fg)]"
            >
              {error}
              <Button variant="outline" size="sm" className="ms-3" onClick={() => void load()}>
                Try again
              </Button>
            </div>
          ) : items.length === 0 ? (
            <p
              className="rounded-md border border-dashed border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] px-3 py-8 text-center text-sm text-[var(--lc-text-muted)]"
              data-testid="dlq-empty"
            >
              Nothing in the dead-letter queue. All notifications are delivering cleanly.
            </p>
          ) : (
            <ul className="space-y-2" data-testid="dlq-list">
              {items.map((item) => (
                <li
                  key={item.id}
                  data-testid="dlq-item"
                  className="rounded-lg border border-[var(--lc-border)] p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-[var(--lc-text-primary)]">
                          {item.event_type || item.title || 'Notification'}
                        </span>
                        <Badge variant={statusVariant(item.status)} className="capitalize">
                          {item.status.replace('_', ' ')}
                        </Badge>
                        {item.channel && (
                          <Badge variant="outline" className="uppercase">
                            {item.channel}
                          </Badge>
                        )}
                      </div>
                      {item.title && item.event_type && (
                        <p className="mt-0.5 truncate text-xs text-[var(--lc-text-muted)]">{item.title}</p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[var(--lc-text-muted)]">
                        <span>
                          Attempts <Numeric>{item.attempts}</Numeric>
                        </span>
                        {item.created_at && <span>· {new Date(item.created_at).toLocaleString()}</span>}
                      </div>
                      {item.last_error && (
                        <p
                          className="mt-1 line-clamp-2 rounded bg-[var(--lc-surface-sunken)] px-2 py-1 text-xs text-[var(--lc-text-secondary)]"
                          title={item.last_error}
                        >
                          {item.last_error}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {confirmIgnoreId === item.id ? (
                        <>
                          <span className="text-xs text-[var(--lc-text-muted)]">Ignore?</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void ignoreOne(item.id)}
                            disabled={busyId === item.id}
                            data-testid={`dlq-confirm-ignore-${item.id}`}
                          >
                            {busyId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmIgnoreId('')}
                            aria-label="Cancel ignore"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : item.status === 'ignored' ? (
                        <span className="text-xs text-[var(--lc-text-muted)]">Dismissed</span>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            onClick={() => void retryOne(item.id)}
                            disabled={busyId === item.id}
                            className="gap-1.5 bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)] hover:bg-[var(--lc-action-primary-hover)]"
                            data-testid={`dlq-retry-${item.id}`}
                          >
                            {busyId === item.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RotateCw className="h-4 w-4" />
                            )}
                            Retry
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmIgnoreId(item.id)}
                            data-testid={`dlq-ignore-${item.id}`}
                          >
                            Ignore
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default NotificationDeadLetterPage
