/**
 * Session environment helpers for PA LIVE/TEST mirroring.
 *
 * Client contract uses lowercase `live` | `test` (X-Wingcaster-Env).
 * Fin GUC / admin context still uses uppercase LIVE | TEST.
 */

export const WINGCASTER_ENV_HEADER = 'X-Wingcaster-Env'

export function normalizeClientEnv(value) {
  const raw = String(value || '').trim().toLowerCase()
  return raw === 'test' ? 'test' : 'live'
}

export function toFinEnvironment(clientEnv) {
  return normalizeClientEnv(clientEnv) === 'test' ? 'TEST' : 'LIVE'
}

export function fromAnyEnv(value) {
  if (value === 'TEST' || value === 'test') return 'test'
  return 'live'
}

/**
 * Resolve the env that should ride on the response for client mirroring.
 * Prefer the authenticated session claim; fall back to inbound header / default.
 */
export function resolveSessionEnv(req) {
  return normalizeClientEnv(
    req.user?.env
    || req.user?.fin_environment
    || req.user?.environment
    || req.sessionEnv
    || req.get?.(WINGCASTER_ENV_HEADER)
    || 'live',
  )
}

/**
 * Express middleware: stamp X-Wingcaster-Env on every response.
 * Auth middleware may later overwrite req.user.env from the JWT.
 */
export function wingcasterEnvMiddleware(req, res, next) {
  req.sessionEnv = normalizeClientEnv(req.get(WINGCASTER_ENV_HEADER) || 'live')

  const originalEnd = res.end
  res.end = function wingcasterEnvEnd(...args) {
    try {
      res.setHeader(WINGCASTER_ENV_HEADER, resolveSessionEnv(req))
    } catch {
      // Header may already be sent; ignore.
    }
    return originalEnd.apply(this, args)
  }

  next()
}
