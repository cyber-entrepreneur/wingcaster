/**
 * Declarative OAuth provider configuration.
 * PR1: x + tiktok. Shape is ready for meta/linkedin/google/microsoft (PR4+).
 */

const PROVIDERS = {
  x: {
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
    usesPKCE: true,
    pkceMethod: 'S256',
    supportsRefresh: true,
    tokenStyle: 'bearer',
    authExtraParams: {},
    redirectPath: '/social-channels/oauth/x/callback',
    appCredentialKey: 'x',
    async resolveIdentity(tokenSet, { fetch: fetchFn = fetch } = {}) {
      const res = await fetchFn('https://api.twitter.com/2/users/me', {
        headers: { Authorization: `Bearer ${tokenSet.access_token}` },
      })
      const parsed = await res.json().catch(() => ({}))
      if (!res.ok) {
        const message = parsed?.errors?.[0]?.message || parsed?.error || `HTTP ${res.status}`
        throw new Error(`X identity lookup failed: ${message}`)
      }
      const user = parsed?.data || {}
      return {
        id: user.id || null,
        handle: user.username ? `@${user.username}` : null,
      }
    },
  },
  tiktok: {
    authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    scopes: ['user.info.basic', 'video.publish'],
    usesPKCE: true,
    pkceMethod: 'S256',
    supportsRefresh: true,
    tokenStyle: 'bearer',
    authExtraParams: {},
    redirectPath: '/social-channels/oauth/tiktok/callback',
    appCredentialKey: 'tiktok',
    async resolveIdentity(tokenSet, { fetch: fetchFn = fetch } = {}) {
      const openId = tokenSet.open_id || tokenSet.user_id || null
      let handle = null
      if (tokenSet.access_token && openId) {
        const url = new URL('https://open.tiktokapis.com/v2/user/info/')
        url.searchParams.set('fields', 'open_id,display_name,username')
        const res = await fetchFn(url.toString(), {
          headers: { Authorization: `Bearer ${tokenSet.access_token}` },
        })
        const parsed = await res.json().catch(() => ({}))
        if (res.ok && parsed?.data?.user) {
          const user = parsed.data.user
          handle = user.username ? `@${user.username}` : (user.display_name || null)
        }
      }
      return { id: openId, handle }
    },
  },
}

export function listProviders() {
  return Object.keys(PROVIDERS)
}

export function getProvider(provider) {
  const config = PROVIDERS[provider]
  if (!config) {
    throw new Error(`Unsupported OAuth provider: ${provider}`)
  }
  return config
}

export function isOAuthProvider(provider) {
  return Boolean(PROVIDERS[provider])
}
