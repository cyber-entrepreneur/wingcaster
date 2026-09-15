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

export interface SkipWizardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function SkipWizardDialog({ open, onOpenChange, onConfirm }: SkipWizardDialogProps) {
  const { locale: rawLocale } = useLocale()
  const locale = (rawLocale === 'ar' ? 'ar' : 'en') as ActivationLocale
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{act('skip.title', locale)}</DialogTitle>
          <DialogDescription>{act('skip.body', locale)}</DialogDescription>
        </DialogHeader>
        <div className="mt-[var(--lc-space-lg)] flex flex-col-reverse gap-[var(--lc-space-sm)] sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {act('skip.cancel', locale)}
          </Button>
          <Button type="button" autoFocus onClick={onConfirm}>
            {act('skip.confirm', locale)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
