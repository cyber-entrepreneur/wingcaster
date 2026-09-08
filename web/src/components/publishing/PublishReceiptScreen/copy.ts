import type { AggregateOutcome } from '@/components/portals'
import type { CtaAction } from '@/components/recipient'
import { BULK_RETRYABLE_ERROR_CLASSES, isBulkRetryable } from '@/components/portals'
import type { PublishingDestination, PublishingJobSummary } from '@/api/client'

export const RECEIPT_COPY = {
  navTitle: 'Publish receipt',
  groupNeedsAttention: (n: number) => `Needs your attention (${n})`,
  groupAwaiting: (n: number) => `Awaiting portal moderation (${n})`,
  groupLive: (n: number) => `Live now (${n})`,
  contactSupport: 'Something not right? Contact WingCaster support',
  jobCopied: 'Job ID copied',
  publishUpdated: 'Publish updated',
  publishComplete: 'Publish complete.',
  offlineBanner: "You're offline — some actions won't work.",
  notFound: "This publish receipt doesn't exist or isn't yours.",
  networkError: 'Check your connection.',
  backToListings: 'Go back to listings',
  retry: 'Retry',
  retryAllHelper:
    'AUTH, quota, rules, and content issues need to be fixed first.',
  outOfCredits: "You're out of credits",
  contextHelper: {
    all_succeeded:
      'Your listing is live on every destination you selected. Credits were charged only for successful publishes.',
    mixed:
      "Failed publishes weren't charged — reserved credits were released. Retry when the underlying issue is resolved. In-review submissions typically get a decision within 24 hours; you'll get a push notification.",
    all_failed:
      'None of your destinations went live. Fix the issues below, then retry the transient failures.',
    in_review_only:
      'Portals are reviewing your submissions. You can track progress in the submission queue.',
    partial:
      'Some destinations are live; others are still in portal moderation. Reserved credits for pending destinations stay held until a decision.',
  } as Record<AggregateOutcome, string>,
} as const

export function buildCtas(opts: {
  aggregate: AggregateOutcome
  listingId: string | null
  destinations: PublishingDestination[]
  retryAllLoading?: boolean
  offline?: boolean
  onRetryAll?: () => void
  onContactSupport?: () => void
}): { primary: CtaAction; secondary: CtaAction; tertiary?: CtaAction } {
  const { aggregate, listingId, destinations, retryAllLoading, offline, onRetryAll, onContactSupport } =
    opts
  const listingsHref = listingId ? `/listings/${listingId}` : '/listings'
  const publishAnother: CtaAction = {
    key: 'publish-another',
    label: 'Publish another',
    variant: 'outline',
    href: '/listings',
  }

  const bulkTargets = destinations.filter(
    (d) => d.status === 'failed' && isBulkRetryable(d.error_class),
  )
  const allQuota =
    destinations.length > 0 &&
    destinations.every((d) => d.status === 'failed' && d.error_class === 'QUOTA_EXCEEDED')

  if (allQuota) {
    return {
      primary: {
        key: 'top-up',
        label: 'Top up credits',
        variant: 'default',
        href: '/my-credits',
        disabled: offline,
      },
      secondary: publishAnother,
      tertiary: {
        key: 'support',
        label: 'Contact WingCaster support',
        variant: 'ghost',
        onClick: onContactSupport,
      },
    }
  }

  if (aggregate === 'all_failed') {
    return {
      primary: {
        key: 'retry-all',
        label: retryAllLoading ? 'Retrying…' : 'Retry all fixable',
        variant: 'default',
        onClick: onRetryAll,
        loading: retryAllLoading,
        disabled: offline || bulkTargets.length === 0 || retryAllLoading,
        confirm:
          bulkTargets.length > 5
            ? {
                title: `Retry ${bulkTargets.length} publishes?`,
                body: 'Retries cost credits.',
                confirm_label: 'Retry',
                cancel_label: 'Cancel',
              }
            : undefined,
      },
      secondary: publishAnother,
      tertiary: {
        key: 'support',
        label: 'Contact WingCaster support',
        variant: 'ghost',
        onClick: onContactSupport,
      },
    }
  }

  if (aggregate === 'in_review_only') {
    return {
      primary: {
        key: 'view-queue',
        label: 'View submission queue',
        variant: 'default',
        href: listingId ? `/listings/${listingId}/submissions` : '/publish/tracker',
      },
      secondary: publishAnother,
    }
  }

  const tertiary =
    aggregate === 'mixed' && bulkTargets.length > 0
      ? ({
          key: 'retry-all',
          label: retryAllLoading ? 'Retrying…' : 'Retry all fixable',
          variant: 'ghost' as const,
          onClick: onRetryAll,
          loading: retryAllLoading,
          disabled: offline || retryAllLoading,
          confirm:
            bulkTargets.length > 5
              ? {
                  title: `Retry ${bulkTargets.length} publishes?`,
                  body: 'Retries cost credits.',
                  confirm_label: 'Retry',
                  cancel_label: 'Cancel',
                }
              : undefined,
        } satisfies CtaAction)
      : undefined

  return {
    primary: {
      key: 'view-listings',
      label: 'View my listings',
      variant: 'default',
      href: listingsHref,
    },
    secondary: publishAnother,
    tertiary,
  }
}

export function supportHref(job: PublishingJobSummary, destinations: PublishingDestination[]): string {
  const failed = destinations
    .filter((d) => d.status === 'failed')
    .map((d) => `${d.portal.display_name || d.portal.code || d.id}:${d.error_class || 'UNKNOWN'}`)
    .join(',')
  const params = new URLSearchParams({
    jobId: job.id,
    aggregate: job.aggregate,
    failed,
  })
  return `/support?${params.toString()}`
}

export { BULK_RETRYABLE_ERROR_CLASSES }
