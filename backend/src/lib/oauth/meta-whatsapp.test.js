import { createHmac } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { getProvider } from './provider-registry.js'
import { fetchWhatsAppBusinessAccounts } from './meta-graph.js'
import {
  getMetaScopesForPlatform,
  isWhatsAppOAuthConnectEnabled,
  isWhatsAppOAuthConfigured,
} from './meta-whatsapp.js'

describe('meta-whatsapp', () => {
  it('exposes WhatsApp Embedded Signup scopes', () => {
    const scopes = getMetaScopesForPlatform('whatsapp')
    expect(scopes).toContain('whatsapp_business_management')
    expect(scopes).toContain('whatsapp_business_messaging')
    expect(scopes).not.toContain('pages_manage_posts')
  })

  it('feature flag gates WhatsApp OAuth connect', () => {
    expect(isWhatsAppOAuthConnectEnabled({ WINGCASTER_WHATSAPP_OAUTH_CONNECT_ENABLED: 'true' })).toBe(true)
    expect(isWhatsAppOAuthConnectEnabled({})).toBe(false)
  })

  it('reports configured when flag and meta credentials are set', () => {
    expect(isWhatsAppOAuthConfigured({
      WINGCASTER_WHATSAPP_OAUTH_CONNECT_ENABLED: 'true',
      META_OAUTH_CLIENT_ID: 'app-id',
      META_OAUTH_CLIENT_SECRET: 'app-secret',
      PUBLIC_API_URL: 'https://api.test/api',
    })).toBe(true)
    expect(isWhatsAppOAuthConfigured({
      WINGCASTER_WHATSAPP_OAUTH_CONNECT_ENABLED: 'true',
    })).toBe(false)
  })

  it('meta resolveIdentity resolves WABA + phone numbers with appsecret_proof', async () => {
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
      if (href.includes('/me/businesses')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [{ id: 'biz-1', name: 'Acme Realty' }] }),
        }
      }
      if (href.includes('/owned_whatsapp_business_accounts')) {
        expect(href).toContain('appsecret_proof=')
        const proof = href.match(/appsecret_proof=([^&]+)/)?.[1]
        const expected = createHmac('sha256', 'app-secret').update('long-user-token').digest('hex')
        expect(proof).toBe(expected)
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [{ id: 'waba-1', name: 'Acme WA' }] }),
        }
      }
      if (href.includes('/phone_numbers')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{
              id: 'phone-99',
              display_phone_number: '+1 555 0100',
              verified_name: 'Acme Realty',
            }],
          }),
        }
      }
      if (href.includes('client_whatsapp_business_accounts')) {
        return { ok: true, status: 200, json: async () => ({ data: [] }) }
      }
      throw new Error(`unexpected fetch: ${href}`)
    })

    const identity = await config.resolveIdentity(
      { access_token: 'short-user-token' },
      {
        fetch: fetchFn,
        clientId: 'app-id',
        clientSecret: 'app-secret',
        platform: 'whatsapp',
      },
    )

    expect(identity.meta.platform).toBe('whatsapp')
    expect(identity.meta.accounts).toEqual([{
      waba_id: 'waba-1',
      waba_name: 'Acme WA',
      phone_number_id: 'phone-99',
      display_phone_number: '+1 555 0100',
      verified_name: 'Acme Realty',
    }])
  })

  it('fetchWhatsAppBusinessAccounts deduplicates WABAs across business edges', async () => {
    const fetchFn = vi.fn(async (url) => {
      const href = String(url)
      if (href.includes('/me/businesses')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [{ id: 'biz-1', name: 'Biz' }] }),
        }
      }
      if (href.includes('/owned_whatsapp_business_accounts')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [{ id: 'waba-1', name: 'WABA' }] }),
        }
      }
      if (href.includes('/client_whatsapp_business_accounts')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [{ id: 'waba-1', name: 'WABA' }] }),
        }
      }
      if (href.includes('/phone_numbers')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{ id: 'phone-1', display_phone_number: '+15550100', verified_name: 'Biz' }],
          }),
        }
      }
      throw new Error(`unexpected fetch: ${href}`)
    })

    const accounts = await fetchWhatsAppBusinessAccounts('token', 'secret', { fetch: fetchFn })
    expect(accounts).toHaveLength(1)
    expect(accounts[0].phone_number_id).toBe('phone-1')
  })
})
