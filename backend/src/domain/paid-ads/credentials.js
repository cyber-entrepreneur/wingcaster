/**
 * Wave 2A — resolve tenant OAuth / ad-account credentials for paid adapters.
 * credentials_ref is a pointer only (secret:…); tokens never stored as raw refs.
 */

import { tryDecrypt } from '../../lib/credentials.js'

/**
 * Hydrated channel_connections rows flatten JSONB attrs to top-level (fromRow).
 * Prefer top-level oauth / enterprise_targets; fall back to nested .data for safety.
 */
export function resolvePaidCredentials(connection) {
  if (!connection) {
    return {
      accessToken: null,
      adAccountId: null,
      developerToken: null,
      loginCustomerId: null,
      platform: null,
    }
  }

  const nested = connection.data && typeof connection.data === 'object' ? connection.data : {}
  const oauth = (connection.oauth && typeof connection.oauth === 'object' ? connection.oauth : null)
    || (nested.oauth && typeof nested.oauth === 'object' ? nested.oauth : {})
  const targets = (connection.enterprise_targets && typeof connection.enterprise_targets === 'object'
    ? connection.enterprise_targets
    : null)
    || (nested.enterprise_targets && typeof nested.enterprise_targets === 'object'
      ? nested.enterprise_targets
      : {})

  const accessToken = tryDecrypt(oauth.access_token_encrypted)
    || (typeof oauth.access_token === 'string' ? oauth.access_token : null)
    || resolveEnvPointer(connection.credentials_ref)

  const adAccountId = connection.provider_account_id
    || targets.ad_account_id
    || targets.customer_id
    || connection.ad_account_id
    || connection.customer_id
    || nested.ad_account_id
    || nested.customer_id
    || null

  return {
    accessToken,
    adAccountId: adAccountId ? String(adAccountId) : null,
    developerToken: connection.developer_token
      || nested.developer_token
      || process.env.GOOGLE_ADS_DEVELOPER_TOKEN
      || null,
    loginCustomerId: targets.login_customer_id
      || connection.login_customer_id
      || nested.login_customer_id
      || null,
    platform: connection.platform || nested.platform || null,
  }
}

/**
 * credentials_ref may point at an env var: secret:env:META_ADS_ACCESS_TOKEN
 */
function resolveEnvPointer(credentialsRef) {
  if (!credentialsRef || typeof credentialsRef !== 'string') return null
  if (!credentialsRef.startsWith('secret:env:')) return null
  const envName = credentialsRef.slice('secret:env:'.length)
  if (!envName || !/^[A-Z0-9_]+$/.test(envName)) return null
  return process.env[envName] || null
}

export function assertCredentialsRefPointer(credentialsRef) {
  if (!credentialsRef) return
  if (/token|secret|password/i.test(credentialsRef) && !credentialsRef.startsWith('secret:')) {
    throw Object.assign(
      new Error('credentials_ref must be a pointer (secret:…), not raw credentials'),
      { code: 'RAW_CREDENTIALS_FORBIDDEN' },
    )
  }
}
