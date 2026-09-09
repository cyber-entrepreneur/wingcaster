import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Pencil, Rocket, Sparkles } from 'lucide-react'
import { useOnboardingState } from '@/hooks/useOnboardingState'
import {
  CelebrationHeader,
  DraftListingPreview,
  OfflineBanner,
  PublishingOverlay,
  type DraftListingPreviewData,
} from '@/components/onboarding'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { usePageTitle } from '@/lib/usePageTitle'
import { cn } from '@/lib/utils'
import { OnboardingChrome } from './OnboardingChrome'
import {
  approveWhatsAppDraft,
  discardWhatsAppDraft,
  getWhatsAppDraft,
  trackOnboardingEvent,
  type WhatsAppDraft,
} from './onboardingApi'
import { useOnlineStatus } from './useOnlineStatus'
import {
  isPatchConflict,
  ONB_CELEBRATION_LISTING_KEY,
  ONB_DISCARD_TOAST_KEY,
  resumeRouteForStep,
  writeSessionFlag,
} from './helpers'

function photoUrlsOf(draft: WhatsAppDraft): string[] {
  if (Array.isArray(draft.photo_urls)) return draft.photo_urls.filter(Boolean)
  if (Array.isArray(draft.photos)) {
    return draft.photos
      .map((item) => (typeof item === 'string' ? item : item?.url))
      .filter((url): url is string => Boolean(url))
  }
  return []
}

function priceLabelOf(draft: WhatsAppDraft): string | undefined {
  if (typeof draft.priceLabel === 'string') return draft.priceLabel
  if (typeof draft.price === 'string') return draft.price
  if (typeof draft.price === 'number') {
    const currency = draft.currency || 'AED'
    return `${currency} ${new Intl.NumberFormat('en-US').format(draft.price)}`
  }
  return undefined
}

function mapDraft(draft: WhatsAppDraft): DraftListingPreviewData {
  return {
    title: draft.title,
    priceLabel: priceLabelOf(draft),
    beds: draft.beds,
    baths: draft.baths,
    areaLabel: draft.areaLabel || draft.area,
    address: draft.address,
    description: draft.description,
    photoUrls: photoUrlsOf(draft),
    aiAttribution:
      'Drafted by WingCaster AI from your voice memo · you can edit anything before publishing.',
  }
}

function missingAddressChips(draft: WhatsAppDraft): string[] {
  const chips: string[] = []
  if (!draft.area_name && !draft.address) chips.push('Add area')
  if (!draft.building_name) chips.push('Add building name')
  if (!draft.floor) chips.push('Add floor')
  return chips
}

export function FirstListingReviewPage() {
  const { draftId = '' } = useParams<{ draftId: string }>()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { state, patch, isLoading: stateLoading } = useOnboardingState()
  const online = useOnlineStatus()

  const [draft, setDraft] = useState<WhatsAppDraft | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  usePageTitle('Review your listing')

  const load = useCallback(async () => {
    if (!draftId) return
    setLoading(true)
    setLoadError(false)
    try {
      const data = await getWhatsAppDraft(draftId)
      if (data.status === 'collecting') {
        navigate('/onboarding/whatsapp', { replace: true })
        return
      }
      setDraft(data)
      trackOnboardingEvent('onboarding.draft_reviewed', { draft_id: draftId })
    } catch (error) {
      if ((error as { status?: number }).status === 404) {
        addToast({ description: 'That draft is no longer available.' })
        navigate('/onboarding/welcome', { replace: true })
        return
      }
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [addToast, draftId, navigate])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (stateLoading) return
    if (state.step === 'draft_review') return
    const next = resumeRouteForStep(state.step, draftId)
    if (next) navigate(next, { replace: true })
  }, [draftId, navigate, state.step, stateLoading])

  const preview = useMemo(() => (draft ? mapDraft(draft) : undefined), [draft])
  const photos = preview?.photoUrls ?? []
  const chips = draft ? missingAddressChips(draft) : []
  const propertyId = draft?.property_id || draft?.listing_id || draftId

  const handlePublish = async () => {
    if (!draftId || publishing) return
    setPublishing(true)
    setBusy(true)
    try {
      const result = await approveWhatsAppDraft(draftId)
      const liveId = result.result?.property_id || result.result?.id || propertyId
      writeSessionFlag(
        ONB_CELEBRATION_LISTING_KEY,
        JSON.stringify({
          id: liveId,
          priceLabel: preview?.priceLabel,
          address: preview?.address,
          photoUrl: photos[0],
        }),
      )
      try {
        await patch({
          step: 'first_published',
          checklist_delta: { first_listing_published: true, first_listing_drafted: true },
        })
      } catch (error) {
        if (!isPatchConflict(error)) {
          /* celebration still proceeds — state is bookkeeping */
        }
      }
      trackOnboardingEvent('onboarding.draft_published', { draft_id: draftId })
      navigate('/onboarding/first-listing/published')
    } catch {
      addToast({ variant: 'error', description: "Publishing didn't go through. Try again?" })
      setPublishing(false)
      setBusy(false)
    }
  }

  const handleDiscard = async () => {
    if (!draftId) return
    setBusy(true)
    try {
      await discardWhatsAppDraft(draftId)
      await patch({ step: 'whatsapp_intake_pending', path: 'whatsapp' })
      writeSessionFlag(ONB_DISCARD_TOAST_KEY, '1')
      trackOnboardingEvent('onboarding.draft_discarded', { draft_id: draftId })
      addToast({
        description:
          'Draft discarded. Send us new photos + a voice memo on WhatsApp whenever you\'re ready.',
      })
      navigate('/onboarding/welcome')
    } catch {
      addToast({ variant: 'error', description: "We couldn't discard that draft. Try again?" })
      setBusy(false)
    }
  }

  const editorHref = `/listings/${propertyId}/edit?returnUrl=${encodeURIComponent(`/onboarding/first-listing/${draftId}`)}`
  const ctasDisabled = busy || publishing || !online

  const actionColumn = (
    <div className="flex flex-col gap-[var(--lc-space-sm)]">
      <Button
        type="button"
        variant="default"
        size="lg"
        className="h-14 w-full"
        disabled={ctasDisabled}
        onClick={() => void handlePublish()}
      >
        <Rocket className="me-2 h-4 w-4" aria-hidden="true" />
        Publish my first listing
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={publishing}
        onClick={() => {
          trackOnboardingEvent('onboarding.draft_edited', { draft_id: draftId })
          navigate(editorHref)
        }}
      >
        Open full editor
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="text-[var(--lc-text-muted)]"
        disabled={publishing}
        onClick={() => setDiscardOpen(true)}
      >
        Discard and start over
      </Button>
    </div>
  )

  return (
    <div className="min-h-screen bg-[var(--lc-bg-page)] pb-24 text-[var(--lc-text-primary)] md:pb-[var(--lc-space-xl)]">
      <OfflineBanner
        show={!online}
        message="You're offline. Editing is paused until you reconnect."
      />
      <OnboardingChrome step={3} label="Review your listing" />

      <div className="mx-auto grid max-w-6xl gap-[var(--lc-space-xl)] px-[var(--lc-space-md)] py-[var(--lc-space-lg)] md:grid-cols-[55fr_45fr] md:px-[var(--lc-space-xl)]">
        <div className="flex flex-col gap-[var(--lc-space-md)]">
          <div className="flex items-start gap-[var(--lc-space-sm)]">
            <Sparkles className="mt-1 h-5 w-5 shrink-0 text-[var(--lc-text-brand)]" aria-hidden="true" />
            <CelebrationHeader
              tone="subdued"
              title="We drafted your first listing from your voice memo."
              body="Look it over. Change anything. Then publish when you're ready."
              className="items-start py-0 text-start"
            />
          </div>

          {loadError ? (
            <div className="rounded-[var(--lc-radius-xl)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)]">
              <p>We couldn&apos;t load your draft. Refresh?</p>
              <Button className="mt-[var(--lc-space-md)]" onClick={() => void load()}>
                Refresh
              </Button>
            </div>
          ) : (
            <div className="relative">
              <DraftListingPreview
                draftId={draftId}
                draft={preview}
                loading={loading || !draft}
                className="rounded-[var(--lc-radius-xl)] shadow-[var(--lc-elevation-md)]"
              />
              {!loading && draft ? (
                <button
                  type="button"
                  className="absolute end-3 top-3 inline-flex h-tap w-tap items-center justify-center rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-raised)] text-[var(--lc-text-muted)] shadow-[var(--lc-elevation-sm)] hover:bg-[var(--lc-action-secondary)]"
                  aria-label="Edit in full editor"
                  disabled={!online}
                  onClick={() => navigate(editorHref)}
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          )}

          {photos.length < 3 && !loading && draft ? (
            <p className="text-[var(--lc-text-brand)]" style={{ font: 'var(--lc-type-body-sm)' }}>
              Send more photos on WhatsApp →
            </p>
          ) : null}

          {chips.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {chips.map((chip) => (
                <li key={chip}>
                  <button
                    type="button"
                    className="min-h-tap rounded-[var(--lc-radius-md)] border border-dashed border-[var(--lc-border-strong)] px-3 text-[var(--lc-text-muted)]"
                    style={{ font: 'var(--lc-type-caption)' }}
                    onClick={() => navigate(editorHref)}
                  >
                    {chip}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <aside className="hidden md:flex md:flex-col md:gap-[var(--lc-space-lg)]">
          <section className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)] shadow-[var(--lc-elevation-sm)]">
            <h2
              className="mb-[var(--lc-space-md)] text-[var(--lc-text-heading)]"
              style={{ font: 'var(--lc-type-heading-3)' }}
            >
              What happens when you publish
            </h2>
            <ul className="flex flex-col gap-3 text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-body-sm)' }}>
              <li>Your listing goes live on your WingCaster public page.</li>
              <li>We&apos;ll suggest which social channels to post to next.</li>
              <li>You keep control — edit or unpublish anytime.</li>
            </ul>
          </section>
          {actionColumn}
        </aside>
      </div>

      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-sticky border-t border-[var(--lc-border)]',
          'bg-[var(--lc-surface-raised)] px-[var(--lc-space-md)] pt-[var(--lc-space-sm)]',
          'pb-[calc(var(--lc-space-sm)+env(safe-area-inset-bottom,0px))] md:hidden',
        )}
      >
        <div className="mb-2 flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={publishing}
            onClick={() => navigate(editorHref)}
          >
            Open full editor
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="flex-1 text-[var(--lc-text-muted)]"
            disabled={publishing}
            onClick={() => setDiscardOpen(true)}
          >
            Discard and start over
          </Button>
        </div>
        <Button
          type="button"
          variant="default"
          size="lg"
          className="h-14 w-full"
          disabled={ctasDisabled}
          onClick={() => void handlePublish()}
        >
          <Rocket className="me-2 h-4 w-4" aria-hidden="true" />
          Publish my first listing
        </Button>
      </div>

      <PublishingOverlay
        open={publishing}
        label="Publishing to WingCaster… syndicating to your channels…"
        className="bg-[var(--lc-surface-inverse)]/40 duration-slow ease-emphasis"
      />

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard this draft?</DialogTitle>
            <DialogDescription>
              Your photos and voice memo will be removed. You can start a new listing from WhatsApp
              anytime.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-[var(--lc-space-md)] flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setDiscardOpen(false)}>
              Keep the draft
            </Button>
            <Button type="button" variant="destructive" onClick={() => void handleDiscard()}>
              Yes, discard
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
