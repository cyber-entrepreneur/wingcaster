import { useMemo, useRef, useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Star, Trash2, Upload } from 'lucide-react'
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

function SortablePhotoTile({
  photo,
  index,
  onSetHero,
  onRemove,
  onAltChange,
  isKeyboardActive,
}: {
  photo: ComposerPhoto
  index: number
  onSetHero: (id: string) => void
  onRemove: (id: string) => void
  onAltChange: (id: string, alt: string) => void
  isKeyboardActive: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: photo.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'overflow-hidden rounded-[var(--lc-radius-md)] border border-[var(--lc-border)]',
        'bg-[var(--lc-surface-raised)] shadow-[var(--lc-elevation-sm)]',
        isDragging && 'z-10 opacity-90 shadow-[var(--lc-elevation-md)]',
        isKeyboardActive && 'ring-2 ring-[var(--lc-focus-ring)]',
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
        <div className="absolute end-1 top-1 z-[2] flex gap-1">
          {index !== 0 && (
            <button
              type="button"
              aria-label="Set as hero photo"
              className="rounded-[var(--lc-radius-sm)] bg-[color-mix(in_srgb,var(--lc-surface-inverse)_70%,transparent)] p-1.5 text-[var(--lc-text-inverse)]"
              onClick={() => onSetHero(photo.id)}
            >
              <Star className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            aria-label="Remove photo"
            className="rounded-[var(--lc-radius-sm)] bg-[color-mix(in_srgb,var(--lc-surface-inverse)_70%,transparent)] p-1.5 text-[var(--lc-text-inverse)]"
            onClick={() => onRemove(photo.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        <button
          type="button"
          aria-label={`Reorder photo ${index + 1}. Press Space to pick up, arrow keys to move, Space to drop.`}
          className={cn(
            'absolute inset-x-0 bottom-0 z-[1] flex min-h-11 items-center justify-center gap-1',
            'bg-[color-mix(in_srgb,var(--lc-surface-inverse)_55%,transparent)] text-[var(--lc-text-inverse)]',
            'cursor-grab touch-none active:cursor-grabbing',
          )}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" aria-hidden />
          <span className="text-[10px] font-medium">Reorder</span>
        </button>
      </div>
      <div className="p-2">
        <Label htmlFor={`alt-${photo.id}`} className="text-[length:var(--lc-type-body-sm)]">
          Describe this photo (for accessibility)
        </Label>
        <Input
          id={`alt-${photo.id}`}
          value={photo.alt_text}
          placeholder="e.g. Marina view from the living room at sunset"
          onChange={(e) => onAltChange(photo.id, e.target.value)}
          className="mt-1"
        />
        {!photo.alt_text.trim() && (
          <p className="mt-1 text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
            Adding a short description helps buyers with screen readers and improves SEO.
          </p>
        )}
      </div>
    </li>
  )
}

export function StepMedia({
  form,
  errors,
  onChange,
  onUploadFiles,
  uploading,
}: StepMediaProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [announce, setAnnounce] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const count = form.photos.filter((p) => p.url).length
  const need = Math.max(0, 3 - count)
  const photoIds = useMemo(() => form.photos.map((p) => p.id), [form.photos])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function setPhotos(photos: ComposerPhoto[]) {
    const normalized = photos.map((p, i) => ({ ...p, isHero: i === 0 }))
    onChange('photos', normalized)
  }

  function updatePhoto(id: string, patch: Partial<ComposerPhoto>) {
    setPhotos(form.photos.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  function setHero(id: string) {
    const idx = form.photos.findIndex((p) => p.id === id)
    if (idx <= 0) return
    const next = [...form.photos]
    const [picked] = next.splice(idx, 1)
    next.unshift(picked)
    setPhotos(next)
    setAnnounce('Hero photo updated. First photo is now the hero.')
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

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return
    const oldIndex = form.photos.findIndex((p) => p.id === active.id)
    const newIndex = form.photos.findIndex((p) => p.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const next = arrayMove(form.photos, oldIndex, newIndex)
    setPhotos(next)
    setAnnounce(
      `Photo moved to position ${newIndex + 1} of ${next.length}.${
        newIndex === 0 ? ' This photo is now the hero.' : ''
      }`,
    )
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length) return
    if (onUploadFiles) {
      await onUploadFiles(files)
    } else {
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

      <p className="text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)] sm:hidden">
        Long-press a photo to drag it. First photo is the hero.
      </p>
      <p className="hidden text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)] sm:block">
        Drag photos to reorder. First photo is the hero. Keyboard: Space to pick up, arrows to move,
        Space to drop.
      </p>

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

      <div aria-live="polite" className="sr-only">
        {announce}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(e) => setActiveId(String(e.active.id))}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <SortableContext items={photoIds} strategy={rectSortingStrategy}>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Listing photos">
            {form.photos.map((photo, index) => (
              <SortablePhotoTile
                key={photo.id}
                photo={photo}
                index={index}
                onSetHero={setHero}
                onRemove={removePhoto}
                onAltChange={(id, alt) => updatePhoto(id, { alt_text: alt })}
                isKeyboardActive={activeId === photo.id}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

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
