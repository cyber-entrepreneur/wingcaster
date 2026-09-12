import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import type { SettingsIndexResponse } from '@/api/client'
import { fillCopy, settingsCopy } from '@/lib/settings-copy'
import { formatRelativeTime, formatShortDate, initialsFromName } from '@/lib/relative-time'
import { BillingSnapshotCard } from './BillingSnapshotCard'
import { SecurityCountValue, SecurityPostureTile } from './SecurityPostureTile'
import { SettingsActivityList } from './SettingsActivityList'

export function SettingsAnchor({
  displayName,
  email,
  avatarUrl,
  signInMethod,
  twoFactorOn,
  sessionCount,
  passwordChangedAt,
  showPassword,
  planName,
  renewsAt,
  showBilling,
  activity,
  locale = 'en',
}: {
  displayName: string
  email?: string | null
  avatarUrl?: string | null
  signInMethod?: string | null
  twoFactorOn?: boolean
  sessionCount?: number
  passwordChangedAt?: string | null
  showPassword?: boolean
  planName?: string | null
  renewsAt?: string | null
  showBilling?: boolean
  activity?: SettingsIndexResponse['recent_activity']
  locale?: string
}) {
  const copy = settingsCopy(locale)
  const sessionsHref = '/settings/sessions'
  const twoFaHref = '/settings/2fa'

  return (
    <div className="flex flex-col gap-[var(--lc-space-xl)]">
      <Card className="shadow-[var(--lc-elevation-sm)]">
        <CardContent className="flex flex-col gap-[var(--lc-space-md)] p-[var(--lc-space-xl)] sm:flex-row sm:items-center">
          <Avatar className="h-16 w-16 rounded-[var(--lc-radius-pill)] bg-[var(--lc-surface-inverse)] text-[var(--lc-text-inverse)]">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
            <AvatarFallback className="bg-[var(--lc-surface-inverse)] text-[var(--lc-text-inverse)]">
              {initialsFromName(displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h2 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-2)' }}>
              {displayName}
            </h2>
            {email ? (
              <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body)' }} dir="ltr">
                {email}
              </p>
            ) : null}
            <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
              {fillCopy(copy['anchor.greeting'], { method: signInMethod || 'Email' })}
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/settings/account">{copy['anchor.editProfile']}</Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-[var(--lc-space-md)] md:grid-cols-3">
        <SecurityPostureTile
          label="2FA"
          value={twoFactorOn ? copy['anchor.security.2fa.on'] : copy['anchor.security.2fa.off']}
          tone={twoFactorOn ? 'success' : 'warning'}
          actionLabel={copy['anchor.security.2fa.action']}
          to={twoFaHref}
        />
        <SecurityPostureTile
          label="Sessions"
          value={<SecurityCountValue count={sessionCount ?? 0} />}
          actionLabel={copy['anchor.security.sessions.action']}
          to={sessionsHref}
        />
        {showPassword !== false ? (
          <SecurityPostureTile
            label="Password"
            value={
              passwordChangedAt
                ? fillCopy(copy['anchor.security.password.last'], {
                    relativeTime: formatRelativeTime(passwordChangedAt),
                  })
                : '—'
            }
            actionLabel={copy['anchor.security.password.action']}
            to="/settings/password"
          />
        ) : (
          <div />
        )}
      </div>

      <BillingSnapshotCard
        planName={planName}
        renewsAt={renewsAt ? formatShortDate(renewsAt, locale) : null}
        locale={locale}
        hidden={!showBilling}
      />

      <SettingsActivityList items={activity ?? []} locale={locale} />

      <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
        <Link to="/settings/danger/delete-account" className="hover:text-[var(--lc-text-brand)]">
          {copy['anchor.danger.hint']} →
        </Link>
      </p>
    </div>
  )
}
