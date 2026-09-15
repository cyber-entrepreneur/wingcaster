import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useLocale } from '@/hooks/useLocale'
import { act, type ActivationLocale } from '../copy'

export interface LockedInfoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  helper: string
}

export function LockedInfoDialog({ open, onOpenChange, title, helper }: LockedInfoDialogProps) {
  const { locale: rawLocale } = useLocale()
  const locale = (rawLocale === 'ar' ? 'ar' : 'en') as ActivationLocale
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{helper}</DialogDescription>
        </DialogHeader>
        <div className="mt-[var(--lc-space-lg)] flex justify-end">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {act('locked.gotIt', locale)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
