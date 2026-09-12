import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api, type SettingsIndexResponse, type TenantSubscription } from '@/api/client'
import { SettingsAnchor } from '@/components/settings'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/hooks/useLocale'
import { isNotFound } from '@/lib/http-status'
import { settingsCopy } from '@/lib/settings-copy'
import type { TwoFactorStatus } from '@/types/twoFactor'

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

  const [twoFa, setTwoFa] = useState<TwoFactorStatus | null>(null)
  const [sessionCount, setSessionCount] = useState<number | undefined>(undefined)
  const [subscription, setSubscription] = useState<TenantSubscription | null>(null)

  useEffect(() => {
    let cancelled = false
    api.twoFactorStatus()
      .then((s) => {
        if (!cancelled) setTwoFa(s)
      })
      .catch(() => {
        if (!cancelled) setTwoFa(null)
      })
    api
      .getAuthSessions()
      .then((res) => {
        if (!cancelled) setSessionCount(res.sessions?.length ?? 0)
      })
      .catch((err) => {
        if (!cancelled) setSessionCount(isNotFound(err) ? 0 : 0)
      })
    api
      .getTenantSubscription()
      .then((res) => {
        if (!cancelled) setSubscription(res.subscription)
      })
      .catch(() => {
        if (!cancelled) setSubscription(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const caps = index?.capabilities || {}
  const showBilling = caps.billing !== false
  const showPassword = caps.password !== false
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
        signInMethod="Email"
        twoFactorOn={Boolean(twoFa?.totp_enabled)}
        sessionCount={sessionCount ?? 0}
        showPassword={showPassword}
        showBilling={showBilling}
        planName={subscription?.display_name || subscription?.package_code}
        renewsAt={subscription?.billing_cycle_end}
        activity={index?.recent_activity}
        locale={locale}
      />
    </div>
  )
}
