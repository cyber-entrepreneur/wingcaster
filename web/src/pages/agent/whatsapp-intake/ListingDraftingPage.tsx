import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { AlertOctagon, ArrowRight, Check, CheckCircle2, Loader2, Sparkles } from 'lucide-react'
import {
  InboundMessageSummary,
  ListingPreviewCard,
  LiveDraftCanvas,
  StepHero,
  type DraftField,
  type ListingPreviewListing,
} from '@/components/onboarding/whatsapp'
import { Button } from '@/components/ui/button'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { discardDraft } from './intakeApi'
import { markWhatsAppIntakeProgress, useOnboardingState } from './useOnboardingState'
import { useDraftProgress } from './useDraftProgress'
import { useOnlineStatus } from './useOnlineStatus'
import { buildWaMeLink } from './waMeLink'
import { buildCompletionPath } from './tour'
import { StickyCtaBar, WhatsAppTourShell } from './WhatsAppTourShell'

export interface DraftingLocationState {
  draft_session_id?: string
  received_at?: string
  phone_e164?: string
  attachments?: Array<{ type: string; count?: number; duration?: number | string }>
}

const CROSS_FADE_MS = 1200

export function ListingDraftingPage() {
  const { sessionId = '' } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { addToast } = useToast()
  const onboarding = useOnboardingState()
  const online = useOnlineStatus()
  const routeState = (location.state || {}) as DraftingLocationState

  const progress = useDraftProgress(sessionId)
  const [phase, setPhase] = useState<'drafting' | 'ready'>('drafting')
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [saving, setSaving] = useState(false)
  const fadeTimer = useRef<number | null>(null)
  const liveRef = useRef<HTMLDivElement>(null)

  const reducedMotion = useReducedMotion()

  useEffect(() => {
    if (!progress.isReady || phase === 'ready') return
    const delay = reducedMotion ? 0 : CROSS_FADE_MS
    fadeTimer.current = window.setTimeout(() => setPhase('ready'), delay)
    return () => {
      if (fadeTimer.current != null) window.clearTimeout(fadeTimer.current)
    }
  }, [progress.isReady, phase, reducedMotion])

  useEffect(() => {
    if (phase !== 'ready') return
    liveRef.current?.focus()
  }, [phase])

  const listing = useMemo(
    () => listingFromFields(progress.fields, progress.draftId || sessionId),
    [progress.fields, progress.draftId, sessionId],
  )

  const waLink = routeState.phone_e164
    ? buildWaMeLink(routeState.phone_e164, '')
    : 'https://wa.me/'

  const goReadyNow = () => {
    if (fadeTimer.current != null) window.clearTimeout(fadeTimer.current)
    setPhase('ready')
  }

  const onReview = async () => {
    if (phase === 'drafting' && progress.isReady) {
      goReadyNow()
      return
    }
    if (phase !== 'ready') return
    setPublishing(true)
    const listingId = progress.draftId || listing.id || sessionId
    await markWhatsAppIntakeProgress(onboarding, { kind: 'draft_ready', listingId })
    navigate(buildCompletionPath(listingId))
  }

  const onSaveLater = async () => {
    setSaving(true)
    const listingId = progress.draftId || listing.id || sessionId
    await markWhatsAppIntakeProgress(onboarding, { kind: 'draft_ready', listingId })
    addToast({
      title: 'Your listing is saved as a draft. Publish anytime.',
      variant: 'success',
    })
    navigate('/agent/whatsapp-listings')
  }

  const onEditLater = () => {
    addToast({
      title: "We'll keep drafting — find it in your Drafts tab.",
      variant: 'default',
    })
    navigate('/agent/whatsapp-listings')
  }

  const onCancelConfirm = async () => {
    setCancelling(true)
    if (progress.draftId) {
      await discardDraft(progress.draftId)
    }
    addToast({ title: 'Draft cancelled.', variant: 'default' })
    navigate('/dashboard')
  }

  if (progress.error && !progress.isReady) {
    return (
      <WhatsAppTourShell step={5} title="Drafting your listing" offline={!online}>
        <div className="mx-auto max-w-lg px-[var(--lc-space-md)] py-[var(--lc-space-xl)] text-center">
          <AlertOctagon className="mx-auto h-10 w-10 text-[var(--lc-text-brand)]" aria-hidden />
          <h1 className="mt-[var(--lc-space-md)] text-[length:var(--lc-type-heading-1)] text-[var(--lc-text-primary)]">
            We couldn't finish your draft
          </h1>
          <p className="mt-[var(--lc-space-sm)] text-[length:var(--lc-type-body-lg)] text-[var(--lc-text-secondary)]">
            {progress.error}. Send another WhatsApp message to try again.
          </p>
          <div className="mt-[var(--lc-space-lg)] flex flex-col gap-2">
            <Button type="button" size="lg" onClick={() => navigate('/onboarding/whatsapp/waiting')}>
              Back to WhatsApp
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate('/dashboard')}>
              Contact support
            </Button>
          </div>
        </div>
      </WhatsAppTourShell>
    )
  }

  const drafting = phase === 'drafting'
  const fallback = progress.transport === 'fallback'

  return (
    <WhatsAppTourShell
      step={5}
      title={drafting ? 'Drafting your listing' : 'Your listing is ready'}
      offline={!online}
      offlineMessage="You're offline — drafting continues on our side."
    >
      <div
        className="transition-opacity duration-[var(--lc-duration-slow)] ease-[var(--lc-easing-emphasis)] motion-reduce:transition-none"
        aria-busy={cancelling || publishing || saving || undefined}
      >
        {drafting ? (
          <DraftingBody
            progress={progress}
            fallback={fallback}
            routeState={routeState}
            waLink={waLink}
            online={online}
          />
        ) : (
          <ReadyBody
            listing={listing}
            onReview={() => void onReview()}
            publishing={publishing}
            liveRef={liveRef}
          />
        )}
      </div>

      <StickyCtaBar>
        {drafting ? (
          <div className="flex flex-col gap-[var(--lc-space-xs)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button type="button" variant="ghost" className="text-[var(--lc-text-muted)]" onClick={() => setCancelOpen(true)}>
                Cancel this draft
              </Button>
              <Button type="button" variant="ghost" className="text-[var(--lc-text-muted)]" onClick={onEditLater}>
                Edit later
              </Button>
            </div>
            <Button
              type="button"
              variant="default"
              size="lg"
              className="w-full"
              disabled={!progress.isReady}
              onClick={() => void onReview()}
            >
              {progress.isReady ? (
                'Review & publish →'
              ) : (
                <>
                  Drafting… (
                  <Numeric>
                    {progress.completedCount}/{progress.totalCount}
                  </Numeric>{' '}
                  fields)
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-[var(--lc-space-xs)]">
            <Button
              type="button"
              variant="ghost"
              className="w-full text-[var(--lc-text-muted)]"
              disabled={saving}
              onClick={() => void onSaveLater()}
            >
              {saving ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />
                  Saving to Drafts…
                </>
              ) : (
                "Save for later — I'll review in Drafts"
              )}
            </Button>
            <Button
              type="button"
              variant="default"
              size="lg"
              className="w-full"
              disabled={publishing}
              onClick={() => void onReview()}
            >
              {publishing ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />
                  Opening review…
                </>
              ) : (
                <>
                  Review & publish →
                  <ArrowRight className="ms-2 h-4 w-4" aria-hidden />
                </>
              )}
            </Button>
          </div>
        )}
      </StickyCtaBar>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this draft?</DialogTitle>
            <DialogDescription>
              We'll delete what's been drafted so far. You can send a new WhatsApp message anytime to start
              over.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setCancelOpen(false)}>
              Keep drafting
            </Button>
            <Button type="button" variant="ghost" disabled={cancelling} onClick={() => void onCancelConfirm()}>
              {cancelling ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />
                  Cancelling…
                </>
              ) : (
                'Cancel draft'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </WhatsAppTourShell>
  )
}

function DraftingBody({
  progress,
  fallback,
  routeState,
  waLink,
  online,
}: {
  progress: ReturnType<typeof useDraftProgress>
  fallback: boolean
  routeState: DraftingLocationState
  waLink: string
  online: boolean
}) {
  const received = routeState.received_at || new Date().toISOString()
  return (
    <div className="mx-auto grid w-full max-w-[1080px] gap-[var(--lc-space-md)] px-[var(--lc-space-md)] py-[var(--lc-space-md)] md:grid-cols-2">
      <div className="md:col-span-1">
        <StepHero
          glyph={Sparkles}
          title="Turning your message into a listing"
          body="You'll see each field fill in as I read your photos, voice, and pin. You can review and edit everything on the next screen."
        />
      </div>
      <InboundMessageSummary
        received_at={received}
        relativeTimeLabel={relativeTime(received)}
        attachments={routeState.attachments ?? []}
        wa_me_link={waLink}
        className="md:col-span-1"
      />

      <div className="md:col-span-2">
        {fallback ? (
          <div className="flex flex-col items-center gap-[var(--lc-space-md)] py-[var(--lc-space-3xl)] text-center">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--lc-text-brand)]" aria-hidden />
            <p className="text-[length:var(--lc-type-body-lg)] text-[var(--lc-text-secondary)]">
              Drafting your listing… this usually takes 15-30s.
            </p>
          </div>
        ) : (
          <LiveDraftCanvas
            fields={progress.fields}
            connection={progress.connection}
            onCancel={() => undefined}
            onEditLater={() => undefined}
          />
        )}
        {progress.isConnecting && !fallback ? (
          <p className="mt-[var(--lc-space-sm)] text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
            Connecting…
          </p>
        ) : null}
        {!online ? (
          <p className="mt-[var(--lc-space-sm)] text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
            Draft continues server-side.
          </p>
        ) : null}
      </div>
    </div>
  )
}

function ReadyBody({
  listing,
  onReview,
  publishing,
  liveRef,
}: {
  listing: ListingPreviewListing
  onReview: () => void
  publishing: boolean
  liveRef: RefObject<HTMLDivElement>
}) {
  const hasBeds = listing.bedrooms != null
  const hasBaths = listing.bathrooms != null
  return (
    <div className="mx-auto w-full max-w-[1080px] px-[var(--lc-space-md)] py-[var(--lc-space-md)]">
      <div
        ref={liveRef}
        tabIndex={-1}
        aria-live="polite"
        className="sr-only"
      >
        Your listing is ready. Review and publish, or save for later.
      </div>

      <StepHero
        glyph={CheckCircle2}
        emphasis="success"
        title="Your listing is ready"
        body="Review the details, tweak anything you want, then publish to Bazaar and your connected portals."
      />

      <div className="mt-[var(--lc-space-lg)] grid gap-[var(--lc-space-lg)] md:grid-cols-[55%_1fr]">
        <ListingPreviewCard listing={listing} variant="preview" onTap={publishing ? undefined : onReview} />

        <aside className="md:sticky md:top-[var(--lc-space-3xl)]">
          <section className="rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)] p-[var(--lc-space-lg)]">
            <p className="mb-[var(--lc-space-md)] text-[length:var(--lc-type-overline)] uppercase tracking-wide text-[var(--lc-text-muted)]">
              What we caught
            </p>
            <ul className="flex flex-col gap-[var(--lc-space-sm)] text-sm text-[var(--lc-text-primary)]">
              <CaughtLine>Address extracted from your voice note + location pin</CaughtLine>
              {listing.price != null ? <CaughtLine>Price extracted from your voice note</CaughtLine> : null}
              {listing.photos.length ? <CaughtLine>Photos organized by room type</CaughtLine> : null}
              {hasBeds || hasBaths ? (
                <CaughtLine>Bedrooms + bathrooms extracted from your voice note</CaughtLine>
              ) : null}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}

function CaughtLine({ children }: { children: string }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--lc-accent-bold-edge)]" aria-hidden />
      {children}
    </li>
  )
}

function listingFromFields(fields: DraftField[], id: string): ListingPreviewListing {
  const get = (key: string) => fields.find((f) => f.key === key)
  const photosRaw = get('photos')?.value
  const photos = Array.isArray(photosRaw) ? photosRaw.filter((u) => typeof u === 'string') : []
  const beds = get('bedrooms')?.value
  const baths = get('bathrooms')?.value
  const area = get('area_sqft')?.value
  const price = get('price')?.value
  const address = String(get('address')?.value || 'Listing draft')
  const description = get('description')?.value
  return {
    id,
    address,
    photos,
    bedrooms: typeof beds === 'number' ? beds : Number.isFinite(Number(beds)) && beds != null ? Number(beds) : undefined,
    bathrooms: typeof baths === 'number' ? baths : Number.isFinite(Number(baths)) && baths != null ? Number(baths) : undefined,
    area: typeof area === 'number' ? area : Number.isFinite(Number(area)) && area != null ? Number(area) : undefined,
    price: typeof price === 'number' ? price : Number.isFinite(Number(price)) && price != null && String(price).trim() !== '' ? Number(String(price).replace(/[^\d.]/g, '')) || undefined : undefined,
    currency: 'AED',
    description: typeof description === 'string' ? description : undefined,
    status: 'draft',
  }
}

function relativeTime(iso: string): string {
  const ms = Date.now() - Date.parse(iso)
  if (!Number.isFinite(ms) || ms < 15_000) return 'just now'
  const mins = Math.round(ms / 60_000)
  if (mins < 1) return 'just now'
  if (mins === 1) return '1 min ago'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  return hours === 1 ? '1 hour ago' : `${hours} hours ago`
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}
