import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { api } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/toast'
import { usePageTitle } from '@/lib/usePageTitle'
import { useTenant } from '@/hooks/useTenant'
import { useAutosaveDraft } from '@/hooks/useAutosaveDraft'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ListingPreviewCard } from '@/components/onboarding/whatsapp/ListingPreviewCard'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'
import type { Property } from '@/types'
import { AutosaveIndicator } from '@/components/listings/composer/AutosaveIndicator'
import { StickyStepNav } from '@/components/listings/composer/StickyStepNav'
import { StepBasics } from '@/components/listings/composer/StepBasics'
import { StepPropertyDetails } from '@/components/listings/composer/StepPropertyDetails'
import { StepMedia } from '@/components/listings/composer/StepMedia'
import { StepContactAttribution } from '@/components/listings/composer/StepContactAttribution'
import {
  StepPublishPreview,
  hasBlockingIssues,
} from '@/components/listings/composer/StepPublishPreview'
import {
  COMPOSER_STEPS,
  STEP_META,
  composerToPayload,
  emptyComposerForm,
  validateStep,
  type ComposerFormState,
  type ComposerPhoto,
  type ComposerStep,
} from '@/components/listings/composer/types'

/** Survives the /listings/new → /listings/:id/edit remount after first autosave. */
let inflightComposer: { id: string; form: ComposerFormState; step: ComposerStep } | null = null

function hydrateFromProperty(p: Property): ComposerFormState {
  const base = emptyComposerForm()
  const photos: ComposerPhoto[] = (Array.isArray(p.photos) ? p.photos : []).map((url, i) => ({
    id: `hydrated-${i}`,
    url,
    alt_text: '',
    isHero: i === 0,
  }))
  return {
    ...base,
    type: p.type || 'sale',
    title: p.title || '',
    description: p.description || '',
    property_type: p.property_type || 'apartment',
    price: String(p.price ?? ''),
    currency:
      p.price_unit && !['month', 'year', 'mo', 'yr'].includes(p.price_unit)
        ? p.price_unit
        : 'AED',
    price_unit: p.price_unit === 'year' ? 'year' : 'month',
    bedrooms: String(p.bedrooms ?? 0),
    bathrooms: String(p.bathrooms ?? 1),
    area: String(p.area ?? ''),
    area_unit: (p.area_unit as string) || 'sqft',
    location: p.location || '',
    neighborhood: p.neighborhood || '',
    address: p.address || '',
    country: p.city || '',
    amenities: Array.isArray(p.amenities) ? p.amenities : [],
    photos,
    agency_tied: Boolean(p.agency_tied),
    listing_owner: p.listing_owner_type === 'agency' ? 'agency' : 'self',
    marketplace_syndicated: p.marketplace_syndicated !== 0 && p.marketplace_syndicated !== false,
    territory_id: p.territory_id || '',
  }
}

/**
 * AGT-LST-004 — multi-step manual listing composer.
 * Routes: `/listings/new` · `/listings/:id/edit`
 */
export function ManualListingComposerPage() {
  const { id: routeId } = useParams<{ id?: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { agent, loading: authLoading } = useAuth()
  const { activeTenant } = useTenant()
  const { addToast } = useToast()
  const isEdit = Boolean(routeId) && routeId !== 'new'
  usePageTitle(isEdit ? 'Edit listing' : 'List a new property')

  const stepParam = Number(searchParams.get('step') || '1')
  const initialStep = (
    stepParam >= 1 && stepParam <= 5 ? stepParam : 1
  ) as ComposerStep
  const sourceOnboarding = searchParams.get('source') === 'onboarding'

  const cached = inflightComposer && inflightComposer.id === routeId ? inflightComposer : null
  const [step, setStep] = useState<ComposerStep>(cached ? cached.step : initialStep)
  const [form, setForm] = useState<ComposerFormState>(() =>
    cached ? cached.form : emptyComposerForm(),
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [propertyId, setPropertyId] = useState<string | null>(isEdit ? routeId! : null)
  const [hydrating, setHydrating] = useState(isEdit && !cached)
  const [hydrateError, setHydrateError] = useState<string | null>(null)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [touched, setTouched] = useState(Boolean(cached))
  const [charsTyped, setCharsTyped] = useState(0)
  const skipHydrateForIdRef = useRef<string | null>(cached ? routeId! : null)

  const isAgency = activeTenant?.kind === 'agency'
  const agencyName = activeTenant?.name || 'your agency'

  useEffect(() => {
    if (!isEdit || !routeId) return
    if (inflightComposer?.id === routeId && inflightComposer.form) {
      setForm(inflightComposer.form)
      setPropertyId(routeId)
      setStep(inflightComposer.step)
      setTouched(true)
      setHydrating(false)
      skipHydrateForIdRef.current = routeId
      inflightComposer = null
      return
    }
    if (skipHydrateForIdRef.current === routeId) {
      setHydrating(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setHydrating(true)
      setHydrateError(null)
      try {
        const p = (await api.getProperty(routeId)) as Property
        if (cancelled) return
        setForm(hydrateFromProperty(p))
        setPropertyId(p.id)
        skipHydrateForIdRef.current = p.id
      } catch (err: unknown) {
        if (cancelled) return
        setHydrateError(err instanceof Error ? err.message : 'Failed to load listing')
      } finally {
        if (!cancelled) setHydrating(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isEdit, routeId])

  const payload = useMemo(() => composerToPayload(form), [form])

  const autosave = useAutosaveDraft({
    propertyId,
    formState: payload,
    enabled: !hydrating && Boolean(agent) && touched,
    onCreated: (id) => {
      setPropertyId(id)
      skipHydrateForIdRef.current = id
      inflightComposer = { id, form, step }
      const sp = new URLSearchParams(searchParams)
      if (!sp.get('step')) sp.set('step', String(step))
      navigate(`/listings/${id}/edit?${sp.toString()}`, { replace: true })
    },
  })

  const goStep = useCallback(
    (next: ComposerStep) => {
      setStep(next)
      setErrors({})
      const sp = new URLSearchParams(searchParams)
      sp.set('step', String(next))
      setSearchParams(sp, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  function onChange<K extends keyof ComposerFormState>(key: K, value: ComposerFormState[K]) {
    setTouched(true)
    if (typeof value === 'string') setCharsTyped((c) => c + value.length)
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleNext() {
    const stepErrors = validateStep(step, form)
    // Photo min only hard-gates publish (step 5), not intermediate next from step 3
    if (step === 3) delete stepErrors.photos
    if (Object.keys(stepErrors).length) {
      setErrors(stepErrors)
      return
    }
    setErrors({})
    await autosave.saveNow()
    if (step < COMPOSER_STEPS) {
      goStep((step + 1) as ComposerStep)
      return
    }
    setPublishOpen(true)
  }

  async function confirmPublish() {
    if (hasBlockingIssues(form)) {
      addToast({
        title: 'Fix blocking issues',
        description: 'Some portals will reject this listing until required fields are filled.',
        variant: 'error',
      })
      setPublishOpen(false)
      return
    }
    setPublishing(true)
    try {
      let id = propertyId || autosave.propertyId
      const body = { ...composerToPayload(form), status: 'active' }
      if (!id) {
        const created = (await api.createProperty(body)) as { id: string }
        id = created.id
      } else {
        await api.updateProperty(id, body)
      }
      addToast({ title: 'Published. Taking you to your dashboard.', variant: 'success' })
      navigate(`/publish/outcome/${id}`)
    } catch (err: unknown) {
      addToast({
        title: 'Publish failed',
        description: err instanceof Error ? err.message : 'Try again',
        variant: 'error',
      })
    } finally {
      setPublishing(false)
      setPublishOpen(false)
    }
  }

  async function saveDraftAndExit() {
    setTouched(true)
    await autosave.saveNow()
    addToast({
      title: 'Draft saved. You can finish later from your listings.',
      variant: 'success',
    })
    navigate('/listings')
  }

  async function discardDraft() {
    setDiscardOpen(false)
    if (propertyId && !isEdit) {
      try {
        await api.deleteProperty(propertyId)
      } catch {
        /* best-effort */
      }
    }
    navigate('/listings')
  }

  async function onUploadFiles(files: FileList) {
    setUploading(true)
    try {
      const result = await api.uploadMedia(Array.from(files))
      const items = result?.items || []
      const added: ComposerPhoto[] = items
        .filter((i) => i.media_type === 'image')
        .map((i, idx) => ({
          id: `upload-${Date.now()}-${idx}`,
          url: i.url,
          alt_text: '',
          isHero: form.photos.length === 0 && idx === 0,
        }))
      setTouched(true)
      setForm((prev) => ({
        ...prev,
        photos: [...prev.photos, ...added].slice(0, 30),
      }))
    } catch (err: unknown) {
      addToast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Try again',
        variant: 'error',
      })
    } finally {
      setUploading(false)
    }
  }

  const showWhatsAppNudge = sourceOnboarding && charsTyped < 20 && step === 1
  const meta = STEP_META[step]
  const stepTitle =
    step === 4 && !isAgency ? 'How should buyers reach you?' : meta.title
  const nextLabel =
    step === 5
      ? isEdit
        ? 'Save changes'
        : 'Publish →'
      : 'Next →'
  const hideSaveDraft = isEdit && !hydrating

  if (authLoading || hydrating) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--lc-text-muted)]" />
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-[length:var(--lc-type-heading-1)] font-semibold">Sign in to continue</h1>
        <Link to="/login" className="mt-4 inline-block">
          <Button>Sign in</Button>
        </Link>
      </div>
    )
  }

  if (hydrateError) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center" role="alert">
        <h1 className="text-[length:var(--lc-type-heading-1)] font-semibold">Couldn&apos;t load listing</h1>
        <p className="mt-2 text-[var(--lc-text-muted)]">{hydrateError}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="outline" onClick={() => navigate('/listings')}>
            Back to list
          </Button>
          <Button onClick={() => window.location.reload()}>Try again</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col bg-[var(--lc-bg-page)]">
      <header
        className={cn(
          'sticky top-0 z-10 border-b border-[var(--lc-border)] bg-[var(--lc-surface)]',
          'pt-[env(safe-area-inset-top)] shadow-[var(--lc-elevation-sm)]',
        )}
      >
        <div className="relative flex min-h-14 items-center px-[var(--lc-space-md)]">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Back"
            className="absolute start-2"
            onClick={() => {
              if (step === 1) {
                if (touched && !isEdit) setDiscardOpen(true)
                else navigate('/listings')
              } else {
                goStep((step - 1) as ComposerStep)
              }
            }}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <div className="mx-auto flex flex-col items-center">
            <ol
              role="progressbar"
              aria-valuenow={step}
              aria-valuemin={1}
              aria-valuemax={COMPOSER_STEPS}
              aria-valuetext={`Step ${step} of ${COMPOSER_STEPS}: ${meta.counterLabel}`}
              className="flex items-center gap-2"
            >
              {([1, 2, 3, 4, 5] as ComposerStep[]).map((n) => (
                <li
                  key={n}
                  aria-current={n === step ? 'step' : undefined}
                  className={cn(
                    'h-2.5 w-2.5 rounded-full border transition-colors duration-[var(--lc-duration-base)]',
                    n <= step
                      ? 'border-[var(--lc-action-primary)] bg-[var(--lc-action-primary)]'
                      : 'border-[var(--lc-border-strong)] bg-transparent',
                  )}
                />
              ))}
            </ol>
            <p className="mt-1 text-[length:var(--lc-type-overline)] tracking-[0.08em] text-[var(--lc-text-muted)]">
              Step <Numeric>{step}</Numeric> of <Numeric>{COMPOSER_STEPS}</Numeric> ·{' '}
              {meta.counterLabel}
            </p>
          </div>

          <div className="absolute end-2">
            <AutosaveIndicator
              status={autosave.status}
              lastSavedAt={autosave.lastSavedAt}
              onRetry={() => void autosave.saveNow()}
            />
          </div>
        </div>
      </header>

      <div className="grid flex-1 gap-6 px-[var(--lc-space-md)] py-[var(--lc-space-xl)] lg:grid-cols-[3fr_2fr]">
        <div>
          <div aria-live="polite" className="sr-only">
            Step {step} of {COMPOSER_STEPS}, {stepTitle}, entered.
          </div>
          <h1 className="text-[length:var(--lc-type-heading-1)] font-semibold text-[var(--lc-text-heading)]">
            {stepTitle}
          </h1>
          <p className="mt-1 text-[length:var(--lc-type-body-lg)] text-[var(--lc-text-muted)]">
            {isAgency && step === 4
              ? 'Solo listings stay with you if you leave the agency. Agency-owned listings stay with the agency.'
              : meta.sub}
          </p>

          <div className="mt-[var(--lc-space-xl)]">
            {step === 1 && (
              <StepBasics
                form={form}
                errors={errors}
                onChange={onChange}
                showWhatsAppNudge={showWhatsAppNudge}
                onWhatsAppNudge={() => navigate('/agent/whatsapp-listings')}
              />
            )}
            {step === 2 && (
              <StepPropertyDetails form={form} errors={errors} onChange={onChange} />
            )}
            {step === 3 && (
              <StepMedia
                form={form}
                errors={errors}
                onChange={onChange}
                onUploadFiles={onUploadFiles}
                uploading={uploading}
              />
            )}
            {step === 4 && (
              <StepContactAttribution
                form={form}
                errors={errors}
                onChange={onChange}
                isAgency={isAgency}
                agencyName={agencyName}
              />
            )}
            {step === 5 && (
              <StepPublishPreview
                form={form}
                isAgency={isAgency}
                onJumpToStep={goStep}
              />
            )}
          </div>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-4 shadow-[var(--lc-elevation-sm)]">
            <p className="mb-3 text-[length:var(--lc-type-overline)] tracking-[0.08em] text-[var(--lc-text-muted)]">
              Live preview
            </p>
            <ListingPreviewCard
              variant="compact"
              listing={{
                id: 'live',
                address: [form.location || form.neighborhood, form.country].filter(Boolean).join(', '),
                photos: form.photos.map((p) => p.url),
                bedrooms: Number(form.bedrooms) || 0,
                bathrooms: Number(form.bathrooms) || 0,
                area: Number(form.area) || undefined,
                areaUnit: form.area_unit,
                price: Number(form.price) || undefined,
                currency: form.currency,
                status: 'draft',
              }}
            />
          </div>
        </aside>
      </div>

      {/* Mobile peek strip */}
      {step >= 2 && (
        <div className="border-t border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] px-4 py-2 text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)] lg:hidden">
          {[form.location || form.neighborhood || 'Add area', `${form.bedrooms || 0} bed`, `${form.bathrooms || 0} bath`, form.area ? `${form.area} ${form.area_unit}` : null, form.property_type, form.price ? `${form.currency} ${form.price}` : 'Add price']
            .filter(Boolean)
            .join(' · ')}
        </div>
      )}

      <StickyStepNav
        onSaveDraft={hideSaveDraft ? undefined : () => void saveDraftAndExit()}
        hideSaveDraft={hideSaveDraft}
        onNext={() => void handleNext()}
        nextLabel={nextLabel}
        nextDisabled={step === 5 && hasBlockingIssues(form)}
        busy={publishing}
      />

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard this draft?</DialogTitle>
            <DialogDescription>
              You haven&apos;t saved anything yet. Leaving now will discard what you&apos;ve typed.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setDiscardOpen(false)}>
              Keep editing
            </Button>
            <Button variant="destructive" onClick={() => void discardDraft()}>
              Discard draft
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish this listing?</DialogTitle>
            <DialogDescription>
              Once you publish, we&apos;ll queue it for portals + your public profile. You can
              unpublish or edit anytime.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setPublishOpen(false)} disabled={publishing}>
              Not yet
            </Button>
            <Button onClick={() => void confirmPublish()} disabled={publishing}>
              {publishing ? 'Publishing…' : 'Yes, publish'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
