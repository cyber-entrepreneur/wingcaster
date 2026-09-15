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
import { useLocale } from '@/hooks/useLocale'
import { usePageTitle } from '@/lib/usePageTitle'
import { cn } from '@/lib/utils'
import { OnboardingChrome } from './OnboardingChrome'
import { t, type OnboardingLocale } from './copy'
import {
  AddressInlineEditor,
  DescriptionInlineEditor,
  PhotoRailEditor,
  PriceInlineEditor,
  type AddressFields,
} from './editors'
import {
  approveWhatsAppDraft,
  discardWhatsAppDraft,
  getWhatsAppDraft,
  patchOnboardingDraft,
  trackOnboardingEvent,
  type OnboardingDraftPatch,
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
  const extracted = draft.extracted_property as { photo_urls?: string[] } | undefined
  if (Array.isArray(extracted?.photo_urls)) return extracted.photo_urls.filter(Boolean)
  return []
}

function priceOf(draft: WhatsAppDraft): number | null {
  const extracted = draft.extracted_property as { price?: number } | undefined
  if (typeof draft.price === 'number') return draft.price
  if (typeof extracted?.price === 'number') return extracted.price
  if (typeof draft.price === 'string') {
    const n = Number(draft.price.replace(/[^\d.]/g, ''))
    return Number.isFinite(n) ? n : null
  }
  return null
}

function currencyOf(draft: WhatsAppDraft): string {
  const extracted = draft.extracted_property as { currency?: string } | undefined
  return draft.currency || extracted?.currency || 'AED'
}

function priceLabelOf(draft: WhatsAppDraft, locale: string): string | undefined {
  if (typeof draft.priceLabel === 'string') return draft.priceLabel
  const price = priceOf(draft)
  if (price == null) return typeof draft.price === 'string' ? draft.price : undefined
  const currency = currencyOf(draft)
  return `${currency} ${new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US').format(price)}`
}

function mapDraft(draft: WhatsAppDraft, locale: OnboardingLocale): DraftListingPreviewData {
  const extracted = (draft.extracted_property as Record<string, unknown> | undefined) || {}
  return {
    title: draft.title || (typeof extracted.title === 'string' ? extracted.title : undefined),
    priceLabel: priceLabelOf(draft, locale),
    beds: draft.beds ?? (typeof extracted.bedrooms === 'number' ? extracted.bedrooms : undefined),
    baths: draft.baths ?? (typeof extracted.bathrooms === 'number' ? extracted.bathrooms : undefined),
    areaLabel: draft.areaLabel || draft.area,
    address:
      draft.address ||
      (typeof extracted.address === 'string' ? extracted.address : undefined) ||
      (typeof extracted.address_display === 'string' ? extracted.address_display : undefined),
    description:
      draft.description ||
      (typeof extracted.description === 'string' ? extracted.description : undefined),
    photoUrls: photoUrlsOf(draft),
    aiAttribution: t('review.aiAttribution', locale),
  }
}

type ChipKey = 'area_name' | 'building_name' | 'floor'

function missingAddressChips(
  draft: WhatsAppDraft,
  locale: OnboardingLocale,
): Array<{ key: ChipKey; label: string }> {
  const chips: Array<{ key: ChipKey; label: string }> = []
  if (!draft.area_name && !draft.address) chips.push({ key: 'area_name', label: t('review.chip.area', locale) })
  if (!draft.building_name) chips.push({ key: 'building_name', label: t('review.chip.building', locale) })
  if (!draft.floor) chips.push({ key: 'floor', label: t('review.chip.floor', locale) })
  return chips
}

type EditorKind = 'photos' | 'price' | 'address' | 'description' | null

export function FirstListingReviewPage() {
  const { draftId = '' } = useParams<{ draftId: string }>()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { isArabic } = useLocale()
  const onbLocale: OnboardingLocale = isArabic ? 'ar' : 'en'
  const { state, patch, isLoading: stateLoading } = useOnboardingState()
  const online = useOnlineStatus()

  const [draft, setDraft] = useState<WhatsAppDraft | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [editor, setEditor] = useState<EditorKind>(null)
  const [addressFocus, setAddressFocus] = useState<ChipKey | 'address' | undefined>()

  usePageTitle(t('review.progress', onbLocale))

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

  const preview = useMemo(
    () => (draft ? mapDraft(draft, onbLocale) : undefined),
    [draft, onbLocale],
  )
  const photos = preview?.photoUrls ?? []
  const chips = draft ? missingAddressChips(draft, onbLocale) : []
  const propertyId = draft?.property_id || draft?.listing_id || draftId

  const applyPatch = async (body: OnboardingDraftPatch) => {
    if (!draftId) return
    const previous = draft
    setDraft((d) => (d ? ({ ...d, ...body } as WhatsAppDraft) : d))
    try {
      const updated = await patchOnboardingDraft(draftId, body)
      setDraft(updated)
      trackOnboardingEvent('onboarding.draft_edited', { draft_id: draftId, fields: Object.keys(body) })
    } catch {
      setDraft(previous)
      addToast({ variant: 'error', description: t('review.error.patch', onbLocale) })
      throw new Error('patch failed')
    }
  }

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
      addToast({ variant: 'error', description: t('review.error.publish', onbLocale) })
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
      addToast({ description: t('review.toast.discard', onbLocale) })
      navigate('/onboarding/welcome')
    } catch {
      addToast({ variant: 'error', description: t('review.error.discard', onbLocale) })
      setBusy(false)
    }
  }

  const editorHref = `/listings/${propertyId}/edit?returnUrl=${encodeURIComponent(`/onboarding/first-listing/${draftId}`)}`
  const ctasDisabled = busy || publishing || !online
  const editorsDisabled = !online || busy || publishing

  const openAddress = (focus?: ChipKey | 'address') => {
    setAddressFocus(focus)
    setEditor('address')
  }

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
        {t('review.cta.publish', onbLocale)}
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
        {t('review.cta.editor', onbLocale)}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="text-[var(--lc-text-muted)]"
        disabled={publishing}
        onClick={() => setDiscardOpen(true)}
      >
        {t('review.cta.discard', onbLocale)}
      </Button>
    </div>
  )

  const editBtn = (label: string, onClick: () => void) => (
    <button
      type="button"
      className="inline-flex h-tap w-tap min-h-tap min-w-tap items-center justify-center rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-raised)] text-[var(--lc-text-muted)] shadow-[var(--lc-elevation-sm)] hover:bg-[var(--lc-action-secondary)]"
      aria-label={label}
      disabled={editorsDisabled}
      onClick={onClick}
    >
      <Pencil className="h-4 w-4" aria-hidden="true" />
    </button>
  )

  return (
    <div className="min-h-screen bg-[var(--lc-bg-page)] pb-24 text-[var(--lc-text-primary)] md:pb-[var(--lc-space-xl)]">
      <OfflineBanner show={!online} message={t('review.offline', onbLocale)} />
      <OnboardingChrome step={3} label={t('review.progress', onbLocale)} />

      <div className="mx-auto grid max-w-6xl gap-[var(--lc-space-xl)] px-[var(--lc-space-md)] py-[var(--lc-space-lg)] md:grid-cols-[55fr_45fr] md:px-[var(--lc-space-xl)]">
        <div className="flex flex-col gap-[var(--lc-space-md)]">
          <div className="flex items-start gap-[var(--lc-space-sm)]">
            <Sparkles className="mt-1 h-5 w-5 shrink-0 text-[var(--lc-text-brand)]" aria-hidden="true" />
            <CelebrationHeader
              tone="subdued"
              title={t('review.h1', onbLocale)}
              body={t('review.sub', onbLocale)}
              className="items-start py-0 text-start"
            />
          </div>

          {loadError ? (
            <div className="rounded-[var(--lc-radius-xl)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)]">
              <p>{t('review.error.load', onbLocale)}</p>
              <Button className="mt-[var(--lc-space-md)]" onClick={() => void load()}>
                {t('review.refresh', onbLocale)}
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
                <div className="absolute end-3 top-3 flex flex-col gap-2">
                  {editBtn(t('review.edit.photos', onbLocale), () => setEditor('photos'))}
                  {editBtn(t('review.edit.price', onbLocale), () => setEditor('price'))}
                  {editBtn(t('review.edit.address', onbLocale), () => openAddress('address'))}
                  {editBtn(t('review.edit.description', onbLocale), () => setEditor('description'))}
                </div>
              ) : null}
            </div>
          )}

          {photos.length < 3 && !loading && draft ? (
            <p className="text-[var(--lc-text-brand)]" style={{ font: 'var(--lc-type-body-sm)' }}>
              {t('review.photoNudge', onbLocale)}
            </p>
          ) : null}

          {chips.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {chips.map((chip) => (
                <li key={chip.key}>
                  <button
                    type="button"
                    className="min-h-tap rounded-[var(--lc-radius-md)] border border-dashed border-[var(--lc-border-strong)] px-3 text-[var(--lc-text-muted)]"
                    style={{ font: 'var(--lc-type-caption)' }}
                    disabled={editorsDisabled}
                    onClick={() => openAddress(chip.key)}
                  >
                    {chip.label}
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
              {t('review.publishWhat', onbLocale)}
            </h2>
            <ul className="flex flex-col gap-3 text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-body-sm)' }}>
              <li>{t('review.publish.1', onbLocale)}</li>
              <li>{t('review.publish.2', onbLocale)}</li>
              <li>{t('review.publish.3', onbLocale)}</li>
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
            {t('review.cta.editor', onbLocale)}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="flex-1 text-[var(--lc-text-muted)]"
            disabled={publishing}
            onClick={() => setDiscardOpen(true)}
          >
            {t('review.cta.discard', onbLocale)}
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
          {t('review.cta.publish', onbLocale)}
        </Button>
      </div>

      <PublishingOverlay
        open={publishing}
        label={t('review.publishing', onbLocale)}
        className="bg-[var(--lc-surface-inverse)]/40 duration-slow ease-emphasis"
      />

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('review.discard.title', onbLocale)}</DialogTitle>
            <DialogDescription>{t('review.discard.body', onbLocale)}</DialogDescription>
          </DialogHeader>
          <div className="mt-[var(--lc-space-md)] flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setDiscardOpen(false)}>
              {t('review.discard.cancel', onbLocale)}
            </Button>
            <Button type="button" variant="destructive" onClick={() => void handleDiscard()}>
              {t('review.discard.confirm', onbLocale)}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {draft ? (
        <>
          <PhotoRailEditor
            open={editor === 'photos'}
            onOpenChange={(open) => setEditor(open ? 'photos' : null)}
            photoUrls={photos}
            locale={onbLocale}
            disabled={editorsDisabled}
            onSave={(photoUrls) => applyPatch({ photo_urls: photoUrls })}
          />
          <PriceInlineEditor
            open={editor === 'price'}
            onOpenChange={(open) => setEditor(open ? 'price' : null)}
            price={priceOf(draft)}
            currency={currencyOf(draft)}
            locale={onbLocale}
            disabled={editorsDisabled}
            onSave={(payload) => applyPatch(payload)}
          />
          <AddressInlineEditor
            open={editor === 'address'}
            onOpenChange={(open) => setEditor(open ? 'address' : null)}
            initial={{
              address: draft.address,
              area_name: draft.area_name,
              building_name: draft.building_name,
              floor: draft.floor,
              lat: typeof draft.lat === 'number' ? draft.lat : undefined,
              lng: typeof draft.lng === 'number' ? draft.lng : undefined,
            }}
            locale={onbLocale}
            disabled={editorsDisabled}
            focusField={addressFocus}
            onSave={(fields: AddressFields) => applyPatch(fields)}
          />
          <DescriptionInlineEditor
            open={editor === 'description'}
            onOpenChange={(open) => setEditor(open ? 'description' : null)}
            description={draft.description || ''}
            locale={onbLocale}
            disabled={editorsDisabled}
            onSave={(description) => applyPatch({ description })}
          />
        </>
      ) : null}
    </div>
  )
}
