import { AggregateOutcomeHero } from '@/components/portals'
import { CreditsSummary } from '@/components/portals'
import { PortalReceiptCard } from '@/components/portals'
import {
  defaultFixDeepLink,
  isPortalErrorClass,
  type PortalErrorClass,
} from '@/components/portals'
import { PrimaryCtaPerState } from '@/components/recipient'
import { Numeric } from '@/components/ui/numeric'
import { Button } from '@/components/ui/button'
import { OfflineBanner } from '@/components/onboarding'
import { cn } from '@/lib/utils'
import { Copy, AlertOctagon } from 'lucide-react'
import type { PublishingDestination, PublishingJobPayload } from '@/api/client'
import { RECEIPT_COPY, buildCtas, supportHref } from './copy'
import { mapDestinationTimeline } from './mapTimeline'

export type PublishReceiptScreenProps = {
  payload: PublishingJobPayload
  offline?: boolean
  retryingIds?: Set<string>
  retryAllLoading?: boolean
  liveAnnouncement?: string
  onCopyJobId?: () => void
  onRetryDestination?: (destinationId: string) => void
  onRetryAll?: () => void
  onContactSupport?: () => void
}

function groupDestinations(destinations: PublishingDestination[]) {
  const failed = destinations.filter((d) => d.status === 'failed')
  const inReview = destinations.filter((d) => d.status === 'in_review')
  const succeeded = destinations.filter((d) => d.status === 'succeeded')
  return { failed, inReview, succeeded }
}

function shortJobId(id: string): string {
  return id.replace(/^job_/, '').slice(0, 8)
}

function DestinationGroup({
  title,
  destinations,
  listingId,
  offline,
  retryingIds,
  onRetryDestination,
  onContactSupport,
}: {
  title: string
  destinations: PublishingDestination[]
  listingId: string | null
  offline?: boolean
  retryingIds?: Set<string>
  onRetryDestination?: (id: string) => void
  onContactSupport?: () => void
}) {
  if (destinations.length === 0) return null
  return (
    <section className="space-y-[var(--lc-space-sm)]">
      <h2
        className="text-[var(--lc-text-muted)]"
        style={{ font: 'var(--lc-type-overline)', letterSpacing: 'var(--lc-tracking-overline)' }}
      >
        {title}
      </h2>
      <ul className="flex list-none flex-col gap-[var(--lc-space-sm)] p-0">
        {destinations.map((dest) => {
          const errorClass: PortalErrorClass | undefined = isPortalErrorClass(dest.error_class)
            ? dest.error_class
            : undefined
          const fix =
            dest.fix_deep_link ||
            (errorClass
              ? defaultFixDeepLink(errorClass, {
                  listingId,
                  portalCode: dest.portal.code,
                })
              : null)
          return (
            <li key={dest.id}>
              <PortalReceiptCard
                destination={{
                  portal_code: dest.portal.code || dest.id,
                  portal_display_name:
                    dest.portal.display_name || dest.portal.code || 'Portal',
                  portal_logo_url: dest.portal.logo_url || undefined,
                  country_code: dest.portal.country_code || undefined,
                  all_country_codes: dest.portal.all_country_codes || undefined,
                }}
                status={dest.status}
                error_class={errorClass}
                portal_message={dest.portal_message}
                credit_charged={dest.credit_charged}
                credit_reserved={dest.credit_reserved}
                timestamp={dest.event_at || new Date().toISOString()}
                live_url={dest.live_url || undefined}
                retry_available={dest.retry_available}
                fix_deep_link={fix || undefined}
                moderation_queue_deep_link={dest.moderation_queue_deep_link || undefined}
                timeline_events={mapDestinationTimeline(dest.timeline, {
                  status: dest.status,
                  eventAt: dest.event_at,
                })}
                correlation_id={dest.correlation_id}
                retrying={retryingIds?.has(dest.id)}
                actionsDisabled={offline}
                onRetry={() => onRetryDestination?.(dest.id)}
                onContactSupport={onContactSupport}
              />
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/**
 * Receipt composition for AGT-PUB-003 — hero → credits → destination groups → CTAs.
 */
export function PublishReceiptScreen({
  payload,
  offline = false,
  retryingIds,
  retryAllLoading = false,
  liveAnnouncement = '',
  onCopyJobId,
  onRetryDestination,
  onRetryAll,
  onContactSupport,
}: PublishReceiptScreenProps) {
  const { job, destinations } = payload
  const groups = groupDestinations(destinations)
  const groupCount =
    (groups.failed.length > 0 ? 1 : 0) +
    (groups.inReview.length > 0 ? 1 : 0) +
    (groups.succeeded.length > 0 ? 1 : 0)

  const ctas = buildCtas({
    aggregate: job.aggregate,
    listingId: job.listing_id,
    destinations,
    retryAllLoading,
    offline,
    onRetryAll,
    onContactSupport,
  })

  const supportLink = supportHref(job, destinations)
  const publishedAt = job.completed_at || job.submitted_at || new Date().toISOString()

  return (
    <div className="flex min-h-full flex-col bg-[var(--lc-bg-page)] text-[var(--lc-text-primary)]">
      <OfflineBanner show={offline} message={RECEIPT_COPY.offlineBanner} />

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>

      <AggregateOutcomeHero
        aggregate={job.aggregate}
        counts={{
          succeeded: job.counts.succeeded,
          in_review: job.counts.in_review,
          failed: job.counts.failed,
        }}
        total_destinations={job.counts.total}
        published_at={publishedAt}
        listing_title={job.listing_short_ref || undefined}
      />

      <div className="mx-auto w-full max-w-[1200px] px-[var(--lc-space-md)] pb-[calc(var(--lc-space-5xl)+env(safe-area-inset-bottom,0px))] pt-[var(--lc-space-md)] lg:pb-[var(--lc-space-3xl)]">
        <div className="flex flex-col gap-[var(--lc-space-lg)] lg:grid lg:grid-cols-[65%_35%] lg:items-start lg:gap-[var(--lc-space-xl)]">
          <div className="min-w-0 space-y-[var(--lc-space-lg)]">
            <div
              className="flex flex-wrap items-center gap-[var(--lc-space-xs)] text-[var(--lc-text-muted)]"
              style={{ font: 'var(--lc-type-body-sm)' }}
            >
              <span>
                Job{' '}
                <Numeric className="inline">{shortJobId(job.id)}</Numeric>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                <Numeric className="inline">{job.counts.total}</Numeric> destinations
              </span>
              <span aria-hidden="true">·</span>
              <span>1 listing</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-tap"
                aria-label={`Copy job ID ${job.id}`}
                onClick={onCopyJobId}
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Copy</span>
              </Button>
            </div>

            <CreditsSummary
              total_charged={job.credits.total_charged}
              total_reserved={job.credits.total_reserved}
              credits_history_deep_link={`/my-credits?job=${encodeURIComponent(job.id)}`}
              variant="horizontal"
            />

            <div className="space-y-[var(--lc-space-xl)]">
              <DestinationGroup
                title={RECEIPT_COPY.groupNeedsAttention(groups.failed.length)}
                destinations={groups.failed}
                listingId={job.listing_id}
                offline={offline}
                retryingIds={retryingIds}
                onRetryDestination={onRetryDestination}
                onContactSupport={onContactSupport}
              />
              <DestinationGroup
                title={RECEIPT_COPY.groupAwaiting(groups.inReview.length)}
                destinations={groups.inReview}
                listingId={job.listing_id}
                offline={offline}
                retryingIds={retryingIds}
                onRetryDestination={onRetryDestination}
                onContactSupport={onContactSupport}
              />
              <DestinationGroup
                title={RECEIPT_COPY.groupLive(groups.succeeded.length)}
                destinations={groups.succeeded}
                listingId={job.listing_id}
                offline={offline}
                retryingIds={retryingIds}
                onRetryDestination={onRetryDestination}
                onContactSupport={onContactSupport}
              />
              {groupCount === 0 ? (
                <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body)' }}>
                  No destinations on this job.
                </p>
              ) : null}
            </div>
          </div>

          <aside
            className={cn(
              'hidden space-y-[var(--lc-space-md)] lg:sticky lg:top-[var(--lc-space-3xl)] lg:block',
            )}
          >
            <PrimaryCtaPerState
              layout="stacked"
              primary={ctas.primary}
              secondary={ctas.secondary}
              tertiary={ctas.tertiary}
            />
            {job.aggregate === 'all_failed' ||
            (job.aggregate === 'mixed' && ctas.tertiary?.key === 'retry-all') ? (
              <p
                className="text-[var(--lc-text-muted)]"
                style={{ font: 'var(--lc-type-caption)' }}
              >
                {RECEIPT_COPY.retryAllHelper}
              </p>
            ) : null}
            <div
              className={cn(
                'rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)] p-[var(--lc-space-md)]',
              )}
            >
              <p style={{ font: 'var(--lc-type-body-sm)' }}>
                {RECEIPT_COPY.contextHelper[job.aggregate]}
              </p>
            </div>
            <dl
              className="space-y-[var(--lc-space-2xs)] text-[var(--lc-text-muted)]"
              style={{ font: 'var(--lc-type-caption)' }}
            >
              <div>
                <dt className="inline">Job ID </dt>
                <dd className="inline">
                  <Numeric>{job.id}</Numeric>
                </dd>
              </div>
              {job.submitted_at ? (
                <div>
                  <dt className="inline">Submitted </dt>
                  <dd className="inline">
                    <Numeric>{job.submitted_at}</Numeric>
                  </dd>
                </div>
              ) : null}
              {job.completed_at ? (
                <div>
                  <dt className="inline">Completed </dt>
                  <dd className="inline">
                    <Numeric>{job.completed_at}</Numeric>
                  </dd>
                </div>
              ) : null}
              {job.listing_id ? (
                <div>
                  <dt className="inline">Listing </dt>
                  <dd className="inline">
                    <a
                      href={`/listings/${job.listing_id}`}
                      className="text-[var(--lc-text-brand)] underline-offset-2 hover:underline"
                    >
                      {job.listing_short_ref || job.listing_id}
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
          </aside>
        </div>

        {/* Mobile sticky CTA */}
        <div
          className={cn(
            'fixed inset-x-0 bottom-0 z-20 border-t border-[var(--lc-border)]',
            'bg-[var(--lc-surface-raised)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)]',
            'shadow-[var(--lc-elevation-md)]',
            'pb-[max(var(--lc-space-sm),env(safe-area-inset-bottom,0px))]',
            'lg:hidden',
          )}
        >
          <PrimaryCtaPerState
            layout="stacked"
            primary={ctas.primary}
            secondary={ctas.secondary}
            tertiary={ctas.tertiary}
          />
        </div>

        <div className="mt-[var(--lc-space-xl)] text-center lg:mt-[var(--lc-space-2xl)]">
          <a
            href={supportLink}
            className="inline-flex min-h-tap items-center text-[var(--lc-text-brand)] underline-offset-4 hover:underline"
            style={{ font: 'var(--lc-type-body-sm)' }}
            onClick={(e) => {
              if (onContactSupport) {
                e.preventDefault()
                onContactSupport()
              }
            }}
          >
            {RECEIPT_COPY.contactSupport}
          </a>
        </div>
      </div>
    </div>
  )
}

export function PublishReceiptSkeleton() {
  return (
    <div
      className="flex min-h-full flex-col bg-[var(--lc-bg-page)]"
      aria-busy="true"
      aria-label="Loading publish receipt"
    >
      <div className="h-[200px] w-full animate-pulse bg-[var(--lc-surface-sunken)]" />
      <div className="mx-auto w-full max-w-[1200px] space-y-[var(--lc-space-md)] px-[var(--lc-space-md)] py-[var(--lc-space-lg)]">
        <div className="h-4 w-2/3 animate-pulse rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)]" />
        <div className="h-28 animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]" />
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-raised)] shadow-[var(--lc-elevation-sm)]"
          />
        ))}
        <div className="h-12 animate-pulse rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)]" />
      </div>
    </div>
  )
}

export function PublishReceiptFallback({
  kind,
  onRetry,
}: {
  kind: 'not_found' | 'network'
  onRetry?: () => void
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-[var(--lc-space-md)] bg-[var(--lc-bg-page)] px-[var(--lc-space-md)] text-center">
      <AlertOctagon
        className="h-10 w-10 text-[var(--lc-status-closed-fg)]"
        aria-hidden="true"
      />
      <p
        className="max-w-md text-[var(--lc-text-primary)]"
        style={{ font: 'var(--lc-type-heading-2)' }}
      >
        {kind === 'not_found' ? RECEIPT_COPY.notFound : RECEIPT_COPY.networkError}
      </p>
      {kind === 'not_found' ? (
        <Button asChild variant="default">
          <a href="/listings">{RECEIPT_COPY.backToListings}</a>
        </Button>
      ) : (
        <Button type="button" variant="default" onClick={onRetry}>
          {RECEIPT_COPY.retry}
        </Button>
      )}
    </div>
  )
}
