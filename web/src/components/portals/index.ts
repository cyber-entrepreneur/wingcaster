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
 * `<SourceMark>` ships at `components/ui/source-mark.tsx` (AGT-INB-005 dual-badge).
 */

export { PortalReceiptCard } from './PortalReceiptCard'
export type {
  PortalErrorClass,
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
  PortalStatusPill,
  type PortalStatus,
  type PortalStatusPillProps,
} from '@/components/ui/portal-status-pill'

export { ChannelMark } from '@/components/ui/channel-mark'
export { SourceMark } from '@/components/ui/source-mark'
