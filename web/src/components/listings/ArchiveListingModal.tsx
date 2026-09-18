import { useState } from 'react'
import { Archive, Loader2, X } from 'lucide-react'
import { api } from '@/api/client'
import { apiErrorMessage } from '@/lib/http-status'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

export type ArchiveReason = 'sold' | 'rented' | 'withdrawn' | 'wrong_data'

const ARCHIVE_REASONS: Array<{ value: ArchiveReason; label: string; description: string }> = [
  { value: 'sold', label: 'Sold', description: 'Deal completed — listing no longer on market.' },
  { value: 'rented', label: 'Rented', description: 'Tenant secured — listing taken off market.' },
  { value: 'withdrawn', label: 'Withdrawn', description: 'Owner or agent pulled the listing.' },
  { value: 'wrong_data', label: 'Wrong data', description: 'Duplicate or incorrect listing details.' },
]

export interface ArchiveListingModalProps {
  open: boolean
  listingId: string
  listingTitle: string
  onClose: () => void
  onArchived: (reason: ArchiveReason) => void
}

/**
 * AGT-LST-008 — soft-delete archive flow with reason + notes.
 * Reversible via Unarchive on the listing profile (separate action).
 */
export function ArchiveListingModal({
  open,
  listingId,
  listingTitle,
  onClose,
  onArchived,
}: ArchiveListingModalProps) {
  const { addToast } = useToast()
  const [reason, setReason] = useState<ArchiveReason | ''>('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  if (!open) return null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason || busy) return
    setBusy(true)
    try {
      await api.updateProperty(listingId, { status: 'archived' })
      const reasonLabel = ARCHIVE_REASONS.find((r) => r.value === reason)?.label ?? reason
      const noteBody = [
        `[Archived] Reason: ${reasonLabel}`,
        notes.trim() ? `Notes: ${notes.trim()}` : null,
      ].filter(Boolean).join('\n')
      await api.createListingNote(listingId, { body: noteBody, visibility: 'internal' })
      try {
        await api.trackPropertyEvent(listingId, {
          type: 'archive',
          source: 'listing_profile',
          reason,
        })
      } catch {
        // Telemetry is best-effort — archive already succeeded.
      }
      addToast({ title: 'Listing archived', variant: 'success' })
      setReason('')
      setNotes('')
      onArchived(reason)
    } catch (err: unknown) {
      addToast({ title: 'Could not archive listing', description: apiErrorMessage(err), variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-overlay flex items-center justify-center lc-overlay p-4"
      data-screen="AGT-LST-008"
      role="dialog"
      aria-labelledby="archive-listing-title"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-lg bg-[var(--lc-surface)] shadow-xl">
        <div className="flex items-center justify-between border-b p-4">
          <h2 id="archive-listing-title" className="text-lg font-semibold">Archive this listing?</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-muted" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4 p-4 text-sm">
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-900">
            <p className="font-medium">This hides &quot;{listingTitle}&quot; from public sites and portals.</p>
            <p className="mt-1 text-xs text-amber-800">
              History, analytics, and notes are preserved. You can unarchive later. For permanent removal, use Delete.
            </p>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-muted-foreground">Why are you archiving?</legend>
            <div className="space-y-1.5">
              {ARCHIVE_REASONS.map((opt) => {
                const selected = reason === opt.value
                return (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-start gap-2 rounded-md border p-2.5 transition-colors ${
                      selected ? 'border-slate-400 bg-slate-50' : 'border-input hover:bg-muted/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="archive-reason"
                      value={opt.value}
                      checked={selected}
                      onChange={() => setReason(opt.value)}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-[11px] text-muted-foreground">{opt.description}</div>
                    </div>
                  </label>
                )
              })}
            </div>
          </fieldset>

          <div>
            <Label htmlFor="archive-notes" className="text-xs">Notes (optional)</Label>
            <textarea
              id="archive-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Context for your team — not shown publicly."
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!reason || busy}
              className="gap-1.5 bg-slate-900 text-[var(--lc-action-primary-text)] hover:bg-slate-800"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
              Archive
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
