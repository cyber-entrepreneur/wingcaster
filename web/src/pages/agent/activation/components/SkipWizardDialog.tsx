import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export interface SkipWizardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function SkipWizardDialog({ open, onOpenChange, onConfirm }: SkipWizardDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Leave the activation wizard?</DialogTitle>
          <DialogDescription>
            Your progress is saved. You can pick this back up any time from your dashboard.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-[var(--lc-space-lg)] flex flex-col-reverse gap-[var(--lc-space-sm)] sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Never mind, keep going
          </Button>
          <Button type="button" autoFocus onClick={onConfirm}>
            Leave — I&apos;ll return later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
