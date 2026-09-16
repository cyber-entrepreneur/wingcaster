import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export interface PackWarningBannerProps {
  /** Body copy (already localized). */
  message: string
  /** Optional deep-link action (localized label). */
  actionLabel?: string
  onAction?: () => void
  className?: string
}

/**
 * AGN-ROL-001 R11 warning banner. `warning` maps to the underOffer status
 * palette per the Wave 6/7 token gotcha (no --lc-status-warning-* tokens exist).
 * role="alert" so it is announced on render.
 */
export function PackWarningBanner({
  message,
  actionLabel,
  onAction,
  className,
}: PackWarningBannerProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2 rounded-[var(--lc-radius-md)] border px-3 py-2',
        'border-[var(--lc-status-underOffer-fg)] bg-[var(--lc-status-underOffer-bg)]',
        'text-[var(--lc-status-underOffer-fg)]',
        className,
      )}
      data-pack-warning
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1" style={{ font: 'var(--lc-type-body-sm)' }}>
        <span>{message}</span>
        {actionLabel && onAction ? (
          <Button
            type="button"
            variant="link"
            className="ms-1 inline h-auto p-0 align-baseline text-[var(--lc-status-underOffer-fg)] underline"
            onClick={onAction}
          >
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
