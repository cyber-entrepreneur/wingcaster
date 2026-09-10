/**
 * PA-PVA-008b — Bad-comparable-report detail (WF-05 arbitration).
 *
 * All 4 decision affordances live here (not on the queue):
 *   confirm-remove · confirm-quarantine · reject-as-invalid · request-info
 *
 * Two-person rule is triggered by **market-impact tier** (high → REMOVE_PROPOSED),
 * NOT tenure risk. Recalculation defers until second PA approval lands.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Copy,
  ExternalLink,
  MessageCircle,
  Pause,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useEnv } from '@/hooks/useEnv'
import { EnvBadge } from '@/components/nav/EnvBadge'
import { PIIMask, TwoPersonProgress } from '@/components/security'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { comparableReportsApi } from './api'
import {
  DETAIL_COPY,
  REJECT_REASON_VOCAB,
  REQUEST_INFO_REASON_VOCAB,
  QUEUE_COPY,
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
import type {
  AffectedValuationRow,
  AuditTrailEvent,
  ComparableReportDetail,
  ReporterHistoryRow,
} from './types'

type DecisionModal = 'remove' | 'quarantine' | 'reject' | 'request_info' | null

export function BadComparableDetailPage() {
  const { isAdmin } = useAuth()
  const { env } = useEnv()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const { reportId = '' } = useParams<{ reportId: string }>()
  const [searchParams] = useSearchParams()
  const returnTo =
    searchParams.get('return_to') || '/admin/valuation/comparable-reports?status=pending'
  const initialTab = searchParams.get('tab') || 'affected'

  const [report, setReport] = useState<ComparableReportDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [readConfirm, setReadConfirm] = useState(false)
  const [modal, setModal] = useState<DecisionModal>(null)
  const [notes, setNotes] = useState('')
  const [reasonCode, setReasonCode] = useState('')
  const [quarantineHours, setQuarantineHours] = useState(72)
  const [submitting, setSubmitting] = useState(false)
  const [affected, setAffected] = useState<AffectedValuationRow[]>([])
  const [audit, setAudit] = useState<AuditTrailEvent[]>([])
  const [history, setHistory] = useState<ReporterHistoryRow[]>([])
  const [tab, setTab] = useState(initialTab)

  const load = useCallback(async () => {
    if (!reportId) return
    setLoading(true)
    setError(null)
    try {
      const [detail, aff, hist, trail] = await Promise.all([
        comparableReportsApi.get(reportId),
        comparableReportsApi.affectedValuations(reportId).catch(() => ({ valuations: [] })),
        comparableReportsApi.reporterHistory(reportId).catch(() => ({ reports: [] })),
        comparableReportsApi.auditTrail(reportId).catch(() => ({ events: [] })),
      ])
      setReport(detail)
      setAffected(aff.valuations ?? [])
      setHistory(hist.reports ?? [])
      setAudit(trail.events ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : DETAIL_COPY.notFound)
      setReport(null)
    } finally {
      setLoading(false)
    }
  }, [reportId, env])

  useEffect(() => {
    if (!isAdmin) return
    void load()
  }, [isAdmin, load])

  const isPending =
    report?.status === 'pending' || report?.status === 'awaiting_info'
  const isOwn = Boolean(report?.is_own)
  const isHighImpact = report?.market_impact?.tier === 'high'
  const requiresTwoPerson = Boolean(report?.requires_two_person || isHighImpact)
  const alreadyDecided = report && !isPending && report.status !== 'pending_second_approval'

  const canLoudDecision = readConfirm && !isOwn && isPending && !submitting
  const canRequestInfo = !isOwn && isPending && !submitting

  const claim = report?.reporter_claim
  const diffs = claim?.field_diffs ?? []

  const deltaRibbon = useMemo(() => {
    if (!report) return null
    const field = claim?.reported_field ?? report.reported_field ?? 'field'
    const current =
      diffs.find((d) => d.field === field)?.current ?? report.reported_value ?? '—'
    const observed =
      claim?.observed_value ??
      diffs.find((d) => d.field === field)?.observed ??
      report.observed_value ??
      '—'
    const delta = report.delta_pct
    return DETAIL_COPY.deltaRibbon
      .replace('{field}', String(field))
      .replace('{currentValue}', String(current))
      .replace('{observedValue}', String(observed))
      .replace('{deltaPct}', delta == null ? '—' : String(delta))
  }, [report, claim, diffs])

  const openModal = (kind: DecisionModal) => {
    if (kind === 'request_info') {
      if (!canRequestInfo) return
      setModal(kind)
      return
    }
    if (!canLoudDecision) {
      if (!readConfirm) {
        addToast({ title: DETAIL_COPY.readConfirmError, variant: 'warning' })
      }
      return
    }
    setModal(kind)
  }

  const closeModal = () => {
    setModal(null)
    setNotes('')
    setReasonCode('')
    setQuarantineHours(72)
  }

  const afterSuccess = (message: string, navigateBack = true) => {
    addToast({ title: message, variant: 'success' })
    closeModal()
    if (navigateBack) {
      window.setTimeout(() => navigate(returnTo), 1500)
    } else {
      void load()
    }
  }

  const submitRemove = async () => {
    if (!report) return
    setSubmitting(true)
    try {
      const res = await comparableReportsApi.confirmRemove(report.id, { notes })
      const proposed =
        res.status === 'pending_second_approval' ||
        res.status === 'REMOVE_PROPOSED' ||
        Boolean(res.approval_request_id)
      if (proposed) {
        afterSuccess(DETAIL_COPY.toastTwoPerson)
      } else {
        afterSuccess(
          DETAIL_COPY.toastRemove.replace(
            '{N}',
            String(res.valuations_affected ?? report.market_impact.valuations_affected),
          ),
        )
      }
    } catch (err) {
      addToast({
        title: err instanceof Error ? err.message : 'Confirm-remove failed',
        variant: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const submitQuarantine = async () => {
    if (!report) return
    setSubmitting(true)
    try {
      await comparableReportsApi.confirmQuarantine(report.id, {
        notes,
        quarantine_hours: quarantineHours,
      })
      afterSuccess(DETAIL_COPY.toastQuarantine.replace('{H}', String(quarantineHours)), false)
    } catch (err) {
      addToast({
        title: err instanceof Error ? err.message : 'Quarantine failed',
        variant: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const submitReject = async () => {
    if (!report || !reasonCode || notes.trim().length < 5) return
    setSubmitting(true)
    try {
      await comparableReportsApi.rejectAsInvalid(report.id, {
        reason_code: reasonCode,
        notes: notes.trim(),
      })
      const reasonLabel =
        REJECT_REASON_VOCAB.find((r) => r.value === reasonCode)?.label ?? reasonCode
      afterSuccess(DETAIL_COPY.toastReject.replace('{reason}', reasonLabel))
    } catch (err) {
      addToast({
        title: err instanceof Error ? err.message : 'Reject failed',
        variant: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const submitRequestInfo = async () => {
    if (!report || !reasonCode) return
    setSubmitting(true)
    try {
      await comparableReportsApi.requestInfo(report.id, {
        reason_code: reasonCode,
        notes: notes.trim(),
      })
      afterSuccess(
        DETAIL_COPY.toastRequestInfo.replace(
          '{reporterName}',
          report.reporter.display_name,
        ),
        false,
      )
    } catch (err) {
      addToast({
        title: err instanceof Error ? err.message : 'Request-info failed',
        variant: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }

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

  if (loading) {
    return (
      <div className="mx-auto max-w-[1440px] px-4 py-8">
        <div className="h-8 w-64 animate-pulse rounded bg-[var(--lc-surface-sunken)]" />
        <div className="mt-6 grid gap-4 lg:grid-cols-[52%_48%]">
          <div className="h-64 animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]" />
          <div className="h-64 animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]" />
        </div>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>{DETAIL_COPY.notFound}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-[var(--lc-text-muted)]">{error}</p>
            <Button asChild variant="outline">
              <Link to={returnTo}>{DETAIL_COPY.backToQueue}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const sla = formatSlaChip(report.sla_hours_remaining)
  const pattern = report.reporter.pattern_flag
  const patternSignals = report.reporter.pattern_signals

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

      <div className="sticky top-0 z-10 border-b border-[var(--lc-border)] bg-[var(--lc-surface-raised)] px-4 py-2">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3">
          <Link
            to={returnTo}
            className="text-sm text-[var(--lc-text-brand)] underline-offset-2 hover:underline"
            aria-label="Back to bad-comparable-report queue"
          >
            {DETAIL_COPY.backToQueue}
          </Link>
          <EnvBadge env={env} />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label="Copy link"
            onClick={() => {
              void navigator.clipboard.writeText(window.location.href)
              addToast({ title: DETAIL_COPY.copyLinkToast, variant: 'success' })
            }}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] px-4 py-6">
        <header className="mb-4">
          <h1
            className="text-[var(--lc-text-heading)]"
            style={{ font: 'var(--lc-type-heading-1)' }}
          >
            {report.comparable.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ReasonCategoryBadge category={report.reason_category} />
            <SeverityBadge severity={report.severity} />
            <MarketImpactChip impact={report.market_impact} />
            <ReportStatusBadge status={report.status} />
          </div>
          <p className="mt-1 text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
            {report.comparable.address_line}
          </p>
        </header>

        <div className="mb-4 grid gap-3 md:grid-cols-2">
          <div className="flex items-center gap-3 rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-3">
            <Avatar className="h-10 w-10">
              {report.reporter.avatar_url ? (
                <AvatarImage src={report.reporter.avatar_url} alt="" />
              ) : null}
              <AvatarFallback>{initials(report.reporter.display_name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <PIIMask
                  value={report.reporter.display_name}
                  kind="name"
                  auditContext={{ caseId: report.id, field: 'reporter_name' }}
                />
                <ReporterPatternDot
                  patternFlag={pattern}
                  signals={patternSignals}
                  agencyName={report.comparable.owning_agency?.name}
                />
              </div>
              <p className="text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
                {report.reporter.agency?.name} · {formatRelativeSubmitted(report.created_at)} ·{' '}
                <span className={slaToneClass(sla.tone)}>{sla.label}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback>
                {initials(report.comparable.owning_agency?.name ?? '?')}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{report.comparable.owning_agency?.name}</p>
              <p className="text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
                {report.comparable.source_display}
                {report.comparable.current_fields?.scraped_days_ago != null
                  ? ` · Scraped ${String(report.comparable.current_fields.scraped_days_ago)} days ago`
                  : null}
              </p>
            </div>
            {report.comparable.source_url ? (
              <a
                href={report.comparable.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-[var(--lc-text-brand)]"
              >
                {DETAIL_COPY.openInSource}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            ) : null}
          </div>
        </div>

        {pattern && patternSignals ? (
          <div
            role="status"
            className="mb-4 rounded-[var(--lc-radius-md)] bg-[var(--lc-status-warning-bg)] px-4 py-3 text-sm text-[var(--lc-status-warning-fg)]"
          >
            {DETAIL_COPY.reporterPatternBanner
              .replace('{N}', String(patternSignals.reports_against_agency_last_30d))
              .replace(
                '{agency}',
                patternSignals.agency_name ?? report.comparable.owning_agency?.name ?? 'agency',
              )
              .replace('{D}', String(patternSignals.days_window))}
          </div>
        ) : null}

        <div className="grid items-start gap-4 lg:grid-cols-[52%_48%]">
          <div className="flex flex-col gap-4">
            <Card className="overflow-hidden shadow-[var(--lc-elevation-sm)]">
              <div
                role="status"
                aria-live="polite"
                className="bg-[var(--lc-status-warning-bg)] px-4 py-2 text-sm text-[var(--lc-status-warning-fg)]"
                data-delta-ribbon
              >
                {deltaRibbon}
              </div>
              <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-[var(--lc-text-heading)]">
                    {DETAIL_COPY.sideBySideLeft}
                  </h3>
                  <FieldList
                    fields={report.comparable.current_fields ?? {}}
                    highlightKeys={[]}
                  />
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-[var(--lc-text-heading)]">
                    {DETAIL_COPY.sideBySideRight}
                  </h3>
                  <FieldList
                    fields={Object.fromEntries(
                      (diffs.length
                        ? diffs.map((d) => [d.field, d.observed])
                        : [
                            [
                              claim?.reported_field ?? report.reported_field ?? 'value',
                              claim?.observed_value ?? report.observed_value,
                            ],
                          ]
                      ) as Array<[string, unknown]>,
                    )}
                    highlightKeys={diffs.map((d) => d.field)}
                  />
                </div>
              </CardContent>
            </Card>

            {claim?.reason_text || report.reported_field ? (
              <blockquote className="border-s-4 border-[var(--lc-border-strong)] bg-[var(--lc-surface-raised)] p-4 text-[length:var(--lc-type-body-lg)]">
                <p className="mb-1 text-xs uppercase tracking-wide text-[var(--lc-text-muted)]">
                  {DETAIL_COPY.reporterMessage}
                </p>
                <p className="whitespace-pre-wrap">
                  {claim?.reason_text ?? '—'}
                </p>
              </blockquote>
            ) : null}

            <section>
              <h3 className="mb-2 text-sm font-semibold">
                {DETAIL_COPY.evidenceHeader.replace(
                  '{N}',
                  String(report.evidence?.file_count ?? 0),
                )}
              </h3>
              {(report.evidence?.file_count ?? 0) === 0 ? (
                <div className="rounded-[var(--lc-radius-md)] bg-[var(--lc-status-warning-bg)] px-3 py-2 text-sm text-[var(--lc-status-warning-fg)]">
                  {DETAIL_COPY.evidenceZero}
                </div>
              ) : (
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {(report.evidence?.files ?? []).map((f) => (
                    <li
                      key={`${f.filename}-${f.uploaded_at}`}
                      className="rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-2 text-xs"
                    >
                      <p className="truncate font-medium">{f.filename}</p>
                      <p className="text-[var(--lc-text-muted)]">
                        {formatRelativeSubmitted(f.uploaded_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div
            className="flex flex-col gap-4 lg:sticky"
            style={{ top: 'var(--lc-space-3xl, 5rem)' }}
          >
            <Card className="shadow-[var(--lc-elevation-sm)]">
              <CardHeader>
                <CardTitle className="text-base">{DETAIL_COPY.marketImpactTitle}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[var(--lc-text-muted)]">
                    {DETAIL_COPY.valuationsAffected}
                  </span>
                  <span className="text-2xl font-semibold">
                    <Numeric>{report.market_impact.valuations_affected}</Numeric>
                  </span>
                </div>
                <MarketImpactChip impact={report.market_impact} />
                <div className="flex justify-between">
                  <span className="text-[var(--lc-text-muted)]">{DETAIL_COPY.medianMove}</span>
                  <span>
                    <Numeric>{report.market_impact.pct_move_median}</Numeric>%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--lc-text-muted)]">{DETAIL_COPY.maxMove}</span>
                  <span>
                    <Numeric>{report.market_impact.pct_move_max}</Numeric>%
                  </span>
                </div>
                {(report.market_impact.top_markets?.length ?? 0) > 0 ? (
                  <div>
                    <p className="mb-1 text-[var(--lc-text-muted)]">{DETAIL_COPY.marketsLabel}</p>
                    <ul className="space-y-1">
                      {report.market_impact.top_markets!.slice(0, 5).map((m) => (
                        <li key={m.market} className="flex justify-between">
                          <span>{m.market}</span>
                          <Numeric>{m.count}</Numeric>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <p className="text-xs text-[var(--lc-text-muted)]">{DETAIL_COPY.marketImpactNote}</p>
                {isHighImpact ? (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-[var(--lc-radius-md)] bg-[var(--lc-status-warning-bg)] px-3 py-2 text-[var(--lc-status-warning-fg)]"
                    data-two-person-banner
                  >
                    <Users className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span>{DETAIL_COPY.twoPersonBanner}</span>
                  </div>
                ) : null}
                {requiresTwoPerson && report.status === 'pending_second_approval' ? (
                  <TwoPersonProgress
                    firstApprover={{
                      initials:
                        report.proposal?.proposed_by?.initials ??
                        initials(report.proposal?.proposed_by?.display_name ?? 'PA'),
                      displayName: report.proposal?.proposed_by?.display_name,
                      signedOffAt: report.proposal?.proposed_at,
                      vote: 'approve',
                    }}
                    secondApprover={{ initials: '—', displayName: 'Second PA' }}
                    pendingTone="warning"
                    pendingSecondLabel="Awaiting second PA"
                  />
                ) : null}
              </CardContent>
            </Card>

            <Card
              className="shadow-[var(--lc-elevation-md)]"
              data-arbitration-decision-panel
            >
              <CardHeader>
                <CardTitle className="text-base">{DETAIL_COPY.decisionTitle}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isOwn ? (
                  <p
                    role="status"
                    className="rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] px-3 py-2 text-sm"
                  >
                    {DETAIL_COPY.ownCaseDecision}
                  </p>
                ) : null}

                {alreadyDecided ? (
                  <p className="text-sm text-[var(--lc-text-muted)]">
                    {DETAIL_COPY.alreadyDecided
                      .replace('{status}', report.status)
                      .replace('{decidedBy}', report.decided_by ?? 'a PA')
                      .replace('{decidedAt}', report.decided_at ?? '—')}
                  </p>
                ) : (
                  <>
                    {/* All 4 WF-05 decisions — detail only (no inline queue Approve/Reject). */}
                    <Button
                      type="button"
                      className="w-full"
                      disabled={!canLoudDecision}
                      data-decision="confirm-remove"
                      aria-describedby="wf05-read-confirm"
                      onClick={() => openModal('remove')}
                    >
                      <Trash2 className="me-2 h-4 w-4" aria-hidden />
                      {DETAIL_COPY.confirmRemove}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-[var(--lc-status-warning-fg)] text-[var(--lc-status-warning-fg)]"
                      disabled={!canLoudDecision}
                      data-decision="confirm-quarantine"
                      aria-describedby="wf05-read-confirm"
                      onClick={() => openModal('quarantine')}
                    >
                      <Pause className="me-2 h-4 w-4" aria-hidden />
                      {DETAIL_COPY.confirmQuarantine}
                    </Button>
                    <div className="border-t border-[var(--lc-border)]" />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={!canLoudDecision}
                      data-decision="reject-as-invalid"
                      aria-describedby="wf05-read-confirm"
                      onClick={() => openModal('reject')}
                    >
                      <X className="me-2 h-4 w-4" aria-hidden />
                      {DETAIL_COPY.reject}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={!canRequestInfo}
                      data-decision="request-info"
                      onClick={() => openModal('request_info')}
                    >
                      <MessageCircle className="me-2 h-4 w-4" aria-hidden />
                      {DETAIL_COPY.requestInfo}
                    </Button>

                    <label
                      id="wf05-read-confirm"
                      className="flex items-start gap-2 text-sm text-[var(--lc-text-primary)]"
                    >
                      <input
                        type="checkbox"
                        className="mt-1 accent-[var(--lc-action-primary)]"
                        checked={readConfirm}
                        onChange={(e) => setReadConfirm(e.target.checked)}
                        disabled={isOwn || !isPending}
                      />
                      {DETAIL_COPY.readConfirm}
                    </label>
                    <p className="text-xs text-[var(--lc-text-muted)]">{DETAIL_COPY.auditNote}</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="mt-8">
          <TabsList>
            <TabsTrigger value="affected">{DETAIL_COPY.tabs.affected}</TabsTrigger>
            <TabsTrigger value="audit">{DETAIL_COPY.tabs.audit}</TabsTrigger>
            <TabsTrigger value="reporter-history">{DETAIL_COPY.tabs.reporterHistory}</TabsTrigger>
          </TabsList>
          <TabsContent value="affected" className="mt-3">
            <AffectedTable rows={affected} />
          </TabsContent>
          <TabsContent value="audit" className="mt-3">
            <AuditList events={audit} />
          </TabsContent>
          <TabsContent value="reporter-history" className="mt-3">
            <HistoryTable rows={history} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Confirm-remove — converts to two-person propose when market-impact is high */}
      <Dialog open={modal === 'remove'} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{DETAIL_COPY.confirmRemoveModal.title}</DialogTitle>
            <DialogDescription>
              {requiresTwoPerson
                ? DETAIL_COPY.confirmRemoveModal.twoPerson
                : DETAIL_COPY.confirmRemoveModal.body
                    .replace('{N}', String(report.market_impact.valuations_affected))
                    .replace(
                      '{agencyName}',
                      report.comparable.owning_agency?.name ?? 'the agency',
                    )}
            </DialogDescription>
          </DialogHeader>
          <Label htmlFor="remove-notes">Notes</Label>
          <textarea
            id="remove-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              {DETAIL_COPY.confirmRemoveModal.cancel}
            </Button>
            <Button type="button" disabled={submitting} onClick={() => void submitRemove()}>
              {requiresTwoPerson
                ? DETAIL_COPY.confirmRemoveModal.propose
                : DETAIL_COPY.confirmRemoveModal.confirm}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={modal === 'quarantine'} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{DETAIL_COPY.confirmQuarantineModal.title}</DialogTitle>
            <DialogDescription>
              {DETAIL_COPY.confirmQuarantineModal.body
                .replace('{H}', String(quarantineHours))
                .replace(
                  '{agencyName}',
                  report.comparable.owning_agency?.name ?? 'the agency',
                )}
            </DialogDescription>
          </DialogHeader>
          <Label htmlFor="quarantine-hours">{DETAIL_COPY.quarantineHoursLabel}</Label>
          <Input
            id="quarantine-hours"
            type="number"
            min={24}
            max={168}
            value={quarantineHours}
            onChange={(e) => setQuarantineHours(Number(e.target.value) || 72)}
          />
          <p className="text-xs text-[var(--lc-text-muted)]">
            {DETAIL_COPY.quarantineHoursHelper}
          </p>
          <Label htmlFor="quarantine-notes">Notes</Label>
          <textarea
            id="quarantine-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="button" disabled={submitting} onClick={() => void submitQuarantine()}>
              {DETAIL_COPY.confirmQuarantineModal.confirm.replace(
                '{H}',
                String(quarantineHours),
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={modal === 'reject'} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{DETAIL_COPY.rejectModal.title}</DialogTitle>
          </DialogHeader>
          <Label htmlFor="reject-reason">{DETAIL_COPY.rejectModal.reasonLabel}</Label>
          <select
            id="reject-reason"
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value)}
            className="min-h-tap w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 text-sm"
          >
            <option value="">Select a reason…</option>
            {REJECT_REASON_VOCAB.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Label htmlFor="reject-notes">{DETAIL_COPY.rejectModal.notesLabel}</Label>
          <textarea
            id="reject-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={submitting || !reasonCode || notes.trim().length < 5}
              onClick={() => void submitReject()}
            >
              {DETAIL_COPY.rejectModal.confirm}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={modal === 'request_info'} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{DETAIL_COPY.requestInfoModal.title}</DialogTitle>
          </DialogHeader>
          <Label htmlFor="info-reason">What should the reporter attach or clarify?</Label>
          <select
            id="info-reason"
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value)}
            className="min-h-tap w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 text-sm"
          >
            <option value="">Select…</option>
            {REQUEST_INFO_REASON_VOCAB.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Label htmlFor="info-notes">{DETAIL_COPY.requestInfoModal.notesLabel}</Label>
          <textarea
            id="info-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={submitting || !reasonCode}
              onClick={() => void submitRequestInfo()}
            >
              {DETAIL_COPY.requestInfoModal.confirm}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FieldList({
  fields,
  highlightKeys,
}: {
  fields: Record<string, unknown>
  highlightKeys: string[]
}) {
  const entries = Object.entries(fields)
  if (entries.length === 0) {
    return <p className="text-sm text-[var(--lc-text-muted)]">No fields</p>
  }
  return (
    <dl className="space-y-1 text-sm">
      {entries.map(([key, value]) => {
        const changed = highlightKeys.includes(key)
        return (
          <div
            key={key}
            className={cn(
              'flex justify-between gap-2 rounded px-1 py-0.5',
              changed && 'bg-[var(--lc-status-warning-bg)] text-[var(--lc-status-warning-fg)]',
            )}
          >
            <dt className="capitalize text-[var(--lc-text-muted)]">
              {key.replace(/_/g, ' ')}
            </dt>
            <dd className="font-medium">{value == null ? '—' : String(value)}</dd>
          </div>
        )
      })}
    </dl>
  )
}

function AffectedTable({ rows }: { rows: AffectedValuationRow[] }) {
  if (!rows.length) {
    return <p className="text-sm text-[var(--lc-text-muted)]">No affected valuations.</p>
  }
  return (
    <div className="overflow-x-auto rounded-[var(--lc-radius-md)] border border-[var(--lc-border)]">
      <table className="w-full text-sm">
        <thead className="bg-[var(--lc-surface-sunken)] text-start">
          <tr>
            <th className="px-3 py-2">Valuation</th>
            <th className="px-3 py-2">Agency</th>
            <th className="px-3 py-2">Address</th>
            <th className="px-3 py-2">Current</th>
            <th className="px-3 py-2">Projected</th>
            <th className="px-3 py-2">Δ%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.valuation_id} className="border-t border-[var(--lc-border)]">
              <td className="px-3 py-2">{r.valuation_id}</td>
              <td className="px-3 py-2">{r.agency ?? '—'}</td>
              <td className="px-3 py-2">{r.listing_address ?? '—'}</td>
              <td className="px-3 py-2">
                {r.current_valuation != null ? <Numeric>{r.current_valuation}</Numeric> : '—'}
              </td>
              <td className="px-3 py-2">
                {r.projected_valuation != null ? (
                  <Numeric>{r.projected_valuation}</Numeric>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-3 py-2">
                {r.delta_pct != null ? <Numeric>{r.delta_pct}</Numeric> : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AuditList({ events }: { events: AuditTrailEvent[] }) {
  if (!events.length) {
    return <p className="text-sm text-[var(--lc-text-muted)]">No audit events yet.</p>
  }
  return (
    <ol className="space-y-2 border-s border-[var(--lc-border)] ps-4">
      {events.map((e, i) => (
        <li key={e.id ?? `${e.at}-${i}`} className="text-sm">
          <p className="font-medium">{e.description || e.kind}</p>
          <p className="text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
            {e.at}
            {e.actor ? ` · ${e.actor}` : ''}
          </p>
        </li>
      ))}
    </ol>
  )
}

function HistoryTable({ rows }: { rows: ReporterHistoryRow[] }) {
  if (!rows.length) {
    return <p className="text-sm text-[var(--lc-text-muted)]">No prior reports.</p>
  }
  return (
    <div className="overflow-x-auto rounded-[var(--lc-radius-md)] border border-[var(--lc-border)]">
      <table className="w-full text-sm">
        <thead className="bg-[var(--lc-surface-sunken)] text-start">
          <tr>
            <th className="px-3 py-2">Report</th>
            <th className="px-3 py-2">Reason</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Decided</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-[var(--lc-border)]">
              <td className="px-3 py-2">{r.comparable_title ?? r.id}</td>
              <td className="px-3 py-2">{r.reason_category}</td>
              <td className="px-3 py-2">
                <ReportStatusBadge status={r.status} />
              </td>
              <td className="px-3 py-2">{r.decided_at ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
