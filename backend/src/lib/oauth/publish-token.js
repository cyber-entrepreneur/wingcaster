/**
 * Resolve a fresh OAuth access token for social publish (x/tiktok).
 */
import { getFreshAccessToken } from './token-store.js'

const OAUTH_PUBLISH_PLATFORMS = new Set(['x', 'tiktok'])

const REAUTH_MESSAGES = {
  x: 'X authorization has expired. Re-authorise in Settings → Channels.',
  tiktok: 'TikTok authorization has expired. Re-authorise in Settings → Channels.',
}

/**
 * @param {object} connection marketplace_connections row
 * @param {'x'|'tiktok'} platform
 * @param {object} [options] forwarded to getFreshAccessToken
 */
export async function resolveOAuthPublishAccessToken(connection, platform, options = {}) {
  if (!OAUTH_PUBLISH_PLATFORMS.has(platform)) {
    throw new Error(`resolveOAuthPublishAccessToken only supports x/tiktok, got ${platform}`)
  }

  try {
    return await getFreshAccessToken(connection, options)
  } catch (err) {
    if (err?.code === 'REAUTH_REQUIRED') {
      throw Object.assign(
        new Error(REAUTH_MESSAGES[platform] || 'OAuth authorization has expired. Re-authorise in Settings → Channels.'),
        { code: 'REAUTH_REQUIRED' },
      )
    }
    throw err
  }
}
