import { useRef, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api } from '@/api/client'
import { cn } from '@/lib/utils'
import { t, type OnboardingLocale } from '../copy'

export interface PhotoRailEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  photoUrls: string[]
  locale: OnboardingLocale
  disabled?: boolean
  onSave: (photoUrls: string[]) => Promise<void>
}

/**
 * Photo gallery editor for AGT-ONB-003 — native file picker + reorder/remove.
 */
export function PhotoRailEditor({
  open,
  onOpenChange,
  photoUrls,
  locale,
  disabled,
  onSave,
}: PhotoRailEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [urls, setUrls] = useState<string[]>(photoUrls)
  const [busy, setBusy] = useState(false)

  const syncOpen = (next: boolean) => {
    if (next) setUrls(photoUrls)
    onOpenChange(next)
  }

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    try {
      const uploaded = (await api.uploadMedia([...files])) as { urls?: string[]; url?: string } | string[]
      const next =
        Array.isArray(uploaded)
          ? uploaded
          : uploaded.urls ?? (uploaded.url ? [uploaded.url] : [])
      setUrls((prev) => [...prev, ...next.filter(Boolean)])
    } finally {
      setBusy(false)
    }
  }

  const handleSave = async () => {
    setBusy(true)
    try {
      await onSave(urls)
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={syncOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('review.edit.photos', locale)}</DialogTitle>
        </DialogHeader>
        <ul className="grid grid-cols-3 gap-2">
          {urls.map((url, index) => (
            <li key={`${url}-${index}`} className="relative aspect-square overflow-hidden rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)]">
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                className="absolute end-1 top-1 inline-flex min-h-tap min-w-tap items-center justify-center rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-raised)] text-[var(--lc-text-muted)]"
                aria-label={t('review.photos.remove', locale)}
                disabled={busy || disabled}
                onClick={() => setUrls((prev) => prev.filter((_, i) => i !== index))}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => void addFiles(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={busy || disabled}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus className="me-2 h-4 w-4" aria-hidden="true" />
          {t('review.photos.add', locale)}
        </Button>
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
