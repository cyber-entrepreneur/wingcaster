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
import { OriginalReportAccordion } from './OriginalReportAccordion'
import { ReportIdentityCard } from './ReportIdentityCard'
import { WeightingPanel } from './WeightingPanel'
import {
  ContactSupportLink,
  OutcomeLoadingSkeleton,
  OutcomeNetworkError,
  OutcomeNotFound,
  OutcomeTopNav,
} from './OutcomeShell'
import { mapPriceOutcomeState, priceHeroLabel } from './mapPriceOutcomeState'
import { usePriceReportOutcome } from './usePriceReportOutcome'
import type { PriceOutcomeVariant } from './outcomeTypes'

function formatExpires(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

function buildTimeline(
  variant: PriceOutcomeVariant,
  report: {
    created_at?: string
    reviewed_at?: string | null
    incorporated_at?: string | null
    data?: { picked_up_at?: string | null } | null
  },
): OutcomeTimelineEvent[] {
  const submitted = report.created_at
  const pickedUp = report.data?.picked_up_at || null
  const decided = report.reviewed_at || report.incorporated_at || null
  const isPending = variant === 'pending' || variant === 'pending_in_review'
  const inReview = variant === 'pending_in_review' || Boolean(pickedUp) || !isPending

  let resolvedLabel = 'Resolved'
  switch (variant) {
    case 'approved_incorporated':
      resolvedLabel = 'Signal live'
      break
    case 'approved_signal_only':
      resolvedLabel = 'Weighted into pricing'
      break
    case 'rejected':
      resolvedLabel = 'Not published'
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
    { key: 'submitted', label: 'Submitted', timestamp: submitted, state: 'complete' },
    {
      key: 'in_review',
      label: 'In Platform Administrator review',
      timestamp: inReview && pickedUp ? pickedUp : inReview && !isPending ? decided || undefined : undefined,
      state: !inReview && isPending ? 'pending' : 'complete',
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
      timestamp: !isPending ? decided || undefined : undefined,
      state: isPending ? 'pending' : 'complete',
    },
  ]
}

/**
 * AGT-REC-003 — Agent price-report outcome (WF-06 Recipient).
 * Routes: `/reports/prices/:reportId/outcome`, legacy `/agent/pricing/reports/:id/outcome`.
 */
export function PriceReportOutcomePage() {
  usePageTitle('Price report status')
  const navigate = useNavigate()
  const params = useParams<{ reportId?: string; id?: string }>()
  const reportId = params.reportId || params.id
  const { report, loading, notFound, error, refetch } = usePriceReportOutcome(reportId)
  const [sheetOpen, setSheetOpen] = useState(false)

  const mapping = useMemo(
    () => (report ? mapPriceOutcomeState(report) : null),
    [report],
  )

  const title =
    report?.external_property_title ||
    report?.segment_label ||
    (report ? `Price report ${report.id}` : 'Price report')

  const marketSegment =
    report?.segment_label ||
    report?.external_property_location ||
    report?.property_type ||
    'your market segment'

  const heroTimestamp =
    report?.incorporated_at || report?.reviewed_at || report?.created_at

  const showWeighting =
    mapping?.variant === 'approved_incorporated' ||
    mapping?.variant === 'approved_signal_only'

  const resolverName =
    report?.data?.resolver?.display_name ||
    (report?.reviewed_by ? String(report.reviewed_by) : null)

  const ctas = useMemo(() => {
    if (!mapping || !report) return null
    const signalUrl =
      (typeof report.data?.live_signal_url === 'string' && report.data.live_signal_url) ||
      `/agent/pricing?highlight_signal_id=${encodeURIComponent(report.id)}`
    const profileUrl =
      (typeof report.data?.public_profile_url === 'string' && report.data.public_profile_url) ||
      '/public/agent/me'

    const primary: CtaAction = (() => {
      switch (mapping.variant) {
        case 'pending':
        case 'pending_in_review':
          return { key: 'awaiting', label: 'Awaiting reviewer', variant: 'default', disabled: true }
        case 'approved_incorporated':
          return { key: 'live', label: 'View live signal', variant: 'default', href: signalUrl }
        case 'approved_signal_only':
          return {
            key: 'how_used',
            label: "View how it's used",
            variant: 'default',
            href: `${signalUrl}${signalUrl.includes('?') ? '&' : '?'}weighted=true`,
          }
        case 'more_info':
          return {
            key: 'provide',
            label: 'Provide the requested info',
            variant: 'default',
            href: `/agent/pricing?resumeReportId=${encodeURIComponent(report.id)}&mode=more_info`,
          }
        case 'rejected':
          return {
            key: 'revise',
            label: 'Revise and resubmit',
            variant: 'default',
            href: `/agent/pricing?resumeReportId=${encodeURIComponent(report.id)}`,
          }
        case 'expired':
        case 'withdrawn':
        case 'superseded':
        default:
          return {
            key: 'fresh',
            label: 'Submit a fresh report',
            variant: 'default',
            href: `/agent/pricing?forReportId=${encodeURIComponent(report.id)}`,
          }
      }
    })()

    let secondary: CtaAction | undefined
    if (mapping.variant === 'approved_incorporated') {
      secondary = {
        key: 'profile',
        label: 'View on your public profile',
        variant: 'outline',
        href: profileUrl,
      }
    } else if (mapping.variant === 'approved_signal_only' || mapping.variant === 'more_info') {
      secondary = {
        key: 'original',
        label: 'View original submission',
        variant: 'outline',
        onClick: () => {
          document.getElementById('price-original-report')?.scrollIntoView({ behavior: 'smooth' })
        },
      }
    } else if (
      mapping.variant === 'rejected' ||
      mapping.variant === 'expired' ||
      mapping.variant === 'withdrawn'
    ) {
      secondary = {
        key: 'close',
        label: 'Close and continue',
        variant: 'outline',
        onClick: () => navigate('/agent/pricing'),
      }
    }

    let tertiary: CtaAction | undefined
    if (
      mapping.variant === 'pending' ||
      mapping.variant === 'pending_in_review' ||
      mapping.variant === 'more_info'
    ) {
      tertiary = {
        key: 'withdraw',
        label: 'Withdraw report',
        variant: 'ghost',
        confirm: {
          title: 'Withdraw your price report?',
          body: 'The reviewer will stop looking at this. You can submit a fresh report anytime. (Withdraw API not yet available — contact support if you need this closed now.)',
          confirm_label: 'Withdraw',
          cancel_label: 'Keep report open',
        },
        onClick: () => {
          // Thin gap: POST /api/users/me/price-reports/:id/withdraw not shipped.
        },
      }
    }

    return { primary, secondary, tertiary }
  }, [mapping, report, navigate])

  if (loading) {
    return (
      <div className="bg-[var(--lc-bg-page)]">
        <OutcomeTopNav title="Price report status" />
        <OutcomeLoadingSkeleton />
      </div>
    )
  }

  if (error && !report) {
    return (
      <div className="bg-[var(--lc-bg-page)]">
        <OutcomeTopNav title="Price report status" />
        <OutcomeNetworkError onRetry={() => void refetch()} />
      </div>
    )
  }

  if (notFound || !report || !mapping || !ctas) {
    return (
      <div className="bg-[var(--lc-bg-page)]">
        <OutcomeTopNav title="Price report status" />
        <OutcomeNotFound />
      </div>
    )
  }

  const showResolver =
    mapping.variant !== 'pending' &&
    mapping.variant !== 'pending_in_review' &&
    Boolean(report.reviewed_at || report.review_notes || report.reason_code)

  const priceBands = [
    report.recommendation_price_low != null
      ? { label: 'Low', value: Number(report.recommendation_price_low), currency: report.currency }
      : null,
    report.recommendation_price_point != null
      ? { label: 'Point', value: Number(report.recommendation_price_point), currency: report.currency }
      : null,
    report.recommendation_price_high != null
      ? { label: 'High', value: Number(report.recommendation_price_high), currency: report.currency }
      : null,
    report.sold_price != null
      ? { label: 'Sold price', value: Number(report.sold_price), currency: report.currency }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: number; currency?: string }>

  return (
    <div className="min-h-screen bg-[var(--lc-bg-page)] pb-28 md:pb-[var(--lc-space-3xl)]">
      <OutcomeTopNav title="Price report status" />
      <div aria-live="polite" className="sr-only">
        Price report status: {priceHeroLabel(mapping.variant)}
      </div>

      <StatusHero
        state={mapping.heroState}
        emphasis={mapping.emphasis}
        label={priceHeroLabel(mapping.variant)}
        timestamp={heroTimestamp}
      />

      <div className="mx-auto grid max-w-[1200px] gap-[var(--lc-space-lg)] px-[var(--lc-space-md)] py-[var(--lc-space-md)] lg:grid-cols-[65%_35%]">
        <div className="min-w-0 space-y-[var(--lc-space-lg)]">
          <ReportIdentityCard
            title={title}
            marketSnippet={marketSegment}
            submittedAt={report.created_at}
            onOpenDetails={() => setSheetOpen(true)}
          />

          {sheetOpen ? (
            <div
              role="dialog"
              aria-label="Price report details"
              className="rounded-lg border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-md)] shadow-sm"
            >
              <p style={{ font: 'var(--lc-type-body-sm)' }} className="text-[var(--lc-text-muted)]">
                Report ID
              </p>
              <Numeric dir="ltr">{report.id}</Numeric>
              {report.notes ? (
                <p className="mt-[var(--lc-space-sm)] whitespace-pre-wrap" style={{ font: 'var(--lc-type-body)' }}>
                  {report.notes}
                </p>
              ) : null}
              <button
                type="button"
                className="mt-[var(--lc-space-sm)] text-[var(--lc-text-brand)]"
                style={{ font: 'var(--lc-type-body-sm)' }}
                onClick={() => setSheetOpen(false)}
              >
                Close
              </button>
            </div>
          ) : null}

          <OutcomeTimeline events={buildTimeline(mapping.variant, report)} />

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
                  avatar_url: report.data?.resolver?.avatar_url || undefined,
                }}
                decided_at={
                  report.reviewed_at ||
                  report.incorporated_at ||
                  report.created_at ||
                  new Date().toISOString()
                }
                message={
                  report.review_notes ||
                  (report.reason_code ? `Reviewer noted: ${report.reason_code}` : null) ||
                  report.notes ||
                  null
                }
              />
            </div>
          ) : null}

          {showWeighting && mapping.weight != null ? (
            <WeightingPanel
              weight={mapping.weight}
              mode={mapping.variant === 'approved_incorporated' ? 'incorporated' : 'signal_only'}
              marketSegmentLabel={marketSegment}
              effectiveOn={report.incorporated_at}
            />
          ) : null}

          {(mapping.variant === 'pending' || mapping.variant === 'pending_in_review') ? (
            <div
              className="rounded-lg bg-[var(--lc-surface-sunken)] p-[var(--lc-space-md)]"
              style={{ font: 'var(--lc-type-body-sm)' }}
            >
              <p className="text-[var(--lc-text-primary)]">
                Typical PA review: <strong>72 hours</strong>
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

          {mapping.variant === 'rejected' ? (
            <p className="text-[var(--lc-text-primary)]" style={{ font: 'var(--lc-type-body)' }}>
              You can revise the methodology or add supporting data and submit a fresh report. Your
              original is preserved in your history.
            </p>
          ) : null}

          {mapping.variant === 'more_info' ? (
            <p className="text-[var(--lc-text-primary)]" style={{ font: 'var(--lc-type-body)' }}>
              The reviewer flagged:{' '}
              <strong>
                {String(report.data?.more_info_summary || report.review_notes || 'additional information needed')}
              </strong>
              . Add it and we&apos;ll re-open the review.
            </p>
          ) : null}

          {mapping.variant === 'expired' ? (
            <p className="text-[var(--lc-text-primary)]" style={{ font: 'var(--lc-type-body)' }}>
              This report timed out after 30 days without a decision. You can submit a fresh report;
              your original is preserved in your history.
            </p>
          ) : null}

          {mapping.variant === 'withdrawn' ? (
            <p className="text-[var(--lc-text-primary)]" style={{ font: 'var(--lc-type-body)' }}>
              You withdrew this report
              {report.data?.withdrawn_at ? (
                <>
                  {' '}
                  on <Numeric as="strong">{formatExpires(String(report.data.withdrawn_at))}</Numeric>
                </>
              ) : null}
              . You can submit a fresh report anytime.
            </p>
          ) : null}

          {mapping.variant === 'superseded' && report.superseded_by_report_id ? (
            <p style={{ font: 'var(--lc-type-body-sm)' }}>
              <Link
                to={`/reports/prices/${report.superseded_by_report_id}/outcome`}
                className="text-[var(--lc-text-brand)] underline-offset-2 hover:underline"
              >
                Open the active report
              </Link>
            </p>
          ) : null}

          <div id="price-original-report">
            <OriginalReportAccordion
              reportId={report.id}
              headerLabel="What you originally submitted"
              body={{
                marketSegmentLabel: marketSegment,
                methodologyNotes:
                  (typeof report.data?.methodology_notes === 'string' && report.data.methodology_notes) ||
                  report.notes,
                priceBands,
                evidence:
                  report.data?.attachments ||
                  report.data?.evidence_files ||
                  (report.supporting_document_url
                    ? [{ kind: 'document', url: report.supporting_document_url }]
                    : []),
              }}
            />
          </div>

          <ContactSupportLink context={`Price report ID: ${report.id}`} />
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
              {report.reviewed_at ? (
                <p className="mt-1">
                  Decided: <Numeric dir="ltr">{report.reviewed_at}</Numeric>
                </p>
              ) : null}
              {report.incorporated_at ? (
                <p className="mt-1">
                  Effective: <Numeric dir="ltr">{report.incorporated_at}</Numeric>
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
