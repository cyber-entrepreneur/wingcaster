import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'

/** Controlled reason vocabulary option for bulk reject / request-info. */
export interface PAQueueReasonOption {
  value: string
  label: string
}

export type PAQueueBulkReasonMode = 'reject' | 'request_info'

export interface PAQueueBulkReasonDialogProps {
  open: boolean
  onOpenChange?: (open: boolean) => void
  /** `reject` | `request_info` — drives default title copy. */
  mode?: PAQueueBulkReasonMode
  count: number
  /** Controlled vocabulary (required selection). */
  reasonOptions: PAQueueReasonOption[]
  /** Controlled reason code; uncontrolled falls back to internal state. */
  reasonCode?: string
  onReasonCodeChange?: (code: string) => void
  notes?: string
  onNotesChange?: (notes: string) => void
  /**
   * Confirm payload. Confirm disabled until reason chosen + notes ≥ `minNotesLength`.
   * Invariant: bulk reject / request-info REQUIRE a shared reason.
   */
  onConfirm?: (payload: { reasonCode: string; notes: string }) => void
  onCancel?: () => void
  minNotesLength?: number
  title?: string
  entityLabel?: string
  notesRequired?: boolean
}

/**
 * Bulk reject / request-info reason dialog (vocab Select + notes).
 *
 * Invariant: bulk reject requires a shared reason; confirm disabled until valid.
 *
 * Used by: PA-MOD-001, PA-PKG-003, PA-PVA-009.
 * Stub visual + prop types only — no real API.
 */
export function PAQueueBulkReasonDialog({
  open,
  onOpenChange,
  mode = 'reject',
  count,
  reasonOptions,
  reasonCode: reasonCodeProp,
  onReasonCodeChange,
  notes: notesProp,
  onNotesChange,
  onConfirm,
  onCancel,
  minNotesLength = 5,
  title,
  entityLabel = 'items',
  notesRequired = true,
}: PAQueueBulkReasonDialogProps) {
  const [internalReason, setInternalReason] = useState('')
  const [internalNotes, setInternalNotes] = useState('')

  const reasonCode = reasonCodeProp ?? internalReason
  const notes = notesProp ?? internalNotes

  const setReason = (code: string) => {
    onReasonCodeChange?.(code)
    if (reasonCodeProp === undefined) setInternalReason(code)
  }

  const setNotes = (value: string) => {
    onNotesChange?.(value)
    if (notesProp === undefined) setInternalNotes(value)
  }

  const notesOk = !notesRequired || notes.trim().length >= minNotesLength
  const canConfirm = Boolean(reasonCode) && notesOk

  const defaultTitle =
    mode === 'request_info'
      ? `Request info on ${count} ${entityLabel}`
      : `Reject ${count} ${entityLabel}`

  const handleCancel = () => {
    onCancel?.()
    onOpenChange?.(false)
  }

  const handleConfirm = () => {
    if (!canConfirm) return
    onConfirm?.({ reasonCode, notes: notes.trim() })
    onOpenChange?.(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="pa-queue-bulk-reason-desc">
        <DialogHeader>
          <DialogTitle>
            {title ?? (
              <>
                {mode === 'request_info' ? 'Request info on ' : 'Reject '}
                <Numeric>{count}</Numeric> {entityLabel}
              </>
            )}
          </DialogTitle>
          <DialogDescription id="pa-queue-bulk-reason-desc">
            {defaultTitle}. Reason is shown to each recipient. Bulk commits immediately — no undo.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pa-queue-bulk-reason">Reason (shown to each agent)</Label>
            <select
              id="pa-queue-bulk-reason"
              value={reasonCode}
              onChange={(e) => setReason(e.target.value)}
              className={cn(
                'min-h-tap rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)]',
                'bg-[var(--lc-surface)] px-3 text-sm text-[var(--lc-text-primary)]',
                'focus-visible:outline-none',
              )}
            >
              <option value="">Select a reason…</option>
              {reasonOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pa-queue-bulk-notes">
              Notes for the agents{notesRequired ? '' : ' (optional)'}
            </Label>
            <textarea
              id="pa-queue-bulk-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add context — this message is sent to every affected agent."
              className={cn(
                'w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)]',
                'bg-[var(--lc-surface)] px-3 py-2 text-sm text-[var(--lc-text-primary)]',
                'placeholder:text-[var(--lc-text-muted)] focus-visible:outline-none',
              )}
            />
            <p className="text-xs text-[var(--lc-text-muted)]">
              Required. Kind and clear beats terse.
              {notesRequired ? ` Minimum ${minNotesLength} characters.` : null}
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button type="button" variant="default" disabled={!canConfirm} onClick={handleConfirm}>
            {mode === 'request_info' ? 'Request info on' : 'Reject all'}{' '}
            <Numeric className="ms-1">{count}</Numeric>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
