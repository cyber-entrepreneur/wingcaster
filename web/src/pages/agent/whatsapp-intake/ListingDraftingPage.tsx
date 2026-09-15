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
import { useLocale } from '@/hooks/useLocale'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { discardDraft } from './intakeApi'
import { useOnboardingState } from '@/hooks/useOnboardingState'
import { markWhatsAppIntakeProgress } from './useOnboardingState'
import { useDraftProgress } from './useDraftProgress'
import { useOnlineStatus } from './useOnlineStatus'
import { buildWaMeLink } from './waMeLink'
import { buildCompletionPath, TOUR_STEPS } from './tour'
import { StickyCtaBar, WhatsAppTourShell } from './WhatsAppTourShell'
import { waLocale, waT, type WaLocale } from './copy'

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
  const { isArabic } = useLocale()
  const locale = waLocale(isArabic)
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

  const reducedMotion = usePrefersReducedMotion()

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
      title: waT('draft.toast.saved', locale),
      variant: 'success',
    })
    navigate('/agent/whatsapp-listings')
  }

  const onEditLater = () => {
    addToast({
      title: waT('draft.toast.editLater', locale),
      variant: 'default',
    })
    navigate('/agent/whatsapp-listings')
  }

  const onCancelConfirm = async () => {
    setCancelling(true)
    if (progress.draftId) {
      const result = await discardDraft(progress.draftId)
      if (!result.ok) {
        addToast({ title: waT('draft.toast.cancelError', locale), variant: 'error' })
        setCancelling(false)
        return
      }
    }
    addToast({ title: waT('draft.toast.cancelled', locale), variant: 'default' })
    navigate('/dashboard')
  }

  const tourStep = phase === 'ready' ? TOUR_STEPS.ready : TOUR_STEPS.drafting

  if (progress.error && !progress.isReady) {
    return (
      <WhatsAppTourShell
        step={TOUR_STEPS.drafting}
        title={waT('draft.title', locale)}
        offline={!online}
        offlineMessage={waT('shell.offline.drafting', locale)}
      >
        <div className="mx-auto max-w-lg px-[var(--lc-space-md)] py-[var(--lc-space-xl)] text-center">
          <AlertOctagon className="mx-auto h-10 w-10 text-[var(--lc-text-brand)]" aria-hidden />
          <h1 className="mt-[var(--lc-space-md)] text-[length:var(--lc-type-heading-1)] text-[var(--lc-text-primary)]">
            {waT('draft.error.title', locale)}
          </h1>
          <p className="mt-[var(--lc-space-sm)] text-[length:var(--lc-type-body-lg)] text-[var(--lc-text-secondary)]">
            {waT('draft.error.body', locale, { error: progress.error })}
          </p>
          <div className="mt-[var(--lc-space-lg)] flex flex-col gap-2">
            <Button type="button" size="lg" onClick={() => navigate('/onboarding/whatsapp/waiting')}>
              {waT('draft.error.back', locale)}
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate('/dashboard')}>
              {waT('draft.error.support', locale)}
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
      step={tourStep}
      title={drafting ? waT('draft.title', locale) : waT('draft.ready.titleBar', locale)}
      offline={!online}
      offlineMessage={waT('shell.offline.drafting', locale)}
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
            locale={locale}
            onCancel={() => setCancelOpen(true)}
            onEditLater={onEditLater}
          />
        ) : (
          <ReadyBody
            listing={listing}
            onReview={() => void onReview()}
            publishing={publishing}
            liveRef={liveRef}
            locale={locale}
          />
        )}
      </div>

      <StickyCtaBar>
        {drafting ? (
          <div className="flex flex-col gap-[var(--lc-space-xs)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button type="button" variant="ghost" className="text-[var(--lc-text-muted)]" onClick={() => setCancelOpen(true)}>
                {waT('draft.cta.cancel', locale)}
              </Button>
              <Button type="button" variant="ghost" className="text-[var(--lc-text-muted)]" onClick={onEditLater}>
                {waT('draft.cta.editLater', locale)}
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
                waT('draft.cta.review', locale)
              ) : (
                <>
                  {waT('draft.cta.drafting', locale)} (
                  <Numeric>
                    {progress.completedCount}/{progress.totalCount}
                  </Numeric>{' '}
                  {waT('draft.cta.fields', locale)})
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
                  {waT('draft.cta.saving', locale)}
                </>
              ) : (
                waT('draft.cta.saveLater', locale)
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
                  {waT('draft.cta.opening', locale)}
                </>
              ) : (
                <>
                  {waT('draft.cta.review', locale)}
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
            <DialogTitle>{waT('draft.cancel.title', locale)}</DialogTitle>
            <DialogDescription>{waT('draft.cancel.body', locale)}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setCancelOpen(false)}>
              {waT('draft.cancel.keep', locale)}
            </Button>
            <Button type="button" variant="ghost" disabled={cancelling} onClick={() => void onCancelConfirm()}>
              {cancelling ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />
                  {waT('draft.cancel.busy', locale)}
                </>
              ) : (
                waT('draft.cancel.confirm', locale)
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
  locale,
  onCancel,
  onEditLater,
}: {
  progress: ReturnType<typeof useDraftProgress>
  fallback: boolean
  routeState: DraftingLocationState
  waLink: string
  online: boolean
  locale: WaLocale
  onCancel: () => void
  onEditLater: () => void
}) {
  const received = routeState.received_at || new Date().toISOString()
  return (
    <div className="mx-auto grid w-full max-w-[1080px] gap-[var(--lc-space-md)] px-[var(--lc-space-md)] py-[var(--lc-space-md)] md:grid-cols-2">
      <div className="md:col-span-1">
        <StepHero
          glyph={Sparkles}
          title={waT('draft.hero.title', locale)}
          body={waT('draft.hero.body', locale)}
        />
      </div>
      <InboundMessageSummary
        received_at={received}
        relativeTimeLabel={relativeTime(received, locale)}
        attachments={routeState.attachments ?? []}
        wa_me_link={waLink}
        className="md:col-span-1"
      />

      <div className="md:col-span-2">
        {fallback ? (
          <div className="flex flex-col items-center gap-[var(--lc-space-md)] py-[var(--lc-space-3xl)] text-center">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--lc-text-brand)]" aria-hidden />
            <p className="text-[length:var(--lc-type-body-lg)] text-[var(--lc-text-secondary)]">
              {waT('draft.fallback', locale)}
            </p>
          </div>
        ) : (
          <LiveDraftCanvas
            fields={progress.fields}
            connection={progress.connection}
            onCancel={onCancel}
            onEditLater={onEditLater}
          />
        )}
        {progress.isConnecting && !fallback ? (
          <p className="mt-[var(--lc-space-sm)] text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
            {waT('draft.connecting', locale)}
          </p>
        ) : null}
        {!online ? (
          <p className="mt-[var(--lc-space-sm)] text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
            {waT('draft.serverSide', locale)}
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
  locale,
}: {
  listing: ListingPreviewListing
  onReview: () => void
  publishing: boolean
  liveRef: RefObject<HTMLDivElement>
  locale: WaLocale
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
        {waT('ready.live', locale)}
      </div>

      <StepHero
        glyph={CheckCircle2}
        emphasis="success"
        title={waT('ready.hero.title', locale)}
        body={waT('ready.hero.body', locale)}
      />

      <div className="mt-[var(--lc-space-lg)] grid gap-[var(--lc-space-lg)] md:grid-cols-[55%_1fr]">
        <ListingPreviewCard listing={listing} variant="preview" onTap={publishing ? undefined : onReview} />

        <aside className="md:sticky md:top-[var(--lc-space-3xl)]">
          <section className="rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)] p-[var(--lc-space-lg)]">
            <p className="mb-[var(--lc-space-md)] text-[length:var(--lc-type-overline)] uppercase tracking-wide text-[var(--lc-text-muted)]">
              {waT('ready.caught.title', locale)}
            </p>
            <ul className="flex flex-col gap-[var(--lc-space-sm)] text-sm text-[var(--lc-text-primary)]">
              <CaughtLine>{waT('ready.caught.address', locale)}</CaughtLine>
              {listing.price != null ? <CaughtLine>{waT('ready.caught.price', locale)}</CaughtLine> : null}
              {listing.photos.length ? <CaughtLine>{waT('ready.caught.photos', locale)}</CaughtLine> : null}
              {hasBeds || hasBaths ? (
                <CaughtLine>{waT('ready.caught.beds', locale)}</CaughtLine>
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

function relativeTime(iso: string, locale: WaLocale): string {
  const ms = Date.now() - Date.parse(iso)
  if (!Number.isFinite(ms) || ms < 15_000) return waT('ready.relative.justNow', locale)
  const mins = Math.round(ms / 60_000)
  if (mins < 1) return waT('ready.relative.justNow', locale)
  if (mins === 1) return waT('ready.relative.min', locale)
  if (mins < 60) return waT('ready.relative.mins', locale, { n: mins })
  const hours = Math.round(mins / 60)
  return hours === 1
    ? waT('ready.relative.hour', locale)
    : waT('ready.relative.hours', locale, { n: hours })
}

