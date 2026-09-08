import { useId, useState } from 'react'
import {
  ChevronDown,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Numeric } from '@/components/ui/numeric'
import { Button } from '@/components/ui/button'
import {
  PortalStatusPill,
  type PortalStatus,
} from '@/components/ui/portal-status-pill'
import { OutcomeTimeline, type OutcomeTimelineEvent } from '@/components/recipient'
import { ResolverMessage } from '@/components/recipient'
import {
  ERROR_CLASS_FIX_COPY,
  ERROR_CLASS_HELPER,
  ERROR_CLASS_ICON,
  ERROR_CLASS_LABEL,
  ERROR_CLASS_SECONDARY_FIX,
  type PortalErrorClass,
} from './failureClasses'

/**
 * Minimal timeline node shape for accordion expand.
 * Compatible with REC-family `OutcomeTimelineEvent`.
 */
export type PortalReceiptTimelineEvent = OutcomeTimelineEvent

export type PortalReceiptDestination = {
  portal_code: string
  portal_display_name: string
  portal_logo_url?: string
  country_code?: string
  all_country_codes?: string[]
}

/**
 * Per-destination receipt row for a publish job.
 *
 * Used by: AGT-PUB-003 (publish outcome receipt), AGT-PUB-006 (row → detail).
 *
 * Visual invariants (AGT-PUB-003):
 * - Raised surface + elevation-sm + radius-lg
 * - 4px start-edge rail stripe by status (published / underOffer / closed)
 * - Status never colour-alone — always pill glyph + label
 * - Failed cards surface the 6 error-class labels, not a generic "failed"
 */
export type PortalReceiptCardProps = {
  destination: PortalReceiptDestination
  status: 'succeeded' | 'in_review' | 'failed'
  /** Required when `status === 'failed'`. */
  error_class?: PortalErrorClass
  portal_message?: string | null
  credit_charged: number
  credit_reserved: number
  /** ISO 8601 — published_at / submitted_at / failed_at. */
  timestamp: string
  live_url?: string
  retry_available?: boolean
  fix_deep_link?: string
  /** Secondary fix link (e.g. Upgrade plan for QUOTA_EXCEEDED). */
  secondary_fix_deep_link?: string
  moderation_queue_deep_link?: string
  timeline_events?: PortalReceiptTimelineEvent[]
  /** Shown on UNKNOWN_ERROR for support handoff. */
  correlation_id?: string | null
  className?: string
  /** Retry POST in flight — pill shows Loader2 + "Retrying…". */
  retrying?: boolean
  /** Actions disabled when offline or parent-busy. */
  actionsDisabled?: boolean
  /** Stub action hooks — parent wires business logic in consumer waves. */
  onRetry?: () => void
  onContactSupport?: () => void
}

export type { PortalErrorClass }

const RAIL_CLASS: Record<PortalReceiptCardProps['status'], string> = {
  succeeded: 'border-s-4 border-s-[var(--lc-status-published-fg)]',
  in_review: 'border-s-4 border-s-[var(--lc-status-underOffer-fg)]',
  failed: 'border-s-4 border-s-[var(--lc-status-closed-fg)]',
}

function receiptStatusToPill(status: PortalReceiptCardProps['status']): PortalStatus {
  if (status === 'succeeded') return 'live'
  if (status === 'in_review') return 'in_review'
  return 'failed'
}

function formatTimestampStub(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function monogram(code: string): string {
  return code.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || '??'
}

/**
 * Atomic per-portal / per-channel receipt card.
 */
export function PortalReceiptCard({
  destination,
  status,
  error_class,
  portal_message,
  credit_charged,
  credit_reserved: _credit_reserved,
  timestamp,
  live_url,
  retry_available,
  fix_deep_link,
  secondary_fix_deep_link,
  moderation_queue_deep_link,
  timeline_events,
  correlation_id,
  className,
  retrying = false,
  actionsDisabled = false,
  onRetry,
  onContactSupport,
}: PortalReceiptCardProps) {
  const reactId = useId()
  const titleId = `portal-card-${destination.portal_code}-${reactId}`
  const [expanded, setExpanded] = useState(false)

  const pillStatus = receiptStatusToPill(status)
  const pillLabel = retrying
    ? 'Retrying…'
    : status === 'failed' && error_class
      ? ERROR_CLASS_LABEL[error_class]
      : status === 'succeeded'
        ? 'Live'
        : status === 'in_review'
          ? 'In review'
          : 'Delivery failed'
  const countries = destination.all_country_codes ?? []
  const extraCountries = Math.max(0, countries.length - 1)
  const creditLine =
    credit_charged > 0
      ? `${credit_charged} credit${credit_charged === 1 ? '' : 's'} charged`
      : '0 credits · reservation released'

  const busy = retrying || actionsDisabled
  const showResolver =
    status === 'failed' &&
    (error_class === 'INVALID_CONTENT' ||
      error_class === 'PORTAL_RULES_VIOLATION' ||
      Boolean(portal_message))

  const secondaryQuota =
    error_class === 'QUOTA_EXCEEDED'
      ? ERROR_CLASS_SECONDARY_FIX.QUOTA_EXCEEDED
      : undefined
  const secondaryHref =
    secondary_fix_deep_link ||
    (secondaryQuota ? secondaryQuota.hrefSuffix : undefined)

  return (
    <article
      aria-labelledby={titleId}
      aria-busy={retrying || undefined}
      className={cn(
        'bg-[var(--lc-surface-raised)] text-[var(--lc-text-primary)]',
        'rounded-[var(--lc-radius-lg)] p-[var(--lc-space-md)]',
        'shadow-[var(--lc-elevation-sm)]',
        'transition-colors duration-fast ease-out motion-reduce:transition-none',
        RAIL_CLASS[status],
        className,
      )}
    >
      <div className="flex items-start gap-[var(--lc-space-sm)]">
        {destination.portal_logo_url ? (
          <img
            src={destination.portal_logo_url}
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 shrink-0 rounded-[var(--lc-radius-md)] object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className={cn(
              'inline-flex h-8 w-8 shrink-0 items-center justify-center',
              'rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)]',
              'text-[var(--lc-text-muted)]',
            )}
            style={{ font: 'var(--lc-type-overline)' }}
          >
            {monogram(destination.portal_code)}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-[var(--lc-space-xs)]">
            <h3
              id={titleId}
              className="text-[var(--lc-text-heading)]"
              style={{
                font: 'var(--lc-type-heading-3)',
                letterSpacing: 'var(--lc-tracking-heading-3)',
              }}
            >
              {destination.portal_display_name}
            </h3>
            {destination.country_code ? (
              <span
                className={cn(
                  'inline-flex items-center rounded-[var(--lc-radius-pill)]',
                  'border border-[var(--lc-border)] px-2 py-0.5',
                  'text-[var(--lc-text-secondary)]',
                )}
                style={{ font: 'var(--lc-type-caption)' }}
                aria-label={destination.country_code}
              >
                {destination.country_code}
              </span>
            ) : null}
            {extraCountries > 0 ? (
              <span
                className={cn(
                  'inline-flex items-center rounded-[var(--lc-radius-pill)]',
                  'border border-[var(--lc-border)] px-2 py-0.5',
                  'text-[var(--lc-text-secondary)]',
                )}
                style={{ font: 'var(--lc-type-caption)' }}
                title={countries.slice(1).join(', ')}
              >
                +{extraCountries} more
              </span>
            ) : null}
          </div>

          <div className="mt-[var(--lc-space-xs)] flex flex-wrap items-center gap-[var(--lc-space-sm)]">
            <span aria-label={`${destination.portal_display_name} status: ${pillLabel}`}>
              {retrying ? (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-[var(--lc-radius-pill)] px-2.5 py-0.5',
                    'text-xs font-semibold',
                    'bg-[var(--lc-surface-sunken)] text-[var(--lc-text-secondary)]',
                  )}
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  <span>Retrying…</span>
                </span>
              ) : (
                <PortalStatusPill
                  status={pillStatus}
                  label={pillLabel}
                  pulse={status === 'in_review'}
                />
              )}
            </span>
            <Numeric
              className={cn(
                credit_charged > 0
                  ? 'text-[var(--lc-text-primary)]'
                  : 'text-[var(--lc-text-muted)]',
              )}
              style={{ font: 'var(--lc-type-data-sm)' }}
            >
              {creditLine}
            </Numeric>
          </div>

          <Numeric
            className="mt-[var(--lc-space-2xs)] block text-[var(--lc-text-muted)]"
            style={{ font: 'var(--lc-type-caption)' }}
          >
            {formatTimestampStub(timestamp)}
          </Numeric>

          {error_class && ERROR_CLASS_HELPER[error_class] ? (
            <p
              className="mt-[var(--lc-space-2xs)] text-[var(--lc-text-muted)]"
              style={{ font: 'var(--lc-type-caption)' }}
            >
              {ERROR_CLASS_HELPER[error_class]}
            </p>
          ) : null}

          {error_class === 'UNKNOWN_ERROR' && correlation_id ? (
            <Numeric
              className="mt-[var(--lc-space-2xs)] block text-[var(--lc-text-muted)]"
              style={{ font: 'var(--lc-type-caption)' }}
            >
              Correlation {correlation_id}
            </Numeric>
          ) : null}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-expanded={expanded}
          aria-label={expanded ? 'Hide submission timeline' : 'Show submission timeline'}
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0"
        >
          <ChevronDown
            className={cn(
              'h-4 w-4 transition-transform duration-fast ease-out motion-reduce:transition-none',
              expanded && 'rotate-180',
            )}
          />
        </Button>
      </div>

      <div className="mt-[var(--lc-space-sm)] flex flex-wrap gap-[var(--lc-space-xs)]">
        {status === 'succeeded' && live_url ? (
          <Button variant="outline" size="sm" asChild disabled={busy}>
            <a href={live_url} target="_blank" rel="noopener noreferrer">
              View live listing
              <ExternalLink className="ms-1 h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">(opens in new tab)</span>
            </a>
          </Button>
        ) : null}
        {(status === 'succeeded' || status === 'in_review') &&
        moderation_queue_deep_link ? (
          <Button
            variant={status === 'in_review' ? 'outline' : 'ghost'}
            size="sm"
            asChild
            disabled={busy}
          >
            <a href={moderation_queue_deep_link}>View in queue</a>
          </Button>
        ) : null}
        {status === 'failed' &&
        fix_deep_link &&
        error_class &&
        ERROR_CLASS_FIX_COPY[error_class] ? (
          <Button variant="outline" size="sm" asChild disabled={busy}>
            <a href={fix_deep_link}>{ERROR_CLASS_FIX_COPY[error_class]}</a>
          </Button>
        ) : null}
        {status === 'failed' && secondaryQuota && secondaryHref ? (
          <Button variant="ghost" size="sm" asChild disabled={busy}>
            <a href={secondaryHref}>{secondaryQuota.label}</a>
          </Button>
        ) : null}
        {status === 'failed' && retry_available ? (
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={onRetry}
            disabled={busy}
            aria-busy={retrying || undefined}
          >
            {retrying ? (
              <>
                <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                Retrying…
              </>
            ) : (
              'Retry'
            )}
          </Button>
        ) : null}
        {status === 'failed' && error_class === 'UNKNOWN_ERROR' ? (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={onContactSupport}
            disabled={busy}
          >
            Contact support
          </Button>
        ) : null}
      </div>

      {expanded ? (
        <div
          className={cn(
            'mt-[var(--lc-space-md)] border-t border-[var(--lc-border)] pt-[var(--lc-space-md)]',
            'transition-[height,opacity] duration-base ease-out motion-reduce:transition-none',
          )}
        >
          {error_class ? (
            <p
              className="mb-[var(--lc-space-sm)] flex items-center gap-2 text-[var(--lc-text-muted)]"
              style={{ font: 'var(--lc-type-body-sm)' }}
            >
              {(() => {
                const Icon = ERROR_CLASS_ICON[error_class]
                return <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              })()}
              <span>{ERROR_CLASS_LABEL[error_class]}</span>
            </p>
          ) : null}

          {showResolver ? (
            <div className="mb-[var(--lc-space-md)]">
              <ResolverMessage
                resolver={{
                  display_name: destination.portal_display_name,
                  role_label: 'Portal moderator',
                }}
                decided_at={timestamp}
                message={portal_message?.trim() || null}
                empty_state_copy="Portal didn't provide a message."
              />
            </div>
          ) : (
            <p
              className="mb-[var(--lc-space-md)] text-[var(--lc-text-secondary)]"
              style={{ font: 'var(--lc-type-body-sm)' }}
            >
              {portal_message?.trim() || "Portal didn't provide a message."}
            </p>
          )}

          {timeline_events && timeline_events.length > 0 ? (
            <OutcomeTimeline events={timeline_events} />
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
