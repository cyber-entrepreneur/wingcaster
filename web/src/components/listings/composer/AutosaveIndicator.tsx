import { AlertCircle, Check, Cloud } from 'lucide-react'
import { Numeric } from '@/components/ui/numeric'
import type { AutosaveStatus } from '@/hooks/useAutosaveDraft'
import { cn } from '@/lib/utils'

export interface AutosaveIndicatorProps {
  status: AutosaveStatus
  lastSavedAt?: Date | null
  onRetry?: () => void
  className?: string
}

function relative(ts: Date | null | undefined): string {
  if (!ts) return ''
  const sec = Math.floor((Date.now() - ts.getTime()) / 1000)
  if (sec < 8) return 'just now'
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  return ts.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export function AutosaveIndicator({
  status,
  lastSavedAt,
  onRetry,
  className,
}: AutosaveIndicatorProps) {
  if (status === 'idle' && !lastSavedAt) return null

  let label = 'Saved'
  if (status === 'saving') label = 'Saving…'
  else if (status === 'failed') label = "Couldn't save — retry?"
  else if (status === 'saved' && lastSavedAt && Date.now() - lastSavedAt.getTime() < 5000) {
    label = 'Saved just now'
  } else if (lastSavedAt) {
    label = `Saved ${relative(lastSavedAt)}`
  }

  const base = cn(
    'inline-flex items-center gap-1.5 rounded-[var(--lc-radius-pill)] px-2.5 py-1',
    'text-[length:var(--lc-type-caption)]',
    status === 'failed' && 'text-[var(--lc-status-unpublished-fg)]',
    status === 'saved' && 'text-[var(--lc-status-published-fg)]',
    status === 'saving' && 'text-[var(--lc-accent)]',
    (status === 'idle' || (!status && lastSavedAt)) && 'text-[var(--lc-text-muted)]',
    className,
  )

  const icon =
    status === 'saving' ? (
      <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--lc-accent)]" aria-hidden />
    ) : status === 'saved' ? (
      <Check className="h-3.5 w-3.5" aria-hidden />
    ) : status === 'failed' ? (
      <AlertCircle className="h-3.5 w-3.5" aria-hidden />
    ) : (
      <Cloud className="h-3.5 w-3.5" aria-hidden />
    )

  const body = (
    <>
      {icon}
      <span>
        {status === 'idle' && lastSavedAt ? (
          <>
            Saved <Numeric>{relative(lastSavedAt)}</Numeric>
          </>
        ) : (
          label
        )}
      </span>
    </>
  )

  if (status === 'failed' && onRetry) {
    return (
      <button type="button" className={base} onClick={onRetry} aria-live="polite" aria-label={label}>
        {body}
      </button>
    )
  }

  return (
    <span className={base} aria-live="polite" role="status">
      {body}
    </span>
  )
}
