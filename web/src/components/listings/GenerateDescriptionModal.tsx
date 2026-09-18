import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Sparkles, X } from 'lucide-react'
import { api } from '@/api/client'
import { apiErrorMessage } from '@/lib/http-status'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export type DescriptionTone = 'warm' | 'professional' | 'concise' | 'luxury'
export type DescriptionLanguage = 'en' | 'ar'
export type DescriptionLength = 'short' | 'medium' | 'long'

const TONES: Array<{ value: DescriptionTone; label: string }> = [
  { value: 'warm', label: 'Warm' },
  { value: 'professional', label: 'Professional' },
  { value: 'concise', label: 'Concise' },
  { value: 'luxury', label: 'Luxury' },
]

const LENGTHS: Array<{ value: DescriptionLength; label: string }> = [
  { value: 'short', label: 'Short' },
  { value: 'medium', label: 'Medium' },
  { value: 'long', label: 'Long' },
]

const HIGHLIGHTS: Array<{ id: string; label: string }> = [
  { id: 'marina_view', label: 'Marina view' },
  { id: 'sea_view', label: 'Sea view' },
  { id: 'pool', label: 'Pool' },
  { id: 'parking', label: 'Parking' },
  { id: 'balcony', label: 'Balcony' },
  { id: 'gym', label: 'Gym' },
  { id: 'garden', label: 'Garden' },
  { id: 'furnished', label: 'Furnished' },
]

export interface GenerateDescriptionInput {
  photoUrls: string[]
  hints?: {
    city?: string
    neighborhood?: string
    type?: 'sale' | 'rent'
    property_type?: string
    price?: number
    currency?: string
  }
  intent?: 'create' | 'update'
  existingListing?: Record<string, unknown>
}

export interface GenerateDescriptionOutput {
  title: string
  description: string
  provider: string
  confidence?: number
  property: Awaited<ReturnType<typeof api.describeListingFromPhotos>>['property']
}

export interface GenerateDescriptionModalProps {
  open: boolean
  onClose: () => void
  input: GenerateDescriptionInput
  onApply: (output: GenerateDescriptionOutput) => void | Promise<void>
}

type Phase = 'configure' | 'draft' | 'refine'

function buildAgentNotes(opts: {
  tone: DescriptionTone
  language: DescriptionLanguage
  length: DescriptionLength
  highlights: Set<string>
  refinement?: string
}): string {
  const highlightLabels = HIGHLIGHTS.filter((h) => opts.highlights.has(h.id)).map((h) => h.label)
  const parts = [
    `Tone: ${opts.tone}`,
    `Language: ${opts.language === 'ar' ? 'Arabic' : 'English'}`,
    `Length: ${opts.length}`,
    highlightLabels.length ? `Highlights: ${highlightLabels.join(', ')}` : null,
    opts.refinement?.trim() ? `Refinement: ${opts.refinement.trim()}` : null,
  ].filter(Boolean)
  return parts.join('. ')
}

function isInsufficientCredits(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const code = (err as { code?: string }).code
  return code === 'INSUFFICIENT_CREDITS' || apiErrorMessage(err).toLowerCase().includes('not enough credits')
}

/**
 * AGT-LAI-001 — generate listing description with tone, language, length, and highlights.
 */
export function GenerateDescriptionModal({
  open,
  onClose,
  input,
  onApply,
}: GenerateDescriptionModalProps) {
  const { addToast } = useToast()
  const [phase, setPhase] = useState<Phase>('configure')
  const [tone, setTone] = useState<DescriptionTone>('professional')
  const [language, setLanguage] = useState<DescriptionLanguage>('en')
  const [length, setLength] = useState<DescriptionLength>('medium')
  const [highlights, setHighlights] = useState<Set<string>>(new Set())
  const [refinement, setRefinement] = useState('')
  const [busy, setBusy] = useState(false)
  const [applying, setApplying] = useState(false)
  const [creditError, setCreditError] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.describeListingFromPhotos>> | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftDescription, setDraftDescription] = useState('')

  const photoCount = input.photoUrls.filter(Boolean).length

  useEffect(() => {
    if (!open) return
    setPhase('configure')
    setTone('professional')
    setLanguage('en')
    setLength('medium')
    setHighlights(new Set())
    setRefinement('')
    setBusy(false)
    setApplying(false)
    setCreditError(false)
    setError('')
    setResult(null)
    setDraftTitle('')
    setDraftDescription('')
  }, [open, input.photoUrls.join('|')])

  const wordCount = useMemo(
    () => draftDescription.trim().split(/\s+/).filter(Boolean).length,
    [draftDescription],
  )

  async function generate(refineInstruction?: string) {
    if (busy || photoCount === 0) return
    setBusy(true)
    setError('')
    setCreditError(false)
    try {
      const notes = buildAgentNotes({
        tone,
        language,
        length,
        highlights,
        refinement: refineInstruction,
      })
      const r = await api.describeListingFromPhotos({
        photo_urls: input.photoUrls,
        hints: { ...input.hints, notes },
        intent: input.intent || 'create',
        existing_listing: input.existingListing,
      })
      setResult(r)
      setDraftTitle(r.property.title || '')
      setDraftDescription(r.property.description || '')
      setPhase('draft')
    } catch (err: unknown) {
      if (isInsufficientCredits(err)) {
        setCreditError(true)
        setError('You need more AI credits to generate a description.')
      } else {
        setError(apiErrorMessage(err, 'AI generation failed'))
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleApply() {
    if (!result || applying) return
    setApplying(true)
    try {
      await onApply({
        title: draftTitle.trim(),
        description: draftDescription.trim(),
        provider: result.provider,
        confidence: result.property.confidence,
        property: result.property,
      })
      onClose()
    } catch (err: unknown) {
      addToast({ title: 'Could not apply', description: apiErrorMessage(err), variant: 'error' })
    } finally {
      setApplying(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-overlay flex items-center justify-center lc-overlay p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="generate-description-title"
        data-screen="AGT-LAI-001"
        className="flex w-full max-w-2xl max-h-[90vh] flex-col rounded-lg bg-[var(--lc-surface)] shadow-xl"
      >
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <h2 id="generate-description-title" className="text-lg font-semibold">Generate description</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-muted" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
          {phase === 'configure' && (
            <>
              <p className="text-muted-foreground">
                AI reads {photoCount} photo{photoCount === 1 ? '' : 's'} and drafts a title + description.
                Uses <span className="font-medium">1 AI credit</span> per generate.
              </p>

              {photoCount === 0 && (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                  Add at least one photo before generating.
                </p>
              )}

              <fieldset className="space-y-2">
                <legend className="text-xs font-medium text-muted-foreground">Tone</legend>
                <div className="flex flex-wrap gap-2">
                  {TONES.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTone(opt.value)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${
                        tone === opt.value
                          ? 'border-slate-900 bg-slate-900 text-[var(--lc-action-primary-text)]'
                          : 'border-input hover:bg-muted'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <Label className="text-xs">Language</Label>
                  <select
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as DescriptionLanguage)}
                  >
                    <option value="en">English</option>
                    <option value="ar">Arabic</option>
                  </select>
                </label>
                <label className="block">
                  <Label className="text-xs">Length</Label>
                  <select
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={length}
                    onChange={(e) => setLength(e.target.value as DescriptionLength)}
                  >
                    {LENGTHS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-xs font-medium text-muted-foreground">Include highlights</legend>
                <div className="flex flex-wrap gap-2">
                  {HIGHLIGHTS.map((h) => {
                    const on = highlights.has(h.id)
                    return (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => {
                          setHighlights((prev) => {
                            const next = new Set(prev)
                            if (next.has(h.id)) next.delete(h.id)
                            else next.add(h.id)
                            return next
                          })
                        }}
                        className={`rounded-full border px-2.5 py-0.5 text-xs ${
                          on ? 'border-slate-400 bg-slate-100' : 'border-input hover:bg-muted'
                        }`}
                      >
                        {h.label}
                      </button>
                    )
                  })}
                </div>
              </fieldset>
            </>
          )}

          {phase === 'refine' && (
            <div className="space-y-2">
              <Label htmlFor="refine-instruction" className="text-xs">Refine with instruction</Label>
              <textarea
                id="refine-instruction"
                rows={3}
                value={refinement}
                onChange={(e) => setRefinement(e.target.value)}
                placeholder="e.g. Make it shorter, add family focus, emphasize the marina view"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <p className="text-xs text-muted-foreground">Uses 1 AI credit. Full variant history ships in AGT-LAI-002.</p>
            </div>
          )}

          {(phase === 'draft' || (phase === 'refine' && result)) && result && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">via {result.provider}</Badge>
                {typeof result.property.confidence === 'number' && (
                  <Badge variant="outline">
                    confidence {Math.round((result.property.confidence || 0) * 100)}%
                  </Badge>
                )}
                <span>{wordCount} words</span>
              </div>
              <div>
                <Label className="text-xs">Title</Label>
                <Input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} className="mt-0.5" />
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <textarea
                  rows={10}
                  value={draftDescription}
                  onChange={(e) => setDraftDescription(e.target.value)}
                  className="mt-0.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed"
                />
              </div>
            </>
          )}

          {busy && (
            <div className="flex items-center gap-3 rounded-md border bg-slate-50 px-4 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Generating from {photoCount} photo{photoCount === 1 ? '' : 's'}…
            </div>
          )}

          {creditError && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-900">
              <p className="font-medium">{error}</p>
              <p className="mt-1 text-xs">
                <Link to="/my-credits" className="underline">Top up credits</Link> to continue.
              </p>
            </div>
          )}

          {error && !creditError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t p-4">
          {phase === 'configure' && (
            <>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button
                type="button"
                onClick={() => void generate()}
                disabled={busy || photoCount === 0}
                className="gap-1.5"
                data-testid="generate-description-submit"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate (1 credit)
              </Button>
            </>
          )}

          {phase === 'draft' && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPhase('refine')}
                disabled={busy || applying}
              >
                Refine
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onClose} disabled={applying}>Discard</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void generate()}
                  disabled={busy || applying}
                  className="gap-1.5"
                >
                  Regenerate
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleApply()}
                  disabled={busy || applying || !draftTitle.trim() && !draftDescription.trim()}
                  className="gap-1.5"
                  data-testid="generate-description-apply"
                >
                  {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Apply
                </Button>
              </div>
            </>
          )}

          {phase === 'refine' && (
            <>
              <Button type="button" variant="outline" onClick={() => setPhase('draft')} disabled={busy}>
                Back
              </Button>
              <Button
                type="button"
                onClick={() => void generate(refinement)}
                disabled={busy || !refinement.trim()}
                className="gap-1.5"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Refine (1 credit)
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
