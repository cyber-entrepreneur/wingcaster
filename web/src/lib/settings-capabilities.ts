import type { SettingsIndexResponse } from '@/api/client'

export interface SettingsSecurityCapabilities {
  two_factor_enrolled: boolean
  active_session_count: number
}

export interface SettingsBillingCapabilities {
  plan: string | null
  past_due: boolean
  display_name: string | null
  renews_at: string | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

/** Nested SHR-SET-001 capabilities from GET /api/settings/index. */
export function readSettingsCapabilities(index: SettingsIndexResponse | null | undefined) {
  const caps = index?.capabilities || {}
  const securityRaw = asRecord(caps.security)
  const billingRaw = asRecord(caps.billing)
  const identityRaw = asRecord(caps.identity)

  const security: SettingsSecurityCapabilities = {
    two_factor_enrolled: Boolean(securityRaw?.two_factor_enrolled),
    active_session_count: Number(securityRaw?.active_session_count ?? 0) || 0,
  }

  const billing: SettingsBillingCapabilities | null = billingRaw
    ? {
        plan: typeof billingRaw.plan === 'string' ? billingRaw.plan : null,
        past_due: Boolean(billingRaw.past_due),
        display_name: typeof billingRaw.display_name === 'string' ? billingRaw.display_name : null,
        renews_at: typeof billingRaw.renews_at === 'string' ? billingRaw.renews_at : null,
      }
    : null

  return {
    password: caps.password !== false,
    oauthOnly: Boolean(identityRaw?.oauth_only),
    signInMethod: typeof identityRaw?.signin_method === 'string' ? identityRaw.signin_method : 'email',
    security,
    billing,
    showBilling: caps.billing !== false,
    showPassword: caps.password !== false,
  }
}
