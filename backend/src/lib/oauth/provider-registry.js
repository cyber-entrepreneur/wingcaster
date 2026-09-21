/**
 * Declarative OAuth provider configuration.
 * PR1: x + tiktok. PR4: meta (facebook + instagram).
 */
import {
  META_AUTH_URL,
  META_TOKEN_URL,
  exchangeLongLivedToken,
  fetchManagedPages,
  fetchInstagramBusinessAccount,
} from './meta-graph.js'
import { isMetaOAuthPlatform } from './meta-oauth.js'

const META_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'pages_manage_metadata',
  'business_management',
  'instagram_basic',
  'instagram_content_publish',
  'read_insights',
]

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
  meta: {
    authUrl: META_AUTH_URL,
    tokenUrl: META_TOKEN_URL,
    scopes: META_SCOPES,
    usesPKCE: false,
    pkceMethod: null,
    supportsRefresh: true,
    tokenStyle: 'meta_longlived',
    authExtraParams: {},
    redirectPath: '/social-channels/oauth/meta/callback',
    appCredentialKey: 'meta',
    /**
     * Resolve Meta identity: short→long-lived user token, list Pages, enrich with IG business account.
     * @param {{ access_token: string }} tokenSet short-lived user token from code exchange
     * @param {{ fetch?: typeof fetch, clientId?: string, clientSecret?: string, platform?: string }} ctx
     */
    async resolveIdentity(tokenSet, {
      fetch: fetchFn = fetch,
      clientId,
      clientSecret,
      platform = 'facebook',
    } = {}) {
      if (!clientId || !clientSecret) {
        throw new Error('Meta OAuth requires client_id and client_secret')
      }

      const longLived = await exchangeLongLivedToken(tokenSet.access_token, {
        clientId,
        clientSecret,
        fetch: fetchFn,
      })

      const pages = await fetchManagedPages(longLived.access_token, clientSecret, { fetch: fetchFn })

      const enriched = []
      for (const page of pages) {
        const igId = await fetchInstagramBusinessAccount(
          page.id,
          page.access_token,
          clientSecret,
          { fetch: fetchFn },
        )
        enriched.push({
          ...page,
          instagram_business_account_id: igId,
        })
      }

      const filtered = platform === 'instagram'
        ? enriched.filter((p) => p.instagram_business_account_id)
        : enriched

      if (platform === 'instagram' && pages.length > 0 && filtered.length === 0) {
        throw new Error('No Facebook Pages with a linked Instagram Business account were found')
      }

      return {
        id: null,
        handle: null,
        meta: {
          pages: filtered,
          userToken: longLived.access_token,
          userTokenExpiresAt: longLived.expires_at,
          platform,
        },
      }
    },
  },
}

/** Map social-channels platform → OAuth provider registry key. */
export function resolveOAuthProvider(platform) {
  if (isMetaOAuthPlatform(platform)) return 'meta'
  return platform
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
