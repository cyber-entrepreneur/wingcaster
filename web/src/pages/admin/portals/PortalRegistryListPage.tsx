/**
 * PA-POR-001 — Portal registry list (dynamic portal catalog).
 *
 * Consumes the platform-admin portal_registry routes (BE-BLOCKER-35). Env badge
 * always visible; catalog identity env-shared, connected-agent counts env-scoped.
 * Two-person activation flips live in PA-POR-002 — this list never toggles inline.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  HelpCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react'
import { PAQueueTable, type PAQueueColumn } from '@/components/queue'
import { EnvBadge } from '@/components/nav/EnvBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Numeric } from '@/components/ui/numeric'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { useEnv } from '@/hooks/useEnv'
import { useLocale } from '@/hooks/useLocale'
import { cn } from '@/lib/utils'
import { listPortals, portalsCsvPath } from './api'
import { usePortalCopy } from './copy'
import {
  ToneBadge,
  activeStatusToken,
  adapterStatusToken,
  countryFlagEmoji,
  portalMonogram,
  relativeTime,
  useDesktopMin,
} from './shared'
import type {
  PortalActiveFilter,
  PortalAdmin,
  PortalListCounts,
  PortalListSort,
  PortalStatusFilter,
} from './types'

const SEARCH_DEBOUNCE_MS = 200
const DEFAULT_PAGE_SIZE = 25

const STATUS_VALUES: PortalStatusFilter[] = ['all', 'live', 'stub', 'deprecated']
const SORT_VALUES: PortalListSort[] = [
  'last_change:desc',
  'last_change:asc',
  'code:asc',
  'display_name:asc',
  'connected:desc',
  'country_count:desc',
]

function parseStatus(raw: string | null): PortalStatusFilter {
  return (STATUS_VALUES as string[]).includes(raw || '') ? (raw as PortalStatusFilter) : 'all'
}

function parseActive(raw: string | null): PortalActiveFilter {
  if (raw === 'false' || raw === 'all') return raw
  return 'true'
}

function parseSort(raw: string | null): PortalListSort {
  return (SORT_VALUES as string[]).includes(raw || '') ? (raw as PortalListSort) : 'last_change:desc'
}

type PortalRow = PortalAdmin & { id: string }

export function PortalRegistryListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { addToast } = useToast()
  const { env, isTest } = useEnv()
  const { locale } = useLocale()
  const { t } = usePortalCopy()
  const isDesktop = useDesktopMin()

  const status = parseStatus(searchParams.get('status'))
  const active = parseActive(searchParams.get('active'))
  const country = searchParams.get('country') ?? ''
  const q = searchParams.get('q') ?? ''
  const sort = parseSort(searchParams.get('sort'))
  const page = Math.max(1, Number(searchParams.get('page') || '1') || 1)
  const pageSize = Math.min(
    100,
    Math.max(1, Number(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE)) || DEFAULT_PAGE_SIZE),
  )

  const [rows, setRows] = useState<PortalRow[]>([])
  const [counts, setCounts] = useState<PortalListCounts>({
    total: 0,
    live: 0,
    stub: 0,
    deprecated: 0,
    countries_covered: 0,
  })
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [searchDraft, setSearchDraft] = useState(q)
  const [countryOptions, setCountryOptions] = useState<string[]>([])
  const fetchGen = useRef(0)

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

  const loadRegistry = useCallback(async () => {
    const gen = ++fetchGen.current
    setLoading(true)
    setError(null)
    try {
      const data = await listPortals({
        status,
        active: status === 'deprecated' ? 'all' : active,
        country: country || undefined,
        q: q || undefined,
        page,
        pageSize,
        sort,
      })
      if (gen !== fetchGen.current) return
      const nextRows: PortalRow[] = (data.portals || []).map((p) => ({ ...p, id: p.code }))
      setRows(nextRows)
      setTotal(data.pagination?.total ?? nextRows.length)
      setCounts(
        data.counts ?? { total: 0, live: 0, stub: 0, deprecated: 0, countries_covered: 0 },
      )
      setCountryOptions((prev) => {
        const set = new Set(prev)
        for (const p of nextRows) for (const c of p.country_codes || []) set.add(c)
        return Array.from(set).sort()
      })
      setFocusedId((prev) => {
        if (prev && nextRows.some((r) => r.id === prev)) return prev
        return nextRows[0]?.id ?? null
      })
    } catch (err) {
      if (gen !== fetchGen.current) return
      setError(err instanceof Error ? err.message : t('list.loadError'))
      setRows([])
      setTotal(0)
    } finally {
      if (gen === fetchGen.current) setLoading(false)
    }
  }, [status, active, country, q, page, pageSize, sort, t])

  useEffect(() => {
    void loadRegistry()
  }, [loadRegistry, env])

  useEffect(() => {
    setSearchDraft(q)
  }, [q])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (searchDraft === q) return
      patchParams({ q: searchDraft.trim() || null })
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(handle)
  }, [searchDraft, q, patchParams])

  const listQueryForCsv = useMemo(
    () => ({
      status,
      active: status === 'deprecated' ? ('all' as const) : active,
      country: country || undefined,
      q: q || undefined,
      sort,
    }),
    [status, active, country, q, sort],
  )

  const detailHref = useCallback(
    (code: string, suffix = '') => {
      const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search}`)
      return `/admin/portals/${encodeURIComponent(code)}${suffix}?return_to=${returnTo}`
    },
    [],
  )

  const openView = useCallback((row: PortalRow) => navigate(detailHref(row.code)), [detailHref, navigate])
  const openEdit = useCallback((row: PortalRow) => navigate(detailHref(row.code, '/edit')), [detailHref, navigate])
  const openHistory = useCallback(
    (row: PortalRow) => navigate(detailHref(row.code, '/history')),
    [detailHref, navigate],
  )

  const focusedRow = rows.find((r) => r.id === focusedId) ?? null

  const moveFocus = useCallback(
    (delta: number) => {
      if (rows.length === 0) return
      const idx = Math.max(0, rows.findIndex((r) => r.id === focusedId))
      const next = rows[(idx + delta + rows.length) % rows.length]
      setFocusedId(next.id)
      const el = document.querySelector(`[data-row-id="${CSS.escape(next.id)}"]`) as HTMLElement | null
      el?.focus()
    },
    [rows, focusedId],
  )

  const onGlobalKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) {
        if (e.key === 'Escape') (target as HTMLElement).blur()
        return
      }
      if (shortcutsOpen) {
        if (e.key === 'Escape') setShortcutsOpen(false)
        return
      }
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault()
        setShortcutsOpen(true)
        return
      }
      if (e.key === '.') {
        e.preventDefault()
        void loadRegistry()
        return
      }
      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault()
        moveFocus(1)
        return
      }
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault()
        moveFocus(-1)
        return
      }
      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault()
        navigate('/admin/portals/new')
        return
      }
      if (!focusedRow) return
      if (e.key === 'Enter') {
        e.preventDefault()
        openView(focusedRow)
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault()
        openEdit(focusedRow)
      } else if (e.key === 'h' || e.key === 'H') {
        e.preventDefault()
        openHistory(focusedRow)
      }
    },
    [shortcutsOpen, loadRegistry, moveFocus, navigate, focusedRow, openView, openEdit, openHistory],
  )

  useEffect(() => {
    window.addEventListener('keydown', onGlobalKeyDown)
    return () => window.removeEventListener('keydown', onGlobalKeyDown)
  }, [onGlobalKeyDown])

  const columns: PAQueueColumn<PortalRow>[] = useMemo(
    () => [
      {
        id: 'portal',
        header: t('list.col.portal'),
        cell: (row) => (
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] text-xs font-semibold text-[var(--lc-text-primary)]"
              aria-hidden
            >
              {row.logo_url ? (
                <img src={row.logo_url} alt="" className="h-8 w-8 object-contain" />
              ) : (
                portalMonogram(row.code, row.display_name)
              )}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[var(--lc-text-primary)]">{row.display_name}</div>
              <div
                className="truncate font-[family-name:var(--lc-font-mono)] text-[length:var(--lc-type-data-sm,0.75rem)] text-[var(--lc-text-muted)]"
                dir="ltr"
              >
                {row.code}
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'countries',
        header: t('list.col.countries'),
        cell: (row) => {
          const codes = row.country_codes || []
          const shown = codes.slice(0, 5)
          const extra = codes.length - shown.length
          return (
            <ul className="flex flex-wrap gap-1" aria-label={t('list.col.countries')}>
              {shown.map((c) => (
                <li key={c}>
                  <span
                    className="inline-flex items-center gap-1 rounded-[var(--lc-radius-pill)] border border-[var(--lc-border)] px-2 py-0.5 text-[length:var(--lc-type-caption)] text-[var(--lc-text-secondary)]"
                    dir="ltr"
                    aria-label={c}
                  >
                    <span aria-hidden>{countryFlagEmoji(c)}</span> {c}
                  </span>
                </li>
              ))}
              {extra > 0 ? (
                <li>
                  <span
                    className="inline-flex items-center rounded-[var(--lc-radius-pill)] border border-[var(--lc-border)] px-2 py-0.5 text-[length:var(--lc-type-caption)] text-[var(--lc-text-secondary)]"
                    title={codes.slice(5).join(', ')}
                  >
                    +<Numeric>{extra}</Numeric>
                  </span>
                </li>
              ) : null}
            </ul>
          )
        },
      },
      {
        id: 'adapter',
        header: t('list.col.adapter'),
        cell: (row) => {
          const { glyph, token } = adapterStatusToken(row.adapter_status)
          const label =
            row.adapter_status === 'live'
              ? t('list.adapter.live')
              : row.adapter_status === 'deprecated'
                ? t('list.adapter.deprecated')
                : t('list.adapter.stub')
          const tip =
            row.adapter_status === 'stub'
              ? t('list.adapter.stub.tooltip')
              : row.adapter_status === 'deprecated'
                ? t('list.adapter.deprecated.tooltip')
                : undefined
          return (
            <div className="flex flex-col gap-1">
              <span
                className="font-[family-name:var(--lc-font-mono)] text-[length:var(--lc-type-data-sm,0.75rem)] text-[var(--lc-text-muted)]"
                dir="ltr"
              >
                {row.adapter_class_name}
              </span>
              <span className="w-fit">
                <ToneBadge glyph={glyph} label={label} token={token} title={tip} />
              </span>
            </div>
          )
        },
      },
      {
        id: 'active',
        header: t('list.col.active'),
        cell: (row) => {
          const hasPending = Boolean(row.pending_activation)
          const { glyph, token } = activeStatusToken(row.is_active, hasPending)
          const label = hasPending
            ? t('list.active.pending')
            : row.is_active
              ? t('list.active.active')
              : t('list.active.inactive')
          return <ToneBadge glyph={glyph} label={label} token={token} />
        },
      },
      {
        id: 'sla',
        header: t('list.col.sla'),
        cellClassName: 'text-end',
        cell: (row) =>
          row.sla_hours == null ? (
            <span className="text-[var(--lc-text-muted)]">{t('list.sla.missing')}</span>
          ) : (
            <span>
              <Numeric>{row.sla_hours}</Numeric>h
            </span>
          ),
      },
      {
        id: 'connected',
        header: t('list.col.connected'),
        cellClassName: 'text-end',
        cell: (row) => (
          <span
            className="inline-flex items-center gap-1"
            title={t('list.connected.tooltip', {
              env,
              n: row.connected_agents_env ?? 0,
              m: row.connected_agencies_env ?? 0,
            })}
          >
            <Users className="h-3.5 w-3.5 text-[var(--lc-text-muted)]" aria-hidden />
            <Numeric>{row.connected_agents_env ?? 0}</Numeric>
          </span>
        ),
      },
      {
        id: 'lastChange',
        header: t('list.col.lastChange'),
        cell: (row) => (
          <div className="flex flex-col">
            <span
              className="text-[length:var(--lc-type-body-sm)]"
              title={row.last_change_at ? new Date(row.last_change_at).toISOString() : undefined}
            >
              {relativeTime(row.last_change_at)}
            </span>
            {row.last_change_by ? (
              <span className="text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
                {t('list.lastChange.by', {
                  name: row.last_change_by.display_name || row.last_change_by.id,
                })}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        id: 'actions',
        header: t('list.col.actions'),
        srOnlyHeader: true,
        cellClassName: 'text-end',
        cell: (row) => {
          const stop = (e: ReactMouseEvent) => e.stopPropagation()
          return (
            <div className="flex items-center justify-end gap-1" onClick={stop}>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={t('list.action.view', { name: row.display_name })}
                onClick={() => openView(row)}
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={t('list.action.edit', { name: row.display_name })}
                onClick={() => openEdit(row)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={t('list.action.history', { name: row.display_name })}
                onClick={() => openHistory(row)}
              >
                <Clock className="h-4 w-4" />
              </Button>
            </div>
          )
        },
      },
    ],
    [t, env, openView, openEdit, openHistory],
  )

  const hasFilters = status !== 'all' || active !== 'true' || Boolean(country) || Boolean(q)

  const emptyState = (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-6 text-center">
      <div
        className="flex h-[160px] w-[160px] items-center justify-center rounded-[var(--lc-radius-lg)] border border-dashed border-[var(--lc-border-strong)] bg-[var(--lc-surface-sunken)] text-sm text-[var(--lc-text-muted)]"
        aria-hidden
      >
        {t('list.title')}
      </div>
      {hasFilters ? (
        <>
          <h2 style={{ font: 'var(--lc-type-heading-3)' }} className="text-[var(--lc-text-heading)]">
            {t('list.emptyFilter.title')}
          </h2>
          <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body)' }}>
            {t('list.emptyFilter.body')}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => patchParams({ status: null, active: null, country: null, q: null })}
          >
            {t('list.emptyFilter.cta')}
          </Button>
        </>
      ) : (
        <>
          <h2 style={{ font: 'var(--lc-type-heading-3)' }} className="text-[var(--lc-text-heading)]">
            {t('list.empty.title')}
          </h2>
          <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body)' }}>
            {t('list.empty.body')}
          </p>
          <Button type="button" asChild>
            <Link to="/admin/portals/new">{t('list.empty.cta')}</Link>
          </Button>
        </>
      )}
    </div>
  )

  const selectClassName = cn(
    'min-h-tap rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)]',
    'bg-[var(--lc-surface)] px-3 text-sm text-[var(--lc-text-primary)]',
    'focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
  )

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
  const deprecatedTab = status === 'deprecated'

  return (
    <div
      className="mx-auto w-full max-w-[1440px] px-[var(--lc-space-2xl)] py-[var(--lc-space-xl)]"
      data-testid="portal-registry-list"
      data-env={env}
    >
      <a
        href="#pa-por-list-table"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-[var(--lc-radius-md)] focus:bg-[var(--lc-surface-raised)] focus:px-3 focus:py-2"
      >
        {t('list.skipToTable')}
      </a>

      <header className="mb-[var(--lc-space-md)] flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 style={{ font: 'var(--lc-type-heading-1)' }} className="text-[var(--lc-text-heading)]">
            {t('list.title')}
          </h1>
          <p className="mt-1 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
            <Numeric>{counts.total}</Numeric> · <Numeric>{counts.live}</Numeric>{' '}
            {t('list.tab.live')} · <Numeric>{counts.stub}</Numeric> {t('list.tab.stub')} ·{' '}
            <Numeric>{counts.deprecated}</Numeric> {t('list.tab.deprecated')} ·{' '}
            <Numeric>{counts.countries_covered}</Numeric>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <EnvBadge env={env} locale={locale} tabIndex={-1} />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t('list.refresh')}
            onClick={() => {
              void loadRegistry().then(() => addToast({ title: t('list.refreshedToast') }))
            }}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => window.open(portalsCsvPath(listQueryForCsv), '_blank', 'noopener,noreferrer')}
          >
            <Download className="me-2 h-4 w-4" aria-hidden />
            {t('list.exportCsv')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t('list.shortcuts')}
            onClick={() => setShortcutsOpen(true)}
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
          <Button type="button" asChild>
            <Link to="/admin/portals/new">
              <Plus className="me-2 h-4 w-4" aria-hidden />
              {t('list.addPortal')}
            </Link>
          </Button>
        </div>
      </header>

      {isTest ? (
        <div
          role="status"
          aria-live="polite"
          className="mb-[var(--lc-space-sm)] rounded-[var(--lc-radius-md)] px-3 py-2 text-sm font-medium"
          style={{ background: 'var(--lc-status-underOffer-dot)', color: 'var(--lc-text-inverse)' }}
          data-testid="pa-por-test-warning"
        >
          {t('shell.testStrip')}
        </div>
      ) : null}

      <div
        className="mb-[var(--lc-space-sm)] flex flex-wrap items-end gap-3 rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-3"
        role="group"
        aria-label={t('list.filter.aria')}
      >
        <div role="tablist" aria-label={t('list.filter.aria')} className="flex gap-1">
          {STATUS_VALUES.map((s) => {
            const label =
              s === 'all'
                ? t('list.tab.all')
                : s === 'live'
                  ? t('list.tab.live')
                  : s === 'stub'
                    ? t('list.tab.stub')
                    : t('list.tab.deprecated')
            const countFor = s === 'all' ? counts.total : counts[s]
            const activeTab = status === s
            return (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={activeTab}
                disabled={loading}
                className={cn(
                  'inline-flex items-center gap-1 rounded-[var(--lc-radius-md)] px-3 py-1.5 text-sm',
                  activeTab
                    ? 'bg-[var(--lc-action-secondary)] text-[var(--lc-action-secondary-text)]'
                    : 'text-[var(--lc-text-secondary)] hover:bg-[var(--lc-surface-sunken)]',
                )}
                onClick={() => patchParams({ status: s === 'all' ? null : s })}
              >
                {label}
                <Numeric>{countFor}</Numeric>
              </button>
            )
          })}
        </div>

        <label className="flex items-center gap-2 text-sm text-[var(--lc-text-primary)]">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--lc-action-primary)]"
            checked={active === 'true'}
            disabled={loading || deprecatedTab}
            onChange={(e) => patchParams({ active: e.target.checked ? null : 'all' })}
          />
          {t('list.filter.activeOnly')}
        </label>

        <div className="flex flex-col gap-1">
          <label htmlFor="pa-por-country" className="text-sm font-medium text-[var(--lc-text-primary)]">
            {t('list.filter.country')}
          </label>
          <select
            id="pa-por-country"
            className={selectClassName}
            value={country}
            disabled={loading}
            onChange={(e) => patchParams({ country: e.target.value || null })}
          >
            <option value="">{t('list.filter.anyCountry')}</option>
            {countryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex min-w-[16rem] flex-1 flex-col gap-1">
          <label htmlFor="pa-por-search" className="text-sm font-medium text-[var(--lc-text-primary)]">
            {t('list.filter.searchPlaceholder')}
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute inset-y-0 my-auto ms-3 h-4 w-4 text-[var(--lc-text-muted)]"
              aria-hidden
            />
            <Input
              id="pa-por-search"
              className="ps-9"
              value={searchDraft}
              disabled={loading}
              placeholder={t('list.filter.searchPlaceholder')}
              onChange={(e) => setSearchDraft(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="pa-por-sort" className="text-sm font-medium text-[var(--lc-text-primary)]">
            {t('list.sort.label')}
          </label>
          <select
            id="pa-por-sort"
            className={selectClassName}
            value={sort}
            disabled={loading}
            onChange={(e) => patchParams({ sort: e.target.value })}
          >
            <option value="last_change:desc">{t('list.sort.lastChangeDesc')}</option>
            <option value="last_change:asc">{t('list.sort.lastChangeAsc')}</option>
            <option value="code:asc">{t('list.sort.codeAsc')}</option>
            <option value="display_name:asc">{t('list.sort.displayNameAsc')}</option>
            <option value="connected:desc">{t('list.sort.connectedDesc')}</option>
            <option value="country_count:desc">{t('list.sort.countryCountDesc')}</option>
          </select>
        </div>
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
          <Button type="button" variant="outline" onClick={() => void loadRegistry()}>
            {t('shell.retry')}
          </Button>
        </div>
      ) : null}

      <div id="pa-por-list-table">
        <PAQueueTable<PortalRow>
          aria-label={t('list.title')}
          columns={columns}
          rows={rows}
          selectable={false}
          focusedId={focusedId}
          onRowClick={openView}
          emptyState={emptyState}
          loading={loading}
          skeletonRows={6}
        />
      </div>

      <footer className="mt-[var(--lc-space-md)] flex flex-wrap items-center justify-end gap-3 text-sm text-[var(--lc-text-muted)]">
        <span>
          {t('list.pagination', { start: startIdx, end: endIdx, total })}
        </span>
        <label className="inline-flex items-center gap-2">
          <span>{t('list.pageSize')}</span>
          <select
            className={selectClassName}
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
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('list.nextPage')}
          disabled={page >= pageCount || loading}
          onClick={() => patchParams({ page: String(page + 1) }, { resetPage: false })}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </footer>

      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('kbd.title')}</DialogTitle>
          </DialogHeader>
          <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-sm">
            {(
              [
                ['J', t('kbd.next')],
                ['K', t('kbd.prev')],
                ['Enter', t('kbd.open')],
                ['E', t('kbd.edit')],
                ['H', t('kbd.history')],
                ['A', t('kbd.add')],
                ['.', t('kbd.refresh')],
                ['?', t('kbd.help')],
                ['Esc', t('kbd.escape')],
              ] as const
            ).map(([key, desc]) => (
              <div key={key} className="contents">
                <dt>
                  <kbd className="rounded-[var(--lc-radius-sm)] border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] px-2 py-0.5 font-[family-name:var(--lc-font-mono)]">
                    {key}
                  </kbd>
                </dt>
                <dd className="text-[var(--lc-text-secondary)]">{desc}</dd>
              </div>
            ))}
          </dl>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default PortalRegistryListPage
