import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Numeric } from '@/components/ui/numeric'

export interface PAQueueBulkApproveDialogProps {
  open: boolean
  onOpenChange?: (open: boolean) => void
  /** Count shown in title / confirm — required for count-confirm invariant. */
  count: number
  /** Optional body override (parent i18n). */
  description?: string
  /** Confirm handler — stub fires callback only; no API. */
  onConfirm?: () => void
  /** Cancel / dismiss. */
  onCancel?: () => void
  /** Disable confirm while step-up pending, etc. */
  confirmDisabled?: boolean
  /** Entity noun for copy (`portal submissions`, `packages`, …). */
  entityLabel?: string
}

/**
 * Bulk-approve count-confirm dialog.
 *
 * Invariant: bulk approve MUST confirm the selected count before commit.
 * Bulk commits immediately — no 5s undo (unlike single-row).
 *
 * Used by: PA-MOD-001, PA-PKG-003, PA-PVA-009.
 * Stub visual + prop types only — no real API.
 */
export function PAQueueBulkApproveDialog({
  open,
  onOpenChange,
  count,
  description = 'Each item will be processed immediately after your approval. Bulk decisions cannot be undone.',
  onConfirm,
  onCancel,
  confirmDisabled = false,
  entityLabel = 'items',
}: PAQueueBulkApproveDialogProps) {
  const handleCancel = () => {
    onCancel?.()
    onOpenChange?.(false)
  }

  const handleConfirm = () => {
    onConfirm?.()
    onOpenChange?.(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="pa-queue-bulk-approve-desc">
        <DialogHeader>
          <DialogTitle>
            Approve <Numeric>{count}</Numeric> {entityLabel}?
          </DialogTitle>
          <DialogDescription id="pa-queue-bulk-approve-desc">{description}</DialogDescription>
        </DialogHeader>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button type="button" variant="default" disabled={confirmDisabled} onClick={handleConfirm}>
            Approve all <Numeric className="ms-1">{count}</Numeric>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
