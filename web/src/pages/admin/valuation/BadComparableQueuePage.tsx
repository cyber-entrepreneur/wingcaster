/**
 * PA-PVA-008 — Bad-comparable-report queue (WF-05 approver-side).
 *
 * PA-queue-family with deliberate WF-05 deviations (documented):
 * 1. Bulk confirm-remove / confirm-quarantine OMITTED — removal re-runs valuations
 *    market-wide. `<PAQueueBulkBar actions={['reject','request_info']}>` filters them out.
 * 2. No inline row Approve/Reject — all 4 decision affordances live on detail only.
 * 3. Two-person rule keyed by market-impact tier (not tenure risk) — surfaced via chip.
 * 4. Reporter-pattern amber dot — informational, not a policy gate.
 * 5. `<PIIMask>` on reporter identifiers.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Globe, Paperclip } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useEnv } from '@/hooks/useEnv'
import { EnvBadge } from '@/components/nav/EnvBadge'
import {
  PAQueueBulkBar,
  PAQueueBulkReasonDialog,
  PAQueueFilterStrip,
  PAQueueTable,
  type PAQueueColumn,
  type PAQueueFilterValues,
  type PAQueueSubmittedWithin,
} from '@/components/queue'
import { PIIMask } from '@/components/security'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { comparableReportsApi } from './api'
import {
  QUEUE_COPY,
  REASON_CATEGORY_OPTIONS,
  SEVERITY_OPTIONS,
  IMPACT_OPTIONS,
  REJECT_REASON_VOCAB,
  REQUEST_INFO_REASON_VOCAB,
} from './copy'
import { MarketImpactChip } from './MarketImpactChip'
import { ReporterPatternDot } from './ReporterPatternDot'
import {
  ReasonCategoryBadge,
  SeverityBadge,
  ReportStatusBadge,
  formatRelativeSubmitted,
  formatSlaChip,
  slaToneClass,
  initials,
} from './badges'
import type { ComparableReportCounts, ComparableReportListItem } from './types'

/** WF-05 bulk actions — confirm-remove / quarantine intentionally excluded. */
export const WF05_BULK_ACTIONS = ['reject', 'request_info'] as const

const selectClassName = cn(
  'min-h-tap rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)]',
  'bg-[var(--lc-surface)] px-3 text-sm text-[var(--lc-text-primary)]',
  'focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
)

type BulkDialogMode = 'reject' | 'request_info' | null

function buildSubtitle(counts: ComparableReportCounts | null): string {
  if (!counts) return 'Loading…'
  return QUEUE_COPY.subtitleTemplate
    .replace('{N}', String(counts.pending ?? 0))
    .replace('{K}', String(counts.pending_at_risk ?? 0))
    .replace('{T}', '—')
    .replace('{H}', String(counts.high_impact_awaiting_two_person ?? 0))
    .replace('{M}', String(counts.confirmed_removed_this_week ?? 0))
    .replace('{J}', String(counts.rejected_this_week ?? 0))
}

export function BadComparableQueuePage() {
  const { isAdmin } = useAuth()
  const { env } = useEnv()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const status = searchParams.get('status') || 'pending'
  const category = (searchParams.get('category') || 'any') as string
  const severity = (searchParams.get('severity') || 'any') as string
  const impact = (searchParams.get('impact') || 'any') as string
  const within = (searchParams.get('within') || '7d') as PAQueueSubmittedWithin
  const q = searchParams.get('q') || ''
  const page = Number(searchParams.get('page') || '1') || 1

  const [rows, setRows] = useState<ComparableReportListItem[]>([])
  const [counts, setCounts] = useState<ComparableReportCounts | null>(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkMode, setBulkMode] = useState<BulkDialogMode>(null)
  const [searchDraft, setSearchDraft] = useState(q)

  const patchParams = useCallback(
    (partial: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams)
      for (const [k, v] of Object.entries(partial)) {
        if (v === null || v === '' || v === 'any') next.delete(k)
        else next.set(k, v)
      }
      if (!partial.page) next.set('page', '1')
      setSearchParams(next)
      setSelectedIds([])
    },
    [searchParams, setSearchParams],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await comparableReportsApi.list({
        status,
        category: category === 'any' ? undefined : category,
        severity: severity === 'any' ? undefined : severity,
        impact: impact === 'any' ? undefined : impact,
        within,
        q: q || undefined,
        page,
        pageSize: 25,
        sort: 'market_impact:desc,sla_remaining:asc,submitted_at:asc',
      })
      setRows(res.reports ?? [])
      setCounts(res.counts ?? null)
      setTotal(res.pagination?.total ?? res.reports?.length ?? 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : QUEUE_COPY.loadError)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [status, category, severity, impact, within, q, page, env])

  useEffect(() => {
    if (!isAdmin) return
    void load()
  }, [isAdmin, load])

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (searchDraft !== q) patchParams({ q: searchDraft || null })
    }, 300)
    return () => window.clearTimeout(t)
  }, [searchDraft, q, patchParams])

  const filterValues: PAQueueFilterValues = {
    status,
    submittedWithin: within,
    riskTier: 'any',
    search: searchDraft,
  }

  const statusOptions = useMemo(
    () =>
      (Object.keys(QUEUE_COPY.statusTabs) as Array<keyof typeof QUEUE_COPY.statusTabs>).map(
        (value) => ({
          value,
          label: QUEUE_COPY.statusTabs[value],
          count:
            value === 'pending'
              ? counts?.pending
              : value === 'confirmed_removed'
                ? counts?.confirmed_removed_this_week
                : value === 'confirmed_quarantined'
                  ? counts?.confirmed_quarantined_this_week
                  : value === 'rejected'
                    ? counts?.rejected_this_week
                    : value === 'awaiting_info'
                      ? counts?.awaiting_info_this_week
                      : counts?.expired_this_week,
        }),
      ),
    [counts],
  )

  const selectedRows = rows.filter((r) => selectedIds.includes(r.id))
  const highRiskCount = selectedRows.filter(
    (r) =>
      r.severity === 'high' ||
      r.severity === 'critical' ||
      r.market_impact?.tier === 'high',
  ).length
  const acrossCategories = new Set(selectedRows.map((r) => r.reason_category)).size

  const openDetail = (row: ComparableReportListItem) => {
    const returnTo = encodeURIComponent(
      `/admin/valuation/comparable-reports?${searchParams.toString()}`,
    )
    navigate(`/admin/valuation/comparable-reports/${row.id}?return_to=${returnTo}`)
  }

  const columns: PAQueueColumn<ComparableReportListItem>[] = [
    {
      id: 'submitted',
      header: QUEUE_COPY.columns.submitted,
      cell: (row) => {
        const sla = formatSlaChip(row.sla_hours_remaining)
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-[var(--lc-text-primary)]">
              {formatRelativeSubmitted(row.created_at)}
            </span>
            <span className={cn('text-xs', slaToneClass(sla.tone))}>{sla.label}</span>
          </div>
        )
      },
    },
    {
      id: 'reporter',
      header: QUEUE_COPY.columns.reporter,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            {row.reporter.avatar_url ? (
              <AvatarImage src={row.reporter.avatar_url} alt="" />
            ) : null}
            <AvatarFallback>{initials(row.reporter.display_name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <PIIMask
                value={row.reporter.display_name}
                kind="name"
                auditContext={{ caseId: row.id, field: 'reporter_name' }}
                className="text-sm text-[var(--lc-text-primary)]"
              />
              <ReporterPatternDot
                patternFlag={row.reporter.pattern_flag}
                signals={row.reporter.pattern_signals}
                agencyName={row.comparable.owning_agency?.name}
              />
            </div>
            <p className="truncate text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
              {row.reporter.agency?.name}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'comparable',
      header: QUEUE_COPY.columns.comparable,
      cell: (row) => {
        const external = row.comparable.source === 'external_scrape'
        return (
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[var(--lc-radius-sm)]',
                external
                  ? 'border border-dashed border-[var(--lc-border-strong)]'
                  : 'bg-[var(--lc-surface-sunken)]',
              )}
              title={
                row.comparable.owning_agency?.name
                  ? `Owned by ${row.comparable.owning_agency.name}`
                  : undefined
              }
            >
              {row.comparable.thumb_url && !external ? (
                <img
                  src={row.comparable.thumb_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <Globe className="h-4 w-4 text-[var(--lc-text-muted)]" aria-hidden />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm text-[var(--lc-text-primary)]">
                {row.comparable.title}
              </p>
              <p className="truncate text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
                {row.comparable.address_line}
              </p>
              <span
                className={cn(
                  'mt-0.5 inline-flex rounded-[var(--lc-radius-sm)] px-1.5 py-px text-[length:var(--lc-type-caption)]',
                  external
                    ? 'bg-[var(--lc-surface-sunken)] text-[var(--lc-text-muted)]'
                    : 'bg-[var(--lc-accent-bold)] text-[var(--lc-accent-bold-text)]',
                )}
              >
                {external
                  ? `${row.comparable.source_display} · external`
                  : QUEUE_COPY.sourceAgencyOwned}
              </span>
            </div>
          </div>
        )
      },
    },
    {
      id: 'category',
      header: QUEUE_COPY.columns.category,
      cell: (row) => <ReasonCategoryBadge category={row.reason_category} />,
    },
    {
      id: 'severity',
      header: QUEUE_COPY.columns.severity,
      cell: (row) => <SeverityBadge severity={row.severity} />,
    },
    {
      id: 'impact',
      header: QUEUE_COPY.columns.impact,
      cell: (row) => <MarketImpactChip impact={row.market_impact} />,
    },
    {
      id: 'evidence',
      header: QUEUE_COPY.columns.evidence,
      cell: (row) => {
        const n = row.evidence?.file_count ?? 0
        return (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-xs',
              n === 0
                ? 'bg-[var(--lc-status-warning-bg)] text-[var(--lc-status-warning-fg)]'
                : 'bg-[var(--lc-surface-sunken)] text-[var(--lc-text-primary)]',
            )}
            title={row.evidence?.files?.map((f) => f.filename).join(', ') || undefined}
          >
            <Paperclip className="h-3 w-3" aria-hidden />
            <Numeric>{n}</Numeric> files
            {n === 0 ? <span aria-hidden> ⚠</span> : null}
          </span>
        )
      },
    },
    {
      id: 'status',
      header: QUEUE_COPY.columns.status,
      cell: (row) => <ReportStatusBadge status={row.status} />,
    },
    {
      id: 'actions',
      header: <span className="sr-only">{QUEUE_COPY.columns.actions}</span>,
      srOnlyHeader: true,
      cell: (row) => (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation()
            openDetail(row)
          }}
        >
          {QUEUE_COPY.rowOpen}
        </Button>
      ),
    },
  ]

  if (!isAdmin) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>{QUEUE_COPY.gateTitle}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-[var(--lc-text-muted)]">
            {QUEUE_COPY.gateBody}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--lc-bg-page)] text-[var(--lc-text-primary)]">
      {env === 'test' ? (
        <div
          role="status"
          className="w-full bg-[var(--lc-status-warning-bg)] px-4 py-2 text-center text-sm text-[var(--lc-status-warning-fg)]"
        >
          {QUEUE_COPY.testEnvStrip}
        </div>
      ) : null}

      <div className="mx-auto max-w-[1440px] px-4 py-6">
        <header className="mb-4">
          <h1
            className="text-[var(--lc-text-heading)]"
            style={{ font: 'var(--lc-type-heading-1)' }}
          >
            {QUEUE_COPY.pageTitle}
          </h1>
          <p className="mt-1 text-sm text-[var(--lc-text-muted)]">{buildSubtitle(counts)}</p>
        </header>

        <PAQueueFilterStrip
          envBadge={<EnvBadge env={env} />}
          statusOptions={statusOptions}
          values={filterValues}
          onChange={(next) => {
            setSearchDraft(next.search)
            patchParams({
              status: next.status,
              within: next.submittedWithin,
              q: next.search || null,
            })
          }}
          customFilters={
            <>
              <div className="flex min-w-[9rem] flex-col gap-1">
                <Label htmlFor="wf05-category">{QUEUE_COPY.filter.categoryLabel}</Label>
                <select
                  id="wf05-category"
                  className={selectClassName}
                  value={category}
                  onChange={(e) => patchParams({ category: e.target.value })}
                >
                  <option value="any">{QUEUE_COPY.filter.categoryAny}</option>
                  {REASON_CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex min-w-[8rem] flex-col gap-1">
                <Label htmlFor="wf05-severity">{QUEUE_COPY.filter.severityLabel}</Label>
                <select
                  id="wf05-severity"
                  className={selectClassName}
                  value={severity}
                  onChange={(e) => patchParams({ severity: e.target.value })}
                >
                  <option value="any">{QUEUE_COPY.filter.severityAny}</option>
                  {SEVERITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex min-w-[8rem] flex-col gap-1">
                <Label htmlFor="wf05-impact">{QUEUE_COPY.filter.impactLabel}</Label>
                <select
                  id="wf05-impact"
                  className={selectClassName}
                  value={impact}
                  onChange={(e) => patchParams({ impact: e.target.value })}
                >
                  <option value="any">{QUEUE_COPY.filter.impactAny}</option>
                  {IMPACT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          }
          disabled={loading}
          aria-label="Filter bad-comparable reports"
        />

        {/*
          WF-05 bulk-safety: confirm-remove / confirm-quarantine are DELIBERATELY OMITTED.
          Removal re-runs valuations across the market — a wrong bulk confirm during a
          launch wave could invalidate thousands of valuations. Bulk is scoped to
          reject-as-invalid + request-info ONLY. Confirm decisions live on PA-PVA-008b.
        */}
        <div className="my-3">
          <PAQueueBulkBar
            showBulk
            actions={[...WF05_BULK_ACTIONS]}
            selectedCount={selectedIds.length}
            acrossCount={acrossCategories}
            highRiskCount={highRiskCount}
            onClearSelection={() => setSelectedIds([])}
            onReject={() => setBulkMode('reject')}
            onRequestInfo={() => setBulkMode('request_info')}
            rejectLabel={QUEUE_COPY.bulk.rejectAsInvalid}
            requestInfoLabel={QUEUE_COPY.bulk.requestMoreInfo}
            stepUpNotice={QUEUE_COPY.bulk.stepUpNotice}
            selectedLabel={QUEUE_COPY.bulk.selectedLabel}
          />
        </div>

        {error ? (
          <div
            role="alert"
            className="mb-3 flex items-center justify-between rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-status-danger-bg)] px-4 py-3 text-[var(--lc-status-danger-fg)]"
          >
            <span>{error}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
              {QUEUE_COPY.retry}
            </Button>
          </div>
        ) : null}

        <PAQueueTable<ComparableReportListItem>
          columns={columns}
          rows={rows.map((r) => ({ ...r, isOwn: r.is_own }))}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          selectable
          loading={loading}
          onRowClick={openDetail}
          aria-label="Bad-comparable-report queue"
          emptyState={
            <div className="flex flex-col items-center gap-2 py-4">
              <p className="font-semibold text-[var(--lc-text-primary)]">
                {QUEUE_COPY.emptyPendingTitle}
              </p>
              <p className="max-w-md text-sm text-[var(--lc-text-muted)]">
                {QUEUE_COPY.emptyPendingBody}
              </p>
              <Link
                to="/admin/pricing"
                className="text-sm text-[var(--lc-text-brand)] underline-offset-2 hover:underline"
              >
                {QUEUE_COPY.emptyPendingCta}
              </Link>
            </div>
          }
        />

        <div className="mt-4 flex items-center justify-between text-sm text-[var(--lc-text-muted)]">
          <span>
            <Numeric>{Math.min((page - 1) * 25 + 1, total)}</Numeric>–
            <Numeric>{Math.min(page * 25, total)}</Numeric> of <Numeric>{total}</Numeric>
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
              disabled={page * 25 >= total}
              onClick={() => patchParams({ page: String(page + 1) })}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      <PAQueueBulkReasonDialog
        open={bulkMode === 'reject'}
        onOpenChange={(open) => !open && setBulkMode(null)}
        mode="reject"
        count={selectedIds.length}
        entityLabel="reports"
        title={QUEUE_COPY.bulkReject.title.replace('{N}', String(selectedIds.length))}
        reasonOptions={[...REJECT_REASON_VOCAB]}
        onConfirm={async ({ reasonCode, notes }) => {
          try {
            await comparableReportsApi.bulkRejectAsInvalid({
              report_ids: selectedIds,
              reason_code: reasonCode,
              notes,
            })
            addToast({
              title: `Rejected ${selectedIds.length} reports`,
              variant: 'success',
            })
            setSelectedIds([])
            setBulkMode(null)
            void load()
          } catch (err) {
            addToast({
              title: err instanceof Error ? err.message : 'Bulk reject failed',
              variant: 'error',
            })
          }
        }}
      />

      <PAQueueBulkReasonDialog
        open={bulkMode === 'request_info'}
        onOpenChange={(open) => !open && setBulkMode(null)}
        mode="request_info"
        count={selectedIds.length}
        entityLabel="reports"
        title={QUEUE_COPY.bulkRequestInfo.title.replace('{N}', String(selectedIds.length))}
        reasonOptions={[...REQUEST_INFO_REASON_VOCAB]}
        onConfirm={async ({ reasonCode, notes }) => {
          try {
            await comparableReportsApi.bulkRequestInfo({
              report_ids: selectedIds,
              reason_code: reasonCode,
              notes,
            })
            addToast({
              title: `Requested info on ${selectedIds.length} reports`,
              variant: 'success',
            })
            setSelectedIds([])
            setBulkMode(null)
            void load()
          } catch (err) {
            addToast({
              title: err instanceof Error ? err.message : 'Bulk request-info failed',
              variant: 'error',
            })
          }
        }}
      />
    </div>
  )
}
