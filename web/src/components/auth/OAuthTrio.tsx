import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMode } from '@/context/BrandContext'
import { resolveLcMode } from '@/theme/mode'
import { AppleMark, FacebookMark, GoogleMark } from './OAuthIcons'
import type { OAuthProvider } from './loginApi'
import { rt, type RegisterLocale } from './registerCopy'

export type OAuthTrioProps = {
  locale?: RegisterLocale
  disabled?: boolean
  /** Provider currently redirecting — shows Loader2 on that button. */
  loadingProvider?: OAuthProvider | null
  onStart: (provider: OAuthProvider) => void
  className?: string
  /** When false, omit the “or use your account” divider (parent renders it). */
  showDivider?: boolean
}

const oauthButtonBase =
  'relative flex w-full items-center justify-center gap-3 rounded-[var(--lc-radius-md)] px-4 text-[length:15px] font-[family-name:var(--lc-font-ui)] font-medium transition-[background-color,color,box-shadow,border-color] duration-[var(--lc-duration-fast)] ease-out focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 min-h-[var(--lc-tap-target-min)]'

/**
 * SHR-AUT-006 OAuth trio — Google / Apple / Facebook.
 * Reuses OAuthIcons; signup-specific copy + Broadcast radii/padding.
 * Provider brand fills are the documented exception to --lc-* (rgb, not hex).
 */
export function OAuthTrio({
  locale = 'en',
  disabled = false,
  loadingProvider = null,
  onStart,
  className,
  showDivider = true,
}: OAuthTrioProps) {
  const [mode] = useMode()
  const isDark = resolveLcMode(mode) === 'dark'
  const busy = Boolean(loadingProvider)

  const buttons: Array<{
    provider: OAuthProvider
    label: string
    Mark: typeof GoogleMark
    className: string
  }> = [
    {
      provider: 'google',
      label: rt('oauth.google', locale),
      Mark: GoogleMark,
      className: isDark
        ? 'border border-[var(--lc-border-strong)] bg-[var(--lc-surface-raised)] text-[var(--lc-text-primary)]'
        : 'border border-[color:rgb(218,220,224)] bg-[color:rgb(255,255,255)] text-[color:rgb(60,64,67)]',
    },
    {
      provider: 'apple',
      label: rt('oauth.apple', locale),
      Mark: AppleMark,
      className: isDark
        ? 'bg-[color:rgb(255,255,255)] text-[color:rgb(0,0,0)]'
        : 'bg-[color:rgb(0,0,0)] text-[color:rgb(255,255,255)]',
    },
    {
      provider: 'facebook',
      label: rt('oauth.facebook', locale),
      Mark: FacebookMark,
      className: 'bg-[color:rgb(24,119,242)] text-[color:rgb(255,255,255)]',
    },
  ]

  return (
    <div className={cn('flex flex-col gap-[var(--lc-space-sm)]', className)} data-testid="oauth-trio">
      {buttons.map(({ provider, label, Mark, className: face }) => {
        const loading = loadingProvider === provider
        return (
          <button
            key={provider}
            type="button"
            className={cn(oauthButtonBase, face)}
            aria-label={label}
            disabled={disabled || busy}
            onClick={() => onStart(provider)}
            data-testid={`oauth-${provider}`}
          >
            <span className="absolute start-4 flex items-center">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Mark />
              )}
            </span>
            {label}
          </button>
        )
      })}

      {showDivider ? (
        <div className="relative flex items-center gap-[var(--lc-space-sm)] py-1" role="presentation">
          <div className="h-px flex-1 bg-[var(--lc-border)]" />
          <span
            className="shrink-0 text-[var(--lc-text-muted)]"
            style={{ font: 'var(--lc-type-body-sm)' }}
          >
            {rt('oauth.divider', locale)}
          </span>
          <div className="h-px flex-1 bg-[var(--lc-border)]" />
        </div>
      ) : null}
    </div>
  )
}
