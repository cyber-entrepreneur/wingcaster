import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export interface LockedInfoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  helper: string
}

export function LockedInfoDialog({ open, onOpenChange, title, helper }: LockedInfoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{helper}</DialogDescription>
        </DialogHeader>
        <div className="mt-[var(--lc-space-lg)] flex justify-end">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
