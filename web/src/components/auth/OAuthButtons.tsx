import { cn } from '@/lib/utils'
import { useMode } from '@/context/BrandContext'
import { resolveLcMode } from '@/theme/mode'
import type { LoginLocale } from './loginCopy'
import { t } from './loginCopy'
import type { OAuthProvider } from './loginApi'
import { AppleMark, FacebookMark, GoogleMark } from './OAuthIcons'

/**
 * Provider-branded OAuth buttons (exception to --lc-* fills).
 * Focus rings still come from base two-tone --lc-focus-* styles.
 */

type Props = {
  locale: LoginLocale
  disabled?: boolean
  onStart: (provider: OAuthProvider) => void
}

const oauthButtonBase =
  'relative flex w-full items-center justify-center gap-3 rounded-[var(--lc-radius-xl)] px-4 text-[length:15px] font-[family-name:var(--lc-font-ui)] font-medium transition-[background-color,color,box-shadow,border-color] duration-fast ease-out focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 min-h-[48px]'

export function OAuthButtons({ locale, disabled, onStart }: Props) {
  const [mode] = useMode()
  const resolved = resolveLcMode(mode)
  const isDark = resolved === 'dark'

  return (
    <div className="flex flex-col gap-[var(--lc-space-sm)]">
      <div className="flex items-center gap-[var(--lc-space-sm)]" role="presentation">
        <div className="h-px flex-1 bg-[var(--lc-border)]" />
        <p className="font-[family-name:var(--lc-font-ui)] text-[length:11px] font-semibold uppercase tracking-[0.08em] text-[var(--lc-text-muted)]">
          {t('federated.heading', locale)}
        </p>
        <div className="h-px flex-1 bg-[var(--lc-border)]" />
      </div>

      <button
        type="button"
        className={cn(
          oauthButtonBase,
          isDark
            ? 'border border-[var(--lc-border-strong)] bg-[var(--lc-surface-raised)] text-[var(--lc-text-primary)]'
            : 'border border-[color:rgb(218,220,224)] bg-[color:rgb(255,255,255)] text-[color:rgb(60,64,67)]',
        )}
        aria-label={t('aria.google', locale)}
        disabled={disabled}
        onClick={() => onStart('google')}
      >
        <span className="absolute start-4 flex items-center">
          <GoogleMark />
        </span>
        {t('federated.google', locale)}
      </button>

      <button
        type="button"
        className={cn(
          oauthButtonBase,
          isDark
            ? 'bg-[color:rgb(255,255,255)] text-[color:rgb(0,0,0)]'
            : 'bg-[color:rgb(0,0,0)] text-[color:rgb(255,255,255)]',
        )}
        aria-label={t('aria.apple', locale)}
        disabled={disabled}
        onClick={() => onStart('apple')}
      >
        <span className="absolute start-4 flex items-center">
          <AppleMark />
        </span>
        {t('federated.apple', locale)}
      </button>

      <button
        type="button"
        className={cn(oauthButtonBase, 'bg-[color:rgb(24,119,242)] text-[color:rgb(255,255,255)]')}
        aria-label={t('aria.facebook', locale)}
        disabled={disabled}
        onClick={() => onStart('facebook')}
      >
        <span className="absolute start-4 flex items-center">
          <FacebookMark />
        </span>
        {t('federated.facebook', locale)}
      </button>
    </div>
  )
}
