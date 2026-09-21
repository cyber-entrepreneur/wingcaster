/**
 * Proactive OAuth token refresh sweep for x/tiktok connections nearing expiry.
 */
import { findAll } from '../../persistence/index.js'
import logger from '../logger.js'
import { getProvider } from './provider-registry.js'
import { getFreshAccessToken, REFRESH_SAFETY_WINDOW_MS } from './token-store.js'

const OAUTH_REFRESH_PLATFORMS = new Set(['x', 'tiktok'])

function credentialsFromConnection(connection) {
  return connection?.settings?.credentials || {}
}

function isNearExpiry(expiresAt, safetyWindowMs) {
  if (!expiresAt) return false
  const expiresMs = new Date(expiresAt).getTime()
  if (!Number.isFinite(expiresMs)) return false
  return expiresMs - Date.now() <= safetyWindowMs
}

function connectionNeedsSweep(connection, safetyWindowMs) {
  if (!connection || connection.status !== 'connected') return false
  if (!OAUTH_REFRESH_PLATFORMS.has(connection.platform)) return false
  if (connection.health === 'reauth_required') return false

  const provider = getProvider(connection.platform)
  if (!provider.supportsRefresh) return false

  const creds = credentialsFromConnection(connection)
  if (!creds.refresh_token_encrypted) return false

  return isNearExpiry(creds.expires_at, safetyWindowMs)
}

/**
 * Refresh OAuth tokens for connections within the safety window of expiry.
 * Idempotent: getFreshAccessToken dedupes concurrent refresh per connection.
 */
export async function sweepOAuthTokensNearExpiry(options = {}) {
  const {
    safetyWindowMs = REFRESH_SAFETY_WINDOW_MS,
    env = process.env,
    region = null,
    fetch: fetchFn = fetch,
    log = logger,
  } = options

  const allConnections = await findAll('marketplace_connections')
  const candidates = allConnections.filter((row) => connectionNeedsSweep(row, safetyWindowMs))

  const summary = {
    scanned: allConnections.length,
    candidates: candidates.length,
    refreshed: 0,
    failed: 0,
    skipped: 0,
  }

  for (const connection of candidates) {
    try {
      await getFreshAccessToken(connection, {
        env,
        region,
        fetch: fetchFn,
        safetyWindowMs,
      })
      summary.refreshed += 1
      log.info(
        {
          connectionId: connection.id,
          platform: connection.platform,
          agentId: connection.agent_id,
          agencyId: connection.agency_id,
        },
        'OAuth token refresh sweep succeeded',
      )
    } catch (err) {
      if (err?.code === 'REAUTH_REQUIRED') {
        summary.failed += 1
        log.warn(
          {
            connectionId: connection.id,
            platform: connection.platform,
            agentId: connection.agent_id,
            agencyId: connection.agency_id,
          },
          'OAuth token refresh sweep flagged reauth_required',
        )
      } else {
        summary.skipped += 1
        log.error(
          { err, connectionId: connection.id, platform: connection.platform },
          'OAuth token refresh sweep unexpected error',
        )
      }
    }
  }

  return summary
}

/** Startup + periodic refresh loop. Unref'd so it does not hold the process. */
export function startOAuthTokenRefreshJob({
  intervalMs = Number(process.env.WINGCASTER_OAUTH_TOKEN_REFRESH_INTERVAL_MS) || 60 * 60 * 1000,
  ...options
} = {}) {
  const tick = async () => {
    try {
      const summary = await sweepOAuthTokensNearExpiry(options)
      if (summary.candidates > 0) {
        logger.info(summary, 'OAuth token refresh sweep tick')
      }
    } catch (err) {
      logger.error({ err }, 'OAuth token refresh sweep tick failed')
    }
  }

  void tick()
  const handle = setInterval(tick, intervalMs)
  handle.unref?.()
  return handle
}
