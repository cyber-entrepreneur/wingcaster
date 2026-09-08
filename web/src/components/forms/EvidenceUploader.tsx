import { useId, useRef, type ChangeEvent } from 'react'
import { AlertOctagon, FileText, Plus, Table, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Client-side evidence file descriptor for agent submission forms.
 * `id` starts client-generated and is replaced by the server-assigned id after upload.
 */
export type EvidenceFile = {
  id: string
  name: string
  size_bytes: number
  content_type: string
  status: 'uploading' | 'complete' | 'error'
  /** 0–100 while `status === 'uploading'`. */
  progress_pct?: number
  /** Server-assigned once complete. */
  thumbnail_url?: string
  /** Signed URL post-upload. */
  server_url?: string
  error_message?: string
}

export type EvidenceUploaderProps = {
  files: EvidenceFile[]
  /** Max tiles allowed. AGT-APR-004 / PA-CRD-005 → 3; AGT-APR-005 → 5. */
  max_files: number
  /** Default 10_485_760 (10MB). Parent enforces before calling `onAdd`. */
  max_bytes_per_file: number
  /**
   * MIME allow-list.
   * APR-004: jpeg/png/heic/pdf/csv; APR-005 adds XLSX.
   */
  accepted_types: string[]
  /** Stub — parent handles upload; this only surfaces the picker. */
  onAdd: (files: File[]) => void
  /** Stub — parent removes from controlled `files`. */
  onRemove: (id: string) => void
  helper_text?: string
  label?: string
  disabled?: boolean
  className?: string
}

function truncateName(name: string, max = 12): string {
  if (name.length <= max) return name
  const dot = name.lastIndexOf('.')
  if (dot > 0 && name.length - dot <= 5) {
    const ext = name.slice(dot)
    const base = name.slice(0, Math.max(1, max - ext.length - 1))
    return `${base}…${ext}`
  }
  return `${name.slice(0, max - 1)}…`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileGlyph({ contentType }: { contentType: string }) {
  if (contentType === 'text/csv' || contentType.includes('spreadsheet')) {
    return <Table className="h-6 w-6 text-[var(--lc-text-muted)]" aria-hidden />
  }
  if (contentType === 'application/pdf') {
    return <FileText className="h-6 w-6 text-[var(--lc-text-muted)]" aria-hidden />
  }
  return <FileText className="h-6 w-6 text-[var(--lc-text-muted)]" aria-hidden />
}

/**
 * File-upload grid with progress / error tiles.
 *
 * Used by: AGT-APR-004 (`max_files=3`), AGT-APR-005 (`max_files=5`),
 * PA-CRD-005 grant initiator (`max_files=3`).
 *
 * Stub visual + prop shape only — no real upload / signed-URL logic.
 */
export function EvidenceUploader({
  files,
  max_files,
  max_bytes_per_file: _maxBytesPerFile,
  accepted_types,
  onAdd,
  onRemove,
  helper_text,
  label,
  disabled = false,
  className,
}: EvidenceUploaderProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const canAdd = !disabled && files.length < max_files
  const liveUploading = files.find((f) => f.status === 'uploading')

  const openPicker = () => {
    if (!canAdd) return
    inputRef.current?.click()
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const list = event.target.files
    if (!list || list.length === 0) return
    const remaining = max_files - files.length
    onAdd(Array.from(list).slice(0, Math.max(0, remaining)))
    event.target.value = ''
  }

  return (
    <div className={cn('flex flex-col gap-[var(--lc-space-sm)]', className)}>
      {label ? (
        <label
          htmlFor={inputId}
          className="text-[length:var(--lc-type-overline)] text-[var(--lc-text-muted)]"
        >
          {label}
        </label>
      ) : null}
      {helper_text ? (
        <p className="text-sm text-[var(--lc-text-muted)]">{helper_text}</p>
      ) : null}

      <ul
        role="list"
        className={cn(
          'grid gap-[var(--lc-space-sm)]',
          'grid-cols-[repeat(auto-fill,minmax(96px,1fr))]',
          'md:grid-cols-[repeat(auto-fill,minmax(120px,1fr))]',
        )}
      >
        {files.map((file) => (
          <li
            key={file.id}
            className={cn(
              'group relative aspect-square overflow-hidden rounded-[var(--lc-radius-md)]',
              'border border-[var(--lc-border)] bg-[var(--lc-surface-raised)]',
              file.status === 'error' && 'border-t-2 border-t-[var(--lc-status-unpublished-fg)]',
            )}
            aria-label={`Evidence file: ${file.name}, ${formatBytes(file.size_bytes)}`}
            title={file.status === 'error' ? file.error_message : file.name}
          >
            {file.thumbnail_url && file.content_type.startsWith('image/') ? (
              <img
                src={file.thumbnail_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2">
                <FileGlyph contentType={file.content_type} />
                <span className="max-w-full truncate text-center text-xs text-[var(--lc-text-primary)]">
                  {truncateName(file.name)}
                </span>
              </div>
            )}

            {file.status === 'uploading' ? (
              <div
                className="absolute inset-x-0 bottom-0 h-1.5 bg-[var(--lc-surface-sunken)]"
                aria-hidden
              >
                <div
                  className="h-full bg-[var(--lc-action-primary)] transition-[width] duration-fast"
                  style={{ width: `${Math.min(100, Math.max(0, file.progress_pct ?? 0))}%` }}
                />
              </div>
            ) : null}

            {file.status === 'error' ? (
              <AlertOctagon
                className="absolute start-1 top-1 h-4 w-4 text-[var(--lc-status-unpublished-fg)]"
                aria-hidden
              />
            ) : null}

            <button
              type="button"
              className={cn(
                'absolute end-1 top-1 flex h-6 w-6 items-center justify-center rounded-full',
                'bg-[var(--lc-surface-inverse)] text-[var(--lc-text-inverse)]',
                'opacity-100 md:opacity-0 md:group-hover:opacity-100',
                'focus-visible:opacity-100 focus-visible:outline-none',
                'disabled:pointer-events-none disabled:opacity-40',
              )}
              aria-label={`Remove ${file.name}`}
              disabled={disabled}
              onClick={() => onRemove(file.id)}
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </li>
        ))}

        {canAdd ? (
          <li>
            <button
              type="button"
              id={inputId}
              className={cn(
                'flex aspect-square w-full flex-col items-center justify-center gap-1',
                'rounded-[var(--lc-radius-md)] border border-dashed border-[var(--lc-border-strong)]',
                'bg-[var(--lc-surface-raised)] text-[var(--lc-text-muted)]',
                'hover:bg-[var(--lc-action-secondary)]',
                'focus-visible:outline-none min-h-tap',
              )}
              aria-label="Add evidence file"
              onClick={openPicker}
            >
              <Plus className="h-5 w-5" aria-hidden />
              <span className="text-xs">Add</span>
            </button>
          </li>
        ) : null}
      </ul>

      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={accepted_types.join(',')}
        multiple={max_files - files.length > 1}
        disabled={!canAdd}
        onChange={handleChange}
        tabIndex={-1}
        aria-hidden
      />

      <div className="sr-only" aria-live="polite">
        {liveUploading
          ? `Uploading ${liveUploading.name}: ${liveUploading.progress_pct ?? 0} percent`
          : null}
      </div>
    </div>
  )
}
