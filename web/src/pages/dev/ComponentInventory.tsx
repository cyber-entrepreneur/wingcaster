/**
 * Dev-only visual inventory for Shared Components Prep primitives.
 * Route: `/dev/components` (registered only when `import.meta.env.DEV`).
 *
 * Renders each family in default + key variant states for visual regression
 * and downstream-wave reference. Stub props only — no business logic.
 */
import { useState } from 'react'
import {
  Clock,
  MapPin,
  MessageCircle,
  Shield,
  Sparkles,
  User,
} from 'lucide-react'
import {
  StatusHero,
  OutcomeTimeline,
  ResolverMessage,
  PrimaryCtaPerState,
} from '@/components/recipient'
import {
  PAQueueFilterStrip,
  PAQueueTable,
  PAQueueBulkBar,
  PAQueueBulkApproveDialog,
  PAQueueBulkReasonDialog,
  PAQueueKeyboardShortcutsPanel,
} from '@/components/queue'
import {
  OnboardingProgressMarker,
  IntakePathCard,
  ActivationCodeBanner,
  OnboardingStepper,
  SignalLampDot,
  DraftListingPreview,
  CelebrationHeader,
  PublishingOverlay,
  OnboardingChecklistCard,
  OnboardingPill,
  ProgressRing,
  SparkleBurst,
  OfflineBanner,
  useOnboardingState,
} from '@/components/onboarding'
import {
  TourFrame,
  StepHero,
  BenefitList,
  WhatsAppHandshakePanel,
  LiveDraftCanvas,
  SignalLampBadge,
  InboundMessageSummary,
  ListingPreviewCard,
} from '@/components/onboarding/whatsapp'
import {
  OtpInput,
  BackupCodeInput,
  RateLimitBanner,
  TrustFooter,
  StepUpModal,
  StepUpProvider,
  TwoFactorStatusHero,
  MethodRow,
  BackupCodesRow,
  EnrollmentStepper,
  PasswordGateCard,
  RevealableSecret,
  BackupCodeGrid,
} from '@/components/mfa'
import {
  SettingsShell,
  type SettingsNavGroupData,
} from '@/components/settings'
import {
  AgencyIdentityCard,
  PersonaChip,
  OwnershipTransferChallenge,
} from '@/components/agency'
import {
  EvidenceUploader,
  ContextEchoCard,
  IdentityForm,
  EMPTY_IDENTITY_FORM_VALUES,
} from '@/components/forms'
import {
  PortalReceiptCard,
  AggregateOutcomeHero,
  CreditsSummary,
  PortalStatusPill,
} from '@/components/portals'
import { ChannelMark } from '@/components/ui/channel-mark'
import {
  PIIMask,
  TwoPersonProgress,
  Timeline,
} from '@/components/security'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { User as UserIcon, ShieldCheck, Bell } from 'lucide-react'
import '../../print.css'

function FamilySection({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      className="scroll-mt-8 border-b border-[var(--lc-border)] py-[var(--lc-space-2xl)]"
    >
      <h2 className="mb-[var(--lc-space-lg)] text-[var(--lc-text-heading)]">{title}</h2>
      <div className="flex flex-col gap-[var(--lc-space-xl)]">{children}</div>
    </section>
  )
}

function VariantLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-[var(--lc-space-sm)] font-[family-name:var(--lc-font-mono)] text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
      {children}
    </p>
  )
}

const SETTINGS_GROUPS: SettingsNavGroupData[] = [
  {
    id: 'account',
    label: 'Account',
    items: [
      {
        id: 'profile',
        route: '/settings/profile',
        icon: UserIcon,
        label: 'Profile',
      },
      {
        id: 'security',
        route: '/settings/security',
        icon: ShieldCheck,
        label: 'Security',
        badge: { kind: 'status', tone: 'warning', label: '2FA off' },
      },
    ],
  },
  {
    id: 'prefs',
    label: 'Preferences',
    items: [
      {
        id: 'notifications',
        route: '/settings/notifications',
        icon: Bell,
        label: 'Notifications',
        badge: { kind: 'count', value: 3 },
      },
    ],
  },
]

const EXPIRES_SOON = new Date(Date.now() + 45 * 60 * 1000).toISOString()

export function ComponentInventoryPage() {
  const [otp, setOtp] = useState('')
  const [backupCode, setBackupCode] = useState('')
  const [identity, setIdentity] = useState(EMPTY_IDENTITY_FORM_VALUES)
  const [bulkApproveOpen, setBulkApproveOpen] = useState(false)
  const [bulkReasonOpen, setBulkReasonOpen] = useState(false)
  const [stepUpOpen, setStepUpOpen] = useState(false)
  const [showPublishing, setShowPublishing] = useState(false)
  const onboarding = useOnboardingState()

  return (
    <div
      className="min-h-screen bg-[var(--lc-bg-page)] px-[var(--lc-space-lg)] py-[var(--lc-space-xl)] text-[var(--lc-text-primary)]"
      data-testid="component-inventory"
    >
      <header className="mb-[var(--lc-space-2xl)] max-w-5xl">
        <p className="text-[var(--lc-text-muted)]">Dev only · Shared Components Prep</p>
        <h1 className="text-[var(--lc-text-heading)]">Component inventory</h1>
        <p className="mt-[var(--lc-space-sm)] max-w-2xl text-[var(--lc-text-muted)]">
          Default + variant stubs for every cross-wave primitive. Toggle RTL / dark via browser
          tools to verify Broadcast tokens.
        </p>
        <nav
          aria-label="Family jump links"
          className="mt-[var(--lc-space-md)] flex flex-wrap gap-[var(--lc-space-sm)]"
        >
          {[
            ['family-recipient', 'REC'],
            ['family-queue', 'PA-queue'],
            ['family-onboarding', 'Onboarding'],
            ['family-whatsapp', 'WLB'],
            ['family-mfa', 'MFA'],
            ['family-settings', 'Settings'],
            ['family-agency', 'Agency'],
            ['family-forms', 'Forms'],
            ['family-portals', 'Portals'],
            ['family-security', 'Security'],
          ].map(([href, label]) => (
            <a
              key={href}
              href={`#${href}`}
              className="rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] px-[var(--lc-space-sm)] py-1 text-[length:var(--lc-type-caption)] text-[var(--lc-text-brand)]"
            >
              {label}
            </a>
          ))}
        </nav>
      </header>

      <div className="mx-auto max-w-5xl">
        <FamilySection id="family-recipient" title="3.1 REC-family">
          <div>
            <VariantLabel>StatusHero · approved loud</VariantLabel>
            <StatusHero state="approved" label="Application approved" timestamp="2026-09-07T14:22:00Z" emphasis="loud" />
          </div>
          <div>
            <VariantLabel>StatusHero · approved default (quarantined / signal-only)</VariantLabel>
            <StatusHero state="approved" label="Approved as signal only" timestamp="2026-09-07T14:22:00Z" emphasis="default" />
          </div>
          <div>
            <VariantLabel>StatusHero · pending / rejected</VariantLabel>
            <div className="grid gap-[var(--lc-space-md)] md:grid-cols-2">
              <StatusHero state="pending" label="Waiting on agency" timestamp="2026-09-08T08:00:00Z" />
              <StatusHero state="rejected" label="Not accepted" timestamp="2026-09-06T11:00:00Z" />
            </div>
          </div>
          <div>
            <VariantLabel>OutcomeTimeline</VariantLabel>
            <OutcomeTimeline
              events={[
                { key: 's', label: 'Submitted', timestamp: '2026-09-01T10:00:00Z', state: 'complete' },
                { key: 'v', label: 'Viewed by agency', timestamp: '2026-09-02T09:00:00Z', state: 'complete' },
                { key: 'd', label: 'Decided', state: 'current' },
                { key: 'r', label: 'Resolved', state: 'pending' },
              ]}
            />
          </div>
          <div>
            <VariantLabel>ResolverMessage · with body / empty</VariantLabel>
            <div className="grid gap-[var(--lc-space-md)] md:grid-cols-2">
              <ResolverMessage
                resolver={{ display_name: 'Sara Al-Maktoum', role_label: 'Owner' }}
                decided_at="2026-09-07T14:22:00Z"
                message="Welcome aboard — let's get your first listing live this week."
              />
              <ResolverMessage
                resolver={{ display_name: 'Sara Al-Maktoum', role_label: 'Owner' }}
                decided_at="2026-09-07T14:22:00Z"
                message={null}
              />
            </div>
          </div>
          <div>
            <VariantLabel>PrimaryCtaPerState · stacked</VariantLabel>
            <PrimaryCtaPerState
              layout="stacked"
              primary={{ key: 'accept', label: 'Switch to Elite Realty', variant: 'default', onClick: () => undefined }}
              secondary={{ key: 'browse', label: 'Browse agencies', variant: 'outline', href: '/public/agencies' }}
              tertiary={{ key: 'withdraw', label: 'Withdraw application', variant: 'ghost', onClick: () => undefined }}
            />
          </div>
        </FamilySection>

        <FamilySection id="family-queue" title="3.2 PA-queue-family">
          <PAQueueFilterStrip
            envBadge={<Badge variant="outline">TEST</Badge>}
            statusOptions={[
              { value: 'pending', label: 'Pending', count: 12 },
              { value: 'approved', label: 'Approved', count: 4 },
              { value: 'rejected', label: 'Rejected', count: 1 },
            ]}
            values={{ status: 'pending', submittedWithin: '7d', riskTier: 'any', search: '' }}
            onChange={() => undefined}
          />
          <PAQueueTable
            columns={[
              { id: 'id', header: 'Case', cell: (r) => r.id },
              { id: 'portal', header: 'Portal', cell: (r) => (r as { portal?: string }).portal },
            ]}
            rows={[
              { id: 'mod-001', portal: 'Property Finder' },
              { id: 'mod-002', portal: 'Bayut' },
            ]}
            selectedIds={['mod-001']}
            onSelectionChange={() => undefined}
            onRowClick={() => undefined}
          />
          <div className="relative min-h-24">
            <PAQueueBulkBar selectedCount={2} highRiskCount={1} onApprove={() => setBulkApproveOpen(true)} onReject={() => setBulkReasonOpen(true)} />
          </div>
          <VariantLabel>showBulk=false (WF-04 / WF-05) — bar must not render</VariantLabel>
          <PAQueueBulkBar showBulk={false} selectedCount={5} />
          <div className="flex flex-wrap gap-[var(--lc-space-sm)]">
            <Button type="button" variant="outline" onClick={() => setBulkApproveOpen(true)}>
              Open bulk approve
            </Button>
            <Button type="button" variant="outline" onClick={() => setBulkReasonOpen(true)}>
              Open bulk reason
            </Button>
          </div>
          <PAQueueBulkApproveDialog open={bulkApproveOpen} onOpenChange={setBulkApproveOpen} count={2} onConfirm={() => setBulkApproveOpen(false)} />
          <PAQueueBulkReasonDialog
            open={bulkReasonOpen}
            onOpenChange={setBulkReasonOpen}
            mode="reject"
            count={2}
            reasonOptions={[{ value: 'duplicate', label: 'Duplicate listing' }]}
            onConfirm={() => setBulkReasonOpen(false)}
          />
          <PAQueueKeyboardShortcutsPanel open onOpenChange={() => undefined} />
        </FamilySection>

        <FamilySection id="family-onboarding" title="3.3 Onboarding family">
          <OnboardingProgressMarker step={2} label="WhatsApp intake" />
          <OnboardingProgressMarker step={4} label="Done" complete />
          <div className="grid gap-[var(--lc-space-md)] md:grid-cols-3">
            <IntakePathCard variant="whatsapp" label="WhatsApp" description="Draft from chat" timeToValue="~2 min" recommended selected ctaLabel="Continue" />
            <IntakePathCard variant="manual" label="Manual" description="Form composer" timeToValue="~8 min" />
            <IntakePathCard variant="nextAction" label="Invite a teammate" description="Share the workspace" ctaLabel="Invite" />
          </div>
          <ActivationCodeBanner code="WC-A7K3" shared_number="+971 4 XXX XXXX" expires_at={EXPIRES_SOON} status="pending" />
          <ActivationCodeBanner code="WC-A7K3" shared_number="+971 4 XXX XXXX" expires_at={EXPIRES_SOON} status="connected" connectedPhoneLabel="+971 5X XXX 4321" />
          <OnboardingStepper
            steps={[
              { id: 'a', label: 'Connect' },
              { id: 'b', label: 'Draft' },
              { id: 'c', label: 'Publish' },
            ]}
            activeIndex={1}
          />
          <div className="flex items-center gap-[var(--lc-space-md)]">
            <SignalLampDot pulsing />
            <SignalLampDot pulsing={false} />
            <OnboardingPill completed={1} total={4} />
            <ProgressRing completed={2} total={4} />
            <SparkleBurst />
          </div>
          <DraftListingPreview draftId="draft_stub" />
          <CelebrationHeader tone="subdued" title="Looking good" body="Review your draft before publishing." />
          <CelebrationHeader tone="loud" title="You're live!" body="First listing published." nextLabel="Next actions" onNext={() => undefined} />
          <OnboardingChecklistCard state={onboarding.state} />
          <OfflineBanner message="You're offline — progress will sync when you're back." />
          <Button type="button" variant="outline" onClick={() => setShowPublishing(true)}>
            Show publishing overlay
          </Button>
          <PublishingOverlay
            open={showPublishing}
            label="Publishing…"
            progress={62}
          />
          {showPublishing ? (
            <Button type="button" variant="ghost" className="relative z-[60]" onClick={() => setShowPublishing(false)}>
              Dismiss overlay
            </Button>
          ) : null}
        </FamilySection>

        <FamilySection id="family-whatsapp" title="3.4 WhatsApp intake tour">
          <TourFrame step={2} totalSteps={5} title="Activation code" onExit={() => undefined}>
            <StepHero
              emphasis="default"
              title="Save this code"
              body="You'll send it once from WhatsApp."
              glyph="whatsapp-mark"
            />
            <WhatsAppHandshakePanel
              displayCode="WC-A4K9-JAMIL"
              sharedNumberE164="+971 4 XXX XXXX"
              expiresAt={EXPIRES_SOON}
              onRegenerate={async () => undefined}
            />
          </TourFrame>
          <StepHero
            emphasis="success"
            title="Listing ready"
            body="Review and publish."
            glyph="listing-mark"
          />
          <BenefitList
            items={[
              { icon: MessageCircle, label: 'Chat to draft', sub: 'Send photos + details' },
              { icon: Sparkles, label: 'AI fills the form', sub: 'You confirm before publish' },
              { icon: MapPin, label: 'Same workspace', sub: 'Shows up in your listings' },
            ]}
          />
          <LiveDraftCanvas
            connection="sse"
            onCancel={() => undefined}
            onEditLater={() => undefined}
            fields={[
              { key: 'address', label: 'Address', state: 'complete', value: 'Downtown Dubai' },
              { key: 'bedrooms', label: 'Beds', state: 'streaming', streamedText: '2' },
              { key: 'price', label: 'Price', state: 'thinking' },
            ]}
          />
          <SignalLampBadge state="listening" label="Listening for WhatsApp" />
          <InboundMessageSummary
            received_at="2026-09-08T12:00:00Z"
            wa_me_link="https://wa.me/97140000000"
            attachments={[{ type: 'photo', count: 3 }]}
          />
          <ListingPreviewCard
            variant="preview"
            listing={{
              id: 'lst_1',
              address: 'Burj Vista Tower 1, Downtown',
              photos: [],
              bedrooms: 2,
              bathrooms: 2,
              area: 1200,
              price: 2400000,
              currency: 'AED',
              status: 'draft',
            }}
          />
        </FamilySection>

        <FamilySection id="family-mfa" title="3.5 MFA family">
          <TwoFactorStatusHero status="on" title="On" subtitle="Authenticator app · enrolled Sep 4, 2026" badgeLabel="Enabled" />
          <TwoFactorStatusHero status="off" title="Off" subtitle="Add a second factor to protect your account" />
          <MethodRow icon={<ShieldCheck className="h-5 w-5" />} label="Authenticator app" meta="Enrolled Sep 4, 2026" />
          <BackupCodesRow remaining={8} total={10} onManage={() => undefined} />
          <EnrollmentStepper activeIndex={1} />
          <PasswordGateCard title="Confirm password" onSubmit={() => undefined} />
          <RevealableSecret secret="JBSWY3DPEHPK3PXP" aria-label="Secret key" />
          <OtpInput value={otp} onChange={setOtp} aria-label="One-time code" />
          <BackupCodeInput value={backupCode} onChange={(formatted) => setBackupCode(formatted)} aria-label="Backup code" />
          <RateLimitBanner message="Too many attempts. Try again shortly." retryAfterMinutes={1} />
          <TrustFooter />
          <BackupCodeGrid codes={['A1B2-C3D4', 'E5F6-G7H8', 'I9J0-K1L2', 'M3N4-O5P6']} />
          <StepUpProvider previewMethod="totp">
            <Button type="button" onClick={() => setStepUpOpen(true)}>
              Open MFA StepUpModal
            </Button>
            <StepUpModal
              open={stepUpOpen}
              reason="View backup codes"
              method="totp"
              onCancel={() => setStepUpOpen(false)}
              onVerify={() => setStepUpOpen(false)}
            />
          </StepUpProvider>
        </FamilySection>

        <FamilySection id="family-settings" title="3.6 Settings shell">
          <div className="overflow-hidden rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)]">
            <SettingsShell groups={SETTINGS_GROUPS} title="Settings">
              <div className="p-[var(--lc-space-lg)]">
                <h3>Profile pane stub</h3>
                <p className="text-[var(--lc-text-muted)]">Child routes render here.</p>
              </div>
            </SettingsShell>
          </div>
        </FamilySection>

        <FamilySection id="family-agency" title="3.7 Agency identity">
          <AgencyIdentityCard
            name="Elite Realty Dubai"
            description="Full-service brokerage covering Downtown, Marina, and Palm."
            teamSize={42}
            primaryMarket="UAE"
            activeListingsCount={128}
            foundedYear={2014}
          />
          <div className="flex flex-wrap gap-[var(--lc-space-sm)]">
            <PersonaChip role="owner" />
            <PersonaChip role="admin" />
            <PersonaChip role="member" />
            <PersonaChip role="applicant" />
          </div>
          <OwnershipTransferChallenge
            agencyName="Elite Realty Dubai"
            ownerEmailMasked="s•••@elite.ae"
            onAllComplete={() => undefined}
            onReset={() => undefined}
          />
        </FamilySection>

        <FamilySection id="family-forms" title="3.8 Form primitives">
          <ContextEchoCard
            glyph={MapPin}
            title="2BR · Downtown Dubai"
            subtitle="Bayut · PF draft 8841"
            meta_row={[
              { key: 'beds', label: 'Beds', value: 2, numeric: true },
              { key: 'ch', label: 'Channel', value: 'WA', channel: 'whatsapp' },
            ]}
          />
          <EvidenceUploader
            files={[
              { id: 'f1', name: 'comp.pdf', size_bytes: 120_000, content_type: 'application/pdf', status: 'complete' },
              { id: 'f2', name: 'photo.jpg', size_bytes: 80_000, content_type: 'image/jpeg', status: 'uploading', progress_pct: 40 },
              { id: 'f3', name: 'bad.csv', size_bytes: 10_000, content_type: 'text/csv', status: 'error', error_message: 'Too large' },
            ]}
            max_files={3}
            max_bytes_per_file={10_485_760}
            accepted_types={['image/jpeg', 'application/pdf', 'text/csv']}
            onAdd={() => undefined}
            onRemove={() => undefined}
          />
          <IdentityForm values={identity} onChange={setIdentity} onSubmit={() => undefined} />
        </FamilySection>

        <FamilySection id="family-portals" title="3.9 Portal / channel">
          <div className="flex flex-wrap gap-[var(--lc-space-sm)]">
            {(['submitted', 'in_review', 'live', 'rejected', 'expired', 'failed'] as const).map((s) => (
              <PortalStatusPill key={s} status={s} pulse={s === 'in_review'} />
            ))}
            <ChannelMark channel="whatsapp" />
            <ChannelMark channel="email" />
          </div>
          <AggregateOutcomeHero
            aggregate="mixed"
            counts={{ succeeded: 2, in_review: 1, failed: 1 }}
            total_destinations={4}
            published_at="2026-09-08T10:00:00Z"
            listing_title="3BR · Downtown Dubai · AED 4.5M"
          />
          <PortalReceiptCard
            destination={{ portal_code: 'pf', portal_display_name: 'Property Finder', country_code: 'AE' }}
            status="succeeded"
            credit_charged={1}
            credit_reserved={1}
            timestamp="2026-09-08T10:01:00Z"
            live_url="https://example.com/listing"
          />
          <PortalReceiptCard
            destination={{ portal_code: 'bayut', portal_display_name: 'Bayut' }}
            status="failed"
            error_class="AUTH_EXPIRED"
            credit_charged={0}
            credit_reserved={1}
            timestamp="2026-09-08T10:02:00Z"
            retry_available
          />
          <CreditsSummary total_charged={2} total_reserved={4} credits_history_deep_link="/my-credits" />
        </FamilySection>

        <FamilySection id="family-security" title="3.10 PII + audit">
          <PIIMask
            value="sara@elite.ae"
            kind="email"
            auditContext={{ caseId: 'acr-001', field: 'email' }}
            onReveal={() => undefined}
          />
          <PIIMask
            value="+971501234567"
            kind="phone"
            maskedValue="+971 5X XXX 4567"
            auditContext={{ caseId: 'acr-001', field: 'phone' }}
          />
          <TwoPersonProgress
            firstApprover={{ initials: 'SM', displayName: 'Sara M', signedOffAt: '2026-09-07T12:00:00Z', vote: 'approve' }}
            secondApprover={{ initials: 'You', displayName: 'You' }}
          />
          <Timeline
            title="Challenge history"
            entries={[
              { id: '1', at: '2026-09-07T11:00:00Z', status: 'info', channel: 'email', title: 'OTP sent', message: 'Challenge email delivered' },
              { id: '2', at: '2026-09-07T11:05:00Z', status: 'success', message: 'OTP verified' },
              { id: '3', at: '2026-09-07T11:06:00Z', status: 'pending', message: 'Awaiting second approver' },
            ]}
          />
          <div className="flex items-center gap-[var(--lc-space-sm)] text-[var(--lc-text-muted)]">
            <Clock className="h-4 w-4" aria-hidden />
            <Shield className="h-4 w-4" aria-hidden />
            <User className="h-4 w-4" aria-hidden />
            <span>Inventory complete — 10 families rendered.</span>
          </div>
        </FamilySection>
      </div>
    </div>
  )
}
