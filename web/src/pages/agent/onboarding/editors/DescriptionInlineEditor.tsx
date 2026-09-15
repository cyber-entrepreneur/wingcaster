import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { t, type OnboardingLocale } from '../copy'

export interface DescriptionInlineEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  description: string
  locale: OnboardingLocale
  disabled?: boolean
  onSave: (description: string) => Promise<void>
}

export function DescriptionInlineEditor({
  open,
  onOpenChange,
  description,
  locale,
  disabled,
  onSave,
}: DescriptionInlineEditorProps) {
  const [value, setValue] = useState(description)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) setValue(description)
  }, [open, description])

  const handleSave = async () => {
    setBusy(true)
    try {
      await onSave(value.trim())
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-xl flex-col">
        <DialogHeader>
          <DialogTitle>{t('review.edit.description', locale)}</DialogTitle>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-1">
          <Label htmlFor="onb-desc">{t('review.description.label', locale)}</Label>
          <textarea
            id="onb-desc"
            className="min-h-[240px] w-full flex-1 resize-y rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] p-3 text-[var(--lc-text-primary)]"
            style={{ font: 'var(--lc-type-body-lg)' }}
            value={value}
            disabled={busy || disabled}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <div className="mt-[var(--lc-space-md)] flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t('review.edit.cancel', locale)}
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={busy || disabled}>
            {t('review.edit.save', locale)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
