import { describe, expect, it } from 'vitest'
import { PLATFORM_CONNECTION_FIELDS } from './credentials.js'
import {
  buildSocialChannelsConfig,
  sanitizeSocialConnection,
} from './social-channels-config.js'

describe('PLATFORM_CONNECTION_FIELDS method model', () => {
  it('declares supported_methods and primary_method for every platform', () => {
    for (const [platform, spec] of Object.entries(PLATFORM_CONNECTION_FIELDS)) {
      expect(spec.supported_methods, platform).toEqual(expect.any(Array))
      expect(spec.supported_methods.length, platform).toBeGreaterThan(0)
      expect(spec.primary_method, platform).toMatch(/^(oauth|manual)$/)
      expect(spec.supported_methods, platform).toContain(spec.primary_method)
    }
  })

  it('uses oauth-primary for x, tiktok, and linkedin', () => {
    expect(PLATFORM_CONNECTION_FIELDS.x).toMatchObject({
      supported_methods: ['oauth', 'manual'],
      primary_method: 'oauth',
    })
    expect(PLATFORM_CONNECTION_FIELDS.tiktok).toMatchObject({
      supported_methods: ['oauth', 'manual'],
      primary_method: 'oauth',
    })
    expect(PLATFORM_CONNECTION_FIELDS.linkedin).toMatchObject({
      supported_methods: ['oauth', 'manual'],
      primary_method: 'oauth',
    })
  })

  it('uses oauth-primary for facebook and instagram', () => {
    expect(PLATFORM_CONNECTION_FIELDS.facebook).toMatchObject({
      supported_methods: ['oauth', 'manual'],
      primary_method: 'oauth',
    })
    expect(PLATFORM_CONNECTION_FIELDS.instagram).toMatchObject({
      supported_methods: ['oauth', 'manual'],
      primary_method: 'oauth',
    })
  })

  it('uses oauth-primary for whatsapp', () => {
    expect(PLATFORM_CONNECTION_FIELDS.whatsapp).toMatchObject({
      supported_methods: ['oauth', 'manual'],
      primary_method: 'oauth',
    })
  })
})

describe('buildSocialChannelsConfig', () => {
  it('returns oauth_configured per platform from env', () => {
    const cfg = buildSocialChannelsConfig({
      X_OAUTH_CLIENT_ID: 'x-client',
      X_OAUTH_CLIENT_SECRET: 'x-secret',
      LINKEDIN_OAUTH_CLIENT_ID: 'li-client',
      LINKEDIN_OAUTH_CLIENT_SECRET: 'li-secret',
      WINGCASTER_LINKEDIN_OAUTH_ENABLED: 'true',
      PUBLIC_API_URL: 'https://api.test/api',
    })
    expect(cfg.connection_fields.x.oauth_configured).toBe(true)
    expect(cfg.connection_fields.linkedin.oauth_configured).toBe(true)
    expect(cfg.connection_fields.tiktok.oauth_configured).toBe(false)
    expect(cfg.connection_fields.facebook.oauth_configured).toBe(false)
  })

  it('returns meta oauth_configured when feature flag and credentials are set', () => {
    const cfg = buildSocialChannelsConfig({
      WINGCASTER_META_OAUTH_CONNECT_ENABLED: 'true',
      META_OAUTH_CLIENT_ID: 'meta-app',
      META_OAUTH_CLIENT_SECRET: 'meta-secret',
      PUBLIC_API_URL: 'https://api.test/api',
    })
    expect(cfg.connection_fields.facebook.oauth_configured).toBe(true)
    expect(cfg.connection_fields.instagram.oauth_configured).toBe(true)
  })

  it('hides linkedin oauth when feature flag is off', () => {
    const cfg = buildSocialChannelsConfig({
      LINKEDIN_OAUTH_CLIENT_ID: 'li-client',
      LINKEDIN_OAUTH_CLIENT_SECRET: 'li-secret',
      PUBLIC_API_URL: 'https://api.test/api',
    })
    expect(cfg.connection_fields.linkedin.oauth_configured).toBe(false)
  })

  it('returns whatsapp oauth_configured when whatsapp feature flag and credentials are set', () => {
    const cfg = buildSocialChannelsConfig({
      WINGCASTER_WHATSAPP_OAUTH_CONNECT_ENABLED: 'true',
      META_OAUTH_CLIENT_ID: 'meta-app',
      META_OAUTH_CLIENT_SECRET: 'meta-secret',
      PUBLIC_API_URL: 'https://api.test/api',
    })
    expect(cfg.connection_fields.whatsapp.oauth_configured).toBe(true)
    expect(cfg.connection_fields.facebook.oauth_configured).toBe(false)
  })
})

describe('sanitizeSocialConnection', () => {
  it('includes connect_method and token_status for oauth connections', () => {
    const row = {
      id: 'conn-1',
      platform: 'x',
      account_name: '@agent',
      status: 'connected',
      health: 'healthy',
      connect_method: 'oauth',
      settings: {
        handle: '@agent',
        credentials: {
          access_token_encrypted: 'v1:a:b:c',
          scope: 'tweet.write offline.access',
          expires_at: '2026-12-01T00:00:00.000Z',
          user_id: '123',
        },
      },
      updated_at: '2026-09-21T00:00:00.000Z',
    }
    const out = sanitizeSocialConnection(row)
    expect(out.connect_method).toBe('oauth')
    expect(out.token_status).toEqual({
      connected: true,
      method: 'oauth',
      scope: 'tweet.write offline.access',
      expires_at: '2026-12-01T00:00:00.000Z',
      health: 'healthy',
    })
  })

  it('surfaces reauth_required health on token_status', () => {
    const out = sanitizeSocialConnection({
      id: 'conn-2',
      platform: 'tiktok',
      account_name: 'TikTok',
      status: 'connected',
      health: 'reauth_required',
      connect_method: 'oauth',
      settings: {
        credentials: {
          access_token_encrypted: 'v1:a:b:c',
          expires_at: '2026-01-01T00:00:00.000Z',
        },
      },
    })
    expect(out.token_status.health).toBe('reauth_required')
    expect(out.health).toBe('reauth_required')
  })

  it('marks manual connections without oauth tokens', () => {
    const out = sanitizeSocialConnection({
      id: 'conn-3',
      platform: 'facebook',
      account_name: 'My Page',
      status: 'connected',
      health: 'healthy',
      connect_method: 'manual',
      settings: {
        enterprise_targets: { fb_page_id: '12345' },
        credentials: {},
      },
    })
    expect(out.connect_method).toBe('manual')
    expect(out.token_status).toMatchObject({
      connected: true,
      method: 'manual',
      health: 'healthy',
    })
    expect(out.oauth.connected).toBe(false)
  })
})
