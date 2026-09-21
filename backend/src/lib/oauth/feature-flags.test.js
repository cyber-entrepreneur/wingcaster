import { describe, expect, it } from 'vitest'
import { isLinkedInOAuthEnabled, isOAuthConnectEnabled } from './feature-flags.js'

describe('oauth feature flags', () => {
  it('requires explicit enablement for LinkedIn OAuth', () => {
    expect(isLinkedInOAuthEnabled({})).toBe(false)
    expect(isLinkedInOAuthEnabled({ WINGCASTER_LINKEDIN_OAUTH_ENABLED: 'true' })).toBe(true)
    expect(isLinkedInOAuthEnabled({ WINGCASTER_LINKEDIN_OAUTH_ENABLED: 'false' })).toBe(false)
  })

  it('gates linkedin and meta connect paths', () => {
    expect(isOAuthConnectEnabled('x', {})).toBe(true)
    expect(isOAuthConnectEnabled('linkedin', {})).toBe(false)
    expect(isOAuthConnectEnabled('linkedin', { WINGCASTER_LINKEDIN_OAUTH_ENABLED: 'true' })).toBe(true)
    expect(isOAuthConnectEnabled('facebook', {})).toBe(false)
    expect(isOAuthConnectEnabled('facebook', { WINGCASTER_META_OAUTH_CONNECT_ENABLED: 'true' })).toBe(true)
  })
})
