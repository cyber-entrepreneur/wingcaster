/**
 * Resolve WingCaster global OAuth app credentials per provider.
 * Signature carries agencyId + region for future BYO/regional overrides.
 */
import { getProvider } from './provider-registry.js'

const CREDENTIAL_ENV = {
  x: {
    clientId: 'X_OAUTH_CLIENT_ID',
    clientSecret: 'X_OAUTH_CLIENT_SECRET',
  },
  tiktok: {
    clientId: 'TIKTOK_CLIENT_KEY',
    clientSecret: 'TIKTOK_CLIENT_SECRET',
  },
}

function buildRedirectUri(apiBase, redirectPath) {
  const base = String(apiBase || '').replace(/\/$/, '')
  const path = redirectPath.startsWith('/') ? redirectPath : `/${redirectPath}`
  return `${base}${path}`
}

/**
 * @param {string} provider
 * @param {{ env?: Record<string, string|undefined>, region?: string|null, agencyId?: string|null, apiBase?: string }} ctx
 * @returns {{ client_id: string, client_secret: string, redirect_uri: string, scopes: string[], dev: boolean, region: string|null, agencyId: string|null }}
 */
export function resolveAppCredential(provider, {
  env = process.env,
  region = null,
  agencyId = null,
  apiBase = null,
} = {}) {
  const config = getProvider(provider)
  const keys = CREDENTIAL_ENV[provider]
  if (!keys) {
    throw new Error(`No app credentials configured for provider: ${provider}`)
  }

  const clientId = env[keys.clientId] || ''
  const clientSecret = env[keys.clientSecret] || ''
  const redirectBase = apiBase || env.PUBLIC_API_URL || ''
  const redirectUri = buildRedirectUri(redirectBase, config.redirectPath)
  const scopes = [...config.scopes]

  // Future: agencyId + region can select BYO or regional app shards.
  void region
  void agencyId

  return {
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    scopes,
    dev: !clientId,
    region,
    agencyId,
  }
}
