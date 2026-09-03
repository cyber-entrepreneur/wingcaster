/**
 * Shared Express auth guards for platform-admin surfaces.
 */
import { findUserById } from '../identity.js'

/** DB-backed platform-admin check (JWT claim alone is not sufficient). */
export async function isPlatformAdmin(userId) {
  const user = await findUserById(userId)
  return user?.platform_role === 'platform_admin'
}

/** Require an authenticated platform admin (verified against the users table). */
export async function requirePlatformAdmin(req, res, next) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' })
    if (!(await isPlatformAdmin(req.user.id))) {
      return res.status(403).json({ error: 'Forbidden: platform admin required' })
    }
    next()
  } catch (err) {
    next(err)
  }
}
