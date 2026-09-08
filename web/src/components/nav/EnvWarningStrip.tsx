import { AlertTriangle } from 'lucide-react'
import { envCopy } from '@/components/nav/EnvBadge'
import { useEnv } from '@/hooks/useEnv'
import { useLocale, type AppLocale } from '@/hooks/useLocale'
import { cn } from '@/lib/utils'

export interface EnvWarningStripProps {
  locale?: AppLocale
  className?: string
  /** Opens the LIVE-bound confirmation dialog — never switches directly. */
  onSwitchToLive: () => void
}

/**
 * PA-NAV-001 — sticky TEST warning under the top bar.
 * Render only while env === 'test' (PaAppShell).
 */
export function EnvWarningStrip({
  locale = 'en',
  className,
  onSwitchToLive,
}: EnvWarningStripProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'sticky top-0 z-sticky flex h-6 w-full items-center',
        'bg-[var(--lc-status-underOffer-dot)] text-[var(--lc-text-inverse)]',
        'font-[var(--lc-type-caption)] tracking-[var(--lc-tracking-caption)]',
        className,
      )}
    >
      <div className="relative mx-auto flex w-full max-w-[1440px] items-center justify-center gap-[var(--lc-space-2xs)] px-[var(--lc-space-md)]">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate text-center">
          {envCopy('strip.warning.text', locale)}
        </span>
        <button
          type="button"
          onClick={onSwitchToLive}
          className={cn(
            'absolute end-[var(--lc-space-md)] inline-flex items-center',
            'min-h-[var(--lc-tap-target-min)] px-[var(--lc-space-2xs)]',
            'font-semibold underline-offset-2 hover:underline',
            'text-[var(--lc-text-inverse)]',
            'focus-visible:outline-none',
          )}
        >
          {envCopy('strip.warning.link', locale)}
        </button>
      </div>
    </div>
  )
}

/**
 * Connected strip for PaAppShell — renders only in TEST and opens LIVE confirm.
 */
export function PaEnvWarningStrip({ className }: { className?: string }) {
  const { locale } = useLocale()
  const { isTest, openLiveConfirm } = useEnv()
  if (!isTest) return null
  return (
    <EnvWarningStrip
      locale={locale}
      className={className}
      onSwitchToLive={openLiveConfirm}
    />
  )
}
