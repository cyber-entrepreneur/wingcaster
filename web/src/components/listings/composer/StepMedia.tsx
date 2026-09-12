import { useRef } from 'react'
import { Star, Trash2, Upload } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'
import type { ComposerFormState, ComposerPhoto } from './types'

export interface StepMediaProps {
  form: ComposerFormState
  errors: Record<string, string>
  onChange: <K extends keyof ComposerFormState>(key: K, value: ComposerFormState[K]) => void
  onUploadFiles?: (files: FileList) => Promise<void>
  uploading?: boolean
}

function newPhotoId() {
  return `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function StepMedia({
  form,
  errors,
  onChange,
  onUploadFiles,
  uploading,
}: StepMediaProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const count = form.photos.filter((p) => p.url).length
  const need = Math.max(0, 3 - count)

  function setPhotos(photos: ComposerPhoto[]) {
    onChange('photos', photos)
  }

  function updatePhoto(id: string, patch: Partial<ComposerPhoto>) {
    setPhotos(form.photos.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  function setHero(id: string) {
    const idx = form.photos.findIndex((p) => p.id === id)
    if (idx <= 0) return
    const next = [...form.photos]
    const [picked] = next.splice(idx, 1)
    next.unshift({ ...picked, isHero: true })
    setPhotos(next.map((p, i) => ({ ...p, isHero: i === 0 })))
  }

  function removePhoto(id: string) {
    setPhotos(form.photos.filter((p) => p.id !== id))
  }

  function addUrlPhoto(url: string) {
    if (!url.trim()) return
    setPhotos([
      ...form.photos,
      {
        id: newPhotoId(),
        url: url.trim(),
        alt_text: '',
        isHero: form.photos.length === 0,
      },
    ])
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length) return
    if (onUploadFiles) {
      await onUploadFiles(files)
    } else {
      // Local object URLs for offline / test environments
      const added: ComposerPhoto[] = Array.from(files).map((f, i) => ({
        id: newPhotoId(),
        url: URL.createObjectURL(f),
        alt_text: '',
        isHero: form.photos.length === 0 && i === 0,
      }))
      setPhotos([...form.photos, ...added].slice(0, 30))
    }
    e.target.value = ''
  }

  return (
    <div className="space-y-[var(--lc-space-xl)]">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--lc-radius-lg)]',
          'border-2 border-dashed border-[var(--lc-border-strong)] bg-[var(--lc-surface-sunken)]',
          'px-4 py-10 text-center transition-colors duration-[var(--lc-duration-fast)]',
          'hover:border-[var(--lc-action-primary)] hover:bg-[var(--lc-surface-sunken)]',
        )}
      >
        <Upload className="h-8 w-8 text-[var(--lc-text-muted)]" aria-hidden />
        <p className="text-[length:var(--lc-type-body)] text-[var(--lc-text-primary)]">
          {uploading ? 'Uploading…' : 'Drag photos here or tap to choose'}
        </p>
        <p className="text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
          JPG or PNG, up to 10 MB each. Min 3, max 30.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          onChange={onFileChange}
        />
      </div>

      {need > 0 && (
        <p className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-status-warning-fg,var(--lc-text-brand))]">
          Add at least <Numeric>{need}</Numeric> more to publish.
        </p>
      )}
      {errors.photos && (
        <p className="text-[length:var(--lc-type-caption)] text-[var(--lc-status-danger-fg)]">
          {errors.photos}
        </p>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {form.photos.map((photo, index) => (
          <li
            key={photo.id}
            className={cn(
              'overflow-hidden rounded-[var(--lc-radius-md)] border border-[var(--lc-border)]',
              'bg-[var(--lc-surface-raised)] shadow-[var(--lc-elevation-sm)]',
            )}
          >
            <div className="relative aspect-square">
              <img src={photo.url} alt={photo.alt_text || ''} className="h-full w-full object-cover" />
              {index === 0 && (
                <span
                  className={cn(
                    'absolute start-2 top-2 rounded-[var(--lc-radius-sm)] px-1.5 py-0.5',
                    'border border-[var(--lc-accent-bold-edge)] bg-[var(--lc-accent-bold)]',
                    'text-[10px] font-semibold text-[var(--lc-accent-bold-text)]',
                  )}
                >
                  Hero
                </span>
              )}
              <div className="absolute end-1 top-1 flex gap-1">
                {index !== 0 && (
                  <button
                    type="button"
                    aria-label="Set as hero photo"
                    className="rounded-[var(--lc-radius-sm)] bg-[color-mix(in_srgb,var(--lc-surface-inverse)_70%,transparent)] p-1.5 text-[var(--lc-text-inverse)]"
                    onClick={() => setHero(photo.id)}
                  >
                    <Star className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Remove photo"
                  className="rounded-[var(--lc-radius-sm)] bg-[color-mix(in_srgb,var(--lc-surface-inverse)_70%,transparent)] p-1.5 text-[var(--lc-text-inverse)]"
                  onClick={() => removePhoto(photo.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="p-2">
              <Label htmlFor={`alt-${photo.id}`} className="text-[length:var(--lc-type-body-sm)]">
                Describe this photo (for accessibility)
              </Label>
              <Input
                id={`alt-${photo.id}`}
                value={photo.alt_text}
                placeholder="e.g. Marina view from the living room at sunset"
                onChange={(e) => updatePhoto(photo.id, { alt_text: e.target.value })}
                className="mt-1"
              />
              {!photo.alt_text.trim() && (
                <p className="mt-1 text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
                  Adding a short description helps buyers with screen readers and improves SEO.
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div>
        <Label htmlFor="composer-photo-url">Or paste a photo URL</Label>
        <Input
          id="composer-photo-url"
          placeholder="https://"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addUrlPhoto((e.target as HTMLInputElement).value)
              ;(e.target as HTMLInputElement).value = ''
            }
          }}
        />
      </div>

      <div>
        <Label htmlFor="composer-video">Add a video walkthrough (optional)</Label>
        <p className="mb-1 text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
          Paste a YouTube or Vimeo URL, or upload MP4 up to 100 MB.
        </p>
        <Input
          id="composer-video"
          value={form.video_url}
          onChange={(e) => onChange('video_url', e.target.value)}
          placeholder="https://youtube.com/…"
        />
      </div>

      <div>
        <Label htmlFor="composer-360">Add a 360° tour link (optional)</Label>
        <Input
          id="composer-360"
          value={form.tour_360_url}
          onChange={(e) => onChange('tour_360_url', e.target.value)}
          placeholder="Matterport, Kuula, or any 360 tour URL"
        />
      </div>
    </div>
  )
}
