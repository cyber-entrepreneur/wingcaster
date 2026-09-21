import { createHmac } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import {
  buildAppSecretProof,
  exchangeLongLivedToken,
  fetchInstagramBusinessAccount,
  fetchManagedPages,
} from './meta-graph.js'

describe('meta-graph', () => {
  it('buildAppSecretProof computes HMAC-SHA256 of token with app secret', () => {
    const token = 'user-access-token'
    const secret = 'app-secret'
    const expected = createHmac('sha256', secret).update(token).digest('hex')
    expect(buildAppSecretProof(token, secret)).toBe(expected)
  })

  it('exchangeLongLivedToken calls fb_exchange_token grant', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: 'long-lived-token',
        expires_in: 5184000,
        token_type: 'bearer',
      }),
    })

    const result = await exchangeLongLivedToken('short-token', {
      clientId: 'app-id',
      clientSecret: 'app-secret',
      fetch: fetchFn,
    })

    expect(result.access_token).toBe('long-lived-token')
    expect(fetchFn).toHaveBeenCalledTimes(1)
    const calledUrl = String(fetchFn.mock.calls[0][0])
    expect(calledUrl).toContain('grant_type=fb_exchange_token')
    expect(calledUrl).toContain('fb_exchange_token=short-token')
  })

  it('fetchManagedPages sends appsecret_proof on Graph calls', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { id: 'page-1', name: 'My Page', access_token: 'page-token-1' },
        ],
      }),
    })

    const pages = await fetchManagedPages('user-token', 'app-secret', { fetch: fetchFn })
    expect(pages).toEqual([
      { id: 'page-1', name: 'My Page', access_token: 'page-token-1' },
    ])

    const calledUrl = String(fetchFn.mock.calls[0][0])
    expect(calledUrl).toContain('appsecret_proof=')
    expect(calledUrl).toContain('access_token=user-token')
    expect(calledUrl).toContain('/me/accounts')
  })

  it('fetchInstagramBusinessAccount returns linked IG business account id', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        instagram_business_account: { id: 'ig-123' },
      }),
    })

    const igId = await fetchInstagramBusinessAccount('page-1', 'page-token', 'app-secret', { fetch: fetchFn })
    expect(igId).toBe('ig-123')
    const calledUrl = String(fetchFn.mock.calls[0][0])
    expect(calledUrl).toContain('fields=instagram_business_account')
    expect(calledUrl).toContain('appsecret_proof=')
  })
})
