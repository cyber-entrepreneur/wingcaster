import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, ExternalLink, Layers3, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  api,
  type CanonicalPrimaryDispute,
  type CanonicalPropertyView,
  type CanonicalSiblingListing,
} from '@/api/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'

function freshness(value: string | null) {
  if (!value) return 'Freshness unavailable'
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return 'Freshness unavailable'
  const days = Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000))
  if (days === 0) return 'Updated today'
  if (days === 1) return 'Updated yesterday'
  return `Updated ${days.toLocaleString()} days ago`
}

function formatMoney(value: number | null, currency: string) {
  if (value === null) return 'Price on request'
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value)
  } catch {
    return `${currency} ${value.toLocaleString()}`
  }
}

function statePresentation(view: CanonicalPropertyView) {
  if (view.state === 'primary') {
    return {
      icon: ShieldCheck,
      title: 'Your listing is the canonical primary',
      description: 'WingCaster uses your listing as the main record for this physical property.',
      className: 'border-[var(--lc-status-success-fg)] bg-[var(--lc-status-success-bg)]',
      iconClass: 'text-[var(--lc-status-success-fg)]',
    }
  }
  if (view.state === 'disputed') {
    return {
      icon: AlertCircle,
      title: 'Primary mandate review pending',
      description: `Your exclusive-mandate request ${view.dispute?.mandate_reference || ''} is waiting for platform review.`,
      className: 'border-[var(--lc-status-warning-fg)] bg-[var(--lc-status-warning-bg)]',
      iconClass: 'text-[var(--lc-status-warning-fg)]',
    }
  }
  return {
    icon: Layers3,
    title: 'This property has listings from other agencies',
    description: 'WingCaster groups matching physical properties into one transparent canonical record.',
    className: 'border-[var(--lc-border-strong)] bg-[var(--lc-surface-selected)]',
    iconClass: 'text-[var(--lc-action-primary)]',
  }
}

function SiblingRow({ listing }: { listing: CanonicalSiblingListing }) {
  return (
    <li className="flex flex-col gap-3 border-t border-[var(--lc-border)] py-3 first:border-t-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-[var(--lc-text-primary)]">
            {listing.agency?.name || listing.agent.name}
          </p>
          {listing.is_primary ? (
            <span className="rounded-[var(--lc-radius-pill)] bg-[var(--lc-status-success-bg)] px-2 py-0.5 text-xs font-medium text-[var(--lc-status-success-fg)]">
              Primary
            </span>
          ) : null}
          {listing.is_mine ? (
            <span className="rounded-[var(--lc-radius-pill)] border border-[var(--lc-border)] px-2 py-0.5 text-xs text-[var(--lc-text-secondary)]">
              Your listing
            </span>
          ) : null}
        </div>
        <p className="mt-1 truncate text-xs text-[var(--lc-text-muted)]">
          {listing.title} · {freshness(listing.updated_at)}
        </p>
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
        <Numeric className="text-sm font-semibold text-[var(--lc-text-primary)]">
          {formatMoney(listing.price, listing.currency)}
        </Numeric>
        {!listing.is_mine ? (
          <Button variant="ghost" size="sm" asChild>
            <Link
              to={`/listings/${listing.id}`}
              aria-label={`View listing from ${listing.agency?.name || listing.agent.name}`}
            >
              View
              <ExternalLink className="ms-2 h-4 w-4" aria-hidden />
            </Link>
          </Button>
        ) : null}
      </div>
    </li>
  )
}

export function CanonicalPropertyBanner({ listingId }: { listingId: string }) {
  const { addToast } = useToast()
  const [view, setView] = useState<CanonicalPropertyView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [contestOpen, setContestOpen] = useState(false)
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.getCanonicalPropertyView(listingId)
      setView(response.canonical_view)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Canonical property details could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [listingId])

  useEffect(() => {
    void load()
  }, [load])

  async function submitContest() {
    const mandateReference = reference.trim()
    const evidenceNotes = notes.trim()
    if (mandateReference.length < 3 || evidenceNotes.length < 10) {
      setFormError('Enter the mandate reference and at least 10 characters of supporting detail.')
      return
    }
    setFormError(null)
    setSubmitting(true)
    try {
      const response = await api.createCanonicalPrimaryDispute(listingId, {
        mandate_type: 'exclusive',
        mandate_reference: mandateReference,
        evidence_notes: evidenceNotes,
      })
      const dispute: CanonicalPrimaryDispute = response.dispute
      setView((current) =>
        current
          ? {
              ...current,
              state: 'disputed',
              can_contest: false,
              dispute,
            }
          : current,
      )
      setContestOpen(false)
      addToast({
        title: 'Primary review requested',
        description: 'Platform operations will review your exclusive mandate.',
      })
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : 'The request could not be submitted.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading && !view) {
    return (
      <div
        className="mb-4 h-32 animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]"
        aria-busy="true"
        aria-label="Loading canonical property details"
      />
    )
  }

  if (error && !view) {
    return (
      <div
        className="mb-4 flex flex-col gap-3 rounded-[var(--lc-radius-lg)] border border-[var(--lc-status-danger-fg)] bg-[var(--lc-status-danger-bg)] p-4 sm:flex-row sm:items-center sm:justify-between"
        role="alert"
      >
        <div>
          <p className="font-semibold text-[var(--lc-status-danger-fg)]">Canonical property details are unavailable</p>
          <p className="mt-1 text-sm text-[var(--lc-status-danger-fg)]">{error}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="me-2 h-4 w-4" aria-hidden />
          Try again
        </Button>
      </div>
    )
  }

  if (!view) return null

  const presentation = statePresentation(view)
  const StateIcon = presentation.icon

  return (
    <>
      <section
        className={`mb-4 rounded-[var(--lc-radius-lg)] border p-4 ${presentation.className}`}
        aria-labelledby="canonical-property-title"
        data-testid="canonical-property-banner"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <StateIcon className={`mt-0.5 h-5 w-5 shrink-0 ${presentation.iconClass}`} aria-hidden />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="canonical-property-title" style={{ font: 'var(--lc-type-heading-3)' }}>
                  {presentation.title}
                </h2>
                <span className="rounded-[var(--lc-radius-pill)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface-raised)] px-2 py-0.5 text-xs font-medium text-[var(--lc-text-secondary)]">
                  Canonical · <Numeric>{view.canonical.sibling_count}</Numeric> listings
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--lc-text-secondary)]">{presentation.description}</p>
            </div>
          </div>
          {view.can_contest ? (
            <Button className="w-full sm:w-auto" onClick={() => setContestOpen(true)}>
              Contest primary
            </Button>
          ) : null}
        </div>

        <details className="mt-4 rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-raised)] px-3">
          <summary className="min-h-tap cursor-pointer py-3 text-sm font-semibold text-[var(--lc-text-primary)]">
            Compare sibling listings
          </summary>
          <p className="pb-2 text-xs text-[var(--lc-text-muted)]">
            Prices and freshness are shown for transparency. Private contact and mandate details remain hidden.
          </p>
          <ul>
            {view.listings.map((listing) => (
              <SiblingRow key={listing.id} listing={listing} />
            ))}
          </ul>
        </details>
      </section>

      <Dialog open={contestOpen} onOpenChange={setContestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contest canonical primary</DialogTitle>
            <DialogDescription>
              Request a platform review only when you hold a current exclusive mandate for this property.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="mandate-reference">Exclusive mandate reference</Label>
              <Input
                id="mandate-reference"
                className="mt-1"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="EX-2026-0018"
                maxLength={160}
              />
            </div>
            <div>
              <Label htmlFor="mandate-evidence">Supporting details</Label>
              <textarea
                id="mandate-evidence"
                className="mt-1 min-h-28 w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 py-2 text-sm text-[var(--lc-text-primary)]"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Describe the signed mandate and where operations can verify it."
                maxLength={3000}
              />
            </div>
            {formError ? (
              <p className="text-sm text-[var(--lc-status-danger-fg)]" role="alert">
                {formError}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContestOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={() => void submitContest()} disabled={submitting}>
              {submitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden /> : null}
              Submit for review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default CanonicalPropertyBanner
