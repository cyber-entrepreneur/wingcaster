/**
 * Feature flags for OAuth provider connect paths (dark-launch / rollback).
 */
import { isMetaOAuthConnectEnabled, isMetaOAuthPlatform } from './meta-oauth.js'

export function isLinkedInOAuthEnabled(env = process.env) {
  return env.WINGCASTER_LINKEDIN_OAUTH_ENABLED === 'true'
}

export function isOAuthConnectEnabled(platform, env = process.env) {
  if (platform === 'linkedin') return isLinkedInOAuthEnabled(env)
  if (platform === 'meta' || isMetaOAuthPlatform(platform)) {
    return isMetaOAuthConnectEnabled(env)
  }
  return true
}
