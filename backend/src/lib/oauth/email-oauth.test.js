import { describe, expect, it } from 'vitest'
import { buildAuthorizeUrl } from './index.js'
import {
  isEmailOAuthCapablePlatform,
  isEmailOAuthConnectEnabled,
  isGoogleEmailOAuthConnectEnabled,
  isMicrosoftEmailOAuthConnectEnabled,
} from './email-oauth.js'
import { getProvider } from './provider-registry.js'

const env = {
  WINGCASTER_GOOGLE_EMAIL_OAUTH_CONNECT_ENABLED: 'true',
  WINGCASTER_MICROSOFT_EMAIL_OAUTH_CONNECT_ENABLED: 'true',
  GOOGLE_OAUTH_CLIENT_ID: 'google-client',
  GOOGLE_OAUTH_CLIENT_SECRET: 'google-secret',
  MICROSOFT_OAUTH_CLIENT_ID: 'ms-client',
  MICROSOFT_OAUTH_CLIENT_SECRET: 'ms-secret',
  PUBLIC_API_URL: 'https://api.test/api',
}

describe('email-oauth feature flags', () => {
  it('flags google and microsoft independently', () => {
    expect(isGoogleEmailOAuthConnectEnabled({ WINGCASTER_GOOGLE_EMAIL_OAUTH_CONNECT_ENABLED: 'true' })).toBe(true)
    expect(isGoogleEmailOAuthConnectEnabled({})).toBe(false)
    expect(isMicrosoftEmailOAuthConnectEnabled({ WINGCASTER_MICROSOFT_EMAIL_OAUTH_CONNECT_ENABLED: 'true' })).toBe(true)
    expect(isMicrosoftEmailOAuthConnectEnabled({})).toBe(false)
    expect(isEmailOAuthConnectEnabled('google', { WINGCASTER_GOOGLE_EMAIL_OAUTH_CONNECT_ENABLED: 'true' })).toBe(true)
    expect(isEmailOAuthConnectEnabled('google', { WINGCASTER_MICROSOFT_EMAIL_OAUTH_CONNECT_ENABLED: 'true' })).toBe(false)
  })

  it('requires both provider registry and feature flag', () => {
    expect(isEmailOAuthCapablePlatform('google', env)).toBe(true)
    expect(isEmailOAuthCapablePlatform('google', { ...env, WINGCASTER_GOOGLE_EMAIL_OAUTH_CONNECT_ENABLED: 'false' })).toBe(false)
    expect(isEmailOAuthCapablePlatform('microsoft', { ...env, WINGCASTER_MICROSOFT_EMAIL_OAUTH_CONNECT_ENABLED: 'false' })).toBe(false)
  })
})

describe('google authorize URL', () => {
  it('includes offline access and consent prompt with PKCE', () => {
    const config = getProvider('google')
    expect(config.authExtraParams).toEqual({ access_type: 'offline', prompt: 'consent' })
    expect(config.usesPKCE).toBe(true)
    expect(config.pkceMethod).toBe('S256')
    expect(config.supportsRefresh).toBe(true)

    const url = buildAuthorizeUrl({
      provider: 'google',
      state: 'state-123',
      redirectUri: 'https://api.test/api/social-channels/oauth/google/callback',
      codeChallenge: 'challenge-abc',
      codeChallengeMethod: 'S256',
      env,
    })

    const parsed = new URL(url)
    expect(parsed.origin + parsed.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(parsed.searchParams.get('access_type')).toBe('offline')
    expect(parsed.searchParams.get('prompt')).toBe('consent')
    expect(parsed.searchParams.get('code_challenge')).toBe('challenge-abc')
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256')
    expect(parsed.searchParams.get('scope')).toContain('gmail.send')
  })
})

describe('microsoft provider shape', () => {
  it('uses delegated Graph scopes with PKCE', () => {
    const config = getProvider('microsoft')
    expect(config.authUrl).toContain('login.microsoftonline.com/common/oauth2/v2.0/authorize')
    expect(config.tokenUrl).toContain('login.microsoftonline.com/common/oauth2/v2.0/token')
    expect(config.scopes).toContain('offline_access')
    expect(config.scopes).toContain('Mail.Send')
    expect(config.usesPKCE).toBe(true)
    expect(config.supportsRefresh).toBe(true)
  })
})
