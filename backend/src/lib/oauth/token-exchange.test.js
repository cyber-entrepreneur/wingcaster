import { describe, expect, it, vi } from 'vitest'
import { exchangeCode, refreshToken } from './token-exchange.js'

const env = {
  X_OAUTH_CLIENT_ID: 'x-id',
  X_OAUTH_CLIENT_SECRET: 'x-secret',
  TIKTOK_CLIENT_KEY: 'tt-key',
  TIKTOK_CLIENT_SECRET: 'tt-secret',
  PUBLIC_API_URL: 'https://api.test/api',
}

function mockFetch(handler) {
  return vi.fn(async (url, init) => {
    const body = init?.body ? String(init.body) : ''
    const headers = init?.headers || {}
    const response = await handler({ url: String(url), body, headers })
    return {
      ok: response.ok ?? true,
      status: response.status ?? 200,
      json: async () => response.json,
    }
  })
}

describe('token-exchange', () => {
  it('X exchange uses HTTP Basic and code_verifier', async () => {
    const fetchFn = mockFetch(({ headers, body }) => {
      expect(headers.Authorization).toBe(`Basic ${Buffer.from('x-id:x-secret').toString('base64')}`)
      expect(body).toContain('grant_type=authorization_code')
      expect(body).toContain('code_verifier=verifier-abc')
      return {
        json: {
          access_token: 'access',
          refresh_token: 'refresh',
          expires_in: 3600,
          scope: 'tweet.read',
        },
      }
    })

    const tokenSet = await exchangeCode({
      provider: 'x',
      code: 'auth-code',
      codeVerifier: 'verifier-abc',
      redirectUri: 'https://api.test/api/social-channels/oauth/x/callback',
      env,
      fetch: fetchFn,
    })

    expect(tokenSet.access_token).toBe('access')
    expect(tokenSet.refresh_token).toBe('refresh')
    expect(tokenSet.expires_at).toBeTruthy()
  })

  it('TikTok exchange sends client_key and client_secret in body', async () => {
    const fetchFn = mockFetch(({ body, headers }) => {
      expect(headers.Authorization).toBeUndefined()
      expect(body).toContain('client_key=tt-key')
      expect(body).toContain('client_secret=tt-secret')
      return {
        json: {
          access_token: 'tt-access',
          refresh_token: 'tt-refresh',
          open_id: 'open-1',
          expires_in: 7200,
        },
      }
    })

    const tokenSet = await exchangeCode({
      provider: 'tiktok',
      code: 'tt-code',
      codeVerifier: 'verifier-xyz',
      redirectUri: 'https://api.test/api/social-channels/oauth/tiktok/callback',
      env,
      fetch: fetchFn,
    })

    expect(tokenSet.access_token).toBe('tt-access')
    expect(tokenSet.open_id).toBe('open-1')
  })

  it('does not leak secrets in exchange errors', async () => {
    const fetchFn = mockFetch(() => ({
      ok: false,
      status: 400,
      json: { error: 'invalid_grant', error_description: 'refresh_token=leaked-secret' },
    }))

    await expect(refreshToken({
      provider: 'x',
      refreshToken: 'old-refresh',
      env,
      fetch: fetchFn,
    })).rejects.toMatchObject({ message: expect.stringContaining('[redacted]') })
  })
})
