/**
 * Explicit no-auth marker for public Express routes.
 *
 * Mount this (and ONLY this) auth-related middleware on routes that must
 * never require a session cookie / Bearer JWT. Callers still authenticate
 * via a signed purpose token in the path/body — that verification is the
 * route handler's job, not this middleware.
 *
 * The `.marker` property is a stable string greppable in audits and tests.
 */
export function publicNoAuth(_req, _res, next) {
  next()
}

publicNoAuth.marker = 'PUBLIC_NO_AUTH'
publicNoAuth.description = 'Public route — no session cookie; token-signed only'
