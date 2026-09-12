/**
 * PA-PVA-009b — Agent-price-report review detail (WF-06).
 *
 * incorporate:true → benchmark write (single-approver if |delta| < 10%, else
 * two-person via fin.approval_requests). Review is atomic/audited; Undo uses
 * POST .../undo-review when the API provides a grace window.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  ChevronLeft,
  ExternalLink,
  FileText,
  HelpCircle,
  Image as ImageIcon,
  MessageCircle,
  X,
} from 'lucide-react'
import { api } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Numeric } from '@/components/ui/numeric'
import { PIIMask } from '@/components/security/PIIMask'
import { TwoPersonProgress } from '@/components/security/TwoPersonProgress'
import { Timeline, type TimelineEntry } from '@/components/security/Timeline'
import { PAQueueKeyboardShortcutsPanel } from '@/components/queue'
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
  statusLabel,
} from './priceReportShared'
import type {
  BenchmarkSeriesResponse,
  PriceReportDetail,
  PriceReportReviewBody,
  PriceReportReviewResult,
} from './priceReportTypes'

function analysisText(analysis: PriceReportDetail['analysis']): string {
  if (!analysis?.body) return ''
  if (typeof analysis.body === 'string') return analysis.body
  if (typeof analysis.body === 'object' && analysis.body && 'text' in (analysis.body as object)) {
    return String((analysis.body as { text?: string }).text || '')
  }
  try {
    return JSON.stringify(analysis.body, null, 2)
  } catch {
    return ''
  }
}

function BenchmarkChart({
  series,
  recommendationPrice,
  currency,
  incorporated,
}: {
  series: BenchmarkSeriesResponse | null
  recommendationPrice?: number | null
  currency: string
  incorporated?: boolean
}) {
  const points = series?.points || []
  if (!points.length) {
    return (
      <div
        role="img"
        aria-label="Benchmark series not yet available for this segment"
        className="flex h-[240px] items-center justify-center rounded-[var(--lc-radius-lg)] border border-dashed border-[var(--lc-border-strong)] bg-[var(--lc-surface-sunken)] px-4 text-center text-sm text-[var(--lc-text-muted)]"
      >
        Benchmark series not yet available for this segment. Consider Signal only for the first
        incorporation.
      </div>
    )
  }

  const prices = points.flatMap((p) =>
    [p.price, p.confidence_low, p.confidence_high, recommendationPrice].filter(
      (n): n is number => typeof n === 'number' && Number.isFinite(n),
    ),
  )
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const pad = (max - min) * 0.08 || 1
  const yMin = min - pad
  const yMax = max + pad
  const w = 480
  const h = 240
  const left = 40
  const right = 12
  const top = 16
  const bottom = 28
  const plotW = w - left - right
  const plotH = h - top - bottom

  const xAt = (i: number) => left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW)
  const yAt = (price: number) => top + ((yMax - price) / (yMax - yMin)) * plotH

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(p.price)}`).join(' ')
  const bandTop = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(p.confidence_high ?? p.price)}`).join(' ')
  const bandBottom = [...points]
    .reverse()
    .map((p, i) => {
      const idx = points.length - 1 - i
      return `${i === 0 ? 'L' : 'L'} ${xAt(idx)} ${yAt(p.confidence_low ?? p.price)}`
    })
    .join(' ')
  const lastX = xAt(points.length - 1)
  const recY = recommendationPrice != null ? yAt(recommendationPrice) : null

  const aria = `Benchmark moved from ${currency} ${points[0].price} to ${currency} ${points[points.length - 1].price} over ${series?.window || '90d'}; agent's recommendation of ${currency} ${recommendationPrice ?? 'n/a'} sits relative to the confidence band.`

  return (
    <figure>
      <svg
        role="img"
        aria-label={aria}
        viewBox={`0 0 ${w} ${h}`}
        className="h-[240px] w-full"
        data-testid="benchmark-chart"
      >
        <path
          d={`${bandTop} ${bandBottom} Z`}
          fill="var(--lc-surface-sunken)"
          opacity={0.6}
          aria-hidden
        />
        <path d={line} fill="none" stroke="var(--lc-text-muted)" strokeWidth={2} />
        {incorporated && recY != null ? (
          <line
            x1={lastX}
            y1={recY}
            x2={w - right}
            y2={recY}
            stroke="var(--lc-action-primary)"
            strokeWidth={2}
            strokeDasharray="4 4"
            aria-hidden
          />
        ) : null}
        {recY != null ? (
          <circle
            cx={lastX}
            cy={recY}
            r={7}
            fill="var(--lc-action-primary)"
            stroke="var(--lc-focus-ring-contrast)"
            strokeWidth={2}
          />
        ) : null}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--lc-text-muted)]">
        <span>Benchmark (90 days)</span>
        <span>Confidence band ±10%</span>
        <span>Agent&apos;s recommendation</span>
        {incorporated ? <span>Projected post-incorporation</span> : null}
      </figcaption>
    </figure>
  )
}

const DETAIL_SHORTCUTS = [
  { keys: 'A', description: 'Incorporate into benchmark' },
  { keys: 'S', description: 'Approve as signal only' },
  { keys: 'R', description: 'Reject with reason' },
  { keys: 'I', description: 'Request more info' },
  { keys: 'B', description: 'Back to queue' },
  { keys: 'E', description: 'Focus first evidence card' },
  { keys: '?', description: 'Show keyboard shortcuts' },
  { keys: 'Esc', description: 'Close modal' },
]

export function PriceReportDetailPage() {
  const { reportId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const returnTo = searchParams.get('return_to')
  const approvalRequestId = searchParams.get('approval_request_id')
  const navigate = useNavigate()
  const { isAdmin, agent } = useAuth()
  const { addToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [report, setReport] = useState<PriceReportDetail | null>(null)
  const [series, setSeries] = useState<BenchmarkSeriesResponse | null>(null)
  const [dialog, setDialog] = useState<
    null | 'incorporate' | 'signal' | 'reject' | 'request_info'
  >(null)
  const [busy, setBusy] = useState(false)
  const [incorporateWeight, setIncorporateWeight] = useState(100)
  const [signalWeight, setSignalWeight] = useState(50)
  const [undoAvailable, setUndoAvailable] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  const backHref = returnTo ? decodeURIComponent(returnTo) : '/admin/valuation/price-reports'

  const load = useCallback(async () => {
    if (!reportId) return
    setLoading(true)
    setError(null)
    setNotFound(false)
    try {
      const detail = (await api.getAdminAgentPriceReport(reportId)) as PriceReportDetail
      setReport(detail)
      const segmentId = detail.subject?.segment_id
      if (segmentId) {
        try {
          const s = (await api.getAdminPricingBenchmarkSeries(segmentId, '90d')) as BenchmarkSeriesResponse
          setSeries(s)
        } catch {
          setSeries({ points: [], currency: detail.recommendation?.currency || 'AED' })
        }
      } else {
        setSeries({ points: [], currency: detail.recommendation?.currency || 'AED' })
      }
    } catch (err) {
      const status = (err as { status?: number })?.status
      if (status === 404) setNotFound(true)
      else setError(err instanceof Error ? err.message : "Couldn't load this report.")
      setReport(null)
    } finally {
      setLoading(false)
    }
  }, [reportId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!undoAvailable) return
    const t = window.setTimeout(() => setUndoAvailable(false), 5000)
    return () => window.clearTimeout(t)
  }, [undoAvailable])

  const secondApproverMode = Boolean(
    approvalRequestId &&
      report?.approval_request_id &&
      approvalRequestId === report.approval_request_id &&
      report.status === 'pending_second_approval' &&
      !report.is_own,
  )

  const auditEntries: TimelineEntry[] = useMemo(() => {
    return (report?.audit_trail || []).map((entry, idx) => ({
      id: `${entry.action}-${idx}`,
      at: entry.at,
      status:
        entry.action === 'rejected'
          ? 'failed'
          : entry.action.includes('request')
            ? 'warning'
            : entry.action === 'submitted'
              ? 'info'
              : 'success',
      title: entry.actor?.name || 'System',
      message: `${entry.action.replace(/_/g, ' ')}${entry.reason ? ` · ${entry.reason}` : ''}`,
    }))
  }, [report])

  const runReview = async (body: PriceReportReviewBody, toastTitle: string) => {
    if (!report) return
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
        setUndoAvailable(false)
      } else {
        addToast({ variant: 'success', title: toastTitle })
        setUndoAvailable(true)
      }
      await load()
    } catch (err) {
      const code = (err as { code?: string })?.code
      if (code === 'OWN_REPORT') {
        addToast({
          variant: 'warning',
          title: 'You are the submitting agent — you cannot review this report.',
        })
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

  const handleUndo = async () => {
    if (!report) return
    try {
      await api.undoAdminAgentPriceReportReview(report.id)
      addToast({ variant: 'success', title: 'Review undone.' })
      setUndoAvailable(false)
      await load()
    } catch (err) {
      addToast({
        variant: 'error',
        title: err instanceof Error ? err.message : 'Undo failed',
      })
    }
  }

  const openEvidence = async (evidenceId: string) => {
    if (!report) return
    try {
      const res = (await api.getAdminAgentPriceReportEvidenceUrl(report.id, evidenceId)) as {
        url: string
      }
      window.open(res.url, '_blank', 'noopener,noreferrer')
    } catch {
      addToast({ variant: 'error', title: 'Preview link expired. Refresh page.' })
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
        setShortcutsOpen(false)
        return
      }
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault()
        navigate(backHref)
        return
      }
      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault()
        document.querySelector<HTMLElement>('[data-evidence-card]')?.focus()
        return
      }
      if (!report || report.is_own || report.status !== 'pending_review') return
      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault()
        setIncorporateWeight(100)
        setDialog('incorporate')
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        setSignalWeight(50)
        setDialog('signal')
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        setDialog('reject')
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault()
        setDialog('request_info')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [report, navigate, backHref])

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <p className="text-[var(--lc-text-muted)]">
          You need price-report review access to view this page.
        </p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <h1 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-1)' }}>
          Report not found
        </h1>
        <p className="mt-2 text-[var(--lc-text-muted)]">
          This price report doesn&apos;t exist or is in a different environment.
        </p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/admin/valuation/price-reports">← Price reports queue</Link>
        </Button>
      </div>
    )
  }

  const pending = report?.status === 'pending_review'
  const decided =
    report &&
    ['verified', 'incorporated', 'rejected', 'request_info', 'expired'].includes(report.status)
  const currency = report?.recommendation?.currency || 'AED'

  return (
    <div className="min-h-screen bg-[var(--lc-bg-page)] text-[var(--lc-text-primary)]">
      <div
        role="status"
        className="border-b border-[var(--lc-border)] bg-[var(--lc-status-warning-bg)] px-4 py-2 text-center text-sm text-[var(--lc-status-warning-fg)] lg:hidden"
      >
        PA console requires a desktop screen (1024px or wider).
      </div>
      <div className="mx-auto max-w-[1440px]">
        <header
          role="banner"
          className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-[var(--lc-border)] bg-[var(--lc-surface-raised)] px-[var(--lc-space-2xl)]"
        >
          <div className="flex min-w-0 items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to={backHref}>
                <ChevronLeft className="me-1 h-4 w-4" aria-hidden />
                Price reports queue
              </Link>
            </Button>
            <span className="truncate text-sm text-[var(--lc-text-secondary)]">
              {report ? (
                <>
                  <PIIMask
                    kind="name"
                    value={report.agent?.display_name || 'Agent'}
                    auditContext={{ caseId: report.id, field: 'agent_display_name' }}
                  />
                  {' · '}
                  {report.subject?.segment_label}
                </>
              ) : (
                'Loading…'
              )}
            </span>
            <h1 className="sr-only">
              Price report by {report?.agent?.display_name || 'agent'} for{' '}
              {report?.subject?.segment_label || 'segment'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {report ? <PriceReportStatusBadge status={report.status} /> : null}
            {report ? (
              <span className="text-xs text-[var(--lc-text-muted)]">
                <Numeric as="span">{formatRelativeTime(report.submitted_at)}</Numeric>
              </span>
            ) : null}
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

        {loading ? (
          <div className="grid grid-cols-[60%_40%] gap-0 px-[var(--lc-space-2xl)] py-[var(--lc-space-xl)]">
            <div className="space-y-4 pe-8">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-28 animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]"
                />
              ))}
            </div>
            <div className="space-y-4 border-s border-[var(--lc-border)] ps-8">
              <div className="h-40 animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]" />
              <div className="h-60 animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]" />
            </div>
            <p className="sr-only">Loading price report…</p>
          </div>
        ) : null}

        {error ? (
          <div role="alert" className="px-[var(--lc-space-2xl)] py-8">
            Couldn&apos;t load this report.{' '}
            <Button type="button" variant="link" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : null}

        {report && !loading ? (
          <div className="grid grid-cols-[minmax(720px,60%)_minmax(480px,40%)] px-[var(--lc-space-2xl)] py-[var(--lc-space-xl)]">
            {/* Left pane — report reader */}
            <section className="min-w-0 space-y-[var(--lc-space-xl)] pe-8">
              <a href="#decision-panel" className="sr-only focus:not-sr-only">
                Skip to decision panel
              </a>

              <div className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)] shadow-[var(--lc-elevation-sm)]">
                <h2 style={{ font: 'var(--lc-type-heading-2)' }} className="text-[var(--lc-text-heading)]">
                  {report.subject?.segment_label}
                </h2>
                <p className="mt-1 text-sm text-[var(--lc-text-muted)]">
                  {report.subject?.country_flag_emoji} {report.subject?.country_code} ·{' '}
                  {report.subject?.property_type || 'Property'} ·{' '}
                  {report.subject?.bedroom_range || '—'} bedrooms ·{' '}
                  <Numeric as="span">{report.subject?.comparable_listings_count ?? 0}</Numeric>{' '}
                  comparable listings
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <PIIMask
                    kind="name"
                    value={report.agent?.display_name || 'Agent'}
                    auditContext={{ caseId: report.id, field: 'agent_display_name' }}
                  />
                  <AgentTierChip tier={report.agent?.tier || 'pro'} />
                  <Numeric as="span" className="text-sm text-[var(--lc-text-muted)]">
                    {formatTenure(report.agent?.tenure_days)}
                  </Numeric>
                </div>
              </div>

              <div>
                <h2 style={{ font: 'var(--lc-type-heading-3)' }} className="mb-3 text-[var(--lc-text-heading)]">
                  Report parameters
                </h2>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                  {[
                    ['Segment definition', report.parameters?.segment_definition],
                    ['Property type', report.subject?.property_type],
                    ['Bedroom range', report.subject?.bedroom_range],
                    ['Time window analyzed', report.parameters?.time_window],
                    ['Analysis basis', report.parameters?.analysis_basis],
                    ['Recommendation type', report.parameters?.recommendation_type],
                  ].map(([label, value]) => (
                    <div key={String(label)}>
                      <dt
                        className="text-[var(--lc-text-muted)] uppercase tracking-[0.08em]"
                        style={{ font: 'var(--lc-type-overline)' }}
                      >
                        {label}
                      </dt>
                      <dd className="mt-0.5 text-sm">{value || '—'}</dd>
                    </div>
                  ))}
                  <div className="col-span-2">
                    <dt
                      className="text-[var(--lc-text-muted)] uppercase tracking-[0.08em]"
                      style={{ font: 'var(--lc-type-overline)' }}
                    >
                      Recommendation
                    </dt>
                    <dd className="mt-0.5">
                      <Numeric as="span" className="text-lg font-medium">
                        {report.recommendation?.price_low != null
                          ? `${formatMoney(report.recommendation.price_low, currency)} – ${formatMoney(report.recommendation.price_high, currency)}`
                          : formatMoney(report.recommendation?.price_point, currency)}
                      </Numeric>
                      {report.recommendation?.price_point != null && report.recommendation?.price_low != null ? (
                        <span className="ms-2 text-sm text-[var(--lc-text-muted)]">
                          (point:{' '}
                          <Numeric as="span">
                            {formatMoney(report.recommendation.price_point, currency)}
                          </Numeric>
                          )
                        </span>
                      ) : null}
                    </dd>
                  </div>
                </dl>
              </div>

              <div>
                <h2 style={{ font: 'var(--lc-type-heading-3)' }} className="mb-3 text-[var(--lc-text-heading)]">
                  Agent&apos;s analysis
                </h2>
                <div
                  className="max-w-[65ch] whitespace-pre-wrap text-[var(--lc-text-primary)]"
                  style={{ font: 'var(--lc-type-body-lg)' }}
                >
                  {analysisText(report.analysis) || (
                    <span className="text-[var(--lc-text-muted)]">No analysis text provided.</span>
                  )}
                </div>
              </div>

              <div>
                <h2 style={{ font: 'var(--lc-type-heading-3)' }} className="mb-3 text-[var(--lc-text-heading)]">
                  Cited comparables · <Numeric as="span">{report.cited_comparables?.length ?? 0}</Numeric>
                </h2>
                {(report.cited_comparables || []).length === 0 ? (
                  <p className="text-sm text-[var(--lc-text-muted)]">No comparables cited</p>
                ) : (
                  <div className="overflow-x-auto rounded-[var(--lc-radius-md)] border border-[var(--lc-border)]">
                    <table className="w-full border-collapse text-sm">
                      <caption className="sr-only">Comparables cited by the agent</caption>
                      <thead className="bg-[var(--lc-surface-sunken)] text-[var(--lc-text-muted)]">
                        <tr>
                          {['Address', 'Price', '$/sqft', 'Beds', 'Baths', 'Status', 'Source'].map(
                            (h) => (
                              <th key={h} scope="col" className="px-3 py-2 text-start font-medium">
                                {h}
                              </th>
                            ),
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {report.cited_comparables!.map((c) => (
                          <tr key={c.id} className="border-t border-[var(--lc-border)]">
                            <td className="px-3 py-2">{c.address}</td>
                            <td className="px-3 py-2">
                              <Numeric as="span">{formatMoney(c.price, c.currency || currency)}</Numeric>
                            </td>
                            <td className="px-3 py-2">
                              <Numeric as="span">{c.price_per_sqft ?? '—'}</Numeric>
                            </td>
                            <td className="px-3 py-2">
                              <Numeric as="span">{c.beds ?? '—'}</Numeric>
                            </td>
                            <td className="px-3 py-2">
                              <Numeric as="span">{c.baths ?? '—'}</Numeric>
                            </td>
                            <td className="px-3 py-2">{c.status || '—'}</td>
                            <td className="px-3 py-2">
                              {c.source_url ? (
                                <a
                                  href={c.source_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[var(--lc-text-brand)]"
                                >
                                  {c.source_portal || 'Source'}
                                  <ExternalLink className="h-3 w-3" aria-hidden />
                                </a>
                              ) : (
                                c.source_portal || '—'
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <h2 style={{ font: 'var(--lc-type-heading-3)' }} className="mb-3 text-[var(--lc-text-heading)]">
                  Attached evidence · <Numeric as="span">{report.evidence_files?.length ?? 0}</Numeric>
                </h2>
                {(report.evidence_files || []).length === 0 ? (
                  <p className="flex items-center gap-2 text-sm text-[var(--lc-status-warning-fg)]">
                    <AlertTriangle className="h-4 w-4" aria-hidden />
                    No evidence files attached — ask for evidence before incorporating
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {report.evidence_files!.map((file) => {
                      const isImage = Boolean(file.mime?.startsWith('image/'))
                      const isPdf = file.mime === 'application/pdf'
                      return (
                        <li
                          key={file.id}
                          role="article"
                          tabIndex={0}
                          data-evidence-card
                          className="flex items-start gap-3 rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-md)] shadow-[var(--lc-elevation-sm)]"
                        >
                          <span
                            className="flex h-10 w-10 items-center justify-center rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] text-[var(--lc-text-muted)]"
                            aria-hidden
                          >
                            {isImage ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{file.filename}</p>
                            <p className="text-xs text-[var(--lc-text-muted)]">
                              {file.size_bytes != null ? (
                                <>
                                  <Numeric as="span">
                                    {(file.size_bytes / (1024 * 1024)).toFixed(1)}
                                  </Numeric>{' '}
                                  MB
                                </>
                              ) : (
                                '—'
                              )}
                              {file.uploaded_at ? ` · ${formatRelativeTime(file.uploaded_at)}` : null}
                              {isPdf ? ' · PDF' : null}
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            aria-label={`View ${file.filename}`}
                            onClick={() => void openEvidence(file.id)}
                          >
                            View
                          </Button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </section>

            {/* Right pane — benchmark + decision */}
            <aside className="min-w-0 space-y-[var(--lc-space-md)] border-s border-[var(--lc-border)] ps-8">
              <div className="rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)] p-[var(--lc-space-lg)]">
                <div className="flex items-start justify-between gap-4">
                  <dl className="grid flex-1 grid-cols-2 gap-4">
                    <div>
                      <dt className="text-xs text-[var(--lc-text-muted)]">Agent&apos;s recommendation</dt>
                      <dd>
                        <Numeric as="span" className="text-lg font-medium">
                          {formatMoney(report.recommendation?.price_point, currency)}
                        </Numeric>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[var(--lc-text-muted)]">Current benchmark</dt>
                      <dd>
                        <Numeric as="span" className="text-lg font-medium">
                          {formatMoney(
                            report.benchmark_delta?.benchmark_price_point,
                            report.benchmark_delta?.benchmark_currency || currency,
                          )}
                        </Numeric>
                      </dd>
                    </div>
                  </dl>
                  <PriceReportCompositeRiskCell
                    tenureTier={report.tenure_risk?.tier || 'unknown'}
                    deltaTier={report.benchmark_delta?.delta_tier || 'unknown'}
                    compositeTier={report.composite_risk_tier || 'unknown'}
                  />
                </div>
                {report.benchmark_delta ? (
                  <div className="mt-3">
                    <PriceReportDeltaChip delta={report.benchmark_delta} />
                  </div>
                ) : null}
                <p className="mt-2 text-xs text-[var(--lc-text-muted)]">
                  Benchmark last computed{' '}
                  <Numeric as="span">
                    {formatRelativeTime(report.benchmark_delta?.benchmark_computed_at)}
                  </Numeric>{' '}
                  ago
                </p>
              </div>

              <BenchmarkChart
                series={series}
                recommendationPrice={report.recommendation?.price_point}
                currency={currency}
                incorporated={report.status === 'incorporated'}
              />

              {report.two_person_required && pending && !report.is_own ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="rounded-[var(--lc-radius-md)] bg-[var(--lc-status-warning-bg)] p-[var(--lc-space-md)] text-[var(--lc-status-warning-fg)]"
                >
                  <span aria-hidden className="me-1">
                    ⚠
                  </span>
                  Incorporating this report writes to the pricing benchmark. Because the delta is{' '}
                  <Numeric as="span">{Math.abs(report.benchmark_delta?.delta_pct ?? 0).toFixed(1)}</Numeric>
                  %, a second approver is required — your decision will create a pending approval
                  request assigned to the on-call PA.
                </div>
              ) : null}

              {report.status === 'pending_second_approval' ? (
                <div className="space-y-3">
                  <TwoPersonProgress
                    firstApprover={{
                      initials: (report.review?.decided_by || agent?.name || 'PA')
                        .split(/\s+/)
                        .map((p) => p[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase(),
                      displayName: report.review?.decided_by || 'Initiator PA',
                      signedOffAt: report.review?.decided_at || report.submitted_at,
                      vote: 'approve',
                    }}
                    secondApprover={{
                      initials: '?',
                      displayName: 'On-call PA',
                    }}
                    pendingTone="warning"
                    pendingSecondLabel="Awaiting second reviewer"
                  />
                  <p className="text-sm text-[var(--lc-text-secondary)]">
                    Awaiting second approver
                    {report.approval_request_id ? (
                      <>
                        {' '}
                        ·{' '}
                        <Link
                          to={`/admin/fin/approvals?id=${report.approval_request_id}`}
                          className="text-[var(--lc-text-brand)] underline-offset-2 hover:underline"
                        >
                          Open approval request →
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
              ) : null}

              <div
                id="decision-panel"
                className={cn(
                  'sticky bottom-[var(--lc-space-lg)] rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)]',
                  'bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)]',
                )}
              >
                {report.is_own ? (
                  <div
                    role="status"
                    className="rounded-[var(--lc-radius-md)] bg-[var(--lc-status-warning-bg)] p-3 text-sm text-[var(--lc-status-warning-fg)]"
                  >
                    You are the submitting agent — you cannot review this report. Decision panel
                    disabled.
                  </div>
                ) : null}

                {secondApproverMode ? (
                  <div className="space-y-3">
                    <div className="rounded-[var(--lc-radius-md)] border border-[var(--lc-accent-bold-edge)] bg-[var(--lc-accent-bold)] p-3 text-[var(--lc-accent-bold-text)]">
                      Second-approver review
                    </div>
                    <p className="text-sm">
                      Initiator proposed: <strong>Incorporate into benchmark</strong>
                    </p>
                    <Button type="button" variant="default" className="w-full" disabled={busy}>
                      Approve request
                    </Button>
                    <Button type="button" variant="outline" className="w-full" disabled={busy}>
                      Decline request
                    </Button>
                  </div>
                ) : null}

                {pending && !report.is_own && !secondApproverMode ? (
                  <div className="flex flex-col gap-3">
                    <div>
                      <Button
                        type="button"
                        variant="default"
                        className="w-full"
                        disabled={busy}
                        aria-describedby="incorporate-subtext"
                        onClick={() => {
                          setIncorporateWeight(100)
                          setDialog('incorporate')
                        }}
                      >
                        Incorporate into benchmark
                      </Button>
                      <p id="incorporate-subtext" className="mt-1 text-xs text-[var(--lc-text-muted)]">
                        Writes an authoritative signal into the pricing benchmark for{' '}
                        {report.subject?.segment_label}. Affects agent pricing tools and Bazaar
                        segment badges.
                        {report.two_person_required
                          ? ' High delta — second approver required.'
                          : null}
                      </p>
                    </div>
                    <div>
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full"
                        disabled={busy}
                        aria-describedby="signal-subtext"
                        onClick={() => {
                          setSignalWeight(50)
                          setDialog('signal')
                        }}
                      >
                        Approve as signal only
                      </Button>
                      <p id="signal-subtext" className="mt-1 text-xs text-[var(--lc-text-muted)]">
                        Marks verified and visible to Bazaar and agents as a considered opinion.
                        Benchmark does NOT change.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={busy}
                      onClick={() => setDialog('reject')}
                    >
                      <X className="me-1 h-4 w-4" aria-hidden />
                      Reject with reason
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={busy}
                      onClick={() => setDialog('request_info')}
                    >
                      <MessageCircle className="me-1 h-4 w-4" aria-hidden />
                      Request more info
                    </Button>
                  </div>
                ) : null}

                {decided && !secondApproverMode ? (
                  <div className="space-y-2 text-sm">
                    <p className="font-medium text-[var(--lc-text-heading)]">
                      {statusLabel(report.status)}
                    </p>
                    <p className="text-[var(--lc-text-muted)]">
                      Decided by {report.review?.decided_by || 'PA'} on{' '}
                      <Numeric as="span">{report.review?.decided_at || '—'}</Numeric>
                    </p>
                    {report.review?.reason_code ? (
                      <p>
                        Reason: <span className="font-medium">{report.review.reason_code}</span>
                      </p>
                    ) : null}
                    {report.review?.notes ? (
                      <p>
                        <span className="text-[var(--lc-text-muted)]">Notes</span>
                        <br />
                        {report.review.notes}
                      </p>
                    ) : null}
                    {typeof report.review?.weight === 'number' ? (
                      <p>
                        Applied weight:{' '}
                        <Numeric as="span">{report.review.weight}</Numeric>%
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {undoAvailable ? (
                  <div className="mt-3 flex items-center justify-between rounded-[var(--lc-radius-md)] border border-[var(--lc-accent-bold-edge)] px-3 py-2 text-sm">
                    <span>Decision recorded — undo within 5s</span>
                    <Button type="button" variant="link" size="sm" onClick={() => void handleUndo()}>
                      Undo
                    </Button>
                  </div>
                ) : null}
              </div>

              <Timeline title="Audit trail" entries={auditEntries} emptyLabel="No audit events yet." />
            </aside>
          </div>
        ) : null}
      </div>

      <PAQueueKeyboardShortcutsPanel
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
        shortcuts={DETAIL_SHORTCUTS}
      />

      {report && dialog === 'incorporate' ? (
        <PriceReportIncorporateDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          segmentLabel={report.subject?.segment_label || 'this segment'}
          deltaPct={report.benchmark_delta?.delta_pct ?? 0}
          twoPersonRequired={Boolean(report.two_person_required)}
          weight={incorporateWeight}
          onWeightChange={setIncorporateWeight}
          confirmDisabled={busy}
          onConfirm={() =>
            void runReview(
              { status: 'verified', incorporate: true, weight: incorporateWeight },
              `Incorporated ${report.subject?.segment_label || 'report'} by ${report.agent?.display_name || 'agent'}. Benchmark refresh queued.`,
            )
          }
        />
      ) : null}

      {report && dialog === 'signal' ? (
        <PriceReportSignalOnlyDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          weight={signalWeight}
          onWeightChange={setSignalWeight}
          confirmDisabled={busy}
          onConfirm={() =>
            void runReview(
              { status: 'verified', incorporate: false, weight: signalWeight },
              `Published ${report.subject?.segment_label || 'report'} as signal-only.`,
            )
          }
        />
      ) : null}

      {report && (dialog === 'reject' || dialog === 'request_info') ? (
        <PriceReportReasonDialog
          open
          mode={dialog}
          onOpenChange={(open) => !open && setDialog(null)}
          confirmDisabled={busy}
          onConfirm={({ reasonCode, notes }) =>
            void runReview(
              {
                status: dialog === 'reject' ? 'rejected' : 'request_info',
                reason_code: reasonCode,
                notes,
              },
              dialog === 'reject'
                ? `Rejected ${report.subject?.segment_label || 'report'} — ${reasonCode}.`
                : `Requested info on ${report.subject?.segment_label || 'report'}.`,
            )
          }
        />
      ) : null}
    </div>
  )
}
