import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface TypedConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  /** Exact phrase the user must type, e.g. `delete 12`. */
  confirmPhrase: string
  confirmLabel?: string
  onConfirm: () => void | Promise<void>
  loading?: boolean
}

/**
 * AGT-LST-002 — typed-confirm for bulk/single destructive actions.
 * Primary stays disabled until the phrase matches exactly (case-insensitive).
 */
export function TypedConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmPhrase,
  confirmLabel = 'Delete',
  onConfirm,
  loading = false,
}: TypedConfirmDialogProps) {
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (!open) setTyped('')
  }, [open])

  const matches = typed.trim().toLowerCase() === confirmPhrase.trim().toLowerCase()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="typed-confirm-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="typed-confirm-input">
            Type &quot;{confirmPhrase}&quot; to confirm
          </Label>
          <Input
            id="typed-confirm-input"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            data-testid="typed-confirm-input"
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!matches || loading}
            data-testid="typed-confirm-submit"
            onClick={() => void onConfirm()}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
