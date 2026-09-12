/**
 * PA-PKG env scoping — LIVE/TEST catalogs must never co-mingle.
 */
import { normalizeClientEnv, toFinEnvironment, WINGCASTER_ENV_HEADER } from '../session-env.js'

export { WINGCASTER_ENV_HEADER }

export function resolvePackagesEnv(req) {
  const sessionRaw = req?.user?.fin_environment
    || req?.user?.environment
    || req?.user?.env
    || req?.finEnvironment
    || req?.sessionEnv
  if (sessionRaw != null && String(sessionRaw).trim() !== '') {
    return toFinEnvironment(sessionRaw)
  }
  const headerRaw = req?.get?.(WINGCASTER_ENV_HEADER)
    || req?.headers?.['x-wingcaster-env']
    || req?.headers?.['X-Wingcaster-Env']
  return toFinEnvironment(normalizeClientEnv(headerRaw || 'live'))
}

export function normalizePackagesEnv(value) {
  return toFinEnvironment(value)
}
