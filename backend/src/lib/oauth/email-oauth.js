/**
 * Email OAuth connect helpers — feature flags + platform/provider mapping.
 */
import { getProvider, isOAuthProvider } from './provider-registry.js'
import { resolveAppCredential } from './app-credentials.js'

export const EMAIL_OAUTH_PLATFORMS = new Set(['google', 'microsoft'])

export function isEmailOAuthPlatform(platform) {
  return EMAIL_OAUTH_PLATFORMS.has(platform)
}

/** Dark-launch gate for Google delegated mailbox connect. */
export function isGoogleEmailOAuthConnectEnabled(env = process.env) {
  return env.WINGCASTER_GOOGLE_EMAIL_OAUTH_CONNECT_ENABLED === 'true'
}

/** Dark-launch gate for Microsoft delegated mailbox connect. */
export function isMicrosoftEmailOAuthConnectEnabled(env = process.env) {
  return env.WINGCASTER_MICROSOFT_EMAIL_OAUTH_CONNECT_ENABLED === 'true'
}

export function isEmailOAuthConnectEnabled(platform, env = process.env) {
  if (platform === 'google') return isGoogleEmailOAuthConnectEnabled(env)
  if (platform === 'microsoft') return isMicrosoftEmailOAuthConnectEnabled(env)
  return false
}

export function assertEmailOAuthEnabled(platform, env = process.env) {
  if (!isEmailOAuthConnectEnabled(platform, env)) {
    throw new Error(`${platform} email OAuth connect is not enabled in this environment`)
  }
}

/**
 * True when the platform can start an OAuth mailbox connect flow.
 */
export function isEmailOAuthCapablePlatform(platform, env = process.env) {
  return isEmailOAuthPlatform(platform)
    && isEmailOAuthConnectEnabled(platform, env)
    && isOAuthProvider(platform)
}

/**
 * True when OAuth app credentials are configured for this email platform.
 */
export function isEmailPlatformOAuthConfigured(platform, env = process.env) {
  if (!isEmailOAuthCapablePlatform(platform, env)) return false
  try {
    const creds = resolveAppCredential(platform, { env })
    return !creds.dev
  } catch {
    return false
  }
}

export function getEmailOAuthProviderConfig(platform) {
  return getProvider(platform)
}
