import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'

export type DraftFieldKey =
  | 'address'
  | 'bedrooms'
  | 'bathrooms'
  | 'price'
  | 'area_sqft'
  | 'description'
  | 'photos'

export type DraftFieldState = 'idle' | 'thinking' | 'streaming' | 'complete'

/** Live-connection transport mode (AGT-WLB-001 palette + prep aliases). */
export type LiveDraftConnectionMode =
  | 'sse'
  | 'ws'
  | 'polling-fallback'
  /** Prep alias for `polling-fallback`. */
  | 'polling'
  /** Determinate-spinner fallback when streaming is unavailable. */
  | 'fallback'

export interface DraftField {
  key: DraftFieldKey
  label: string
  state: DraftFieldState
  /** Photos as URL array; scalars for the rest. */
  value?: string | number | string[]
  /** Partial description text while `state === 'streaming'`. */
  streamedText?: string
}

export interface LiveDraftCanvasProps {
  fields: DraftField[]
  /**
   * Transport mode. Brief palette: `'sse' | 'ws' | 'polling-fallback'`.
   * Prep also accepts `'polling'` / `'fallback'` for the SSE/polling/fallback triad.
   */
  connection: LiveDraftConnectionMode
  onCancel: () => void
  /** Completes the tour without waiting for the draft. */
  onEditLater: () => void
  className?: string
}

function isNumericKey(key: DraftFieldKey): boolean {
  return key === 'bedrooms' || key === 'bathrooms' || key === 'price' || key === 'area_sqft'
}

function isWide(key: DraftFieldKey): boolean {
  return key === 'address' || key === 'description'
}

function connectionCaption(
  connection: LiveDraftCanvasProps['connection'],
): string | null {
  if (connection === 'polling' || connection === 'polling-fallback') {
    return 'Live view is degraded — refreshing every 3s.'
  }
  if (connection === 'fallback') {
    return 'Drafting your listing… this usually takes 15-30s.'
  }
  return null
}

function renderValue(field: DraftField): ReactNode {
  switch (field.state) {
    case 'idle':
      return <span className="text-[var(--lc-text-muted)]">Waiting for input…</span>
    case 'thinking':
      return (
        <span className="inline-flex items-center gap-2 text-[var(--lc-text-muted)]">
          <span
            aria-hidden
            className={cn(
              'inline-block h-3 w-16 rounded-[var(--lc-radius-sm)]',
              'bg-[var(--lc-surface-sunken)] motion-safe:animate-pulse',
            )}
          />
          Thinking…
        </span>
      )
    case 'streaming':
      return (
        <span className="whitespace-pre-wrap text-[var(--lc-text-primary)]">
          {field.streamedText ?? ''}
          <span
            aria-hidden
            className="ms-0.5 inline-block w-[0.5ch] animate-pulse font-mono text-[var(--lc-text-brand)] motion-reduce:animate-none"
          >
            |
          </span>
        </span>
      )
    case 'complete': {
      if (Array.isArray(field.value)) {
        return (
          <span className="text-[var(--lc-text-primary)]">
            <Numeric>{field.value.length}</Numeric> photos
          </span>
        )
      }
      if (isNumericKey(field.key) && field.value != null) {
        return <Numeric className="text-[var(--lc-text-primary)]">{field.value}</Numeric>
      }
      return <span className="text-[var(--lc-text-primary)]">{String(field.value ?? '')}</span>
    }
    default:
      return null
  }
}

/**
 * Streaming AI draft field grid for WhatsApp intake.
 *
 * Used by: AGT-WLB-004 (heavy). Cross-fades into AGT-WLB-005 when ready.
 *
 * Stub visual + prop types only — no real SSE / polling / WhatsApp.
 */
export function LiveDraftCanvas({
  fields,
  connection,
  onCancel,
  onEditLater,
  className,
}: LiveDraftCanvasProps) {
  const busy = fields.some((f) => f.state === 'thinking' || f.state === 'streaming')
  const caption = connectionCaption(connection)

  return (
    <div
      className={cn('flex flex-col gap-[var(--lc-space-md)]', className)}
      aria-busy={busy || undefined}
    >
      <ol
        aria-live="polite"
        className="grid grid-cols-1 gap-[var(--lc-space-sm)] md:grid-cols-2"
      >
        {fields.map((field) => (
          <li
            key={field.key}
            className={cn(
              'relative rounded-[var(--lc-radius-md)] border border-[var(--lc-border)]',
              'bg-[var(--lc-surface-raised)] p-[var(--lc-space-md)]',
              'transition-opacity duration-[var(--lc-duration-base)] ease-[var(--lc-easing-out)]',
              isWide(field.key) && 'md:col-span-2',
            )}
          >
            <p className="mb-2 text-[length:var(--lc-type-overline)] uppercase tracking-wide text-[var(--lc-text-muted)]">
              {field.label}
            </p>
            <div className="min-h-[1.5rem] text-sm">{renderValue(field)}</div>
            {field.state === 'complete' ? (
              <Check
                aria-hidden
                className={cn(
                  'absolute end-3 top-3 h-4 w-4 text-[var(--lc-accent-bold)]',
                  'opacity-100 transition-opacity duration-[var(--lc-duration-fast)]',
                  'ease-[var(--lc-easing-emphasis)]',
                )}
              />
            ) : null}
          </li>
        ))}
      </ol>

      {caption ? (
        <p className="text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
          {caption}
        </p>
      ) : null}

      {/* Ghost actions live on the screen sticky bar; stubs kept for prop wiring smoke. */}
      <div className="sr-only">
        <button type="button" onClick={onCancel}>
          Cancel this draft
        </button>
        <button type="button" onClick={onEditLater}>
          Edit later
        </button>
      </div>
    </div>
  )
}
