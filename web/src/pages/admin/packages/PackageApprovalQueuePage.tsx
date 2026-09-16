/**
 * PA-PKG-003 (queue) — Package approval queue. Lists PENDING_APPROVAL versions
 * awaiting review; opening a row goes to the detail decision surface.
 *
 * Built on the PA-queue-family primitives per project memory
 * `project_pa_queue_family.md` — PA-MOD-001 is the anchor and every downstream
 * PA queue must consume the same shared primitives (StatusHero-shaped hero +
 * PAQueueFilterStrip + PAQueueTable + PAQueueKeyboardShortcutsPanel).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { HelpCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Numeric } from '@/components/ui/numeric'
import { PIIMask } from '@/components/security/PIIMask'
import {
  PAQueueFilterStrip,
  PAQueueKeyboardShortcutsPanel,
  PAQueueTable,
  type PAQueueColumn,
  type PAQueueFilterValues,
  type PAQueueKeyboardShortcut,
  type PAQueueSubmittedWithin,
} from '@/components/queue'
import { cn } from '@/lib/utils'
import { PackageConsoleFrame, PackageStatusBadge } from './packageShared'
import { formatRelative } from './packageFormat'
import { usePackagesCopy } from './packagesCopy'
import { packagesApi } from './api'
import { diffRequiresTwoPerson, type PendingApprovalRow } from './types'

const WF20_SHORTCUTS: PAQueueKeyboardShortcut[] = [
  { keys: 'J', description: 'Next row' },
  { keys: 'K', description: 'Previous row' },
  { keys: 'Enter', description: 'Open selected row' },
  { keys: '.', description: 'Refresh queue' },
  { keys: '?', description: 'Show shortcuts' },
  { keys: 'Esc', description: 'Close panel / clear focus' },
]

function ChangeChips({ row }: { row: PendingApprovalRow }) {
  const { t } = usePackagesCopy()
  const chips: string[] = []
  if (row.diff.monthly_price_minor_delta !== 0) chips.push(t('appr.chip.price'))
  if (row.diff.properties_covered_delta !== 0) chips.push(t('appr.chip.coverage'))
  const quotaTotal = row.diff.quotas_added + row.diff.quotas_removed + row.diff.quotas_changed
  if (quotaTotal > 0) chips.push(t('appr.chip.quotas', { count: quotaTotal }))
  if (row.diff.flags_changed > 0) chips.push(t('appr.chip.flags', { count: row.diff.flags_changed }))
  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((c) => (
        <Badge key={c} variant="outline">
          {c}
        </Badge>
      ))}
    </div>
  )
}

export function PackageApprovalQueuePage() {
  const navigate = useNavigate()
  const { t } = usePackagesCopy()
  const [searchParams, setSearchParams] = useSearchParams()
  const view = (searchParams.get('view') as 'mine' | 'all') || 'mine'
  const within = ((searchParams.get('within') as PAQueueSubmittedWithin) || '7d')
  const search = searchParams.get('q') || ''

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [rows, setRows] = useState<PendingApprovalRow[]>([])
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const data = await packagesApi.pendingApprovals()
      setRows(data.approvals || [])
    } catch {
      setError(true)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const patchParams = useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams)
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === '') params.delete(key)
        else params.set(key, value)
      }
      setSearchParams(params)
    },
    [searchParams, setSearchParams],
  )

  const twoPersonCount = useMemo(
    () => rows.filter((r) => diffRequiresTwoPerson(r.diff)).length,
    [rows],
  )
  const mineCount = useMemo(() => rows.filter((r) => !r.is_own_submission).length, [rows])

  const visibleRows = useMemo(() => {
    const withinMs = withinToMs(within)
    const now = Date.now()
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (view === 'mine' && r.is_own_submission) return false
      if (withinMs != null && r.submitted_at) {
        const ts = Date.parse(r.submitted_at)
        if (Number.isFinite(ts) && now - ts > withinMs) return false
      }
      if (q) {
        const hay = `${r.package_display_name} ${r.package_code} ${r.version_number}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, view, within, search])

  // Keyboard-first navigation — invariant 7 (project_pa_queue_family.md).
  // J/K move focus, Enter opens, `.` refreshes, `?` opens shortcuts, Esc closes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const editable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'SELECT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      if (editable) return
      if (e.key === '?') {
        e.preventDefault()
        setShortcutsOpen(true)
        return
      }
      if (e.key === 'Escape') {
        setShortcutsOpen(false)
        return
      }
      if (e.key === '.') {
        e.preventDefault()
        void load()
        return
      }
      if (visibleRows.length === 0) return
      const currentIdx = focusedId ? visibleRows.findIndex((r) => r.id === focusedId) : -1
      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault()
        const next = Math.min(visibleRows.length - 1, Math.max(0, currentIdx + 1))
        setFocusedId(visibleRows[next]?.id ?? null)
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault()
        const prev = Math.max(0, currentIdx - 1)
        setFocusedId(visibleRows[prev]?.id ?? null)
      } else if (e.key === 'Enter') {
        if (focusedId) {
          e.preventDefault()
          navigate(
            `/admin/packages/approvals/${focusedId}?return_to=${encodeURIComponent(
              `${window.location.pathname}${window.location.search}`,
            )}`,
          )
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visibleRows, focusedId, load, navigate])

  const filterValues: PAQueueFilterValues = {
    status: view,
    submittedWithin: within,
    riskTier: 'any',
    search,
  }

  const columns: PAQueueColumn<PendingApprovalRow>[] = [
    {
      id: 'submitted',
      header: t('appr.col.submitted'),
      cell: (row) => (
        <Numeric as="span" title={row.submitted_at || undefined}>
          {formatRelative(row.submitted_at)}
        </Numeric>
      ),
    },
    {
      id: 'package',
      header: t('appr.col.package'),
      cell: (row) => (
        <div>
          <div className="font-medium text-[var(--lc-text-heading)]">{row.package_display_name}</div>
          <div className="font-[family-name:var(--lc-font-mono)] text-xs text-[var(--lc-text-muted)]">
            {row.package_code}
          </div>
        </div>
      ),
    },
    {
      id: 'version',
      header: t('appr.col.version'),
      cell: (row) => (
        <Numeric as="span">
          {t('appr.version.transition', {
            version: row.version_number,
            base: row.diff.versus_version_number ?? row.version_number - 1,
          })}
        </Numeric>
      ),
    },
    {
      id: 'submitter',
      header: t('appr.col.submitter'),
      cell: (row) => (
        <PIIMask
          kind="name"
          value={row.requester_actor_id || '—'}
          auditContext={{ caseId: row.id, field: 'requester' }}
          revealDurationMs={30_000}
        />
      ),
    },
    {
      id: 'summary',
      header: t('appr.col.summary'),
      cell: (row) => <ChangeChips row={row} />,
    },
    {
      id: 'type',
      header: t('appr.col.type'),
      cell: (row) => {
        const twoPerson = diffRequiresTwoPerson(row.diff)
        return (
          <Badge status={twoPerson ? 'pending' : 'draft'}>
            {twoPerson ? t('appr.badge.twoPerson') : t('appr.badge.single')}
          </Badge>
        )
      },
    },
    {
      id: 'status',
      header: t('appr.col.status'),
      cell: () => <PackageStatusBadge state="PENDING_APPROVAL" />,
    },
    {
      id: 'actions',
      header: t('list.col.actions'),
      cell: (row) => (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            navigate(
              `/admin/packages/approvals/${row.id}?return_to=${encodeURIComponent(
                `${window.location.pathname}${window.location.search}`,
              )}`,
            )
          }
        >
          {t('common.open')}
        </Button>
      ),
    },
  ]

  return (
    <PackageConsoleFrame>
      <header className="mb-[var(--lc-space-lg)] flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            className="text-[var(--lc-text-heading)]"
            style={{ font: 'var(--lc-type-heading-1)' }}
          >
            {t('appr.title')}
          </h1>
          <p
            className="mt-1 text-[var(--lc-text-muted)]"
            style={{ font: 'var(--lc-type-body-sm)' }}
          >
            {t('appr.subtitle', {
              pending: rows.length,
              twoPerson: twoPersonCount,
              mine: mineCount,
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={t('common.shortcuts')}
            onClick={() => setShortcutsOpen(true)}
          >
            <HelpCircle className="me-1 h-4 w-4" aria-hidden />
            <span className="sr-only">?</span>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="me-1 h-4 w-4" aria-hidden />
            {t('common.refresh')}
          </Button>
        </div>
      </header>

      <PAQueueFilterStrip
        statusOptions={[
          {
            value: 'mine',
            label: t('appr.tab.mine'),
            count: rows.filter((r) => !r.is_own_submission).length,
          },
          { value: 'all', label: t('appr.tab.all'), count: rows.length },
        ]}
        values={filterValues}
        onChange={(next) => {
          patchParams({
            view: next.status,
            within: next.submittedWithin,
            q: next.search || null,
          })
        }}
      />

      {error ? (
        <div
          role="alert"
          className="mt-[var(--lc-space-md)] rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-status-unpublished-bg)] px-4 py-3 text-[var(--lc-status-unpublished-fg)]"
        >
          {t('appr.error')}{' '}
          <Button type="button" variant="link" onClick={() => void load()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : null}

      <div className={cn('mt-[var(--lc-space-md)] [&_tr]:group')}>
        <PAQueueTable<PendingApprovalRow>
          aria-label={t('appr.title')}
          columns={columns}
          rows={visibleRows}
          focusedId={focusedId}
          onRowClick={(row) =>
            navigate(
              `/admin/packages/approvals/${row.id}?return_to=${encodeURIComponent(
                `${window.location.pathname}${window.location.search}`,
              )}`,
            )
          }
          loading={loading}
          // Invariant 6 (deliberate bulk-omit): WF-20 package publish is
          // enterprise-governance — each approval writes to the shared
          // capability-pack registry and downstream cache-bust; approvers
          // review each package in context (version-diff + capability delta
          // + cast-vote when high-value). Bulk approve would be a footgun.
          // See PA-PKG-003 brief §Interactions.
          selectable={false}
          emptyState={
            <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-4">
              <div
                className="h-[160px] w-full rounded-[var(--lc-radius-lg)] border border-dashed border-[var(--lc-border-strong)] bg-[var(--lc-surface-sunken)]"
                aria-hidden
              />
              <p className="font-medium text-[var(--lc-text-heading)]">{t('appr.empty.title')}</p>
              <p className="text-sm text-[var(--lc-text-muted)]">{t('appr.empty.body')}</p>
              <Button
                type="button"
                variant="link"
                onClick={() => navigate('/admin/packages')}
              >
                {t('appr.empty.cta')}
              </Button>
            </div>
          }
        />
      </div>

      <PAQueueKeyboardShortcutsPanel
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
        shortcuts={WF20_SHORTCUTS}
      />
    </PackageConsoleFrame>
  )
}

function withinToMs(within: PAQueueSubmittedWithin | undefined): number | null {
  switch (within) {
    case '24h':
      return 24 * 60 * 60 * 1000
    case '7d':
      return 7 * 24 * 60 * 60 * 1000
    case '30d':
      return 30 * 24 * 60 * 60 * 1000
    default:
      return null
  }
}
