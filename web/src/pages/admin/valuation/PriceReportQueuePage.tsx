/**
 * PA-PVA-009 — Agent-price-report review queue (WF-06).
 *
 * Bulk incorporate is intentionally disallowed — each incorporate writes the
 * pricing benchmark and must be reviewed one report at a time.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { HelpCircle, Info, RefreshCw, Download } from 'lucide-react'
import { api } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { PIIMask } from '@/components/security/PIIMask'
import {
  PAQueueBulkReasonDialog,
  PAQueueFilterStrip,
  PAQueueKeyboardShortcutsPanel,
  PAQueueTable,
  type PAQueueColumn,
  type PAQueueFilterValues,
  type PAQueueSubmittedWithin,
} from '@/components/queue'
import { cn } from '@/lib/utils'
import {
  PriceReportIncorporateDialog,
  PriceReportReasonDialog,
  PriceReportSignalOnlyDialog,
} from './priceReportDialogs'
import {
  AgentTierChip,
  PriceReportCompositeRiskCell,
  PriceReportDeltaChip,
  PriceReportStatusBadge,
  formatMoney,
  formatRelativeTime,
  formatTenure,
} from './priceReportShared'
import type {
  PriceReportListItem,
  PriceReportListResponse,
  PriceReportReviewBody,
  PriceReportReviewResult,
} from './priceReportTypes'
import { REJECT_REASON_OPTIONS, REQUEST_INFO_REASON_OPTIONS } from './priceReportTypes'

const WF06_SHORTCUTS = [
  { keys: 'J', description: 'Next report' },
  { keys: 'K', description: 'Previous report' },
  { keys: 'A', description: 'Incorporate focused report (single-row only)' },
  { keys: 'S', description: 'Approve focused report as signal-only' },
  { keys: 'R', description: 'Reject focused report' },
  { keys: 'I', description: 'Request info on focused report' },
  { keys: 'Enter', description: 'Open report detail' },
  { keys: 'X', description: 'Toggle row selection' },
  { keys: 'Shift + A', description: 'Select all visible rows' },
  { keys: '.', description: 'Refresh queue' },
  { keys: '?', description: 'Show keyboard shortcuts' },
  { keys: 'Esc', description: 'Close modal / clear selection' },
]

type DialogKind =
  | null
  | { type: 'incorporate'; report: PriceReportListItem }
  | { type: 'signal'; report: PriceReportListItem }
  | { type: 'reject'; report: PriceReportListItem }
  | { type: 'request_info'; report: PriceReportListItem }
  | { type: 'bulk_signal' }
  | { type: 'bulk_reject' }
  | { type: 'bulk_request_info' }

function normalizeListPayload(raw: unknown): PriceReportListResponse {
  if (Array.isArray(raw)) {
    return {
      reports: raw as PriceReportListItem[],
      pagination: { page: 1, page_size: raw.length, total: raw.length, has_next: false },
      counts: {
        pending: raw.length,
        pending_high_delta: 0,
        incorporated_this_month: 0,
        signal_only_this_month: 0,
        rejected_this_month: 0,
      },
    }
  }
  const body = (raw || {}) as Partial<PriceReportListResponse>
  return {
    reports: body.reports || [],
    pagination: body.pagination || { page: 1, page_size: 25, total: 0, has_next: false },
    counts: body.counts || {
      pending: 0,
      pending_high_delta: 0,
      incorporated_this_month: 0,
      signal_only_this_month: 0,
      rejected_this_month: 0,
    },
  }
}

export function PriceReportQueuePage() {
  const { isAdmin } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const status = searchParams.get('status') || 'pending_review'
  const within = (searchParams.get('within') as PAQueueSubmittedWithin) || '7d'
  const country = searchParams.get('country') || ''
  const segment = searchParams.get('segment') || ''
  const delta = searchParams.get('delta') || ''
  const tier = searchParams.get('tier') || ''
  const q = searchParams.get('q') || ''
  const page = Math.max(1, Number(searchParams.get('page') || 1))

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<PriceReportListResponse | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [dialog, setDialog] = useState<DialogKind>(null)
  const [busy, setBusy] = useState(false)
  const [incorporateWeight, setIncorporateWeight] = useState(100)
  const [signalWeight, setSignalWeight] = useState(50)
  const [undo, setUndo] = useState<{ reportId: string; label: string } | null>(null)

  const filterValues: PAQueueFilterValues = {
    status,
    submittedWithin: within,
    riskTier: 'any',
    search: q,
  }

  const patchParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams)
      for (const [key, value] of Object.entries(patch)) {
        if (!value) next.delete(key)
        else next.set(key, value)
      }
      if (!('page' in patch)) next.set('page', '1')
      setSearchParams(next)
      setSelectedIds([])
    },
    [searchParams, setSearchParams],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const raw = await api.getAdminAgentPriceReports({
        status,
        within,
        country: country || undefined,
        segment: segment || undefined,
        delta: delta || undefined,
        tier: tier || undefined,
        q: q || undefined,
        page,
        pageSize: 25,
        sort: 'delta_abs:desc',
      })
      const normalized = normalizeListPayload(raw)
      setPayload(normalized)
      setFocusedId(normalized.reports[0]?.id ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load reports. Try again.")
      setPayload(null)
    } finally {
      setLoading(false)
    }
  }, [status, within, country, segment, delta, tier, q, page])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!undo) return
    const timer = window.setTimeout(() => setUndo(null), 5000)
    return () => window.clearTimeout(timer)
  }, [undo])

  const rows = useMemo(
    () =>
      (payload?.reports || []).map((r) => ({
        ...r,
        isOwn: Boolean(r.is_own),
      })),
    [payload],
  )

  const selectedRows = rows.filter((r) => selectedIds.includes(r.id))
  const segmentCount = new Set(selectedRows.map((r) => r.subject?.segment_id).filter(Boolean)).size
  const highRiskCount = selectedRows.filter((r) => r.composite_risk_tier === 'high').length

  const openDetail = (report: PriceReportListItem) => {
    const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search}`)
    navigate(`/admin/valuation/price-reports/${report.id}?return_to=${returnTo}`)
  }

  const runReview = async (
    report: PriceReportListItem,
    body: PriceReportReviewBody,
    toastLabel: string,
  ) => {
    setBusy(true)
    try {
      const result = (await api.reviewAdminAgentPriceReport(
        report.id,
        body as unknown as Record<string, unknown>,
      )) as PriceReportReviewResult
      if (result.pending_second_approval) {
        addToast({
          variant: 'warning',
          title: 'Incorporation request created. Awaiting second approver.',
        })
      } else {
        addToast({ variant: 'success', title: toastLabel })
        setUndo({ reportId: report.id, label: toastLabel })
      }
      await load()
    } catch (err) {
      const code = (err as { code?: string })?.code
      if (code === 'OWN_REPORT') {
        addToast({ variant: 'warning', title: "You can't act on this row — you are the submitting agent." })
      } else {
        addToast({
          variant: 'error',
          title: err instanceof Error ? err.message : 'Review failed',
        })
      }
    } finally {
      setBusy(false)
      setDialog(null)
    }
  }

  const runBulk = async (body: Omit<PriceReportReviewBody, 'incorporate'> & { incorporate?: false }) => {
    setBusy(true)
    try {
      await api.bulkReviewAdminAgentPriceReports({
        ids: selectedIds,
        ...body,
        incorporate: false,
      })
      addToast({
        variant: 'success',
        title:
          body.status === 'verified'
            ? `Published ${selectedIds.length} reports as signal-only.`
            : body.status === 'rejected'
              ? `Rejected ${selectedIds.length} reports.`
              : `Requested info on ${selectedIds.length} reports.`,
      })
      setSelectedIds([])
      await load()
    } catch (err) {
      addToast({
        variant: 'error',
        title: err instanceof Error ? err.message : 'Bulk review failed',
      })
    } finally {
      setBusy(false)
      setDialog(null)
    }
  }

  const handleUndo = async () => {
    if (!undo) return
    try {
      await api.undoAdminAgentPriceReportReview(undo.reportId)
      addToast({ variant: 'success', title: 'Review undone.' })
      setUndo(null)
      await load()
    } catch (err) {
      addToast({
        variant: 'error',
        title: err instanceof Error ? err.message : 'Undo failed',
      })
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return
      }
      if (e.key === '?') {
        e.preventDefault()
        setShortcutsOpen(true)
        return
      }
      if (e.key === 'Escape') {
        setDialog(null)
        setSelectedIds([])
        setShortcutsOpen(false)
        return
      }
      if (e.key === '.') {
        e.preventDefault()
        void load()
        return
      }
      if (!rows.length) return
      const idx = Math.max(0, rows.findIndex((r) => r.id === focusedId))
      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault()
        setFocusedId(rows[Math.min(rows.length - 1, idx + 1)]?.id ?? null)
        return
      }
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault()
        setFocusedId(rows[Math.max(0, idx - 1)]?.id ?? null)
        return
      }
      const focused = rows.find((r) => r.id === focusedId) || rows[0]
      if (!focused) return
      if (e.key === 'Enter') {
        e.preventDefault()
        openDetail(focused)
        return
      }
      if (e.key === 'x' || e.key === 'X') {
        e.preventDefault()
        setSelectedIds((prev) =>
          prev.includes(focused.id) ? prev.filter((id) => id !== focused.id) : [...prev, focused.id],
        )
        return
      }
      if (e.key === 'A' && e.shiftKey) {
        e.preventDefault()
        setSelectedIds(rows.map((r) => r.id))
        return
      }
      if ((e.key === 'a' || e.key === 'A') && !e.shiftKey) {
        e.preventDefault()
        if (selectedIds.length > 1) {
          addToast({
            variant: 'warning',
            title: 'Incorporate must be reviewed one report at a time.',
          })
          return
        }
        if (focused.status === 'pending_review' && !focused.is_own) {
          setIncorporateWeight(100)
          setDialog({ type: 'incorporate', report: focused })
        }
        return
      }
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        if (focused.status === 'pending_review' && !focused.is_own) {
          setSignalWeight(50)
          setDialog({ type: 'signal', report: focused })
        }
        return
      }
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        if (focused.status === 'pending_review' && !focused.is_own) {
          setDialog({ type: 'reject', report: focused })
        }
        return
      }
      if (e.key === 'i' || e.key === 'I') {
        e.preventDefault()
        if (focused.status === 'pending_review' && !focused.is_own) {
          setDialog({ type: 'request_info', report: focused })
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rows, focusedId, selectedIds.length, load, addToast, navigate])

  const columns: PAQueueColumn<PriceReportListItem & { isOwn?: boolean }>[] = [
    {
      id: 'submitted',
      header: 'Submitted',
      cell: (row) => (
        <Numeric as="span" className="text-[var(--lc-text-muted)]">
          {formatRelativeTime(row.submitted_at)}
        </Numeric>
      ),
    },
    {
      id: 'agent',
      header: 'Agent · Tier · Tenure',
      cell: (row) => (
        <div className="flex min-w-[12rem] flex-col gap-1">
          <PIIMask
            kind="name"
            value={row.agent?.display_name || 'Agent'}
            auditContext={{ caseId: row.id, field: 'agent_display_name' }}
            revealDurationMs={30_000}
          />
          <span className="text-xs text-[var(--lc-text-muted)]">{row.agency?.name || '—'}</span>
          <div className="flex flex-wrap items-center gap-1">
            <AgentTierChip tier={row.agent?.tier || 'pro'} />
            <Numeric as="span" className="text-xs text-[var(--lc-text-muted)]">
              {formatTenure(row.agent?.tenure_days)}
            </Numeric>
          </div>
        </div>
      ),
    },
    {
      id: 'subject',
      header: 'Subject · Segment',
      cell: (row) => (
        <div className="flex min-w-[12rem] flex-col gap-0.5">
          <span className="font-medium text-[var(--lc-text-heading)]">
            {row.subject?.segment_label || '—'}
          </span>
          <span className="text-xs text-[var(--lc-text-muted)]">
            <Numeric as="span">{row.subject?.comparable_listings_count ?? 0}</Numeric> comparable
            listings · {row.subject?.country_flag_emoji || ''} {row.subject?.country_code || ''}
          </span>
        </div>
      ),
    },
    {
      id: 'recommendation',
      header: 'Recommendation · Δ benchmark',
      cell: (row) => (
        <div className="flex flex-col gap-1">
          <Numeric as="span" className="font-medium">
            {formatMoney(row.recommendation?.price_point, row.recommendation?.currency || 'AED')}
          </Numeric>
          {row.benchmark_delta ? <PriceReportDeltaChip delta={row.benchmark_delta} /> : null}
        </div>
      ),
    },
    {
      id: 'sources',
      header: 'Sources',
      cell: (row) => (
        <span className="text-sm text-[var(--lc-text-secondary)]">
          <Numeric as="span">{row.sources?.comparable_count ?? 0}</Numeric> comps ·{' '}
          <Numeric as="span">{row.sources?.evidence_file_count ?? 0}</Numeric> files
        </span>
      ),
    },
    {
      id: 'risk',
      header: 'Composite risk',
      cell: (row) => (
        <PriceReportCompositeRiskCell
          tenureTier={row.tenure_risk?.tier || 'unknown'}
          deltaTier={row.benchmark_delta?.delta_tier || 'unknown'}
          compositeTier={row.composite_risk_tier || 'unknown'}
        />
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <PriceReportStatusBadge status={row.status} />,
    },
    {
      id: 'actions',
      header: 'Actions',
      srOnlyHeader: true,
      cell: (row) => {
        const pending = row.status === 'pending_review'
        const blocked = Boolean(row.is_own)
        return (
          <div
            className="flex flex-wrap gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {pending ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={blocked || busy}
                  className="border-[var(--lc-action-primary)] text-[var(--lc-action-primary)]"
                  title={blocked ? "You can't act on this row — you are the submitting agent." : undefined}
                  onClick={() => {
                    setIncorporateWeight(100)
                    setDialog({ type: 'incorporate', report: row })
                  }}
                >
                  Incorporate
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={blocked || busy}
                  onClick={() => {
                    setSignalWeight(50)
                    setDialog({ type: 'signal', report: row })
                  }}
                >
                  Signal only
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={blocked || busy}
                  onClick={() => setDialog({ type: 'reject', report: row })}
                >
                  Reject
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={blocked || busy}
                  className="border-[var(--lc-status-warning-fg)] text-[var(--lc-status-warning-fg)]"
                  onClick={() => setDialog({ type: 'request_info', report: row })}
                >
                  Request info
                </Button>
              </>
            ) : null}
            <Button type="button" size="sm" variant="outline" onClick={() => openDetail(row)}>
              Open
            </Button>
          </div>
        )
      },
    },
  ]

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <h1 className="text-[length:var(--lc-type-heading-1)] text-[var(--lc-text-heading)]">
          Agent-price-report review
        </h1>
        <p className="mt-2 text-[var(--lc-text-muted)]">
          You need price-report review access to view this page.
        </p>
      </div>
    )
  }

  const counts = payload?.counts

  return (
    <div className="min-h-screen bg-[var(--lc-bg-page)] text-[var(--lc-text-primary)]">
      <div
        role="status"
        className="border-b border-[var(--lc-border)] bg-[var(--lc-status-warning-bg)] px-4 py-2 text-center text-sm text-[var(--lc-status-warning-fg)] lg:hidden"
      >
        PA console requires a desktop screen (1024px or wider).
      </div>
      <div className="mx-auto max-w-[1440px] px-[var(--lc-space-xl)] py-[var(--lc-space-xl)]">
        <header className="mb-[var(--lc-space-lg)] flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1
              className="text-[var(--lc-text-heading)]"
              style={{ font: 'var(--lc-type-heading-1)' }}
            >
              Agent-price-report review
            </h1>
            <p className="mt-1 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
              <Numeric>{counts?.pending ?? 0}</Numeric> pending ·{' '}
              <Numeric>{counts?.pending_high_delta ?? 0}</Numeric> high-delta (≥10%) ·{' '}
              <Numeric>{counts?.incorporated_this_month ?? 0}</Numeric> incorporated ·{' '}
              <Numeric>{counts?.signal_only_this_month ?? 0}</Numeric> signal-only ·{' '}
              <Numeric>{counts?.rejected_this_month ?? 0}</Numeric> rejected this month
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
              <RefreshCw className="me-1 h-4 w-4" aria-hidden />
              Refresh
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void api.exportAdminAgentPriceReportsCsv({
                  status,
                  within,
                  country: country || undefined,
                  segment: segment || undefined,
                  delta: delta || undefined,
                  tier: tier || undefined,
                  q: q || undefined,
                })
              }}
            >
              <Download className="me-1 h-4 w-4" aria-hidden />
              Export CSV
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Keyboard shortcuts"
              onClick={() => setShortcutsOpen(true)}
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <PAQueueFilterStrip
          statusOptions={[
            { value: 'pending_review', label: 'Pending review', count: counts?.pending },
            { value: 'verified', label: 'Verified' },
            { value: 'incorporated', label: 'Incorporated', count: counts?.incorporated_this_month },
            { value: 'rejected', label: 'Rejected', count: counts?.rejected_this_month },
            { value: 'request_info', label: 'Request info' },
            { value: 'expired', label: 'Expired' },
          ]}
          values={filterValues}
          onChange={(next) => {
            patchParams({
              status: next.status,
              within: next.submittedWithin,
              q: next.search || null,
            })
          }}
          customFilters={
            <>
              <div className="flex min-w-[8rem] flex-col gap-1">
                <Label htmlFor="price-report-country">Country</Label>
                <select
                  id="price-report-country"
                  value={country}
                  className={cn(
                    'min-h-tap rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)]',
                    'bg-[var(--lc-surface)] px-3 text-sm',
                  )}
                  onChange={(e) => patchParams({ country: e.target.value || null })}
                >
                  <option value="">Any</option>
                  <option value="AE">AE</option>
                  <option value="SA">SA</option>
                  <option value="EG">EG</option>
                  <option value="LB">LB</option>
                  <option value="OM">OM</option>
                </select>
              </div>
              <div className="flex min-w-[10rem] flex-col gap-1">
                <Label htmlFor="price-report-segment">Market segment</Label>
                <input
                  id="price-report-segment"
                  value={segment}
                  placeholder="Any segment"
                  className={cn(
                    'min-h-tap rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)]',
                    'bg-[var(--lc-surface)] px-3 text-sm',
                  )}
                  onChange={(e) => patchParams({ segment: e.target.value || null })}
                />
              </div>
              <div className="flex min-w-[10rem] flex-col gap-1">
                <Label htmlFor="price-report-delta">Recommendation delta</Label>
                <select
                  id="price-report-delta"
                  value={delta}
                  className={cn(
                    'min-h-tap rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)]',
                    'bg-[var(--lc-surface)] px-3 text-sm',
                  )}
                  onChange={(e) => patchParams({ delta: e.target.value || null })}
                >
                  <option value="">Any</option>
                  <option value="in_band">In band (±5%)</option>
                  <option value="above_5">Above 5-10%</option>
                  <option value="above_10">Above 10%+</option>
                  <option value="below_5">Below 5-10%</option>
                  <option value="below_10">Below 10%+</option>
                </select>
              </div>
              <div className="flex min-w-[8rem] flex-col gap-1">
                <Label htmlFor="price-report-tier">Agent tier</Label>
                <select
                  id="price-report-tier"
                  value={tier}
                  className={cn(
                    'min-h-tap rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)]',
                    'bg-[var(--lc-surface)] px-3 text-sm',
                  )}
                  onChange={(e) => patchParams({ tier: e.target.value || null })}
                >
                  <option value="">Any</option>
                  <option value="pro">Pro</option>
                  <option value="pro_elite">Pro Elite</option>
                </select>
              </div>
            </>
          }
        />

        {selectedIds.length > 0 ? (
          <div
            role="status"
            aria-live="polite"
            className="mt-[var(--lc-space-md)] flex flex-wrap items-center justify-between gap-[var(--lc-space-sm)] rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)]"
            data-testid="price-report-bulk-bar"
          >
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span>
                <Numeric>{selectedIds.length}</Numeric> selected
              </span>
              <Button type="button" variant="link" size="sm" onClick={() => setSelectedIds([])}>
                Clear selection
              </Button>
              <span className="text-[var(--lc-text-muted)]">
                <Numeric>{selectedIds.length}</Numeric> across <Numeric>{segmentCount}</Numeric>{' '}
                segments · <Numeric>{highRiskCount}</Numeric> High-risk composite
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Why can't I bulk-incorporate?"
                title="Incorporate must be reviewed one report at a time — it writes to the pricing benchmark."
              >
                <Info className="h-4 w-4 text-[var(--lc-text-muted)]" />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => setDialog({ type: 'bulk_signal' })}
              >
                Signal only <Numeric className="ms-1">{selectedIds.length}</Numeric>
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setDialog({ type: 'bulk_reject' })}
              >
                Reject <Numeric className="ms-1">{selectedIds.length}</Numeric>
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setDialog({ type: 'bulk_request_info' })}
              >
                Request info <Numeric className="ms-1">{selectedIds.length}</Numeric>
              </Button>
            </div>
          </div>
        ) : null}

        {undo ? (
          <div
            role="status"
            className="mt-[var(--lc-space-sm)] flex items-center justify-between rounded-[var(--lc-radius-md)] border border-[var(--lc-accent-bold-edge)] bg-[var(--lc-surface-raised)] px-3 py-2 text-sm"
          >
            <span>{undo.label}</span>
            <Button type="button" variant="link" size="sm" onClick={() => void handleUndo()}>
              Undo
            </Button>
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="mt-[var(--lc-space-md)] rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-status-unpublished-bg)] px-4 py-3 text-[var(--lc-status-unpublished-fg)]"
          >
            Couldn&apos;t load reports. Try again.{' '}
            <Button type="button" variant="link" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : null}

        <div className="mt-[var(--lc-space-md)] [&_tr]:group">
          <PAQueueTable
            aria-label="Agent price-report review queue"
            columns={columns}
            rows={rows}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            selectable
            focusedId={focusedId}
            onRowClick={openDetail}
            loading={loading}
            emptyState={
              status === 'pending_review' ? (
                <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-4">
                  <div
                    className="h-[200px] w-full rounded-[var(--lc-radius-lg)] border border-dashed border-[var(--lc-border-strong)] bg-[var(--lc-surface-sunken)]"
                    aria-hidden
                  />
                  <p className="font-medium text-[var(--lc-text-heading)]">
                    No agent price reports awaiting review
                  </p>
                  <p className="text-sm text-[var(--lc-text-muted)]">
                    Pro-tier agents can submit market-segment price analyses from their listing
                    detail. Reports land here when submitted.
                  </p>
                  <Link
                    to="/admin/pricing"
                    className="text-sm text-[var(--lc-text-brand)] underline-offset-2 hover:underline"
                  >
                    Review Pro-tier submission gating →
                  </Link>
                </div>
              ) : (
                <div>
                  <p className="font-medium">No {status.replace('_', ' ')} reports in this range</p>
                  <p className="text-sm text-[var(--lc-text-muted)]">
                    Try widening the &apos;Submitted within&apos; filter.
                  </p>
                </div>
              )
            }
          />
        </div>

        {payload?.pagination ? (
          <footer className="mt-[var(--lc-space-md)] flex items-center justify-between text-sm text-[var(--lc-text-muted)]">
            <span>
              <Numeric>
                {payload.pagination.total === 0
                  ? 0
                  : (payload.pagination.page - 1) * payload.pagination.page_size + 1}
              </Numeric>
              –
              <Numeric>
                {Math.min(
                  payload.pagination.page * payload.pagination.page_size,
                  payload.pagination.total,
                )}
              </Numeric>{' '}
              of <Numeric>{payload.pagination.total}</Numeric>
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => patchParams({ page: String(page - 1) })}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!payload.pagination.has_next}
                onClick={() => patchParams({ page: String(page + 1) })}
              >
                Next
              </Button>
            </div>
          </footer>
        ) : null}
      </div>

      <PAQueueKeyboardShortcutsPanel
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
        shortcuts={WF06_SHORTCUTS}
      />

      {dialog?.type === 'incorporate' ? (
        <PriceReportIncorporateDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          segmentLabel={dialog.report.subject?.segment_label || 'this segment'}
          deltaPct={dialog.report.benchmark_delta?.delta_pct ?? 0}
          twoPersonRequired={Boolean(dialog.report.two_person_required)}
          weight={incorporateWeight}
          onWeightChange={setIncorporateWeight}
          confirmDisabled={busy}
          onConfirm={() =>
            void runReview(
              dialog.report,
              {
                status: 'verified',
                incorporate: true,
                weight: incorporateWeight,
              },
              `Incorporated ${dialog.report.subject?.segment_label || 'report'} by ${dialog.report.agent?.display_name || 'agent'}. Benchmark refresh queued.`,
            )
          }
        />
      ) : null}

      {dialog?.type === 'signal' ? (
        <PriceReportSignalOnlyDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          weight={signalWeight}
          onWeightChange={setSignalWeight}
          confirmDisabled={busy}
          onConfirm={() =>
            void runReview(
              dialog.report,
              {
                status: 'verified',
                incorporate: false,
                weight: signalWeight,
              },
              `Published ${dialog.report.subject?.segment_label || 'report'} by ${dialog.report.agent?.display_name || 'agent'} as signal-only.`,
            )
          }
        />
      ) : null}

      {dialog?.type === 'reject' || dialog?.type === 'request_info' ? (
        <PriceReportReasonDialog
          open
          mode={dialog.type}
          onOpenChange={(open) => !open && setDialog(null)}
          confirmDisabled={busy}
          onConfirm={({ reasonCode, notes }) =>
            void runReview(
              dialog.report,
              {
                status: dialog.type === 'reject' ? 'rejected' : 'request_info',
                reason_code: reasonCode,
                notes,
              },
              dialog.type === 'reject'
                ? `Rejected ${dialog.report.subject?.segment_label || 'report'} — ${reasonCode}.`
                : `Requested info on ${dialog.report.subject?.segment_label || 'report'}.`,
            )
          }
        />
      ) : null}

      {dialog?.type === 'bulk_signal' ? (
        <PriceReportSignalOnlyDialog
          open
          bulk
          count={selectedIds.length}
          weight={50}
          onOpenChange={(open) => !open && setDialog(null)}
          confirmDisabled={busy}
          onConfirm={() => void runBulk({ status: 'verified' })}
        />
      ) : null}

      {dialog?.type === 'bulk_reject' ? (
        <PAQueueBulkReasonDialog
          open
          mode="reject"
          count={selectedIds.length}
          entityLabel="reports"
          reasonOptions={[...REJECT_REASON_OPTIONS]}
          onOpenChange={(open) => !open && setDialog(null)}
          onConfirm={({ reasonCode, notes }) =>
            void runBulk({ status: 'rejected', reason_code: reasonCode, notes })
          }
        />
      ) : null}

      {dialog?.type === 'bulk_request_info' ? (
        <PAQueueBulkReasonDialog
          open
          mode="request_info"
          count={selectedIds.length}
          entityLabel="reports"
          reasonOptions={[...REQUEST_INFO_REASON_OPTIONS]}
          onOpenChange={(open) => !open && setDialog(null)}
          onConfirm={({ reasonCode, notes }) =>
            void runBulk({ status: 'request_info', reason_code: reasonCode, notes })
          }
        />
      ) : null}
    </div>
  )
}
