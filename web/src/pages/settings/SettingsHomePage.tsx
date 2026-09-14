import { useOutletContext } from 'react-router-dom'
import { type SettingsIndexResponse } from '@/api/client'
import { SettingsAnchor } from '@/components/settings'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/hooks/useLocale'
import { readSettingsCapabilities } from '@/lib/settings-capabilities'
import { settingsCopy } from '@/lib/settings-copy'

interface SettingsOutletContext {
  settingsIndex: SettingsIndexResponse | null
  locale?: string
}

export function SettingsHomePage() {
  const outlet = useOutletContext<SettingsOutletContext | undefined>()
  const { agent } = useAuth()
  const { locale: hookLocale } = useLocale()
  const locale = outlet?.locale ?? hookLocale
  const copy = settingsCopy(locale)
  const index = outlet?.settingsIndex ?? null
  const caps = readSettingsCapabilities(index)
  const displayName = String(agent?.name || 'Account')

  return (
    <div className="hidden md:block">
      <p className="mb-[var(--lc-space-lg)] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body)' }}>
        {copy['sub.desktopOnly']}
      </p>
      <SettingsAnchor
        displayName={displayName}
        email={typeof agent?.email === 'string' ? agent.email : null}
        avatarUrl={typeof agent?.photo === 'string' ? agent.photo : null}
        signInMethod={caps.signInMethod || 'Email'}
        twoFactorOn={caps.security.two_factor_enrolled}
        sessionCount={caps.security.active_session_count}
        showPassword={caps.showPassword}
        showBilling={caps.showBilling}
        planName={caps.billing?.display_name || caps.billing?.plan}
        renewsAt={caps.billing?.renews_at}
        activity={index?.recent_activity}
        locale={locale}
      />
    </div>
  )
}
