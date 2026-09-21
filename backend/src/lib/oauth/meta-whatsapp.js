/**
 * WhatsApp Embedded Signup via Meta OAuth — feature flag + scope helpers.
 */
import { getProvider, isOAuthProvider } from './provider-registry.js'
import { resolveAppCredential } from './app-credentials.js'

/** Dark-launch gate for WhatsApp OAuth / Embedded Signup connect. */
export function isWhatsAppOAuthConnectEnabled(env = process.env) {
  return env.WINGCASTER_WHATSAPP_OAUTH_CONNECT_ENABLED === 'true'
}

export const META_WHATSAPP_SCOPES = [
  'whatsapp_business_management',
  'whatsapp_business_messaging',
  'business_management',
]

export function isWhatsAppOAuthPlatform(platform) {
  return platform === 'whatsapp'
}

export function assertWhatsAppOAuthEnabled(env = process.env) {
  if (!isWhatsAppOAuthConnectEnabled(env)) {
    throw new Error('WhatsApp OAuth connect is not enabled in this environment')
  }
}

/**
 * OAuth scopes for a Meta-backed platform (facebook/instagram vs whatsapp).
 */
export function getMetaScopesForPlatform(platform) {
  if (platform === 'whatsapp') return [...META_WHATSAPP_SCOPES]
  return [...getProvider('meta').scopes]
}

/**
 * True when OAuth app credentials are configured for WhatsApp Embedded Signup.
 */
export function isWhatsAppOAuthConfigured(env = process.env) {
  if (!isWhatsAppOAuthConnectEnabled(env) || !isOAuthProvider('meta')) return false
  try {
    const creds = resolveAppCredential('meta', { env })
    return !creds.dev
  } catch {
    return false
  }
}
