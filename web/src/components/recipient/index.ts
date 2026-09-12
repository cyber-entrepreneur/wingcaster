/**
 * REC-family Broadcast primitives (AGT-REC outcome screens).
 *
 * Anchor brief: docs/design/briefs/AGT-REC-004-application-outcome-brief.md
 * §Reusable REC-family patterns.
 *
 * Consumers: AGT-REC-002 / 003 / 004 / 005 / 006, AGT-PUB-003.
 *
 * Export names (stable — import by name from `@/components/recipient`):
 * - StatusHero
 * - OutcomeTimeline
 * - ResolverMessage
 * - PrimaryCtaPerState
 */

export { StatusHero } from './StatusHero'
export type { StatusHeroProps } from './StatusHero'

export { OutcomeTimeline } from './OutcomeTimeline'
export type { OutcomeTimelineEvent, OutcomeTimelineProps } from './OutcomeTimeline'

export { ResolverMessage } from './ResolverMessage'
export type { ResolverMessageProps } from './ResolverMessage'

export { PrimaryCtaPerState } from './PrimaryCtaPerState'
export type { CtaAction, PrimaryCtaPerStateProps } from './PrimaryCtaPerState'

export {
  formatAbsoluteTimestamp,
  formatRelativeAbsolute,
  formatRelativeTimestamp,
} from './formatRelativeAbsolute'
