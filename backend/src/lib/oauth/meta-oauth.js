/**
 * Meta OAuth connect helpers — feature flag + platform/provider mapping.
 */
import { getProvider, isOAuthProvider } from './provider-registry.js'
import { resolveAppCredential } from './app-credentials.js'

/** Dark-launch gate for Meta OAuth connect (facebook + instagram). */
export function isMetaOAuthConnectEnabled(env = process.env) {
  return env.WINGCASTER_META_OAUTH_CONNECT_ENABLED === 'true'
}

/** Platforms that connect via the Meta OAuth provider. */
export const META_OAUTH_PLATFORMS = new Set(['facebook', 'instagram'])

export function isMetaOAuthPlatform(platform) {
  return META_OAUTH_PLATFORMS.has(platform)
}

/**
 * Map a social-channels platform to its OAuth provider key.
 * x/tiktok use themselves; facebook/instagram use meta.
 */
export function resolveOAuthProvider(platform) {
  if (isMetaOAuthPlatform(platform)) return 'meta'
  return platform
}

/**
 * True when the platform can start an OAuth connect flow.
 */
export function isOAuthCapablePlatform(platform, env = process.env) {
  if (platform === 'linkedin') {
    return env.WINGCASTER_LINKEDIN_OAUTH_ENABLED === 'true' && isOAuthProvider('linkedin')
  }
  if (isMetaOAuthPlatform(platform)) {
    return isMetaOAuthConnectEnabled(env) && isOAuthProvider('meta')
  }
  return isOAuthProvider(platform)
}

/**
 * True when OAuth app credentials are configured for this platform.
 */
export function isPlatformOAuthConfigured(platform, env = process.env) {
  if (!isOAuthCapablePlatform(platform, env)) return false
  try {
    const provider = resolveOAuthProvider(platform)
    const creds = resolveAppCredential(provider, { env })
    return !creds.dev
  } catch {
    return false
  }
}

export function assertMetaOAuthEnabled(env = process.env) {
  if (!isMetaOAuthConnectEnabled(env)) {
    throw new Error('Meta OAuth connect is not enabled in this environment')
  }
}

export function getMetaProviderConfig() {
  return getProvider('meta')
}
