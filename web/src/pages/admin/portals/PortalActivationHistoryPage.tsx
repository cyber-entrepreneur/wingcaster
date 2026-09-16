/**
 * PA-POR-003 — Portal activation history (immutable per-portal audit timeline).
 *
 * Delta to PA-POR-001: reverse-chronological event timeline with per-event-type
 * glyphs, submitter+approver identity, notes, collapsible before/after diffs, and
 * version-snapshot links back into PA-POR-002 (?version=N).
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  Boxes,
  ChevronRight,
  Clock,
  Download,
  Globe,
  Inbox,
  Power,
  PowerOff,
  Settings,
  Shield,
} from 'lucide-react'
import { EnvBadge } from '@/components/nav/EnvBadge'
import { Button } from '@/components/ui/button'
import { useEnv } from '@/hooks/useEnv'
import { useLocale } from '@/hooks/useLocale'
import { cn } from '@/lib/utils'
import { getPortal, getPortalHistory, portalHistoryCsvPath } from './api'
import { HISTORY_EVENT_FILTERS, usePortalCopy, type PortalCopyKey } from './copy'
import { useDesktopMin } from './shared'
import type { StatusToken } from './shared'
import type { PortalHistoryEvent } from './types'

const DEFAULT_PAGE_SIZE = 25

const EVENT_META: Record<
  string,
  { icon: ComponentType<{ className?: string }>; token: StatusToken; copyKey: PortalCopyKey }
> = {
  created: { icon: Boxes, token: 'published', copyKey: 'history.event.created' },
  submitted: { icon: Clock, token: 'underOffer', copyKey: 'history.event.submitted' },
  approved: { icon: Power, token: 'published', copyKey: 'history.event.approved' },
  rejected: { icon: PowerOff, token: 'unpublished', copyKey: 'history.event.rejected' },
  withdrawn: { icon: PowerOff, token: 'archived', copyKey: 'history.event.withdrawn' },
  activated: { icon: Power, token: 'published', copyKey: 'history.event.activated' },
  deactivated: { icon: PowerOff, token: 'archived', copyKey: 'history.event.deactivated' },
  adapter_upgraded: { icon: Boxes, token: 'draft', copyKey: 'history.event.adapter_upgraded' },
  sla_changed: { icon: Clock, token: 'underOffer', copyKey: 'history.event.sla_changed' },
  country_coverage_changed: {
    icon: Globe,
    token: 'draft',
    copyKey: 'history.event.country_coverage_changed',
  },
  validator_ruleset_changed: {
    icon: Shield,
    token: 'underOffer',
    copyKey: 'history.event.validator_ruleset_changed',
  },
  publisher_config_changed: {
    icon: Settings,
    token: 'draft',
    copyKey: 'history.event.publisher_config_changed',
  },
  inbound_config_changed: { icon: Inbox, token: 'draft', copyKey: 'history.event.inbound_config_changed' },
  deprecated: { icon: Archive, token: 'closed', copyKey: 'history.event.deprecated' },
}

function eventMeta(type: string) {
  return EVENT_META[type] ?? { icon: Settings, token: 'draft' as StatusToken, copyKey: 'history.event.submitted' as PortalCopyKey }
}

function prettyJson(value: Record<string, unknown> | null): string {
  if (value == null) return ''
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function DiffBlock({
  event,
  labels,
}: {
  event: PortalHistoryEvent
  labels: { before: string; after: string; none: string }
}) {
  const before = prettyJson(event.diff?.before ?? null)
  const after = prettyJson(event.diff?.after ?? null)
  if (!before && !after) {
    return <p className="text-[var(--lc-text-muted)]">{labels.none}</p>
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div>
        <p className="mb-1 text-[length:var(--lc-type-caption)] font-semibold text-[var(--lc-text-muted)]">
          {labels.before}
        </p>
        <pre
          dir="ltr"
          className="overflow-x-auto rounded-[var(--lc-radius-md)] p-3 font-[family-name:var(--lc-font-mono)] text-[length:var(--lc-type-data-sm,0.75rem)] text-[var(--lc-text-primary)]"
          style={{ background: 'var(--lc-status-unpublished-bg)' }}
        >
          {before || '—'}
        </pre>
      </div>
      <div>
        <p className="mb-1 text-[length:var(--lc-type-caption)] font-semibold text-[var(--lc-text-muted)]">
          {labels.after}
        </p>
        <pre
          dir="ltr"
          className="overflow-x-auto rounded-[var(--lc-radius-md)] p-3 font-[family-name:var(--lc-font-mono)] text-[length:var(--lc-type-data-sm,0.75rem)] text-[var(--lc-text-primary)]"
          style={{ background: 'var(--lc-status-published-bg)' }}
        >
          {after || '—'}
        </pre>
      </div>
    </div>
  )
}

export function PortalActivationHistoryPage() {
  const { code = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { env, isTest } = useEnv()
  const { locale } = useLocale()
  const { t } = usePortalCopy()
  const isDesktop = useDesktopMin()

  const eventsParam = searchParams.get('events')
  const selectedEvents = useMemo(
    () => (eventsParam ? eventsParam.split(',').filter(Boolean) : []),
    [eventsParam],
  )
  const page = Math.max(1, Number(searchParams.get('page') || '1') || 1)
  const pageSize = Math.min(
    100,
    Math.max(1, Number(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE)) || DEFAULT_PAGE_SIZE),
  )

  const [events, setEvents] = useState<PortalHistoryEvent[]>([])
  const [total, setTotal] = useState(0)
  const [displayName, setDisplayName] = useState(code)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const returnTo = searchParams.get('return_to')

  const patchParams = useCallback(
    (patch: Record<string, string | null | undefined>, opts?: { resetPage?: boolean }) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [key, value] of Object.entries(patch)) {
            if (value == null || value === '') next.delete(key)
            else next.set(key, value)
          }
          if (opts?.resetPage !== false) next.set('page', '1')
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [historyRes, portalRes] = await Promise.all([
        getPortalHistory(code, {
          events: selectedEvents.length ? selectedEvents : undefined,
          page,
          pageSize,
        }),
        getPortal(code).catch(() => null),
      ])
      const list = historyRes.events || []
      setEvents(list)
      setTotal(historyRes.pagination?.total ?? list.length)
      if (portalRes?.display_name) setDisplayName(portalRes.display_name)
      setExpanded(list[0] ? new Set([list[0].id]) : new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : t('history.loadError'))
      setEvents([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [code, selectedEvents, page, pageSize, t])

  useEffect(() => {
    void load()
  }, [load, env])

  const toggleEvent = (type: string) => {
    const next = new Set(selectedEvents)
    if (next.has(type)) next.delete(type)
    else next.add(type)
    patchParams({ events: next.size ? Array.from(next).join(',') : null })
  }

  const toggleDiff = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const backHref = returnTo ? decodeURIComponent(returnTo) : `/admin/portals/${encodeURIComponent(code)}`

  if (!isDesktop) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <AlertTriangle className="h-8 w-8 text-[var(--lc-status-underOffer-fg)]" aria-hidden />
        <h1 style={{ font: 'var(--lc-type-heading-2)' }} className="text-[var(--lc-text-heading)]">
          {t('shell.desktopOnly.title')}
        </h1>
        <p className="text-[var(--lc-text-muted)]">{t('shell.desktopOnly.body')}</p>
        <Button type="button" variant="outline" asChild>
          <Link to="/dashboard">{t('shell.backHome')}</Link>
        </Button>
      </div>
    )
  }

  const startIdx = total === 0 ? 0 : (page - 1) * pageSize + 1
  const endIdx = Math.min(page * pageSize, total)
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div
      className="mx-auto w-full max-w-[1440px] px-[var(--lc-space-2xl)] py-[var(--lc-space-xl)]"
      data-testid="portal-activation-history"
      data-env={env}
    >
      <a
        href="#pa-por-history-timeline"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-[var(--lc-radius-md)] focus:bg-[var(--lc-surface-raised)] focus:px-3 focus:py-2"
      >
        {t('history.skipToTimeline')}
      </a>

      <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1 text-sm text-[var(--lc-text-muted)]">
        <Link to="/admin/portals" className="hover:underline">
          {t('detail.breadcrumb')}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        <Link to={backHref} className="hover:underline">
          {displayName}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        <span aria-current="page">{t('history.breadcrumbHistory')}</span>
      </nav>

      <header className="mb-[var(--lc-space-md)] flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 style={{ font: 'var(--lc-type-heading-1)' }} className="text-[var(--lc-text-heading)]">
            {t('history.title', { name: displayName })}
          </h1>
          <p
            className="mt-1 font-[family-name:var(--lc-font-mono)] text-[length:var(--lc-type-data-sm,0.75rem)] text-[var(--lc-text-muted)]"
            dir="ltr"
          >
            {code}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <EnvBadge env={env} locale={locale} tabIndex={-1} />
          <Button type="button" variant="outline" asChild>
            <Link to={backHref}>{t('history.backToPortal')}</Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              window.open(
                portalHistoryCsvPath(code, { events: selectedEvents.length ? selectedEvents : undefined }),
                '_blank',
                'noopener,noreferrer',
              )
            }
          >
            <Download className="me-2 h-4 w-4" aria-hidden />
            {t('history.exportCsv')}
          </Button>
        </div>
      </header>

      {isTest ? (
        <div
          role="status"
          aria-live="polite"
          className="mb-[var(--lc-space-sm)] rounded-[var(--lc-radius-md)] px-3 py-2 text-sm font-medium"
          style={{ background: 'var(--lc-status-underOffer-dot)', color: 'var(--lc-text-inverse)' }}
        >
          {t('shell.testStrip')}
        </div>
      ) : null}

      <div
        className="mb-[var(--lc-space-md)] flex flex-wrap items-center gap-2 rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-3"
        role="group"
        aria-label={t('history.filter.eventType')}
      >
        <span className="text-sm font-medium text-[var(--lc-text-primary)]">
          {t('history.filter.eventType')}
        </span>
        {HISTORY_EVENT_FILTERS.map((type) => {
          const isOn = selectedEvents.includes(type)
          return (
            <button
              key={type}
              type="button"
              aria-pressed={isOn}
              disabled={loading}
              onClick={() => toggleEvent(type)}
              className={cn(
                'rounded-[var(--lc-radius-pill)] border px-3 py-1 text-[length:var(--lc-type-caption)]',
                isOn
                  ? 'border-transparent bg-[var(--lc-action-secondary)] text-[var(--lc-action-secondary-text)]'
                  : 'border-[var(--lc-border)] text-[var(--lc-text-secondary)] hover:bg-[var(--lc-surface-sunken)]',
              )}
            >
              {t(eventMeta(type).copyKey)}
            </button>
          )
        })}
        {selectedEvents.length ? (
          <Button type="button" variant="link" onClick={() => patchParams({ events: null })}>
            {t('history.filter.reset')}
          </Button>
        ) : null}
      </div>

      {error ? (
        <div
          role="alert"
          className="mb-[var(--lc-space-sm)] flex flex-wrap items-center justify-between gap-3 rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] px-4 py-3"
          style={{ background: 'var(--lc-status-unpublished-bg)', color: 'var(--lc-status-unpublished-fg)' }}
        >
          <span className="inline-flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            {error}
          </span>
          <Button type="button" variant="outline" onClick={() => void load()}>
            {t('shell.retry')}
          </Button>
        </div>
      ) : null}

      <div id="pa-por-history-timeline" className="mx-auto max-w-[960px]">
        {loading ? (
          <ul className="flex flex-col gap-3" aria-hidden>
            {Array.from({ length: 5 }, (_, i) => (
              <li
                key={i}
                className="h-24 animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)] motion-reduce:animate-none"
                style={{ animationDuration: 'var(--lc-duration-base)' }}
              />
            ))}
          </ul>
        ) : events.length === 0 ? (
          <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-10 text-center">
            <div
              className="flex h-[160px] w-[160px] items-center justify-center rounded-[var(--lc-radius-lg)] border border-dashed border-[var(--lc-border-strong)] bg-[var(--lc-surface-sunken)] text-sm text-[var(--lc-text-muted)]"
              aria-hidden
            >
              {t('history.title', { name: displayName })}
            </div>
            <h2 style={{ font: 'var(--lc-type-heading-3)' }} className="text-[var(--lc-text-heading)]">
              {selectedEvents.length ? t('history.emptyFilter.title') : t('history.empty.title')}
            </h2>
            {selectedEvents.length ? (
              <Button type="button" variant="outline" onClick={() => patchParams({ events: null })}>
                {t('history.emptyFilter.cta')}
              </Button>
            ) : (
              <>
                <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body)' }}>
                  {t('history.empty.body', { name: displayName })}
                </p>
                <Button type="button" variant="outline" asChild>
                  <Link to={backHref}>{t('history.backToPortal')}</Link>
                </Button>
              </>
            )}
          </div>
        ) : (
          <ul className="flex flex-col gap-3" role="list">
            {events.map((event) => {
              const meta = eventMeta(event.event_type)
              const Icon = meta.icon
              const isOpen = expanded.has(event.id)
              const label = t(meta.copyKey)
              return (
                <li
                  key={event.id}
                  role="listitem"
                  className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-4 shadow-[var(--lc-elevation-sm)]"
                  aria-label={`${label} — ${new Date(event.event_at).toISOString()}`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--lc-radius-pill)]"
                      style={{
                        background: `var(--lc-status-${meta.token}-bg)`,
                        color: `var(--lc-status-${meta.token}-fg)`,
                      }}
                      aria-hidden
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 style={{ font: 'var(--lc-type-heading-3)' }} className="text-[var(--lc-text-heading)]">
                          {label}
                        </h2>
                        <time
                          dateTime={event.event_at}
                          dir="ltr"
                          className="font-[family-name:var(--lc-font-mono)] text-[length:var(--lc-type-data-sm,0.75rem)] text-[var(--lc-text-muted)]"
                        >
                          {new Date(event.event_at).toISOString().replace('T', ' ').slice(0, 16)} UTC
                        </time>
                      </div>
                      <p className="mt-1 text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-secondary)]">
                        {event.submitter
                          ? t('history.actor.submittedBy', {
                              name: event.submitter.display_name || event.submitter.id,
                            })
                          : null}
                        {event.approver ? (
                          <>
                            {event.submitter ? ' · ' : null}
                            {t('history.actor.approvedBy', {
                              name: event.approver.display_name || event.approver.id,
                            })}
                          </>
                        ) : null}
                      </p>

                      {event.submitter_notes ? (
                        <blockquote className="mt-2 border-s-2 border-[var(--lc-border-strong)] ps-3 text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-secondary)]">
                          <span className="me-1 text-[length:var(--lc-type-caption)] font-semibold text-[var(--lc-text-muted)]">
                            {t('history.notes.submitter')}:
                          </span>
                          {event.submitter_notes}
                        </blockquote>
                      ) : null}
                      {event.approver_notes ? (
                        <blockquote className="mt-2 border-s-2 border-[var(--lc-border-strong)] ps-3 text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-secondary)]">
                          <span className="me-1 text-[length:var(--lc-type-caption)] font-semibold text-[var(--lc-text-muted)]">
                            {t('history.notes.approver')}:
                          </span>
                          {event.approver_notes}
                        </blockquote>
                      ) : null}

                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          onClick={() => toggleDiff(event.id)}
                          className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-brand)] hover:underline"
                        >
                          {isOpen ? t('history.diff.toggleHide') : t('history.diff.toggleShow')}
                        </button>
                        {event.version_created != null ? (
                          <Button type="button" size="sm" variant="outline" asChild>
                            <Link to={`/admin/portals/${encodeURIComponent(code)}?version=${event.version_created}`}>
                              <ArrowRight className="me-1 h-3.5 w-3.5" aria-hidden />
                              {t('history.versionLink', { n: event.version_created })}
                            </Link>
                          </Button>
                        ) : null}
                      </div>

                      {isOpen ? (
                        <div className="mt-3">
                          <DiffBlock
                            event={event}
                            labels={{
                              before: t('history.diff.before'),
                              after: t('history.diff.after'),
                              none: t('history.diff.none'),
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {total > pageSize ? (
        <footer className="mt-[var(--lc-space-md)] flex flex-wrap items-center justify-end gap-3 text-sm text-[var(--lc-text-muted)]">
          <span>{t('history.pagination', { start: startIdx, end: endIdx, total })}</span>
          <label className="inline-flex items-center gap-2">
            <span>{t('history.pageSize')}</span>
            <select
              className="min-h-tap rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 text-sm text-[var(--lc-text-primary)] focus-visible:outline-none"
              value={pageSize}
              onChange={(e) => patchParams({ pageSize: e.target.value }, { resetPage: true })}
            >
              {[25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t('list.prevPage')}
            disabled={page <= 1 || loading}
            onClick={() => patchParams({ page: String(page - 1) }, { resetPage: false })}
          >
            <ChevronRight className="h-4 w-4 rotate-180 rtl:rotate-0" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t('list.nextPage')}
            disabled={page >= pageCount || loading}
            onClick={() => patchParams({ page: String(page + 1) }, { resetPage: false })}
          >
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </Button>
        </footer>
      ) : null}
    </div>
  )
}

export default PortalActivationHistoryPage
