import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  StatusHero,
  OutcomeTimeline,
  ResolverMessage,
  PrimaryCtaPerState,
  type CtaAction,
  type OutcomeTimelineEvent,
} from '@/components/recipient'
import { PIIMask } from '@/components/security'
import { Numeric } from '@/components/ui/numeric'
import { usePageTitle } from '@/lib/usePageTitle'
import { ImpactPanel } from './ImpactPanel'
import { OriginalReportAccordion } from './OriginalReportAccordion'
import { ReportedComparableCard } from './ReportedComparableCard'
import {
  ContactSupportLink,
  OutcomeLoadingSkeleton,
  OutcomeNetworkError,
  OutcomeNotFound,
  OutcomeTopNav,
} from './OutcomeShell'
import {
  comparableHeroLabel,
  extractImpactCount,
  mapComparableOutcomeState,
} from './mapComparableOutcomeState'
import { useComparableReportOutcome } from './useComparableReportOutcome'
import type { ComparableOutcomeVariant } from './outcomeTypes'

const REASON_LABELS: Record<string, string> = {
  wrong_price: 'Wrong price',
  incorrect_price: 'Incorrect price',
  duplicate: 'Duplicate',
  not_comparable: 'Not comparable',
  removed_from_market: 'Removed from market',
  fake_listing: 'Fake listing',
  already_sold: 'Already sold',
  wrong_details: 'Wrong details',
  other: 'Other',
}

function formatExpires(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

function buildTimeline(
  variant: ComparableOutcomeVariant,
  report: {
    submitted_at?: string
    created_at?: string
    picked_up_at?: string | null
    reviewed_at?: string | null
    decided_at?: string | null
    resolved_at?: string | null
    data?: { picked_up_at?: string | null } | null
  },
): OutcomeTimelineEvent[] {
  const submitted = report.submitted_at || report.created_at
  const pickedUp = report.picked_up_at || report.data?.picked_up_at || null
  const decided = report.decided_at || report.reviewed_at || report.resolved_at || null
  const resolved = report.resolved_at || decided

  const isPending = variant === 'pending' || variant === 'pending_in_review'
  const inReview = variant === 'pending_in_review' || Boolean(pickedUp) || !isPending

  let resolvedLabel = 'Resolved'
  switch (variant) {
    case 'approved_removed':
      resolvedLabel = 'Comparable removed'
      break
    case 'approved_quarantined':
      resolvedLabel = 'Comparable flagged'
      break
    case 'rejected':
      resolvedLabel = 'Kept in place'
      break
    case 'more_info':
      resolvedLabel = 'More info requested'
      break
    case 'expired':
      resolvedLabel = 'Timed out'
      break
    case 'withdrawn':
      resolvedLabel = 'Withdrawn'
      break
    case 'superseded':
      resolvedLabel = 'Closed as duplicate'
      break
    default:
      break
  }

  return [
    {
      key: 'submitted',
      label: 'Submitted',
      timestamp: submitted,
      state: 'complete',
    },
    {
      key: 'in_review',
      label: 'In Platform Administrator review',
      timestamp: inReview && pickedUp ? pickedUp : inReview && !isPending ? decided || undefined : undefined,
      state: !inReview && isPending ? 'pending' : isPending && inReview ? 'complete' : 'complete',
    },
    {
      key: 'decided',
      label: 'Decided',
      timestamp: !isPending ? decided || undefined : undefined,
      state: isPending ? 'current' : 'complete',
    },
    {
      key: 'resolved',
      label: isPending ? 'Resolved' : resolvedLabel,
      timestamp: !isPending ? resolved || undefined : undefined,
      state: isPending ? 'pending' : 'complete',
    },
  ]
}

function detailCopy(variant: ComparableOutcomeVariant, report: {
  expires_at?: string | null
  data?: { withdrawn_at?: string | null; decision?: { notes?: string | null } } | null
  decision_notes?: string | null
}): string | null {
  switch (variant) {
    case 'pending':
    case 'pending_in_review':
      return null
    case 'rejected':
      return 'If you have new evidence — a price disclosure, a listing withdrawal notice, a corrected sale record — you can submit a fresh report.'
    case 'more_info':
      return `The reviewer flagged: ${report.decision_notes || report.data?.decision?.notes || 'additional evidence needed'}. Add it and we'll re-open the review.`
    case 'expired':
      return 'This report timed out after 30 days without a decision. You can submit a fresh report; your original is preserved in your history.'
    case 'withdrawn': {
      const when = report.data?.withdrawn_at
      return when
        ? `You withdrew this report on ${formatExpires(when)}. You can submit a fresh report anytime.`
        : 'You withdrew this report. You can submit a fresh report anytime.'
    }
    default:
      return null
  }
}

/**
 * AGT-REC-002 — Comparable-report outcome (WF-05 Recipient).
 * Routes: `/reports/comparables/:reportId/outcome`, legacy `/agent/comparable-reports/:id`.
 */
export function ComparableReportOutcomePage() {
  usePageTitle('Report status')
  const navigate = useNavigate()
  const params = useParams<{ reportId?: string; id?: string }>()
  const reportId = params.reportId || params.id
  const { report, loading, notFound, error, refetch } = useComparableReportOutcome(reportId)
  const [sheetOpen, setSheetOpen] = useState(false)

  const mapping = useMemo(
    () => (report ? mapComparableOutcomeState(report) : null),
    [report],
  )

  const heroTimestamp = report
    ? report.decided_at ||
      report.reviewed_at ||
      report.resolved_at ||
      report.submitted_at ||
      report.created_at
    : undefined

  const impactCount = report ? extractImpactCount(report) : 0
  const showImpact =
    mapping?.variant === 'approved_removed' || mapping?.variant === 'approved_quarantined'

  const comparableLabel =
    report?.data?.comparable?.address_label ||
    (report?.comparable_id ? `Comparable ${report.comparable_id}` : 'Reported comparable')

  const resolverName =
    report?.data?.decision?.resolver?.display_name ||
    (report?.reviewed_by ? String(report.reviewed_by) : null)

  const ctas = useMemo(() => {
    if (!mapping || !report) return null
    const comparableId = report.comparable_id || ''
    const primary: CtaAction = (() => {
      switch (mapping.variant) {
        case 'pending':
        case 'pending_in_review':
          return {
            key: 'awaiting',
            label: 'Awaiting reviewer',
            variant: 'default',
            disabled: true,
          }
        case 'approved_removed':
          return {
            key: 'view_updated',
            label: 'View updated comparable',
            variant: 'default',
            href: comparableId
              ? `/listings?comparableId=${encodeURIComponent(comparableId)}`
              : '/agent/pricing',
          }
        case 'approved_quarantined':
          return {
            key: 'view_flagged',
            label: 'View flagged comparable',
            variant: 'default',
            href: comparableId
              ? `/listings?comparableId=${encodeURIComponent(comparableId)}`
              : '/agent/pricing',
          }
        case 'more_info':
          return {
            key: 'provide_info',
            label: 'Provide the requested info',
            variant: 'default',
            href: `/agent/pricing?resumeComparableReportId=${encodeURIComponent(report.id)}`,
          }
        case 'rejected':
        case 'expired':
        case 'withdrawn':
        case 'superseded':
        default:
          return {
            key: 'new_report',
            label: 'Submit a new report',
            variant: 'default',
            href: comparableId
              ? `/agent/pricing?forComparableId=${encodeURIComponent(comparableId)}`
              : '/agent/pricing',
          }
      }
    })()

    let secondary: CtaAction | undefined
    if (mapping.variant === 'approved_removed' || mapping.variant === 'approved_quarantined') {
      secondary = {
        key: 'affected',
        label: 'View affected listings',
        variant: 'outline',
        href: `/listings?affectedByCorrectionId=${encodeURIComponent(report.id)}`,
      }
    } else if (mapping.variant === 'rejected' || mapping.variant === 'expired' || mapping.variant === 'withdrawn') {
      secondary = {
        key: 'close',
        label: 'Close and continue',
        variant: 'outline',
        onClick: () => navigate('/agent/pricing'),
      }
    } else if (mapping.variant === 'more_info') {
      secondary = {
        key: 'view_original',
        label: 'View original submission',
        variant: 'outline',
        onClick: () => {
          document.getElementById('original-report-accordion')?.scrollIntoView({ behavior: 'smooth' })
        },
      }
    }

    let tertiary: CtaAction | undefined
    if (mapping.variant === 'pending' || mapping.variant === 'pending_in_review' || mapping.variant === 'more_info') {
      tertiary = {
        key: 'withdraw',
        label: 'Withdraw report',
        variant: 'ghost',
        // Withdraw POST alias not on main yet — document gap; keep confirm UI honest.
        confirm: {
          title: 'Withdraw your report?',
          body: 'The reviewer will stop looking at this. You can submit a fresh report anytime. (Withdraw API not yet available — contact support if you need this closed now.)',
          confirm_label: 'Withdraw',
          cancel_label: 'Keep report open',
        },
        onClick: () => {
          // Thin gap: POST /api/users/me/comparable-reports/:id/withdraw not shipped.
        },
      }
    }

    return { primary, secondary, tertiary }
  }, [mapping, report, navigate])

  if (loading) {
    return (
      <div className="bg-[var(--lc-bg-page)]">
        <OutcomeTopNav title="Report status" />
        <OutcomeLoadingSkeleton />
      </div>
    )
  }

  if (error && !report) {
    return (
      <div className="bg-[var(--lc-bg-page)]">
        <OutcomeTopNav title="Report status" />
        <OutcomeNetworkError onRetry={() => void refetch()} />
      </div>
    )
  }

  if (notFound || !report || !mapping || !ctas) {
    return (
      <div className="bg-[var(--lc-bg-page)]">
        <OutcomeTopNav title="Report status" />
        <OutcomeNotFound />
      </div>
    )
  }

  const detail = detailCopy(mapping.variant, report)
  const timeline = buildTimeline(mapping.variant, report)
  const showResolver =
    mapping.variant !== 'pending' &&
    mapping.variant !== 'pending_in_review' &&
    Boolean(report.reviewed_at || report.decided_at || report.decision_notes || report.data?.decision)

  return (
    <div className="min-h-screen bg-[var(--lc-bg-page)] pb-28 md:pb-[var(--lc-space-3xl)]">
      <OutcomeTopNav title="Report status" />
      <div aria-live="polite" className="sr-only">
        Report status: {comparableHeroLabel(mapping.variant)}
      </div>

      <StatusHero
        state={mapping.heroState}
        emphasis={mapping.emphasis}
        label={comparableHeroLabel(mapping.variant)}
        timestamp={heroTimestamp}
      />

      <div className="mx-auto grid max-w-[1200px] gap-[var(--lc-space-lg)] px-[var(--lc-space-md)] py-[var(--lc-space-md)] lg:grid-cols-[65%_35%]">
        <div className="min-w-0 space-y-[var(--lc-space-lg)]">
          <ReportedComparableCard
            addressLabel={comparableLabel}
            marketLabel={report.data?.comparable?.market_label}
            sourceLabel={report.data?.comparable?.source_label || report.comparable_type}
            onOpenDetails={() => setSheetOpen(true)}
          />

          {sheetOpen ? (
            <div
              role="dialog"
              aria-label="Comparable details"
              className="rounded-lg border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-md)] shadow-sm"
            >
              <p style={{ font: 'var(--lc-type-body-sm)' }} className="text-[var(--lc-text-muted)]">
                Comparable ID
              </p>
              <Numeric dir="ltr">{report.comparable_id}</Numeric>
              <ButtonCloseSheet onClose={() => setSheetOpen(false)} />
            </div>
          ) : null}

          <OutcomeTimeline events={timeline} />

          {showResolver ? (
            <div className="space-y-[var(--lc-space-sm)]">
              {resolverName ? (
                <div className="text-start" style={{ font: 'var(--lc-type-caption)' }}>
                  <span className="text-[var(--lc-text-muted)]">Reviewer: </span>
                  <PIIMask
                    value={resolverName}
                    kind="name"
                    auditContext={{ caseId: report.id, field: 'resolver_name' }}
                  />
                </div>
              ) : null}
              <ResolverMessage
                resolver={{
                  display_name: resolverName || 'Platform Administrator',
                  role_label: 'Platform Administrator',
                  avatar_url: report.data?.decision?.resolver?.avatar_url || undefined,
                }}
                decided_at={
                  report.decided_at ||
                  report.reviewed_at ||
                  report.resolved_at ||
                  report.created_at ||
                  new Date().toISOString()
                }
                message={
                  report.decision_notes ||
                  report.data?.decision?.notes ||
                  report.notes ||
                  null
                }
              />
            </div>
          ) : null}

          {showImpact ? (
            <ImpactPanel
              count={impactCount}
              mode={mapping.variant === 'approved_removed' ? 'removed' : 'quarantined'}
              affectedListingsHref={`/listings?affectedByCorrectionId=${encodeURIComponent(report.id)}`}
            />
          ) : null}

          {(mapping.variant === 'pending' || mapping.variant === 'pending_in_review') ? (
            <div
              className="rounded-lg bg-[var(--lc-surface-sunken)] p-[var(--lc-space-md)]"
              style={{ font: 'var(--lc-type-body-sm)' }}
            >
              <p className="text-[var(--lc-text-primary)]">
                Typical PA review: <strong>48 hours</strong>
                {report.expires_at ? (
                  <>
                    {' '}
                    · Report expires{' '}
                    <Numeric as="strong">{formatExpires(report.expires_at)}</Numeric>
                  </>
                ) : null}
              </p>
              <p className="mt-[var(--lc-space-xs)] text-[var(--lc-text-muted)]">
                We&apos;ll notify you the moment a reviewer decides.
              </p>
            </div>
          ) : null}

          {detail ? (
            <p className="text-[var(--lc-text-primary)]" style={{ font: 'var(--lc-type-body)' }}>
              {detail}
            </p>
          ) : null}

          {mapping.variant === 'superseded' && report.superseded_by_report_id ? (
            <p style={{ font: 'var(--lc-type-body-sm)' }}>
              <Link
                to={`/reports/comparables/${report.superseded_by_report_id}/outcome`}
                className="text-[var(--lc-text-brand)] underline-offset-2 hover:underline"
              >
                Open the active report
              </Link>
            </p>
          ) : null}

          <div id="original-report-accordion">
            <OriginalReportAccordion
              reportId={report.id}
              headerLabel="What you originally reported"
              body={{
                reasonLabel: REASON_LABELS[String(report.reason || '')] || report.reason || null,
                notes: report.notes,
                evidence: report.data?.evidence,
              }}
            />
          </div>

          <ContactSupportLink context={`Comparable report ID: ${report.id}`} />
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-[var(--lc-space-3xl)] space-y-[var(--lc-space-md)]">
            <PrimaryCtaPerState
              layout="stacked"
              primary={ctas.primary}
              secondary={ctas.secondary}
              tertiary={ctas.tertiary}
            />
            <div
              className="rounded-lg bg-[var(--lc-surface-sunken)] p-[var(--lc-space-md)] text-[var(--lc-text-muted)]"
              style={{ font: 'var(--lc-type-caption)' }}
            >
              <p>
                Report ID: <Numeric dir="ltr">{report.id}</Numeric>
              </p>
              {report.created_at ? (
                <p className="mt-1">
                  Submitted: <Numeric dir="ltr">{report.created_at}</Numeric>
                </p>
              ) : null}
              {(report.decided_at || report.reviewed_at) ? (
                <p className="mt-1">
                  Decided: <Numeric dir="ltr">{report.decided_at || report.reviewed_at}</Numeric>
                </p>
              ) : null}
            </div>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-md)] pb-[max(var(--lc-space-md),env(safe-area-inset-bottom))] shadow-md lg:hidden">
        <PrimaryCtaPerState
          layout="stacked"
          primary={ctas.primary}
          secondary={ctas.secondary}
          tertiary={ctas.tertiary}
        />
      </div>
    </div>
  )
}

function ButtonCloseSheet({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      className="mt-[var(--lc-space-sm)] text-[var(--lc-text-brand)]"
      style={{ font: 'var(--lc-type-body-sm)' }}
      onClick={onClose}
    >
      Close
    </button>
  )
}
