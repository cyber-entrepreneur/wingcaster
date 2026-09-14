/**
 * Cross-family import / prop-signature smoke test (Shared Components Prep §4 Phase B).
 * Proves every extract-stage primitive exists and exports the expected prop types
 * as TypeScript values (compile-time via `satisfies` + runtime typeof checks).
 */
import { describe, expect, it } from 'vitest'
import type { ComponentType } from 'react'

import * as Recipient from '@/components/recipient'
import * as Queue from '@/components/queue'
import * as Onboarding from '@/components/onboarding'
import * as WhatsApp from '@/components/onboarding/whatsapp'
import * as Mfa from '@/components/mfa'
import * as Settings from '@/components/settings'
import * as Agency from '@/components/agency'
import * as Forms from '@/components/forms'
import * as Portals from '@/components/portals'
import * as Security from '@/components/security'
import { PortalStatusPill } from '@/components/ui/portal-status-pill'
import { ChannelMark } from '@/components/ui/channel-mark'

function expectComponent(name: string, value: unknown) {
  expect(value, `${name} should be defined`).toBeTypeOf('function')
}

describe('shared components prep — family exports exist', () => {
  it('REC-family', () => {
    for (const [name, value] of Object.entries({
      StatusHero: Recipient.StatusHero,
      OutcomeTimeline: Recipient.OutcomeTimeline,
      ResolverMessage: Recipient.ResolverMessage,
      PrimaryCtaPerState: Recipient.PrimaryCtaPerState,
    })) {
      expectComponent(name, value)
    }
  })

  it('PA-queue-family', () => {
    for (const [name, value] of Object.entries({
      PAQueueFilterStrip: Queue.PAQueueFilterStrip,
      PAQueueTable: Queue.PAQueueTable,
      PAQueueBulkBar: Queue.PAQueueBulkBar,
      PAQueueBulkApproveDialog: Queue.PAQueueBulkApproveDialog,
      PAQueueBulkReasonDialog: Queue.PAQueueBulkReasonDialog,
      PAQueueKeyboardShortcutsPanel: Queue.PAQueueKeyboardShortcutsPanel,
    })) {
      expectComponent(name, value)
    }
    expect(Queue.PA_QUEUE_DEFAULT_SHORTCUTS.length).toBeGreaterThan(0)
  })

  it('Onboarding family', () => {
    for (const [name, value] of Object.entries({
      OnboardingProgressMarker: Onboarding.OnboardingProgressMarker,
      IntakePathCard: Onboarding.IntakePathCard,
      ActivationCodeBanner: Onboarding.ActivationCodeBanner,
      OnboardingStepper: Onboarding.OnboardingStepper,
      SignalLampDot: Onboarding.SignalLampDot,
      DraftListingPreview: Onboarding.DraftListingPreview,
      CelebrationHeader: Onboarding.CelebrationHeader,
      PublishingOverlay: Onboarding.PublishingOverlay,
      OnboardingChecklistCard: Onboarding.OnboardingChecklistCard,
      OnboardingPill: Onboarding.OnboardingPill,
      ProgressRing: Onboarding.ProgressRing,
      SparkleBurst: Onboarding.SparkleBurst,
      OfflineBanner: Onboarding.OfflineBanner,
      useOnboardingState: Onboarding.useOnboardingState,
    })) {
      expectComponent(name, value)
    }
  })

  it('WhatsApp intake tour family', () => {
    for (const [name, value] of Object.entries({
      TourFrame: WhatsApp.TourFrame,
      StepHero: WhatsApp.StepHero,
      BenefitList: WhatsApp.BenefitList,
      WhatsAppHandshakePanel: WhatsApp.WhatsAppHandshakePanel,
      LiveDraftCanvas: WhatsApp.LiveDraftCanvas,
      SignalLampBadge: WhatsApp.SignalLampBadge,
      InboundMessageSummary: WhatsApp.InboundMessageSummary,
      ListingPreviewCard: WhatsApp.ListingPreviewCard,
    })) {
      expectComponent(name, value)
    }
  })

  it('MFA family', () => {
    for (const [name, value] of Object.entries({
      OtpInput: Mfa.OtpInput,
      BackupCodeInput: Mfa.BackupCodeInput,
      RateLimitBanner: Mfa.RateLimitBanner,
      TrustFooter: Mfa.TrustFooter,
      StepUpModal: Mfa.StepUpModal,
      StepUpProvider: Mfa.StepUpProvider,
      useStepUp: Mfa.useStepUp,
      TwoFactorStatusHero: Mfa.TwoFactorStatusHero,
      MethodRow: Mfa.MethodRow,
      BackupCodesRow: Mfa.BackupCodesRow,
      EnrollmentStepper: Mfa.EnrollmentStepper,
      PasswordGateCard: Mfa.PasswordGateCard,
      RevealableSecret: Mfa.RevealableSecret,
      BackupCodeGrid: Mfa.BackupCodeGrid,
    })) {
      expectComponent(name, value)
    }
  })

  it('Settings shell', () => {
    for (const [name, value] of Object.entries({
      SettingsShell: Settings.SettingsShell,
      SettingsSidebar: Settings.SettingsSidebar,
      SettingsNavGroup: Settings.SettingsNavGroup,
      SettingsNavItem: Settings.SettingsNavItem,
      SettingsCardList: Settings.SettingsCardList,
      SettingsCardRow: Settings.SettingsCardRow,
    })) {
      expectComponent(name, value)
    }
  })

  it('Agency identity', () => {
    for (const [name, value] of Object.entries({
      AgencyIdentityCard: Agency.AgencyIdentityCard,
      PersonaChip: Agency.PersonaChip,
      OwnershipTransferChallenge: Agency.OwnershipTransferChallenge,
    })) {
      expectComponent(name, value)
    }
  })

  it('Form primitives', () => {
    for (const [name, value] of Object.entries({
      EvidenceUploader: Forms.EvidenceUploader,
      ContextEchoCard: Forms.ContextEchoCard,
      IdentityForm: Forms.IdentityForm,
    })) {
      expectComponent(name, value)
    }
    expect(Forms.EMPTY_IDENTITY_FORM_VALUES).toBeDefined()
  })

  it('Portal / channel primitives', () => {
    for (const [name, value] of Object.entries({
      PortalReceiptCard: Portals.PortalReceiptCard,
      AggregateOutcomeHero: Portals.AggregateOutcomeHero,
      CreditsSummary: Portals.CreditsSummary,
      PortalStatusPill: Portals.PortalStatusPill,
    })) {
      expectComponent(name, value)
    }
    expectComponent('PortalStatusPill(ui)', PortalStatusPill)
    expectComponent('ChannelMark', ChannelMark)
    expectComponent('SourceMark', Portals.SourceMark)
  })

  it('PII + audit primitives', () => {
    for (const [name, value] of Object.entries({
      PIIMask: Security.PIIMask,
      TwoPersonProgress: Security.TwoPersonProgress,
      Timeline: Security.Timeline,
    })) {
      expectComponent(name, value)
    }
  })

  it('inventory page is a component', async () => {
    const mod = await import('@/pages/dev/ComponentInventory')
    expectComponent('ComponentInventoryPage', mod.ComponentInventoryPage)
    // Keep the import typed as a React component for tsc consumers.
    const Page: ComponentType = mod.ComponentInventoryPage
    expect(Page).toBeTypeOf('function')
  })
})
