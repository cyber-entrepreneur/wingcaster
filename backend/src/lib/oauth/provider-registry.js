/**
 * Declarative OAuth provider configuration.
 * PR1: x + tiktok. PR4: meta. PR5: linkedin.
 */
import {
  META_AUTH_URL,
  META_TOKEN_URL,
  exchangeLongLivedToken,
  fetchManagedPages,
  fetchInstagramBusinessAccount,
  fetchWhatsAppBusinessAccounts,
} from './meta-graph.js'
import { isMetaOAuthPlatform } from './meta-oauth.js'
import { isWhatsAppOAuthPlatform } from './meta-whatsapp.js'

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

const LINKEDIN_API_VERSION = '202405'

const LINKEDIN_ORG_SCOPES = new Set([
  'w_organization_social',
  'r_organization_social',
  'rw_organization_admin',
])

function linkedInHeaders(accessToken, extra = {}) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'LinkedIn-Version': LINKEDIN_API_VERSION,
    'X-Restli-Protocol-Version': '2.0.0',
    ...extra,
  }
}

function parseLinkedInScope(scope) {
  if (!scope) return new Set()
  return new Set(String(scope).split(/[\s,]+/).filter(Boolean))
}

async function fetchLinkedInOrganizations(accessToken, fetchFn) {
  const url = new URL('https://api.linkedin.com/rest/organizationAcls')
  url.searchParams.set('q', 'roleAssignee')
  const res = await fetchFn(url.toString(), { headers: linkedInHeaders(accessToken) })
  const parsed = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = parsed?.message || parsed?.error || `HTTP ${res.status}`
    throw new Error(`LinkedIn organization lookup failed: ${message}`)
  }

  const elements = parsed?.elements || parsed?.data?.elements || []
  const orgs = []
  for (const entry of elements) {
    const orgUrn = entry?.organization || entry?.organizationTarget || entry?.['organization~']?.id
    if (!orgUrn) continue
    const urn = String(orgUrn).startsWith('urn:')
      ? String(orgUrn)
      : `urn:li:organization:${orgUrn}`
    const label = entry?.['organization~']?.localizedName
      || entry?.organizationName
      || entry?.role
      || urn
    orgs.push({ urn, label: String(label), type: 'organization' })
  }
  return orgs
}

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

      if (platform === 'whatsapp' || isWhatsAppOAuthPlatform(platform)) {
        const accounts = await fetchWhatsAppBusinessAccounts(
          longLived.access_token,
          clientSecret,
          { fetch: fetchFn },
        )
        if (!accounts.length) {
          throw new Error('No WhatsApp Business phone numbers were found for this account')
        }
        return {
          id: null,
          handle: null,
          meta: {
            accounts,
            userToken: longLived.access_token,
            userTokenExpiresAt: longLived.expires_at,
            platform: 'whatsapp',
          },
        }
      }

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
  linkedin: {
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    scopes: [
      'openid',
      'profile',
      'email',
      'w_member_social',
      'w_organization_social',
      'r_organization_social',
      'rw_organization_admin',
    ],
    usesPKCE: false,
    pkceMethod: 'S256',
    supportsRefresh: true,
    tokenStyle: 'bearer',
    authExtraParams: {},
    redirectPath: '/social-channels/oauth/linkedin/callback',
    appCredentialKey: 'linkedin',
    async resolveIdentity(tokenSet, { fetch: fetchFn = fetch } = {}) {
      const accessToken = tokenSet.access_token
      if (!accessToken) {
        throw new Error('LinkedIn identity lookup requires an access token')
      }

      const res = await fetchFn('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const userinfo = await res.json().catch(() => ({}))
      if (!res.ok) {
        const message = userinfo?.message || userinfo?.error || `HTTP ${res.status}`
        throw new Error(`LinkedIn userinfo lookup failed: ${message}`)
      }

      const sub = userinfo.sub ? String(userinfo.sub) : null
      const personUrn = sub ? `urn:li:person:${sub}` : null
      const personLabel = userinfo.name || userinfo.email || personUrn || 'Personal profile'

      const authors = []
      if (personUrn) {
        authors.push({ urn: personUrn, label: personLabel, type: 'person' })
      }

      const grantedScopes = parseLinkedInScope(tokenSet.scope)
      const hasOrgScope = [...LINKEDIN_ORG_SCOPES].some((scope) => grantedScopes.has(scope))
      if (hasOrgScope) {
        try {
          const orgAuthors = await fetchLinkedInOrganizations(accessToken, fetchFn)
          for (const org of orgAuthors) {
            if (!authors.some((a) => a.urn === org.urn)) authors.push(org)
          }
        } catch {
          // Org ACL lookup is best-effort when org scopes were granted.
        }
      }

      const primary = authors.length === 1 ? authors[0] : null
      return {
        id: primary?.urn || personUrn,
        handle: primary?.label || personLabel,
        authors,
        li_author_urn: primary?.urn || null,
      }
    },
  },
}

/** Map social-channels platform → OAuth provider registry key. */
export function resolveOAuthProvider(platform) {
  if (isMetaOAuthPlatform(platform) || isWhatsAppOAuthPlatform(platform)) return 'meta'
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
