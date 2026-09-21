import { createHmac } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { getProvider, isOAuthProvider, listProviders, resolveOAuthProvider } from './provider-registry.js'

describe('provider-registry', () => {
  it('lists x, tiktok, meta, and linkedin', () => {
    expect(listProviders()).toEqual(['x', 'tiktok', 'meta', 'linkedin'])
    expect(isOAuthProvider('meta')).toBe(true)
    expect(isOAuthProvider('linkedin')).toBe(true)
    expect(resolveOAuthProvider('facebook')).toBe('meta')
    expect(resolveOAuthProvider('instagram')).toBe('meta')
    expect(resolveOAuthProvider('linkedin')).toBe('linkedin')
    expect(resolveOAuthProvider('whatsapp')).toBe('meta')
  })

  it('exposes required provider shape for x and tiktok', () => {
    for (const provider of ['x', 'tiktok']) {
      const config = getProvider(provider)
      expect(config.authUrl).toMatch(/^https:\/\//)
      expect(config.tokenUrl).toMatch(/^https:\/\//)
      expect(config.scopes.length).toBeGreaterThan(0)
      expect(typeof config.usesPKCE).toBe('boolean')
      if (config.usesPKCE) {
        expect(config.pkceMethod).toBe('S256')
      }
      expect(config.supportsRefresh).toBe(true)
      expect(config.tokenStyle).toBe('bearer')
      expect(config.redirectPath).toContain('/social-channels/oauth/')
      expect(config.appCredentialKey).toBe(provider)
      expect(typeof config.resolveIdentity).toBe('function')
    }
  })

  it('meta provider uses meta_longlived without PKCE', () => {
    const config = getProvider('meta')
    expect(config.authUrl).toContain('facebook.com/v21.0/dialog/oauth')
    expect(config.tokenUrl).toContain('graph.facebook.com/v21.0/oauth/access_token')
    expect(config.usesPKCE).toBe(false)
    expect(config.tokenStyle).toBe('meta_longlived')
    expect(config.scopes).toContain('pages_manage_posts')
    expect(config.scopes).toContain('instagram_content_publish')
    expect(config.redirectPath).toBe('/social-channels/oauth/meta/callback')
  })

  it('linkedin provider uses bearer tokens without PKCE', () => {
    const config = getProvider('linkedin')
    expect(config.authUrl).toContain('linkedin.com/oauth/v2/authorization')
    expect(config.tokenUrl).toContain('linkedin.com/oauth/v2/accessToken')
    expect(config.usesPKCE).toBe(false)
    expect(config.tokenStyle).toBe('bearer')
    expect(config.scopes).toContain('w_member_social')
    expect(config.redirectPath).toBe('/social-channels/oauth/linkedin/callback')
  })

  it('meta resolveIdentity exchanges long-lived token and lists pages with appsecret_proof', async () => {
    const config = getProvider('meta')
    const fetchFn = vi.fn(async (url) => {
      const href = String(url)
      if (href.includes('fb_exchange_token')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ access_token: 'long-user-token', expires_in: 5184000 }),
        }
      }
      if (href.includes('/me/accounts')) {
        expect(href).toContain('appsecret_proof=')
        const proof = href.match(/appsecret_proof=([^&]+)/)?.[1]
        const expected = createHmac('sha256', 'app-secret').update('long-user-token').digest('hex')
        expect(proof).toBe(expected)
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{ id: 'page-1', name: 'Page One', access_token: 'page-token' }],
          }),
        }
      }
      if (href.includes('fields=instagram_business_account')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ instagram_business_account: { id: 'ig-99' } }),
        }
      }
      throw new Error(`unexpected fetch: ${href}`)
    })

    const identity = await config.resolveIdentity(
      { access_token: 'short-user-token' },
      {
        fetch: fetchFn,
        clientId: 'app-id',
        clientSecret: 'app-secret',
        platform: 'facebook',
      },
    )

    expect(identity.meta.pages).toEqual([
      {
        id: 'page-1',
        name: 'Page One',
        access_token: 'page-token',
        instagram_business_account_id: 'ig-99',
      },
    ])
    expect(identity.meta.userToken).toBe('long-user-token')
  })

  it('meta resolveIdentity filters pages without IG for instagram platform', async () => {
    const config = getProvider('meta')
    const fetchFn = vi.fn(async (url) => {
      const href = String(url)
      if (href.includes('fb_exchange_token')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ access_token: 'long-user-token', expires_in: 5184000 }),
        }
      }
      if (href.includes('/me/accounts')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              { id: 'page-1', name: 'No IG', access_token: 'tok-1' },
              { id: 'page-2', name: 'Has IG', access_token: 'tok-2' },
            ],
          }),
        }
      }
      if (href.includes('/page-1')) {
        return { ok: true, status: 200, json: async () => ({}) }
      }
      if (href.includes('/page-2')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ instagram_business_account: { id: 'ig-2' } }),
        }
      }
      throw new Error(`unexpected fetch: ${href}`)
    })

    const identity = await config.resolveIdentity(
      { access_token: 'short-user-token' },
      {
        fetch: fetchFn,
        clientId: 'app-id',
        clientSecret: 'app-secret',
        platform: 'instagram',
      },
    )

    expect(identity.meta.pages).toHaveLength(1)
    expect(identity.meta.pages[0].id).toBe('page-2')
  })
})
