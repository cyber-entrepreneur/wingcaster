import { WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface OfflineBannerProps {
  /** Banner copy. Parent supplies i18n; defaults to welcome-screen wording. */
  message?: string
  /** When false, renders nothing (parent owns online detection). */
  show?: boolean
  className?: string
}

/**
 * Offline state banner for onboarding flows.
 *
 * Used by: AGT-ONB-001, AGT-ONB-002, AGT-ONB-003, AGT-ONB-004, AGT-ONB-005.
 * Stub visual + prop types only — parent owns `navigator.onLine` / queue writes.
 */
export function OfflineBanner({
  message = "You're offline. Reconnect to continue setup — your progress is saved.",
  show = true,
  className,
}: OfflineBannerProps) {
  if (!show) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex w-full items-start gap-2 border-b border-[var(--lc-border)]',
        'bg-[var(--lc-surface-sunken)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)]',
        'text-[var(--lc-text-secondary)]',
        className,
      )}
      style={{ font: 'var(--lc-type-body-sm)' }}
      data-offline-banner
    >
      <WifiOff
        className="mt-0.5 h-4 w-4 shrink-0 text-[var(--lc-text-muted)]"
        aria-hidden="true"
      />
      <span>{message}</span>
    </div>
  )
}
