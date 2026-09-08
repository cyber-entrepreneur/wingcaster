import { Loader2 } from 'lucide-react'
import { ProgressRing } from '@/components/onboarding/ProgressRing'
import { cn } from '@/lib/utils'

export interface PublishingOverlayProps {
  /** When false, renders nothing. */
  open?: boolean
  /** 0–100 publish progress; omit for indeterminate spinner. */
  progress?: number
  /** Status copy, e.g. `"Publishing your listing…"`. Parent supplies i18n. */
  label?: string
  className?: string
}

/**
 * Full-screen publishing progress overlay with ring / spinner.
 *
 * Used by: AGT-ONB-003; reusable on any future publish surface.
 * Stub visual + prop types only — no publish API.
 */
export function PublishingOverlay({
  open = true,
  progress,
  label = 'Publishing your listing…',
  className,
}: PublishingOverlayProps) {
  if (!open) return null

  const hasProgress = typeof progress === 'number'
  const completed = hasProgress ? Math.round((Math.min(100, Math.max(0, progress)) / 100) * 4) : 0

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-label={label}
      className={cn(
        'fixed inset-0 z-50 flex flex-col items-center justify-center gap-[var(--lc-space-lg)]',
        'bg-[var(--lc-surface)]/90 backdrop-blur-sm',
        className,
      )}
      data-publishing-overlay
    >
      {hasProgress ? (
        <ProgressRing size={64} completed={completed} total={4} />
      ) : (
        <Loader2
          className="h-10 w-10 animate-spin text-[var(--lc-action-primary)]"
          aria-hidden="true"
        />
      )}
      <p
        className="text-[var(--lc-text-heading)]"
        style={{ font: 'var(--lc-type-heading-3)' }}
      >
        {label}
      </p>
      {hasProgress ? (
        <p
          className="text-[var(--lc-text-muted)]"
          style={{ font: 'var(--lc-type-caption)' }}
          aria-live="polite"
        >
          {Math.round(progress)}%
        </p>
      ) : null}
    </div>
  )
}
