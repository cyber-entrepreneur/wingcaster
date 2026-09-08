/**
 * Portal / channel Broadcast primitives (AGT-PUB + PA-POR family).
 *
 * Source briefs:
 * - docs/design/briefs/AGT-PUB-006-portal-tracker-brief.md
 * - docs/design/briefs/AGT-PUB-003-publish-outcome-receipt-brief.md
 * - docs/design/briefs/PA-POR-001-portal-list-brief.md
 *
 * `<PortalStatusPill>` lives under `components/ui/` (shared elevated primitive).
 * `<ChannelMark>` already ships at `components/ui/channel-mark.tsx`.
 */

export { PortalReceiptCard } from './PortalReceiptCard'
export type {
  PortalReceiptCardProps,
  PortalReceiptDestination,
  PortalReceiptTimelineEvent,
} from './PortalReceiptCard'

export { AggregateOutcomeHero } from './AggregateOutcomeHero'
export type {
  AggregateOutcome,
  AggregateOutcomeHeroProps,
} from './AggregateOutcomeHero'

export { CreditsSummary } from './CreditsSummary'
export type { CreditsSummaryProps } from './CreditsSummary'

export {
  BULK_RETRYABLE_ERROR_CLASSES,
  ERROR_CLASS_FIX_COPY,
  ERROR_CLASS_HELPER,
  ERROR_CLASS_ICON,
  ERROR_CLASS_LABEL,
  ERROR_CLASS_SECONDARY_FIX,
  PORTAL_ERROR_CLASSES,
  defaultFixDeepLink,
  isBulkRetryable,
  isPortalErrorClass,
} from './failureClasses'
export type { PortalErrorClass } from './failureClasses'

export {
  PortalStatusPill,
  type PortalStatus,
  type PortalStatusPillProps,
} from '@/components/ui/portal-status-pill'
