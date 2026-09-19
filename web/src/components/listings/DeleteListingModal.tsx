import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react'
import { api } from '@/api/client'
import { apiErrorMessage } from '@/lib/http-status'
import { useToast } from '@/components/ui/toast'
import { useStepUp } from '@/context/StepUpContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const CONFIRM_PHRASE = 'DELETE'

const TERMINAL_INQUIRY_STATUSES = new Set(['closed_won', 'closed_lost'])

export interface DeleteListingModalProps {
  open: boolean
  listingId: string
  listingTitle: string
  onClose: () => void
  onDeleted: () => void
}

interface ImpactCounts {
  publications: number
  commentThreads: number
  activeInquiries: number
  loading: boolean
}

/**
 * AGT-LST-009 — permanent listing delete with typed confirm + step-up (SHR-MFA-007).
 */
export function DeleteListingModal({
  open,
  listingId,
  listingTitle,
  onClose,
  onDeleted,
}: DeleteListingModalProps) {
  const { addToast } = useToast()
  const { requireElevation, runElevated } = useStepUp()
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [impact, setImpact] = useState<ImpactCounts>({
    publications: 0,
    commentThreads: 0,
    activeInquiries: 0,
    loading: true,
  })

  useEffect(() => {
    if (!open) {
      setTyped('')
      return
    }
    let cancelled = false
    setImpact((prev) => ({ ...prev, loading: true }))
    ;(async () => {
      try {
        const [dists, comments, inquiries] = await Promise.all([
          api.getDistributions(listingId).catch(() => []),
          api.getListingComments(listingId).catch(() => ({ threads: [], published_posts: 0 })),
          api.getInquiries({ limit: '200' }).catch(() => ({ items: [] })),
        ])
        if (cancelled) return
        const pubCount = Array.isArray(dists)
          ? dists.filter((d) => d.status === 'published').length
          : 0
        const threadCount = Array.isArray(comments?.threads) ? comments.threads.length : 0
        const inquiryItems = Array.isArray(inquiries?.items) ? inquiries.items : []
        const activeInquiries = inquiryItems.filter(
          (i: { property_id?: string; status?: string }) =>
            i.property_id === listingId && i.status && !TERMINAL_INQUIRY_STATUSES.has(i.status),
        ).length
        setImpact({
          publications: pubCount,
          commentThreads: threadCount,
          activeInquiries,
          loading: false,
        })
      } catch {
        if (!cancelled) {
          setImpact({ publications: 0, commentThreads: 0, activeInquiries: 0, loading: false })
        }
      }
    })()
    return () => { cancelled = true }
  }, [open, listingId])

  if (!open) return null

  const matches = typed.trim().toUpperCase() === CONFIRM_PHRASE

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!matches || busy) return

    const elevated = await requireElevation('Confirm your identity to permanently delete this listing.')
    if (!elevated) return

    setBusy(true)
    try {
      const result = await runElevated(
        () => api.deleteProperty(listingId),
        'Permanently delete listing',
      )
      if (result == null) return
      addToast({ title: 'Listing permanently deleted', variant: 'success' })
      setTyped('')
      onDeleted()
    } catch (err: unknown) {
      addToast({ title: 'Could not delete listing', description: apiErrorMessage(err), variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-overlay flex items-center justify-center lc-overlay p-4"
      data-screen="AGT-LST-009"
      role="dialog"
      aria-labelledby="delete-listing-title"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-lg bg-[var(--lc-surface)] shadow-xl">
        <div className="flex items-center justify-between border-b p-4">
          <h2 id="delete-listing-title" className="text-lg font-semibold text-red-700">
            Permanently delete listing?
          </h2>
          <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-muted" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4 p-4 text-sm">
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-red-900">
            <p className="font-medium">
              &quot;{listingTitle}&quot; and its history will be destroyed. This cannot be undone.
            </p>
            <p className="mt-1 text-xs text-red-800">
              If you only want to hide it, archive the listing instead.
            </p>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-700">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
              What will be removed
            </div>
            {impact.loading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Checking linked data…
              </div>
            ) : (
              <ul className="list-disc space-y-0.5 ps-4 text-xs text-slate-700">
                <li>
                  {impact.publications > 0
                    ? `${impact.publications} portal publication${impact.publications === 1 ? '' : 's'}`
                    : 'Portal publication records'}
                </li>
                <li>
                  {impact.commentThreads > 0
                    ? `${impact.commentThreads} comment thread${impact.commentThreads === 1 ? '' : 's'}`
                    : 'Social comment threads'}
                </li>
                <li>Performance and analytics history</li>
                <li>Offers, notes, and scheduled viewings</li>
              </ul>
            )}
          </div>

          {impact.activeInquiries > 0 && !impact.loading && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-900">
              <p className="font-medium">
                {impact.activeInquiries} active inquir{impact.activeInquiries === 1 ? 'y' : 'ies'} linked to this listing
              </p>
              <p className="mt-1 text-xs text-amber-800">
                Deleting will orphan lead history. Consider closing inquiries first.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="delete-confirm-input">
              Type &quot;{CONFIRM_PHRASE}&quot; to confirm
            </Label>
            <Input
              id="delete-confirm-input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              data-testid="delete-listing-confirm-input"
              className="font-mono"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!matches || busy || impact.loading}
              className="gap-1.5 bg-red-600 text-[var(--lc-action-primary-text)] hover:bg-red-700"
              data-testid="delete-listing-submit"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete permanently
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
