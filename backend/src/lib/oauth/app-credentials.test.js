import { describe, expect, it } from 'vitest'
import { resolveAppCredential } from './app-credentials.js'

describe('resolveAppCredential', () => {
  it('resolves global env credentials and carries agencyId + region', () => {
    const creds = resolveAppCredential('x', {
      env: {
        X_OAUTH_CLIENT_ID: 'x-client',
        X_OAUTH_CLIENT_SECRET: 'x-secret',
        PUBLIC_API_URL: 'https://api.test/api',
      },
      region: 'eu-west-1',
      agencyId: 'agy_123',
    })

    expect(creds.client_id).toBe('x-client')
    expect(creds.client_secret).toBe('x-secret')
    expect(creds.redirect_uri).toBe('https://api.test/api/social-channels/oauth/x/callback')
    expect(creds.scopes).toContain('offline.access')
    expect(creds.dev).toBe(false)
    expect(creds.region).toBe('eu-west-1')
    expect(creds.agencyId).toBe('agy_123')
  })

  it('marks dev when client id is missing', () => {
    const creds = resolveAppCredential('tiktok', { env: {} })
    expect(creds.dev).toBe(true)
    expect(creds.redirect_uri).toContain('/social-channels/oauth/tiktok/callback')
  })
})
