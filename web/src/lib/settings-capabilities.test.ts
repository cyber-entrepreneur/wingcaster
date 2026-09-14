import { describe, expect, it } from 'vitest'
import { readSettingsCapabilities } from './settings-capabilities'
import type { SettingsIndexResponse } from '@/api/client'

describe('readSettingsCapabilities', () => {
  it('reads nested security + billing from /settings/index', () => {
    const index: SettingsIndexResponse = {
      capabilities: {
        password: true,
        identity: { oauth_only: false, signin_method: 'email' },
        security: { two_factor_enrolled: true, active_session_count: 3 },
        billing: { plan: 'semsar', past_due: false, display_name: 'Semsar', renews_at: '2026-10-01' },
      },
      groups: [],
    }
    const caps = readSettingsCapabilities(index)
    expect(caps.security.two_factor_enrolled).toBe(true)
    expect(caps.security.active_session_count).toBe(3)
    expect(caps.showBilling).toBe(true)
    expect(caps.billing?.plan).toBe('semsar')
    expect(caps.billing?.display_name).toBe('Semsar')
  })

  it('hides billing when the server sends billing: false', () => {
    const caps = readSettingsCapabilities({
      capabilities: { billing: false, security: { two_factor_enrolled: false, active_session_count: 1 } },
      groups: [],
    })
    expect(caps.showBilling).toBe(false)
    expect(caps.billing).toBeNull()
  })
})
