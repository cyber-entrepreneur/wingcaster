/**
 * Encrypted OAuth token persistence + refresh seam for OAuth publish paths.
 */
import { v4 as uuidv4 } from 'uuid'
import { encryptSecret, tryDecrypt } from '../credentials.js'
import { findOne, insert, update } from '../../persistence/index.js'
import {
  withMarketplaceConnectionWrite,
  withMarketplaceTenant,
} from '../social/marketplace-tenant.js'
import { refreshToken } from './token-exchange.js'
import { getProvider, resolveOAuthProvider } from './provider-registry.js'
import { isMetaOAuthPlatform } from './meta-oauth.js'

/** Refresh when expiry is within this window (ms). */
export const REFRESH_SAFETY_WINDOW_MS = 5 * 60 * 1000

/** Per-connection in-process refresh locks (thundering-herd guard). */
const refreshLocks = new Map()

function credentialsFromConnection(connection) {
  const settings = connection?.settings || {}
  return settings.credentials || {}
}

function withRefreshLock(connectionId, fn) {
  const existing = refreshLocks.get(connectionId)
  if (existing) return existing

  const promise = Promise.resolve()
    .then(fn)
    .finally(() => {
      if (refreshLocks.get(connectionId) === promise) {
        refreshLocks.delete(connectionId)
      }
    })

  refreshLocks.set(connectionId, promise)
  return promise
}

function isExpiredOrStale(expiresAt, safetyWindowMs = REFRESH_SAFETY_WINDOW_MS) {
  if (!expiresAt) return false
  const expiresMs = new Date(expiresAt).getTime()
  return expiresMs - Date.now() <= safetyWindowMs
}

/**
 * @param {object} connection marketplace_connections row
 * @param {{
 *   access_token: string,
 *   refresh_token?: string|null,
 *   expires_at?: string|null,
 *   scope?: string|null,
 *   user_id?: string|null,
 * }} tokenSet
 */
export async function persistTokens(connection, tokenSet) {
  const credentialsPatch = {
    access_token_encrypted: encryptSecret(tokenSet.access_token),
    refresh_token_encrypted: tokenSet.refresh_token ? encryptSecret(tokenSet.refresh_token) : null,
    expires_at: tokenSet.expires_at || null,
    scope: tokenSet.scope || null,
    user_id: tokenSet.user_id || tokenSet.open_id || null,
  }

  const settings = {
    ...(connection.settings || {}),
    credentials: credentialsPatch,
  }

  const agencyId = connection.agency_id || null
  const agentId = connection.agent_id || null
  await withMarketplaceConnectionWrite(agencyId, agentId, connection.platform, async () => {
    await update('marketplace_connections', (c) => c.id === connection.id, (c) => ({
      ...c,
      status: 'connected',
      health: 'healthy',
      connect_method: 'oauth',
      settings: {
        ...settings,
        handle: connection.settings?.handle || c.settings?.handle || connection.account_name,
      },
      updated_at: new Date().toISOString(),
    }))
  })

  return credentialsPatch
}

/**
 * Return a valid access token, refreshing when within the safety window.
 * Concurrency-safe per connection id.
 *
 * @param {object} connection
 * @param {{ env?: Record<string, string|undefined>, region?: string|null, fetch?: typeof fetch, safetyWindowMs?: number }} [options]
 */
export async function getFreshAccessToken(connection, options = {}) {
  const {
    env = process.env,
    region = null,
    fetch: fetchFn = fetch,
    safetyWindowMs = REFRESH_SAFETY_WINDOW_MS,
  } = options

  const creds = credentialsFromConnection(connection)
  const accessToken = tryDecrypt(creds.access_token_encrypted)
  const refreshTokenValue = tryDecrypt(creds.refresh_token_encrypted)
  const expiresAt = creds.expires_at || null
  const provider = resolveOAuthProvider(connection.platform)

  if (!accessToken) {
    throw new Error('No OAuth access token on connection')
  }

  const providerConfig = getProvider(provider)

  // Meta page tokens derived from long-lived user tokens do not expire — prefer them for publish.
  if (providerConfig.tokenStyle === 'meta_longlived' && isMetaOAuthPlatform(connection.platform)) {
    const targets = connection?.settings?.enterprise_targets || {}
    const pageTokenKey = connection.platform === 'instagram'
      ? 'ig_page_access_token_override_encrypted'
      : 'fb_page_access_token_override_encrypted'
    const pageToken = tryDecrypt(targets[pageTokenKey])
    if (pageToken && !isExpiredOrStale(expiresAt, safetyWindowMs)) {
      return pageToken
    }
  }

  const metaRefreshToken = providerConfig.tokenStyle === 'meta_longlived'
    ? (refreshTokenValue || accessToken)
    : refreshTokenValue

  const needsRefresh = providerConfig.supportsRefresh
    && metaRefreshToken
    && isExpiredOrStale(expiresAt, safetyWindowMs)

  if (!needsRefresh) {
    if (providerConfig.tokenStyle === 'meta_longlived' && isMetaOAuthPlatform(connection.platform)) {
      const targets = connection?.settings?.enterprise_targets || {}
      const pageTokenKey = connection.platform === 'instagram'
        ? 'ig_page_access_token_override_encrypted'
        : 'fb_page_access_token_override_encrypted'
      const pageToken = tryDecrypt(targets[pageTokenKey])
      if (pageToken) return pageToken
    }
    return accessToken
  }

  const tenantAgencyId = connection.agency_id || null
  const tenantAgentId = connection.agent_id || null

  return withRefreshLock(connection.id, async () => {
    const latest = await withMarketplaceTenant(tenantAgencyId, tenantAgentId, () =>
      findOne('marketplace_connections', (c) => c.id === connection.id),
    )
    const latestCreds = credentialsFromConnection(latest || connection)
    const latestAccess = tryDecrypt(latestCreds.access_token_encrypted)
    const latestRefresh = tryDecrypt(latestCreds.refresh_token_encrypted)
    const latestExpires = latestCreds.expires_at || null
    const latestMetaRefresh = providerConfig.tokenStyle === 'meta_longlived'
      ? (latestRefresh || latestAccess || refreshTokenValue || accessToken)
      : (latestRefresh || refreshTokenValue)

    if (latestAccess && !isExpiredOrStale(latestExpires, safetyWindowMs)) {
      if (providerConfig.tokenStyle === 'meta_longlived' && isMetaOAuthPlatform(connection.platform)) {
        const targets = (latest || connection)?.settings?.enterprise_targets || {}
        const pageTokenKey = connection.platform === 'instagram'
          ? 'ig_page_access_token_override_encrypted'
          : 'fb_page_access_token_override_encrypted'
        const pageToken = tryDecrypt(targets[pageTokenKey])
        if (pageToken) return pageToken
      }
      return latestAccess
    }

    try {
      const tokenSet = await refreshToken({
        provider,
        refreshToken: latestMetaRefresh,
        env,
        region,
        agencyId: (latest || connection).agency_id || null,
        fetch: fetchFn,
      })

      await persistTokens(latest || connection, {
        ...tokenSet,
        user_id: latestCreds.user_id || tokenSet.user_id,
      })

      if (providerConfig.tokenStyle === 'meta_longlived' && isMetaOAuthPlatform(connection.platform)) {
        const targets = (latest || connection)?.settings?.enterprise_targets || {}
        const pageTokenKey = connection.platform === 'instagram'
          ? 'ig_page_access_token_override_encrypted'
          : 'fb_page_access_token_override_encrypted'
        const pageToken = tryDecrypt(targets[pageTokenKey])
        if (pageToken) return pageToken
      }

      return tokenSet.access_token
    } catch (err) {
      await withMarketplaceConnectionWrite(tenantAgencyId, tenantAgentId, connection.platform, () =>
        update('marketplace_connections', (c) => c.id === connection.id, (c) => ({
          ...c,
          health: 'reauth_required',
          updated_at: new Date().toISOString(),
        })),
      )
      const message = err instanceof Error ? err.message : 'Token refresh failed'
      const error = new Error(message)
      error.code = 'REAUTH_REQUIRED'
      throw error
    }
  })
}

/**
 * Upsert a marketplace_connections row after OAuth callback.
 */
export async function upsertOAuthConnection({
  agentId,
  agencyId,
  platform,
  accountName,
  handle,
  tokenSet,
  capabilities = {},
}) {
  if (!agencyId) {
    throw Object.assign(new Error('agency_id is required for oauth connection'), { code: 'TENANT_REQUIRED' })
  }

  return withMarketplaceConnectionWrite(agencyId, agentId, platform, async () => {
    const existing = await findOne(
      'marketplace_connections',
      (c) => c.agent_id === agentId && c.platform === platform,
    )

    const credentialsPatch = {
      access_token_encrypted: encryptSecret(tokenSet.access_token),
      refresh_token_encrypted: tokenSet.refresh_token ? encryptSecret(tokenSet.refresh_token) : null,
      expires_at: tokenSet.expires_at || null,
      scope: tokenSet.scope || null,
      user_id: tokenSet.user_id || tokenSet.open_id || null,
    }

    if (existing) {
      await update('marketplace_connections', (c) => c.id === existing.id, (c) => ({
        ...c,
        agency_id: agencyId || c.agency_id || null,
        account_name: accountName || c.account_name,
        status: 'connected',
        health: 'healthy',
        connect_method: 'oauth',
        capabilities,
        settings: {
          ...(c.settings || {}),
          handle: handle || c.settings?.handle || accountName,
          credentials: credentialsPatch,
        },
        updated_at: new Date().toISOString(),
      }))
      return existing.id
    }

    const id = uuidv4()
    await insert('marketplace_connections', {
      id,
      agent_id: agentId,
      agency_id: agencyId,
      platform,
      account_name: accountName,
      status: 'connected',
      health: 'healthy',
      connect_method: 'oauth',
      capabilities,
      settings: {
        handle: handle || accountName,
        enterprise_targets: {},
        credentials: credentialsPatch,
      },
      terms_accepted_at: new Date().toISOString(),
      terms_version: '2026-07-1',
    })
    return id
  })
}

/**
 * Upsert a marketplace_connections row after Meta OAuth with auto-resolved Page + IG targets.
 */
export async function upsertMetaOAuthConnection({
  agentId,
  agencyId,
  platform,
  page,
  userToken,
  userTokenExpiresAt,
  scope = null,
  capabilities = {},
}) {
  if (!agencyId) {
    throw new Error('agency_id is required for Meta OAuth connections')
  }

  const existing = await findOne(
    'marketplace_connections',
    (c) => c.agent_id === agentId && c.platform === platform,
  )

  const accountName = page.name || `${platform} page`
  const handle = platform === 'instagram' && page.instagram_business_account_id
    ? `${page.name} (IG)`
    : page.name

  const enterpriseTargets = {
    ...(existing?.settings?.enterprise_targets || {}),
    fb_page_id: page.id,
    fb_page_access_token_override_encrypted: encryptSecret(page.access_token),
  }

  if (page.instagram_business_account_id) {
    enterpriseTargets.ig_business_account_id = page.instagram_business_account_id
    enterpriseTargets.ig_page_access_token_override_encrypted = encryptSecret(page.access_token)
  }

  const credentialsPatch = {
    access_token_encrypted: encryptSecret(userToken),
    refresh_token_encrypted: encryptSecret(userToken),
    expires_at: userTokenExpiresAt || null,
    scope,
    user_id: page.id,
  }

  if (existing) {
    await update('marketplace_connections', (c) => c.id === existing.id, (c) => ({
      ...c,
      agency_id: agencyId,
      account_name: accountName,
      status: 'connected',
      health: 'healthy',
      connect_method: 'oauth',
      capabilities,
      settings: {
        ...(c.settings || {}),
        handle,
        enterprise_targets: enterpriseTargets,
        credentials: credentialsPatch,
      },
      updated_at: new Date().toISOString(),
    }))
    return existing.id
  }

  const id = uuidv4()
  await insert('marketplace_connections', {
    id,
    agent_id: agentId,
    agency_id: agencyId,
    platform,
    account_name: accountName,
    status: 'connected',
    health: 'healthy',
    connect_method: 'oauth',
    capabilities,
    settings: {
      handle,
      enterprise_targets: enterpriseTargets,
      credentials: credentialsPatch,
    },
    terms_accepted_at: new Date().toISOString(),
    terms_version: '2026-07-1',
  })
  return id
}

/** Test-only: clear in-process refresh locks. */
export function _clearRefreshLocksForTests() {
  refreshLocks.clear()
}
