/**
 * Wave 4A activation-funnel fixtures (AGT-ONB / AGT-WLB / AGT-ACT).
 *
 * Page modules land on Phase A branches. These compositions mount the
 * Shared Prep primitives that those screens own, so a11y + visual coverage
 * is meaningful before (and after) the family PRs merge.
 */
import { useState, type ReactElement } from 'react'
import { Camera, Mic, MapPin, Sparkles } from 'lucide-react'
import {
  CelebrationHeader,
  DraftListingPreview,
  IntakePathCard,
  OnboardingChecklistCard,
  OnboardingPill,
  OnboardingProgressMarker,
  OnboardingStepper,
  SparkleBurst,
  type OnboardingState,
} from '@/components/onboarding'
import {
  BenefitList,
  InboundMessageSummary,
  ListingPreviewCard,
  LiveDraftCanvas,
  SignalLampBadge,
  StepHero,
  TourFrame,
  WhatsAppHandshakePanel,
  type DraftField,
} from '@/components/onboarding/whatsapp'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Numeric } from '@/components/ui/numeric'

export const FIXED_NOW = new Date('2026-09-09T12:00:00.000Z').getTime()
export const HANDSHAKE_EXPIRES_AT = '2026-09-09T12:15:00.000Z'
export const DISPLAY_CODE = 'WC-A4K9-JAMIL'
export const SHARED_NUMBER = '+971 4 XXX XXXX'

export function sampleOnboardingState(
  partial?: Partial<OnboardingState> & { checklist?: Partial<OnboardingState['checklist']> },
): OnboardingState {
  const base: OnboardingState = {
    user_id: 'usr_sara',
    step: 'welcome',
    path: null,
    started_at: '2026-09-08T10:00:00.000Z',
    updated_at: '2026-09-08T10:00:00.000Z',
    completed_at: null,
    dismissed_forever: false,
    checklist: {
      welcome_seen: true,
      first_listing_drafted: false,
      first_listing_published: false,
      channels_connected: false,
      notifications_enabled: false,
      profile_completed: false,
      subscription_active: false,
    },
  }
  return {
    ...base,
    ...partial,
    checklist: {
      ...base.checklist,
      ...partial?.checklist,
    },
  }
}

export const STREAMING_FIELDS: DraftField[] = [
  { key: 'address', label: 'Address', state: 'complete', value: '42 Marina Walk, Dubai' },
  { key: 'bedrooms', label: 'Bedrooms', state: 'complete', value: 2 },
  { key: 'bathrooms', label: 'Bathrooms', state: 'thinking' },
  { key: 'price', label: 'Price', state: 'idle' },
  { key: 'area_sqft', label: 'Area', state: 'idle' },
  {
    key: 'description',
    label: 'Description',
    state: 'streaming',
    streamedText: 'Bright 2BR with marina views',
  },
  { key: 'photos', label: 'Photos', state: 'complete', value: ['a.jpg', 'b.jpg'] },
]

export const COMPLETE_FIELDS: DraftField[] = [
  { key: 'address', label: 'Address', state: 'complete', value: '42 Marina Walk, Dubai' },
  { key: 'bedrooms', label: 'Bedrooms', state: 'complete', value: 2 },
  { key: 'bathrooms', label: 'Bathrooms', state: 'complete', value: 2 },
  { key: 'price', label: 'Price', state: 'complete', value: 2400000 },
  { key: 'area_sqft', label: 'Area', state: 'complete', value: 1200 },
  {
    key: 'description',
    label: 'Description',
    state: 'complete',
    value: 'Bright 2-bedroom apartment on the marina.',
  },
  { key: 'photos', label: 'Photos', state: 'complete', value: ['a.jpg', 'b.jpg', 'c.jpg'] },
]

export const READY_LISTING = {
  id: 'lst_draft_1',
  address: '42 Marina Walk, Dubai',
  photos: ['https://example.test/a.jpg'],
  bedrooms: 2,
  bathrooms: 2,
  area: 1200,
  areaUnit: 'sqft',
  price: 2400000,
  currency: 'AED',
  description: 'Bright 2-bedroom apartment on the marina.',
  status: 'draft',
}

const NOOP = () => {}

/** AGT-ONB-001 — Welcome path picker (radio group). */
export function Onb001WelcomeSurface({ selected = 'whatsapp' }: { selected?: 'whatsapp' | 'manual' | 'import' }) {
  const [value, setValue] = useState(selected)
  return (
    <div data-wave4a-surface>
      <OnboardingProgressMarker step={1} label="Welcome" />
      <h1>Welcome, Sara</h1>
      <section role="radiogroup" aria-label="How do you want to add your first listing">
        <IntakePathCard
          variant="whatsapp"
          label="Send a WhatsApp voice memo"
          description="We draft your first listing from photos and a voice note."
          timeToValue="About 2 minutes"
          recommended
          selected={value === 'whatsapp'}
          onSelect={() => setValue('whatsapp')}
          onCta={NOOP}
        />
        <IntakePathCard
          variant="manual"
          label="Add a listing manually"
          description="Fill in the details yourself."
          timeToValue="About 6 minutes"
          selected={value === 'manual'}
          onSelect={() => setValue('manual')}
          onCta={NOOP}
        />
        <IntakePathCard
          variant="import"
          label="Import from a spreadsheet"
          description="Bring over listings you already have."
          timeToValue="About 8 minutes"
          selected={value === 'import'}
          onSelect={() => setValue('import')}
          onCta={NOOP}
        />
      </section>
      <Button type="button" variant="ghost">
        Skip for now
      </Button>
    </div>
  )
}

/** AGT-ONB-002 — WhatsApp intake tour. */
export function Onb002TourSurface() {
  return (
    <div data-wave4a-surface>
      <OnboardingProgressMarker step={2} label="WhatsApp" />
      <OnboardingStepper
        activeIndex={1}
        steps={[
          { id: 'save', label: 'Save the number' },
          { id: 'code', label: 'Send your code' },
          { id: 'message', label: 'Send a listing' },
          { id: 'draft', label: 'Review the draft' },
        ]}
      />
      <p role="status" aria-live="polite">
        Listening for your message…
      </p>
    </div>
  )
}

/** AGT-ONB-003 — First-listing review. */
export function Onb003ReviewSurface() {
  return (
    <div data-wave4a-surface>
      <OnboardingProgressMarker step={3} label="Review" />
      <CelebrationHeader
        tone="subdued"
        title="We drafted your first listing from your voice memo."
        body="Look it over. Change anything. Then publish when you're ready."
      />
      <DraftListingPreview draftId="draft_1" />
    </div>
  )
}

/** AGT-ONB-004 — Celebration. */
export function Onb004CelebrationSurface({ reducedMotion = false }: { reducedMotion?: boolean }) {
  return (
    <div data-wave4a-surface>
      <OnboardingProgressMarker step={4} label="Published" complete />
      <div aria-hidden="true">
        <SparkleBurst active reducedMotion={reducedMotion} />
      </div>
      <CelebrationHeader
        tone="loud"
        title="Your first listing is live."
        body="You just turned a voice memo into a live listing."
      />
      <IntakePathCard
        variant="nextAction"
        label="Share on your Instagram"
        description="Post the listing to the channel that already has your audience."
        onSelect={NOOP}
        onCta={NOOP}
        ctaLabel="Share"
      />
    </div>
  )
}

/** AGT-ONB-005 — Dashboard-embedded checklist widget. */
export function Onb005ChecklistSurface({
  completed = 1,
  pro = false,
}: {
  completed?: number
  pro?: boolean
}) {
  const state = sampleOnboardingState({
    checklist: {
      first_listing_published: completed >= 1,
      channels_connected: completed >= 2,
      notifications_enabled: completed >= 3,
      profile_completed: completed >= 4,
    },
  })
  if (pro) {
    return (
      <OnboardingPill
        completed={completed}
        total={4}
        aria-label={`Onboarding progress: ${completed} of 4 steps complete. Open checklist.`}
      />
    )
  }
  return <OnboardingChecklistCard state={state} onDismissForever={NOOP} onStepTap={NOOP} />
}

/** AGT-WLB-001 — WhatsApp connect. */
export function Wlb001ConnectSurface() {
  return (
    <TourFrame step={2} totalSteps={5} title="Connect WhatsApp" onExit={NOOP}>
      <StepHero
        glyph="whatsapp-mark"
        title="List a property by sending a WhatsApp"
        body="Save the number, send photos and a voice note, and we draft the listing."
      />
      <BenefitList
        items={[
          { icon: Camera, label: 'Send photos', sub: 'We read the rooms and finishes.' },
          { icon: Mic, label: 'Send a voice note', sub: 'Price, beds, and the story.' },
          { icon: MapPin, label: 'Drop a pin', sub: 'Address without typing.' },
        ]}
      />
    </TourFrame>
  )
}

/** AGT-WLB-002 — Activation code handshake. */
export function Wlb002HandshakeSurface() {
  return (
    <TourFrame step={3} totalSteps={5} title="Send your activation code" onExit={NOOP}>
      <WhatsAppHandshakePanel
        displayCode={DISPLAY_CODE}
        sharedNumberE164={SHARED_NUMBER}
        expiresAt={HANDSHAKE_EXPIRES_AT}
        onRegenerate={async () => undefined}
      />
    </TourFrame>
  )
}

/** AGT-WLB-003 — Waiting for first message. */
export function Wlb003WaitingSurface() {
  return (
    <TourFrame step={4} totalSteps={5} title="Send your first listing" onExit={NOOP}>
      <SignalLampBadge state="listening" label="Listening — waiting for your WhatsApp" />
    </TourFrame>
  )
}

/** AGT-WLB-004 — Live drafting (streaming). */
export function Wlb004DraftingSurface({
  fields = STREAMING_FIELDS,
  connection = 'sse',
}: {
  fields?: DraftField[]
  connection?: 'sse' | 'polling' | 'fallback'
}) {
  const completeCount = fields.filter((f) => f.state === 'complete').length
  const busy = fields.some((f) => f.state === 'thinking' || f.state === 'streaming')
  return (
    <TourFrame step={5} totalSteps={5} title="Turning your message into a listing" onExit={NOOP}>
      <StepHero
        glyph={Sparkles}
        title="Turning your message into a listing"
        body="You'll see each field fill in as I read your photos, voice, and pin."
      />
      <LiveDraftCanvas
        fields={fields}
        connection={connection}
        onCancel={NOOP}
        onEditLater={NOOP}
      />
      <InboundMessageSummary
        received_at="2026-09-09T11:58:00.000Z"
        relativeTimeLabel="2 min ago"
        wa_me_link="https://wa.me/9714xxxxxxx"
        attachments={[
          { type: 'photo', count: 7 },
          { type: 'voice', duration: '0:42' },
          { type: 'location' },
        ]}
      />
      <Button type="button" size="lg" disabled={busy}>
        {busy ? (
          <>
            Drafting… (
            <Numeric>
              {completeCount}/{fields.length}
            </Numeric>{' '}
            fields)
          </>
        ) : (
          'Review & publish →'
        )}
      </Button>
    </TourFrame>
  )
}

/** AGT-WLB-005 — Drafting-page complete state (same route as -004). */
export function Wlb005ReadySurface() {
  return (
    <TourFrame step={5} totalSteps={5} title="Your listing is ready" onExit={NOOP}>
      <StepHero
        glyph={Sparkles}
        emphasis="success"
        title="Your listing is ready"
        body="Review and publish, or save for later."
      />
      <p className="sr-only" aria-live="polite">
        Your listing is ready. Review and publish, or save for later.
      </p>
      <ListingPreviewCard listing={READY_LISTING} variant="preview" />
      <LiveDraftCanvas
        fields={COMPLETE_FIELDS}
        connection="sse"
        onCancel={NOOP}
        onEditLater={NOOP}
      />
    </TourFrame>
  )
}

/** AGT-ACT-001 — Activation welcome hub + skip-wizard dialog. */
export function Act001WelcomeSurface({ skipOpen = false }: { skipOpen?: boolean }) {
  const [open, setOpen] = useState(skipOpen)
  return (
    <div data-wave4a-surface>
      <h1>Activate your workspace</h1>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={5}
        aria-valuenow={2}
        aria-label="Activation progress"
      >
        <Numeric>2</Numeric>/5
      </div>
      <div role="region" aria-labelledby="step-1-title">
        <h2 id="step-1-title">Connect WhatsApp</h2>
        <span className="sr-only">Complete</span>
        <p>Completed via onboarding</p>
        <Button type="button">Open WhatsApp</Button>
      </div>
      <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
        Skip wizard
      </Button>
      <SkipWizardDialog open={open} onOpenChange={setOpen} />
    </div>
  )
}

export function SkipWizardDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Skip activation for now?</DialogTitle>
          <DialogDescription>
            You can finish these steps later from your dashboard.
          </DialogDescription>
        </DialogHeader>
        <Button type="button" autoFocus onClick={() => onOpenChange(false)}>
          Skip for now
        </Button>
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
          Keep going
        </Button>
      </DialogContent>
    </Dialog>
  )
}

/** AGT-ACT-002 — WhatsApp connect step inside the wizard. */
export function Act002WhatsAppSurface() {
  return (
    <div data-wave4a-surface>
      <h1>Connect WhatsApp</h1>
      <WhatsAppHandshakePanel
        displayCode={DISPLAY_CODE}
        sharedNumberE164={SHARED_NUMBER}
        expiresAt={HANDSHAKE_EXPIRES_AT}
        onRegenerate={async () => undefined}
      />
    </div>
  )
}

/** AGT-ACT-003 — First listing step. */
export function Act003FirstListingSurface() {
  return (
    <div data-wave4a-surface>
      <h1>Publish your first listing</h1>
      <DraftListingPreview draftId="act_draft_1" />
      <Button type="button" size="lg">
        Continue
      </Button>
    </div>
  )
}

/** AGT-ACT-004 — Portal credentials (Locked when registry empty). */
export function Act004PortalLockedSurface() {
  return (
    <div data-wave4a-surface>
      <div role="region" aria-labelledby="step-3-title">
        <h1 id="step-3-title">Portal credentials</h1>
        <span className="sr-only">Locked</span>
        <p>Available soon — we&apos;re finalizing your country&apos;s portal list.</p>
      </div>
    </div>
  )
}

/** AGT-ACT-005 — Invite team. */
export function Act005InviteTeamSurface() {
  return (
    <div data-wave4a-surface>
      <h1>Invite your team</h1>
      <label htmlFor="invite-email">Email</label>
      <input id="invite-email" type="email" className="min-h-tap" />
      <Button type="button" size="lg">
        Send invite
      </Button>
    </div>
  )
}

export type Wave4aSurfaceId =
  | 'ONB-001'
  | 'ONB-002'
  | 'ONB-003'
  | 'ONB-004'
  | 'ONB-005'
  | 'WLB-001'
  | 'WLB-002'
  | 'WLB-003'
  | 'WLB-004'
  | 'WLB-005'
  | 'ACT-001'
  | 'ACT-002'
  | 'ACT-003'
  | 'ACT-004'
  | 'ACT-005'

export const WAVE4A_SURFACES: Array<{
  id: Wave4aSurfaceId
  path: string
  render: () => ReactElement
}> = [
  { id: 'ONB-001', path: '/onboarding/welcome', render: () => <Onb001WelcomeSurface /> },
  { id: 'ONB-002', path: '/onboarding/whatsapp', render: () => <Onb002TourSurface /> },
  { id: 'ONB-003', path: '/onboarding/first-listing/draft_1', render: () => <Onb003ReviewSurface /> },
  { id: 'ONB-004', path: '/onboarding/first-listing/published', render: () => <Onb004CelebrationSurface /> },
  { id: 'ONB-005', path: '/dashboard', render: () => <Onb005ChecklistSurface /> },
  { id: 'WLB-001', path: '/onboarding/whatsapp', render: () => <Wlb001ConnectSurface /> },
  { id: 'WLB-002', path: '/onboarding/whatsapp/code', render: () => <Wlb002HandshakeSurface /> },
  { id: 'WLB-003', path: '/onboarding/whatsapp/waiting', render: () => <Wlb003WaitingSurface /> },
  { id: 'WLB-004', path: '/onboarding/whatsapp/drafting/sess_1', render: () => <Wlb004DraftingSurface /> },
  { id: 'WLB-005', path: '/onboarding/whatsapp/drafting/sess_1', render: () => <Wlb005ReadySurface /> },
  { id: 'ACT-001', path: '/activate', render: () => <Act001WelcomeSurface /> },
  { id: 'ACT-002', path: '/activate/whatsapp', render: () => <Act002WhatsAppSurface /> },
  { id: 'ACT-003', path: '/activate/first-listing', render: () => <Act003FirstListingSurface /> },
  { id: 'ACT-004', path: '/activate/portal-credentials', render: () => <Act004PortalLockedSurface /> },
  { id: 'ACT-005', path: '/activate/invite-team', render: () => <Act005InviteTeamSurface /> },
]
