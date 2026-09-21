/**
 * Social channel config + connection sanitization for the tenant UI.
 */
import {
  PLATFORM_CONNECTION_FIELDS,
  PLATFORM_INTEGRATION_MODEL,
} from './credentials.js'
import { isPlatformOAuthConfigured } from './oauth/meta-oauth.js'

function resolveOAuthConfigured(platform, env = process.env) {
  const spec = PLATFORM_CONNECTION_FIELDS[platform]
  if (!spec?.supported_methods?.includes('oauth')) return false
  return isPlatformOAuthConfigured(platform, env)
}

/**
 * Build the GET /api/social-channels/config payload.
 */
export function buildSocialChannelsConfig(env = process.env) {
  const connection_fields = {}
  for (const [platform, spec] of Object.entries(PLATFORM_CONNECTION_FIELDS)) {
    connection_fields[platform] = {
      ...spec,
      oauth_configured: resolveOAuthConfigured(platform, env),
    }
  }
  return {
    integration_models: PLATFORM_INTEGRATION_MODEL,
    connection_fields,
  }
}

function redactEnterpriseTargets(targets = {}) {
  const out = { ...targets }
  for (const key of Object.keys(out)) {
    if (key.endsWith('_encrypted')) {
      out[key.replace(/_encrypted$/, '')] = '••••••••'
      delete out[key]
    }
  }
  return out
}

function inferConnectMethod(row, creds) {
  if (row.connect_method === 'oauth' || row.connect_method === 'manual') {
    return row.connect_method
  }
  if (creds.access_token_encrypted) return 'oauth'
  return null
}

/**
 * Shape a marketplace_connections row for the browser (no ciphertext).
 */
export function sanitizeSocialConnection(row) {
  if (!row) return null
  const settings = row.settings || {}
  const targets = redactEnterpriseTargets(settings.enterprise_targets || {})
  const creds = settings.credentials || {}
  const hasOAuthToken = Boolean(creds.access_token_encrypted)
  const connectMethod = inferConnectMethod(row, creds)
  const isConnected = row.status === 'connected'
  const tokenStatus = {
    connected: isConnected,
    method: connectMethod,
    scope: creds.scope || null,
    expires_at: creds.expires_at || null,
    health: row.health || null,
  }

  return {
    id: row.id,
    platform: row.platform,
    account_name: row.account_name,
    status: row.status,
    health: row.health,
    connect_method: connectMethod,
    handle: settings.handle || null,
    enterprise_targets: targets,
    token_status: tokenStatus,
    // Back-compat for callers still reading oauth.*
    oauth: hasOAuthToken ? {
      connected: true,
      scope: creds.scope || null,
      expires_at: creds.expires_at || null,
      user_id: creds.user_id || null,
    } : { connected: false },
    updated_at: row.updated_at || row.created_at || null,
  }
}
