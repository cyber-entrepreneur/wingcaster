/**
 * WhatsApp intake tour primitives (AGT-WLB family).
 *
 * Path: `web/src/components/onboarding/whatsapp/`
 * Source-of-truth briefs: AGT-WLB-001 (anchor), AGT-WLB-002…005 (deltas).
 */

export { TourFrame } from './TourFrame'
export type { TourFrameProps, TourFrameStep } from './TourFrame'

export { StepHero } from './StepHero'
export type { StepHeroEmphasis, StepHeroGlyph, StepHeroProps } from './StepHero'

export { BenefitList } from './BenefitList'
export type { Benefit, BenefitListProps } from './BenefitList'

export { WhatsAppHandshakePanel } from './WhatsAppHandshakePanel'
export type { WhatsAppHandshakePanelProps } from './WhatsAppHandshakePanel'

export { LiveDraftCanvas } from './LiveDraftCanvas'
export type {
  DraftField,
  DraftFieldKey,
  DraftFieldState,
  LiveDraftCanvasProps,
  LiveDraftConnectionMode,
} from './LiveDraftCanvas'

export { SignalLampBadge } from './SignalLampBadge'
export type { SignalLampBadgeProps, SignalLampState } from './SignalLampBadge'

export { InboundMessageSummary } from './InboundMessageSummary'
export type {
  InboundAttachment,
  InboundAttachmentType,
  InboundMessageSummaryProps,
} from './InboundMessageSummary'

export { ListingPreviewCard } from './ListingPreviewCard'
export type {
  ListingPreviewCardProps,
  ListingPreviewListing,
  ListingPreviewVariant,
} from './ListingPreviewCard'
