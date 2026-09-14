import { AlertTriangle } from 'lucide-react'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'

export interface RateLimitBannerProps {
  /** Primary message. Parent supplies i18n (e.g. "Too many attempts…"). */
  message: string
  /**
   * Optional lockout remaining minutes for countdown display.
   * Rendered via `<Numeric>` when provided.
   */
  retryAfterMinutes?: number
  /** Optional accessible live-region politeness. Defaults to assertive. */
  'aria-live'?: 'polite' | 'assertive' | 'off'
  className?: string
}

/**
 * Inline rate-limit / lockout banner for MFA + auth challenge surfaces.
 *
 * Used by: SHR-MFA-004, SHR-MFA-004b, SHR-MFA-007, SHR-AUT-001.
 * Tokens: `--lc-status-warning-*` + `AlertTriangle` glyph.
 */
export function RateLimitBanner({
  message,
  retryAfterMinutes,
  'aria-live': ariaLive = 'assertive',
  className,
}: RateLimitBannerProps) {
  return (
    <div
      role="alert"
      aria-live={ariaLive}
      className={cn(
        'flex items-start gap-[var(--lc-space-sm)] rounded-[var(--lc-radius-md)]',
        'bg-[var(--lc-status-warning-bg)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)]',
        'text-[var(--lc-status-warning-fg)]',
        className,
      )}
    >
      <AlertTriangle
        className="mt-0.5 h-4 w-4 shrink-0 text-[var(--lc-status-warning-fg)]"
        aria-hidden
      />
      <div className="min-w-0 font-[family-name:var(--lc-font-ui)] text-[length:var(--lc-type-body-sm)]">
        <p>
          <span aria-hidden>⚠ </span>
          {message}
        </p>
        {typeof retryAfterMinutes === 'number' ? (
          <p className="mt-1">
            Retry in <Numeric>{retryAfterMinutes}</Numeric> min
          </p>
        ) : null}
      </div>
    </div>
  )
}
