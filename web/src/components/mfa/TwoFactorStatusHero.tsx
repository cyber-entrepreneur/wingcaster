import { ShieldCheck, ShieldOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type TwoFactorStatus = 'on' | 'off' | 'loading'

export interface TwoFactorStatusHeroProps {
  /** Enrollment status. `loading` renders a skeleton card. */
  status: TwoFactorStatus
  /** Primary heading — e.g. "On" / "Off". Parent supplies i18n. */
  title?: string
  /** Supporting line — e.g. "Authenticator app · enrolled Sep 4, 2026". */
  subtitle?: string
  /** Optional right-side badge label (enabled + recommended). */
  badgeLabel?: string
  className?: string
}

/**
 * Hero status card for the 2FA settings home.
 *
 * Used by: SHR-MFA-001, SHR-AUT-005 (recovery landing), SHR-SET-004 reuse.
 * Tokens: `--lc-surface-raised` + `--lc-elevation-sm`; badge uses
 * `--lc-status-published-*` (on) or `--lc-status-draft-*` (off).
 */
export function TwoFactorStatusHero({
  status,
  title,
  subtitle,
  badgeLabel,
  className,
}: TwoFactorStatusHeroProps) {
  if (status === 'loading') {
    return (
      <div
        aria-busy="true"
        aria-label="Loading two-factor status"
        className={cn(
          'min-h-24 rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)]',
          'shadow-[var(--lc-elevation-sm)] md:min-h-24',
          className,
        )}
      >
        <div className="flex items-center gap-[var(--lc-space-md)]">
          <div className="h-10 w-10 animate-pulse rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)]" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-24 animate-pulse rounded bg-[var(--lc-surface-sunken)]" />
            <div className="h-4 w-48 animate-pulse rounded bg-[var(--lc-surface-sunken)]" />
          </div>
        </div>
      </div>
    )
  }

  const enabled = status === 'on'
  const Icon = enabled ? ShieldCheck : ShieldOff
  const resolvedTitle = title ?? (enabled ? 'On' : 'Off')
  const resolvedSubtitle = subtitle ?? (enabled ? 'Authenticator app active' : 'Not set up')

  return (
    <div
      className={cn(
        'min-h-28 rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)]',
        'shadow-[var(--lc-elevation-sm)] md:min-h-24',
        className,
      )}
      aria-label={`Status: ${resolvedTitle}${enabled ? ', authenticator app active' : ''}`}
    >
      <div className="flex items-center gap-[var(--lc-space-md)]">
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-[var(--lc-radius-md)]',
            enabled
              ? 'bg-[var(--lc-status-published-bg)] text-[var(--lc-status-published-fg)]'
              : 'bg-[var(--lc-status-draft-bg)] text-[var(--lc-text-muted)]',
          )}
        >
          <Icon className="h-6 w-5" aria-hidden />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-[family-name:var(--lc-font-ui)] text-[length:var(--lc-type-heading-3)] text-[var(--lc-text-heading)]">
              {resolvedTitle}
            </p>
            <Badge status={enabled ? 'published' : 'draft'} className="rounded-[var(--lc-radius-pill)]">
              {enabled ? 'On' : 'Off'}
            </Badge>
          </div>
          <p className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-secondary)]">
            {resolvedSubtitle}
          </p>
        </div>

        {enabled ? (
          <Badge
            status="published"
            className="hidden shrink-0 rounded-[var(--lc-radius-pill)] sm:inline-flex"
          >
            {badgeLabel ?? 'Recommended'}
          </Badge>
        ) : null}
      </div>
    </div>
  )
}
